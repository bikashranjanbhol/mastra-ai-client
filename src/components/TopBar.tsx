import { Monitor, Moon, PanelLeft, PanelRight, Sun } from 'lucide-react';
import type { ThemeChoice } from '../types';
import { BrandMark } from './BrandMark';
import { BRAND } from '../brand';

interface Props {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onTogglePanel: () => void;
  panelOpen: boolean;
  showPanelToggle: boolean;
  theme: ThemeChoice;
  resolved: 'light' | 'dark';
  onCycleTheme: () => void;
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const THEME_TEXT = { system: 'Auto', light: 'Light', dark: 'Dark' } as const;
const THEME_LABEL = { system: 'following system', light: 'light', dark: 'dark' } as const;

/**
 * The application bar. This is where the brand lives — a full-width blue band
 * across the top, which is what makes the product recognisable at a glance
 * rather than leaving the colour to sit on a couple of buttons.
 */
export function TopBar({
  onToggleSidebar,
  sidebarOpen,
  onTogglePanel,
  panelOpen,
  showPanelToggle,
  theme,
  resolved,
  onCycleTheme,
}: Props) {
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-bar-edge bg-bar px-3 text-bar-ink">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="chat-list-panel"
        title="Toggle chat list (⌘B)"
        className="icon-btn text-bar-muted hover:bg-bar-hover hover:text-bar-ink"
      >
        <PanelLeft aria-hidden="true" size={16} strokeWidth={2} />
        <span className="sr-only-text">{sidebarOpen ? 'Hide chat list' : 'Show chat list'}</span>
      </button>

      <div className="flex min-w-0 items-center gap-2 pl-1">
        <BrandMark size={24} />
        <span className="truncate text-[15px] font-bold tracking-tight">{BRAND.productName}</span>
        <span className="hidden rounded-pill bg-bar-hover px-2 py-0.5 text-[11px] font-bold text-bar-ink sm:inline">
          Internal
        </span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onCycleTheme}
        className="btn btn-sm text-bar-muted hover:bg-bar-hover hover:text-bar-ink"
      >
        <ThemeIcon aria-hidden="true" size={14} strokeWidth={2} />
        <span className="hidden sm:inline">
          {theme === 'system' ? `Auto · ${THEME_TEXT[resolved]}` : THEME_TEXT[theme]}
        </span>
        <span className="sr-only-text">Appearance: {THEME_LABEL[theme]}. Activate to change.</span>
      </button>

      {showPanelToggle && (
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="context-panel"
          title="Toggle details panel (⌘J)"
          className="icon-btn text-bar-muted hover:bg-bar-hover hover:text-bar-ink"
        >
          <PanelRight aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only-text">
            {panelOpen ? 'Hide details panel' : 'Show details panel'}
          </span>
        </button>
      )}
    </header>
  );
}
