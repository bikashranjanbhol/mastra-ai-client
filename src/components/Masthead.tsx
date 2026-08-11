import { Monitor, Moon, PanelLeft, Sun } from 'lucide-react';
import type { Conversation, ThemeChoice } from '../types';
import { plural, relativeDay } from '../lib/format';

interface Props {
  conversation: Conversation;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  theme: ThemeChoice;
  resolved: 'light' | 'dark';
  onCycleTheme: () => void;
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const THEME_LABEL = {
  system: 'following system',
  light: 'light',
  dark: 'dark',
} as const;

/** Running head: the strip that names the page you are on. */
export function Masthead({
  conversation,
  onToggleSidebar,
  sidebarOpen,
  theme,
  resolved,
  onCycleTheme,
}: Props) {
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-edge px-4 py-2.5 min-[900px]:px-8">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="index-panel"
        title="Toggle index (⌘B)"
        className="rounded-ctl border border-edge p-1.5 text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <PanelLeft aria-hidden="true" size={14} strokeWidth={1.75} />
        <span className="sr-only-text">{sidebarOpen ? 'Hide index' : 'Show index'}</span>
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-[1.05rem] leading-tight text-ink">
          {conversation.title}
        </h2>
        <p className="font-mono text-[11px] tracking-[0.08em] text-muted">
          {plural(conversation.messages.length, 'turn')} · edited {relativeDay(conversation.updatedAt)}
        </p>
      </div>

      <button
        type="button"
        onClick={onCycleTheme}
        className="flex items-center gap-2 rounded-ctl border border-edge px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <ThemeIcon aria-hidden="true" size={13} strokeWidth={1.75} />
        <span className="hidden sm:inline">{theme === 'system' ? `auto · ${resolved}` : theme}</span>
        <span className="sr-only-text">
          Appearance: {THEME_LABEL[theme]}. Activate to change.
        </span>
      </button>
    </header>
  );
}
