import { useEffect, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export function ReeViewMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims =
    size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-9 w-9 rounded-xl';

  return (
    <span
      className={`relative inline-flex ${dims} items-center justify-center bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500 text-white shadow-sm ring-1 ring-white/20 shrink-0`}
      aria-hidden="true"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
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
      ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm ring-1 ring-indigo-400/30 disabled:bg-slate-800 disabled:text-slate-500 disabled:ring-white/5'
      : variant === 'secondary'
        ? 'bg-slate-900/90 text-slate-100 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-50'
        : variant === 'danger'
          ? 'bg-red-950/80 text-red-200 border border-red-500/35 hover:bg-red-900/80 hover:text-white disabled:opacity-50'
          : 'bg-transparent text-slate-300 hover:bg-white/6 hover:text-white disabled:opacity-50';

  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B14] ${sizeClass} ${variantClass} ${className}`}
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${toneClass} ${className}`}
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
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="h-2 w-full rounded-full bg-slate-800/90 overflow-hidden ring-1 ring-white/5"
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? value : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${colorClass}`}
        style={{ width: `${pct}%` }}
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
  const isError = tone === 'error';
  const isStacked = actionLayout === 'stacked';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3.5 flex flex-col ${
        isStacked ? 'gap-3' : 'sm:flex-row sm:items-start justify-between gap-3'
      } ${
        isError
          ? 'bg-red-950/75 border-red-500/40 text-red-100'
          : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-100'
      }`}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        )}
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
    </div>
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
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <ElevatedGlassPanel className="relative z-10 w-full max-w-md p-6 rv-animate-in">
        <div className="flex items-start justify-between gap-3">
          <h2 id="rv-modal-title" className="font-display text-lg font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>
      </ElevatedGlassPanel>
    </div>
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
  return (
    <div className="py-16 px-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/90 border border-slate-700/70 text-indigo-400">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-base font-semibold text-white">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 space-y-3 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-slate-800" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`h-3 rounded bg-slate-800/80 ${idx === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
