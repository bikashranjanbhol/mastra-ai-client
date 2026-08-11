import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft, Plus } from 'lucide-react';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/Sidebar';
import { Masthead } from './components/Masthead';
import { Transcript } from './components/Transcript';
import { Composer, type ComposerHandle } from './components/Composer';

const DESKTOP = '(min-width: 900px)';

export default function App() {
  const chat = useChat();
  const theme = useTheme();

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches,
  );
  const [railOpen, setRailOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleIndex = useCallback(() => {
    if (window.matchMedia(DESKTOP).matches) setRailOpen((v) => !v);
    else setDrawerOpen((v) => !v);
  }, []);

  const focusSearch = useCallback(() => {
    if (!window.matchMedia(DESKTOP).matches) setDrawerOpen(true);
    else setRailOpen(true);
    // Wait a frame so the panel exists before the focus call lands.
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const startNew = useCallback(() => {
    chat.newConversation();
    setDrawerOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [chat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleIndex();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        startNew();
        return;
      }
      if (e.key === 'Escape') {
        if (chat.isGenerating) {
          e.preventDefault();
          chat.stop();
        } else if (drawerOpen) {
          setDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chat, drawerOpen, focusSearch, startNew, toggleIndex]);

  // Move focus into the drawer when it opens; return it to the page when it shuts.
  useEffect(() => {
    if (!drawerOpen) return;
    const node = drawerRef.current;
    const first = node?.querySelector<HTMLElement>('button, input, a[href]');
    first?.focus();
  }, [drawerOpen]);

  const active = chat.active;

  const sidebar = (
    <Sidebar
      conversations={chat.conversations}
      activeId={chat.activeId}
      onSelect={(id) => {
        chat.setActiveId(id);
        setDrawerOpen(false);
      }}
      onNew={startNew}
      onRename={chat.renameConversation}
      onDelete={chat.deleteConversation}
      searchRef={searchRef}
      faultArmed={chat.faultArmed}
      onToggleFault={() => chat.setFaultArmed(!chat.faultArmed)}
    />
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface">
      <a
        href="#composer"
        className="sr-only-text focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-on-accent"
      >
        Skip to composer
      </a>

      {/* ------------------------------------------------- desktop index rail */}
      {isDesktop &&
        (railOpen ? (
          <aside
            id="index-panel"
            aria-label="Chat list"
            className="w-[17rem] shrink-0 border-r border-edge"
          >
            {sidebar}
          </aside>
        ) : (
          <aside
            aria-label="Chat list, collapsed"
            className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-edge py-3"
          >
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              title="Show chat list (⌘B)"
              className="rounded-pill border border-edge p-2 text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <PanelLeft aria-hidden="true" size={14} strokeWidth={1.75} />
              <span className="sr-only-text">Show chat list</span>
            </button>
            <button
              type="button"
              onClick={startNew}
              title="New chat (⌘⇧O)"
              className="rounded-pill bg-accent p-2 text-on-accent transition-colors hover:bg-accent-text"
            >
              <Plus aria-hidden="true" size={14} strokeWidth={2} />
              <span className="sr-only-text">New chat</span>
            </button>
            <span
              className="mt-2 label text-muted"
              style={{ writingMode: 'vertical-rl' }}
            >
              Chats · {chat.conversations.length}
            </span>
          </aside>
        ))}

      {/* --------------------------------------------------------- the sheet */}
      {/* The sheet is left-aligned and bounded rather than centred: past ~64rem
          the surplus stays visible as desk, which is what keeps the transcript
          reading as a page rather than a centred feed. */}
      <main className="flex min-w-0 flex-1 justify-start bg-surface">
        {active && (
          <div className="flex w-full min-w-0 max-w-[64rem] flex-col border-edge bg-raised min-[1200px]:border-r">
            <Masthead
              conversation={active}
              onToggleSidebar={toggleIndex}
              sidebarOpen={isDesktop ? railOpen : drawerOpen}
              theme={theme.choice}
              resolved={theme.resolved}
              onCycleTheme={theme.cycle}
            />

            <Transcript
              conversation={active}
              busy={chat.isGenerating}
              onSend={(text) => chat.send(text)}
              onRegenerate={chat.regenerate}
              onEditSubmit={chat.editAndResend}
              onRetry={chat.retry}
            />

            <Composer
              busy={chat.isGenerating}
              onSend={chat.send}
              onStop={chat.stop}
              handleRef={composerRef}
            />
          </div>
        )}
      </main>

      {/* --------------------------------------------------- mobile drawer */}
      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close chat list"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div
            ref={drawerRef}
            id="index-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Chat list"
            className="relative z-10 h-full w-[84vw] max-w-[20rem] border-r border-edge-strong"
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
                'button, input, a[href], [tabindex]:not([tabindex="-1"])',
              );
              if (!focusables?.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }}
          >
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
