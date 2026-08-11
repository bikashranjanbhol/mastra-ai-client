import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Moon, PanelLeft, PanelRight, Plus, Sun } from 'lucide-react';
import type { ThemeChoice } from '../types';
import { BrandMark } from './BrandMark';
import { listProviders } from '../lib/api/agents';
import { PROVIDERS, TIERS, type ProviderId, type Tier } from '../lib/api/config';
import type { BackendState } from '../hooks/useChat';

interface Props {
  backend: BackendState;
  provider?: ProviderId;
  onSelectProvider: (id: ProviderId | undefined) => void;
  tier: Tier;
  onSelectTier: (tier: Tier) => void;
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

const TIER_COPY: Record<Tier, { name: string; blurb: string }> = {
  fast: { name: 'Fast', blurb: 'Lowest latency, everyday questions' },
  flagship: { name: 'Flagship', blurb: 'The strongest model each provider ships' },
  reasoning: { name: 'Reasoning', blurb: 'Deliberate answers; falls back where unavailable' },
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
};

/**
 * Model picker.
 *
 * The service is provider-agnostic: an agent's model is resolved per request
 * from `provider` and `tier` on the request context. So this picks those two,
 * not a hardcoded model name — and it marks which providers the server
 * actually holds a key for, from GET /api/agents/providers.
 */
function ModelPicker({
  provider,
  onSelectProvider,
  tier,
  onSelectTier,
  disabled,
}: {
  provider?: ProviderId;
  onSelectProvider: (id: ProviderId | undefined) => void;
  tier: Tier;
  onSelectTier: (tier: Tier) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<Set<string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || connected || disabled) return;
    const controller = new AbortController();
    listProviders(controller.signal)
      .then((list) =>
        setConnected(new Set(list.filter((p) => p.connected).map((p) => p.id))),
      )
      .catch(() => setConnected(new Set()));
    return () => controller.abort();
  }, [open, connected, disabled]);

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

  const label = provider ? PROVIDER_LABEL[provider] : 'Auto';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-edge bg-raised py-1.5 pl-1.5 pr-3 text-[14px] font-bold text-ink shadow-raised transition-colors hover:bg-hover"
      >
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-pill bg-wash">
          <BrandMark size={15} tone="glyph" className="text-accent-text" />
        </span>
        {label}
        <span className="font-semibold text-muted">· {TIER_COPY[tier].name}</span>
        <ChevronDown aria-hidden="true" size={15} strokeWidth={2.25} className="text-muted" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Model selection"
          className="card absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden p-1"
        >
          <p className="label px-2.5 pb-1 pt-2 text-muted">Tier</p>
          <ul role="listbox" aria-label="Tier">
            {TIERS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option === tier}
                  onClick={() => onSelectTier(option)}
                  className="flex w-full items-start gap-2 rounded-ctl px-2.5 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-ink">
                      {TIER_COPY[option].name}
                    </span>
                    <span className="block meta text-muted">{TIER_COPY[option].blurb}</span>
                  </span>
                  {option === tier && (
                    <Check
                      aria-hidden="true"
                      size={15}
                      strokeWidth={2.5}
                      className="mt-0.5 shrink-0 text-accent"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <p className="label border-t border-edge px-2.5 pb-1 pt-3 text-muted">Provider</p>
          <ul role="listbox" aria-label="Provider">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={provider === undefined}
                onClick={() => onSelectProvider(undefined)}
                className="flex w-full items-center gap-2 rounded-ctl px-2.5 py-2 text-left transition-colors hover:bg-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-ink">Auto</span>
                  <span className="block meta text-muted">
                    Server&rsquo;s fallback chain, in order
                  </span>
                </span>
                {provider === undefined && (
                  <Check aria-hidden="true" size={15} strokeWidth={2.5} className="text-accent" />
                )}
              </button>
            </li>
            {PROVIDERS.map((id) => {
              const isConnected = connected?.has(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={provider === id}
                    onClick={() => onSelectProvider(id)}
                    className="flex w-full items-center gap-2 rounded-ctl px-2.5 py-1.5 text-left transition-colors hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1 text-[13.5px] text-ink">
                      {PROVIDER_LABEL[id]}
                    </span>
                    {connected && (
                      <span
                        className={`meta ${isConnected ? 'text-success' : 'text-muted'}`}
                        title={
                          isConnected
                            ? 'The server holds a key for this provider'
                            : 'No API key configured on the server'
                        }
                      >
                        {isConnected ? 'key set' : 'no key'}
                      </span>
                    )}
                    {provider === id && (
                      <Check aria-hidden="true" size={15} strokeWidth={2.5} className="text-accent" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Connection state, stated plainly rather than hidden behind a spinner. */
function ConnectionBadge({ backend }: { backend: BackendState }) {
  if (backend.status === 'live') {
    return (
      <span className="hidden items-center gap-1.5 meta text-muted sm:flex" title={backend.agentId}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-success" />
        {backend.agentName}
      </span>
    );
  }
  if (backend.status === 'connecting') {
    return (
      <span className="hidden items-center gap-1.5 meta text-muted sm:flex">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-edge-strong" />
        Connecting…
      </span>
    );
  }
  return (
    <span
      className="hidden items-center gap-1.5 meta text-danger sm:flex"
      title={backend.reason}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-danger" />
      Offline · simulated
    </span>
  );
}

/** The bar across the top of the main card: model on the left, actions right. */
export function ChatHeader({
  backend,
  provider,
  onSelectProvider,
  tier,
  onSelectTier,
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

      <ModelPicker
        provider={provider}
        onSelectProvider={onSelectProvider}
        tier={tier}
        onSelectTier={onSelectTier}
        disabled={backend.status !== 'live'}
      />

      <ConnectionBadge backend={backend} />

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
