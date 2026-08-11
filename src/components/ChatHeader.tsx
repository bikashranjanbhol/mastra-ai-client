import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Moon, PanelLeft, PanelRight, Plus, Sun } from 'lucide-react';
import type { ThemeChoice } from '../types';
import { BrandMark } from './BrandMark';
import { MODELS } from '../brand';

interface Props {
  modelId: string;
  onSelectModel: (id: string) => void;
  onNewChat: () => void;
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
const THEME_LABEL = { system: 'following system', light: 'light', dark: 'dark' } as const;

/** Model picker — a listbox in a popover, closed on Escape or outside click. */
function ModelPicker({ modelId, onSelect }: { modelId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === modelId) ?? MODELS[0];

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-edge bg-raised py-1.5 pl-1.5 pr-3 text-[14px] font-bold text-ink shadow-raised transition-colors hover:bg-hover"
      >
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-pill bg-wash">
          <BrandMark size={15} tone="glyph" className="text-accent-text" />
        </span>
        {current.name}
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2.25} className="text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Model"
          className="card absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden p-1"
        >
          {MODELS.map((model) => {
            const selected = model.id === modelId;
            return (
              <li key={model.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(model.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-ctl px-2.5 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-ink">{model.name}</span>
                    <span className="block meta text-muted">{model.blurb}</span>
                  </span>
                  {selected && (
                    <Check
                      aria-hidden="true"
                      size={15}
                      strokeWidth={2.5}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The bar across the top of the main card: model on the left, actions right. */
export function ChatHeader({
  modelId,
  onSelectModel,
  onNewChat,
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
    <div className="flex shrink-0 items-center gap-2 px-4 py-3 md:px-5">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="chat-list-panel"
        title="Toggle chat list (⌘B)"
        className="icon-btn"
      >
        <PanelLeft aria-hidden="true" size={16} strokeWidth={2} />
        <span className="sr-only-text">{sidebarOpen ? 'Hide chat list' : 'Show chat list'}</span>
      </button>

      <ModelPicker modelId={modelId} onSelect={onSelectModel} />

      <div className="flex-1" />

      <button type="button" onClick={onCycleTheme} className="icon-btn">
        <ThemeIcon aria-hidden="true" size={16} strokeWidth={2} />
        <span className="sr-only-text">
          Appearance: {THEME_LABEL[theme]}, currently {resolved}. Activate to change.
        </span>
      </button>

      {showPanelToggle && (
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="context-panel"
          title="Toggle details panel (⌘J)"
          className="icon-btn"
        >
          <PanelRight aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only-text">
            {panelOpen ? 'Hide details panel' : 'Show details panel'}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onNewChat}
        title="New chat (⌘⇧O)"
        className="btn bg-ink text-raised hover:opacity-90"
      >
        <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
        New Chat
      </button>
    </div>
  );
}
