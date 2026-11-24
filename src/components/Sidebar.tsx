import { BookOpen, Clock, Film, LogOut, Settings, X } from 'lucide-react';
import type { AuthUser } from '../types/auth.ts';
import type { ReelEvaluation } from '../types/evaluation.ts';
import { ReeViewMark } from './ui/GlassPrimitives.tsx';

export type ActiveTab = 'evaluator' | 'history' | 'methodology' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  history: ReelEvaluation[];
  activeEvaluationId: string | null;
  onSelectHistoryItem: (evaluation: ReelEvaluation) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: AuthUser;
  onLogout: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  history,
  activeEvaluationId,
  onSelectHistoryItem,
  mobileOpen,
  onCloseMobile,
  user,
  onLogout,
}: SidebarProps) {
  const navItems: { id: ActiveTab; label: string; icon: typeof Film; count?: number }[] = [
    { id: 'evaluator', label: 'Video Evaluator', icon: Film },
    { id: 'history', label: 'Evaluation History', icon: Clock, count: history.length },
    { id: 'methodology', label: 'Scoring Rubric', icon: BookOpen },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col rv-glass-nav border-r">
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            onSelectTab('evaluator');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg"
        >
          <ReeViewMark size="sm" />
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            ReeView
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Primary navigation" className="p-3.5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isActive
                  ? 'bg-indigo-500/20 text-white border border-indigo-400/30 shadow-xs'
                  : 'text-slate-300 border border-transparent hover:bg-white/6 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono text-xs tabular-nums text-slate-300 bg-white/8 px-1.5 py-0.5 rounded-md">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-3.5 py-3 border-t border-white/8">
        <div className="px-2 pb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400">Recent Evaluations</h2>
        </div>

        {history.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500 leading-relaxed">
            Analyzed Reels will appear here for quick comparison and report export.
          </p>
        ) : (
          <ul className="space-y-1">
            {history.slice(0, 8).map((item) => {
              const selected = activeEvaluationId === item.id && activeTab === 'evaluator';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectHistoryItem(item);
                      onCloseMobile();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      selected
                        ? 'bg-white/10 text-white border border-white/15'
                        : 'text-slate-300 border border-transparent hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">
                        {item.videoMetadata.fileName}
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-indigo-300 shrink-0">
                        {item.overallScore.toFixed(2)}/20
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                      <span className="truncate">{item.context.targetPersona}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-3.5 border-t border-white/10 bg-slate-950/50">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectTab('settings');
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full border border-white/20 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="h-8 w-8 rounded-full bg-indigo-500/25 border border-indigo-400/35 text-indigo-200 font-display text-xs font-bold flex items-center justify-center shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                {user.name}
              </span>
              <span className="block text-[11px] text-slate-400 truncate">{user.email}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[268px] shrink-0 h-screen sticky top-0 no-print">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
