import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import type {
  ApiErrorPayload,
  CampaignObjective,
  TargetUserPersona,
} from './src/types/evaluation.ts';
import {
  MAX_VIDEO_SIZE_BYTES,
  resolveVideoMimeType,
  validateVideoMetadata,
} from './src/utils/evaluationLogic.ts';
import {
  GEMINI_FREE_TIER_MODEL,
  GeminiServiceError,
  evaluateReelWithGemini,
} from './src/server/geminiService.ts';

const PORT = Number(process.env.PORT) || 3000;
const UPLOAD_TEMP_DIR = path.resolve(os.tmpdir(), 'reelsevaluator-uploads');

if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.mp4', '.webm', '.mov', '.m4v', '.mpeg', '.mpg'].includes(ext)
      ? ext
      : '.mp4';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
    files: 1,
  },
});

const VALID_PERSONAS: TargetUserPersona[] = [
  'General Audience',
  'Gen Z Consumers',
  'Business Owners',
  'Social Media Content Creators',
  'Marketing Professionals',
];

const VALID_OBJECTIVES: CampaignObjective[] = [
  'Brand Awareness',
  'Product Conversion',
  'Community Engagement',
  'Educational Authority',
];

async function removeTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_TEMP_DIR + path.sep)) {
    return;
  }
  try {
    await fs.promises.unlink(resolved);
  } catch {
    // Ignore already-deleted temp files
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      model: GEMINI_FREE_TIER_MODEL,
      apiKeyConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
    });
  });

  app.post('/api/evaluate', (req, res) => {
    upload.single('video')(req, res, async (multerErr) => {
      if (multerErr) {
        if (multerErr instanceof multer.MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
          const payload: ApiErrorPayload = {
            error: {
              code: 'FILE_TOO_LARGE',
              message:
                'Uploaded video exceeds the 45 MB limit optimized for Google Gemini Free Tier analysis.',
            },
          };
          res.status(413).json(payload);
          return;
        }
        const payload: ApiErrorPayload = {
          error: {
            code: 'INVALID_FILE',
            message: multerErr.message || 'Could not process uploaded video file.',
          },
        };
        res.status(400).json(payload);
        return;
      }

      const file = req.file;
      if (!file) {
        const payload: ApiErrorPayload = {
          error: {
            code: 'INVALID_FILE',
            message: 'No video file was uploaded. Please select an MP4, WebM, or MOV video.',
          },
        };
        res.status(400).json(payload);
        return;
      }

      try {
        const validation = validateVideoMetadata({
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
        });

        if (!validation.valid) {
          const status = validation.errorCode === 'FILE_TOO_LARGE' ? 413 : 415;
          const payload: ApiErrorPayload = {
            error: {
              code: validation.errorCode || 'UNSUPPORTED_VIDEO',
              message: validation.errorMessage || 'Unsupported video file.',
            },
          };
          res.status(status).json(payload);
          return;
        }

        const rawPersona = String(req.body?.targetPersona || 'General Audience');
        const targetPersona = VALID_PERSONAS.includes(rawPersona as TargetUserPersona)
          ? (rawPersona as TargetUserPersona)
          : 'General Audience';

        const rawObjective = String(req.body?.campaignObjective || 'Brand Awareness');
        const campaignObjective = VALID_OBJECTIVES.includes(rawObjective as CampaignObjective)
          ? (rawObjective as CampaignObjective)
          : 'Brand Awareness';

        const brandContext =
          typeof req.body?.brandContext === 'string'
            ? req.body.brandContext.trim().slice(0, 300)
            : undefined;

        const durationSecondsRaw = Number(req.body?.durationSeconds);
        const widthRaw = Number(req.body?.width);
        const heightRaw = Number(req.body?.height);

        const canonicalMime = resolveVideoMimeType(file.originalname, file.mimetype);

        const evaluation = await evaluateReelWithGemini({
          filePath: file.path,
          videoMetadata: {
            fileName: file.originalname.slice(0, 180),
            fileSizeBytes: file.size,
            mimeType: canonicalMime,
            durationSeconds:
              Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
                ? durationSecondsRaw
                : undefined,
            width: Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : undefined,
            height: Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : undefined,
          },
          context: {
            targetPersona,
            campaignObjective,
            brandContext: brandContext || undefined,
          },
        });

        res.json({ evaluation });
      } catch (err) {
        if (err instanceof GeminiServiceError) {
          const payload: ApiErrorPayload = {
            error: {
              code: err.errorCode,
              message: err.message,
              retryAfterSeconds: err.retryAfterSeconds,
            },
          };
          res.status(err.statusCode).json(payload);
          return;
        }

        const payload: ApiErrorPayload = {
          error: {
            code: 'ANALYSIS_FAILED',
            message:
              err instanceof Error
                ? err.message
                : 'Unexpected server error while analyzing video.',
          },
        };
        res.status(500).json(payload);
      } finally {
        await removeTempFile(file.path);
      }
    });
  });

  app.use('/api', (_req, res) => {
    const payload: ApiErrorPayload = {
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'API route not found.',
      },
    };
    res.status(404).json(payload);
  });

  app.use(
    '/api',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const payload: ApiErrorPayload = {
        error: {
          code: 'ANALYSIS_FAILED',
          message:
            err instanceof Error
              ? err.message
              : 'Unexpected server error while handling evaluation request.',
        },
      };
      res.status(500).json(payload);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReelsEvaluator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
