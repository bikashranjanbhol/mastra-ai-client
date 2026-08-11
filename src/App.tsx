import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { Masthead } from './components/Masthead';
import { Transcript, type TranscriptHandle } from './components/Transcript';
import { Composer, type ComposerHandle } from './components/Composer';
import { ContextPanel } from './components/ContextPanel';
import { WelcomeHero } from './components/WelcomeHero';

const DESKTOP = '(min-width: 900px)';
/** Below this the context panel is hidden entirely rather than squeezed. */
const WIDE = '(min-width: 1280px)';

export default function App() {
  const chat = useChat();
  const theme = useTheme();

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches,
  );
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(WIDE).matches,
  );
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const transcriptRef = useRef<TranscriptHandle>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    const wide = window.matchMedia(WIDE);
    const onDesktop = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setDrawerOpen(false);
    };
    const onWide = (e: MediaQueryListEvent) => setIsWide(e.matches);
    desktop.addEventListener('change', onDesktop);
    wide.addEventListener('change', onWide);
    return () => {
      desktop.removeEventListener('change', onDesktop);
      wide.removeEventListener('change', onWide);
    };
  }, []);

  const toggleIndex = useCallback(() => {
    if (window.matchMedia(DESKTOP).matches) setRailOpen((v) => !v);
    else setDrawerOpen((v) => !v);
  }, []);

  const focusSearch = useCallback(() => {
    if (!window.matchMedia(DESKTOP).matches) setDrawerOpen(true);
    else setRailOpen(true);
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
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setPanelOpen((v) => !v);
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

  useEffect(() => {
    if (!drawerOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>('button, input, a[href]');
    first?.focus();
  }, [drawerOpen]);

  const active = chat.active;
  const isEmpty = !active || active.messages.length === 0;
  // The welcome state matches the reference exactly: no side panel, nothing
  // competing with the greeting.
  const showPanel = isWide && panelOpen && !isEmpty;

  const sidebar = (
    <Sidebar
      conversations={chat.conversations}
      activeId={chat.activeId}
      onSelect={(id) => {
        chat.setActiveId(id);
        setDrawerOpen(false);
      }}
      onRename={chat.renameConversation}
      onDelete={chat.deleteConversation}
      searchRef={searchRef}
      faultArmed={chat.faultArmed}
      onToggleFault={() => chat.setFaultArmed(!chat.faultArmed)}
    />
  );

  return (
    <div className="flex h-full w-full gap-2.5 overflow-hidden bg-page p-2.5">
      <a
        href="#composer"
        className="sr-only-text focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-on-accent"
      >
        Skip to composer
      </a>

      {/* ------------------------------------------------------ chat list card */}
      {isDesktop && railOpen && (
        <aside
          id="chat-list-panel"
          aria-label="Chat list"
          className="card w-[272px] shrink-0 overflow-hidden"
        >
          {sidebar}
        </aside>
      )}

      {/* ----------------------------------------------------------- main card */}
      <main className="card flex min-w-0 flex-1 flex-col overflow-hidden">
        {active && (
          <>
            <ChatHeader
              modelId={chat.modelId}
              onSelectModel={chat.setModelId}
              onNewChat={startNew}
              onToggleSidebar={toggleIndex}
              sidebarOpen={isDesktop ? railOpen : drawerOpen}
              onTogglePanel={() => setPanelOpen((v) => !v)}
              panelOpen={panelOpen}
              showPanelToggle={isWide && !isEmpty}
              theme={theme.choice}
              resolved={theme.resolved}
              onCycleTheme={theme.cycle}
            />

            {isEmpty ? (
              /* Welcome: orb, greeting and composer centred in the card. */
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
                <div className="w-full max-w-[720px]">
                  <WelcomeHero
                    onPick={(text) => chat.send(text, [], 'standard')}
                  />
                  <div className="mt-9">
                    <Composer
                      busy={chat.isGenerating}
                      onSend={chat.send}
                      onStop={chat.stop}
                      variant="hero"
                      handleRef={composerRef}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Masthead conversation={active} />
                <Transcript
                  conversation={active}
                  busy={chat.isGenerating}
                  onRegenerate={chat.regenerate}
                  onEditSubmit={chat.editAndResend}
                  onRetry={chat.retry}
                  handleRef={transcriptRef}
                />
                <div className="shrink-0 px-3 pb-3 md:px-4 md:pb-4">
                  <Composer
                    busy={chat.isGenerating}
                    onSend={chat.send}
                    onStop={chat.stop}
                    handleRef={composerRef}
                  />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ------------------------------------------------------ context card */}
      {showPanel && active && (
        <aside
          id="context-panel"
          aria-label="Chat details"
          className="card w-[288px] shrink-0 overflow-hidden"
        >
          <ContextPanel
            conversation={active}
            onJumpTo={(id) => transcriptRef.current?.jumpTo(id)}
          />
        </aside>
      )}

      {/* ------------------------------------------------------ mobile drawer */}
      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-40 flex p-2.5">
          <button
            type="button"
            aria-label="Close chat list"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-scrim"
          />
          <div
            ref={drawerRef}
            id="chat-list-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Chat list"
            className="card relative z-10 h-full w-[86vw] max-w-[20rem] overflow-hidden"
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
