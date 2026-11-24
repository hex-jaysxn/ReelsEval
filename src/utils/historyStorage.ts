import type { ReelEvaluation } from '../types/evaluation.ts';

const HISTORY_STORAGE_KEY = 'reelsevaluator_history_v2';
const MAX_HISTORY_ITEMS = 30;

export function loadEvaluationHistory(): ReelEvaluation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ReelEvaluation =>
        Boolean(
          item &&
            item.schemaVersion === 2 &&
            typeof item.id === 'string' &&
            typeof item.overallScore === 'number' &&
            item.variables
        )
    );
  } catch {
    return [];
  }
}

export function saveEvaluationToHistory(evaluation: ReelEvaluation): ReelEvaluation[] {
  const existing = loadEvaluationHistory().filter((item) => item.id !== evaluation.id);
  const next = [evaluation, ...existing].slice(0, MAX_HISTORY_ITEMS);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function deleteEvaluationFromHistory(id: string): ReelEvaluation[] {
  const next = loadEvaluationHistory().filter((item) => item.id !== id);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function clearEvaluationHistory(): ReelEvaluation[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  return [];
}
