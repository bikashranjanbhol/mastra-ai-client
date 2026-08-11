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
const THEME_TEXT = { system: 'Auto', light: 'Light', dark: 'Dark' } as const;
const THEME_LABEL = {
  system: 'following system',
  light: 'light',
  dark: 'dark',
} as const;

/** The strip that names the chat you are in. */
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
        title="Toggle chat list (⌘B)"
        className="rounded-pill border border-edge p-2 text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <PanelLeft aria-hidden="true" size={14} strokeWidth={1.75} />
        <span className="sr-only-text">{sidebarOpen ? 'Hide chat list' : 'Show chat list'}</span>
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[1.05rem] font-bold leading-tight text-ink">
          {conversation.title}
        </h2>
        <p className="meta text-muted">
          {plural(conversation.messages.length, 'message')} · updated {relativeDay(conversation.updatedAt)}
        </p>
      </div>

      <button
        type="button"
        onClick={onCycleTheme}
        className="btn btn-quiet"
      >
        <ThemeIcon aria-hidden="true" size={13} strokeWidth={1.75} />
        <span className="hidden sm:inline">
          {theme === 'system' ? `Auto · ${THEME_TEXT[resolved]}` : THEME_TEXT[theme]}
        </span>
        <span className="sr-only-text">
          Appearance: {THEME_LABEL[theme]}. Activate to change.
        </span>
      </button>
    </header>
  );
}
