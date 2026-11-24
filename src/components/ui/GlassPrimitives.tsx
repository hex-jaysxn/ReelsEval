import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { RV_EASE, RV_SPRING_TACTILE, useMotionProfile } from './MotionPrimitives.tsx';

export function ReeViewMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims =
    size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-9 w-9 rounded-xl';

  return (
    <span
      className={`relative inline-flex ${dims} items-center justify-center bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500 text-white shadow-sm ring-1 ring-white/20 shrink-0 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:rotate-3 group-active:scale-95`}
      aria-hidden="true"
    >
      <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-[0.5px]" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 5.5L18.5 12L7 18.5V5.5Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
      </svg>
    </span>
  );
}

interface PanelProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
  ariaLabel?: string;
}

export function GlassPanel({
  children,
  className = '',
  as: Tag = 'div',
  ariaLabel,
}: PanelProps) {
  return (
    <Tag aria-label={ariaLabel} className={`rv-glass-primary rounded-2xl ${className}`}>
      {children}
    </Tag>
  );
}

export function ElevatedGlassPanel({
  children,
  className = '',
  as: Tag = 'div',
  ariaLabel,
}: PanelProps) {
  return (
    <Tag aria-label={ariaLabel} className={`rv-glass-elevated rounded-2xl ${className}`}>
      {children}
    </Tag>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ActionButtonProps) {
  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs min-h-[34px]'
      : size === 'lg'
        ? 'px-5 py-3 text-sm min-h-[46px]'
        : 'px-4 py-2.5 text-sm min-h-[42px]';

  const variantClass =
    variant === 'primary'
      ? 'rv-btn-sheen bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm hover:shadow-lg hover:shadow-indigo-500/25 ring-1 ring-indigo-400/35 hover:ring-indigo-300/60 disabled:bg-slate-800 disabled:text-slate-500 disabled:ring-white/5 disabled:hover:translate-y-0 disabled:active:scale-100'
      : variant === 'secondary'
        ? 'bg-slate-900/90 text-slate-100 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-500/80 hover:shadow-md hover:shadow-slate-950/50 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100'
        : variant === 'danger'
          ? 'bg-red-950/80 text-red-200 border border-red-500/35 hover:bg-red-900/85 hover:text-white hover:border-red-400/55 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100'
          : 'bg-transparent text-slate-300 hover:bg-white/8 hover:text-white disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100';

  return (
    <button
      {...rest}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-180 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B14] ${sizeClass} ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

interface StatusBadgeProps {
  tone: 'positive' | 'moderate' | 'caution' | 'critical' | 'neutral';
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className = '' }: StatusBadgeProps) {
  const toneClass =
    tone === 'positive'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : tone === 'moderate'
        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
        : tone === 'caution'
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : tone === 'critical'
            ? 'bg-red-500/15 text-red-300 border-red-500/30'
            : 'bg-slate-800/80 text-slate-300 border-slate-700';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap transition-colors duration-150 ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  colorClass?: string;
  label?: string;
}

export function ProgressBar({
  value,
  max = 5,
  colorClass = 'bg-indigo-500',
  label,
}: ProgressBarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const isInView = useInView(ref, { once: true, amount: 0.25 });
  const isReduced = profile.tier === 'reduced';
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      ref={ref}
      className="h-2 w-full rounded-full bg-slate-800/90 overflow-hidden ring-1 ring-white/5"
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? value : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
    >
      <motion.div
        initial={isReduced ? { width: `${pct}%` } : { width: 0 }}
        animate={isInView || isReduced ? { width: `${pct}%` } : { width: 0 }}
        transition={{
          duration: isReduced ? 0.01 : 0.65 * profile.durationScale,
          ease: RV_EASE,
        }}
        className={`h-full rounded-full ${colorClass}`}
      />
    </div>
  );
}

interface AlertBannerProps {
  tone: 'error' | 'success';
  title?: string;
  message: string;
  detail?: string;
  action?: ReactNode;
  actionLayout?: 'inline' | 'stacked';
}

export function AlertBanner({
  tone,
  title,
  message,
  detail,
  action,
  actionLayout = 'inline',
}: AlertBannerProps) {
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const isError = tone === 'error';
  const isStacked = actionLayout === 'stacked';
  return (
    <motion.div
      role={isError ? 'alert' : 'status'}
      initial={
        isReduced
          ? { opacity: 1 }
          : { opacity: 0, x: 12 * profile.distanceScale, y: -4 * profile.distanceScale, scale: 0.985 }
      }
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={
        isReduced
          ? { opacity: 0 }
          : { opacity: 0, x: -10 * profile.distanceScale, scale: 0.985 }
      }
      transition={{ duration: isReduced ? 0.01 : 0.24 * profile.durationScale, ease: RV_EASE }}
      className={`relative overflow-hidden rounded-xl border px-4 py-3.5 flex flex-col ${
        isStacked ? 'gap-3' : 'sm:flex-row sm:items-start justify-between gap-3'
      } ${
        isError
          ? 'bg-red-950/75 border-red-500/40 text-red-100'
          : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <motion.span
          initial={isReduced ? { scale: 1 } : { scale: 0.6, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={isReduced ? { duration: 0.01 } : RV_SPRING_TACTILE}
          className="inline-flex shrink-0 mt-0.5"
        >
          {isError ? (
            <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          )}
        </motion.span>
        <div className="min-w-0">
          {title && (
            <h2 className="font-display text-sm font-semibold text-white">{title}</h2>
          )}
          <p className={`text-sm leading-relaxed ${title ? 'mt-0.5 text-red-200' : ''}`}>
            {message}
          </p>
          {detail && (
            <p className="mt-1 text-xs text-red-300/90 tabular-nums">{detail}</p>
          )}
        </div>
      </div>
      {action && <div className={isStacked ? 'pl-7' : 'shrink-0'}>{action}</div>}
      {!isReduced && (
        <motion.span
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.55 * profile.durationScale, ease: RV_EASE }}
          style={{ transformOrigin: '0% 50%' }}
          className={`pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] ${
            isError
              ? 'bg-gradient-to-r from-red-500/80 via-amber-400/50 to-transparent'
              : 'bg-gradient-to-r from-emerald-400/80 via-teal-300/50 to-transparent'
          }`}
        />
      )}
    </motion.div>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  footer: ReactNode;
}

export function Modal({ open, title, description, onClose, footer }: ModalProps) {
  const profile = useMotionProfile();
  const reduced = profile.tier === 'reduced';

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rv-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.18, ease: 'easeOut' }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: reduced ? 0.01 : 0.2, ease: RV_EASE }}
            className="relative z-10 w-full max-w-md"
          >
            <ElevatedGlassPanel className="w-full p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 id="rv-modal-title" className="font-display text-lg font-bold text-white">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">{description}</p>
              <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>
            </ElevatedGlassPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const profile = useMotionProfile();
  const reduced = profile.tier === 'reduced';
  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 * profile.distanceScale }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.3 * profile.durationScale, ease: RV_EASE }}
      className="py-16 px-4 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/90 border border-slate-700/70 text-indigo-400 shadow-inner">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-base font-semibold text-white">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </motion.div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 space-y-3 rv-skeleton-shimmer">
      <div className="h-4 w-1/3 rounded bg-slate-800/90" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`h-3 rounded bg-slate-800/70 ${idx === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

