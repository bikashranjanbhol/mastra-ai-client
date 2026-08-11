import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Conversation, Message, ReplyMode, ToolRun } from '../types';
import { seedConversations, uid } from '../lib/seed';
import { StreamAbortError, streamAssistantReply } from '../lib/mockModel';
import { API, type ProviderId, type Tier } from '../lib/api/config';
import { ApiError } from '../lib/api/http';
import {
  abortRun,
  listAgents,
  streamAgent,
  type AgentSummary,
  type StreamFrame,
} from '../lib/api/agents';
import {
  createThread,
  deleteMessages,
  deleteThread,
  listMessages,
  listThreads,
  renameThread,
} from '../lib/api/memory';

const blankConversation = (): Conversation => ({
  id: uid('conv'),
  title: 'New chat',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
});

const titleFrom = (text: string): string => {
  const line = text.trim().split('\n')[0].replace(/[#*`>_]/g, '').trim();
  if (!line) return 'New chat';
  return line.length > 52 ? `${line.slice(0, 51).trimEnd()}…` : line;
};

/**
 * Connection to the backend.
 *
 * `offline` is not an error state to hide — it is the honest answer when the
 * service is not running, and the app stays usable on the simulated model so a
 * demo never dies on a missing backend.
 */
export type BackendState =
  | { status: 'connecting' }
  | { status: 'live'; agentId: string; agentName: string }
  | { status: 'offline'; reason: string };

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [generatingIn, setGeneratingIn] = useState<string | null>(null);
  const [backend, setBackend] = useState<BackendState>({ status: 'connecting' });
  const [loadingThread, setLoadingThread] = useState(false);

  /** One-shot: arms a simulated connection drop, for demonstrating the error path. */
  const [faultArmed, setFaultArmed] = useState(false);
  const [provider, setProvider] = useState<ProviderId | undefined>(undefined);
  const [tier, setTier] = useState<Tier>('fast');
  /**
   * Which agent answers the next turn. Threads are shared across agents on the
   * server (verified: a thread created under one agent lists under the other),
   * so switching does not change the chat list — the same conversation can be
   * answered by a different agent.
   */
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentId, setAgentId] = useState<string>(API.agentId);
  const agentRef = useRef<string>(API.agentId);

  const selectAgent = useCallback((id: string) => {
    agentRef.current = id;
    setAgentId(id);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<{ id: string; text: string } | null>(null);
  const frameRef = useRef<number | null>(null);
  const loadedThreads = useRef(new Set<string>());
  /**
   * conversation id → server thread id.
   *
   * A conversation starts local and only becomes a thread when its first
   * message is sent. That keeps empty "New chat" threads out of the database
   * — page loads and stray New Chat clicks used to create one every time.
   */
  const threadIds = useRef(new Map<string, string>());

  /**
   * In-flight thread creations, keyed by conversation.
   *
   * The first send resolves the thread from two places at once — the title
   * rename and the stream itself — so without sharing the promise both would
   * create one and the chat would fork into two threads.
   */
  const pendingThreads = useRef(new Map<string, Promise<string>>());

  const live = backend.status === 'live';

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const patchConversation = useCallback(
    (id: string, fn: (conv: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
    },
    [],
  );

  const patchMessage = useCallback(
    (convId: string, msgId: string, fn: (m: Message) => Message) => {
      patchConversation(convId, (conv) => ({
        ...conv,
        updatedAt: Date.now(),
        messages: conv.messages.map((m) => (m.id === msgId ? fn(m) : m)),
      }));
    },
    [patchConversation],
  );

  /* ───────────────────────────────────────────────── connect and load state */

  useEffect(() => {
    // Safe to run twice (React does in development): this only reads. Nothing
    // is created until a message is sent, which is why the earlier guard-ref
    // could go — it was skipping the second run while the first had already
    // aborted itself, leaving the app with no conversation at all.
    const controller = new AbortController();

    (async () => {
      try {
        const agents = await listAgents(controller.signal);
        const agent = agents.find((a) => a.id === API.agentId) ?? agents[0];
        if (!agent) throw new ApiError(0, 'The service reported no agents');
        if (agent.id !== API.agentId) {
          // Configured id is not registered. Use what the service does have and
          // say so, rather than showing a healthy badge and failing every send.
          console.warn(
            `[assistant] VITE_AGENT_ID="${API.agentId}" is not registered; ` +
              `using "${agent.id}". Available: ${agents.map((a) => a.id).join(', ')}`,
          );
        }
        setAgents(agents);
        agentRef.current = agent.id;
        setAgentId(agent.id);

        const threads = await listThreads(controller.signal);
        const asConversations: Conversation[] = threads.map((t) => ({
          id: t.id,
          title: t.title?.trim() || 'New chat',
          createdAt: Date.parse(t.createdAt) || Date.now(),
          updatedAt: Date.parse(t.updatedAt) || Date.now(),
          messages: [],
        }));

        if (controller.signal.aborted) return;
        setBackend({
          status: 'live',
          agentId: agent.id,
          agentName: agent.name?.trim() || agent.id,
        });

        for (const conv of asConversations) threadIds.current.set(conv.id, conv.id);

        if (asConversations.length) {
          setConversations(asConversations);
          setActiveId(asConversations[0].id);
        } else {
          // Nothing stored yet: open a local draft. It becomes a thread on send.
          const draft = blankConversation();
          loadedThreads.current.add(draft.id);
          setConversations([draft]);
          setActiveId(draft.id);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // Fall back to the simulated model so the interface stays demonstrable.
        setBackend({
          status: 'offline',
          reason:
            err instanceof ApiError && err.status === 0
              ? `Cannot reach ${API.baseUrl}`
              : err instanceof Error
                ? err.message
                : 'The service is unavailable',
        });
        setConversations(seedConversations);
        setActiveId(seedConversations[0].id);
        for (const c of seedConversations) loadedThreads.current.add(c.id);
      }
    })();

    return () => controller.abort();
  }, []);

  /** Thread bodies are fetched on demand — the list call returns no messages. */
  useEffect(() => {
    if (!live || !activeId || loadedThreads.current.has(activeId)) return;
    if (!threadIds.current.has(activeId)) return; // local draft, nothing to fetch
    const controller = new AbortController();
    setLoadingThread(true);

    const threadId = threadIds.current.get(activeId) ?? activeId;
    listMessages(threadId, controller.signal)
      .then((messages) => {
        loadedThreads.current.add(activeId);
        patchConversation(activeId, (conv) => ({ ...conv, messages }));
      })
      .catch(() => {
        // Leave the thread empty; the next send still works and will reload it.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingThread(false);
      });

    return () => controller.abort();
  }, [activeId, live, patchConversation]);

  /* ────────────────────────────────────────────────────────────── streaming */

  /**
   * Tokens arrive every few ms. Committing each to React state directly is a
   * render per token; instead they accumulate in a ref and flush once a frame.
   */
  const flushBuffer = useCallback(
    (convId: string) => {
      frameRef.current = null;
      const pending = bufferRef.current;
      if (!pending || !pending.text) return;
      bufferRef.current = { id: pending.id, text: '' };
      patchMessage(convId, pending.id, (m) => ({ ...m, content: m.content + pending.text }));
    },
    [patchMessage],
  );

  const queueText = useCallback(
    (convId: string, assistantId: string, text: string) => {
      const pending = bufferRef.current;
      if (pending && pending.id === assistantId) pending.text += text;
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => flushBuffer(convId));
      }
    },
    [flushBuffer],
  );

  const upsertTool = useCallback(
    (convId: string, assistantId: string, id: string, patch: Partial<ToolRun>) => {
      patchMessage(convId, assistantId, (m) => {
        const tools = [...(m.tools ?? [])];
        const index = tools.findIndex((t) => t.id === id);
        if (index === -1) {
          tools.push({ id, name: patch.name ?? 'tool', status: 'running', ...patch });
        } else {
          tools[index] = { ...tools[index], ...patch };
        }
        return { ...m, tools };
      });
    },
    [patchMessage],
  );

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  /** Applies one stream frame to the message being built. */
  const applyFrame = useCallback(
    (convId: string, assistantId: string, frame: StreamFrame) => {
      const payload = (frame.payload ?? {}) as Record<string, unknown>;

      switch (frame.type) {
        case 'text-delta': {
          const text = payload.text;
          if (typeof text === 'string' && text) queueText(convId, assistantId, text);
          break;
        }
        case 'reasoning-delta': {
          const text = payload.text;
          if (typeof text === 'string' && text) {
            patchMessage(convId, assistantId, (m) => ({
              ...m,
              reasoning: (m.reasoning ?? '') + text,
            }));
          }
          break;
        }
        case 'tool-call-input-streaming-start':
        case 'tool-call':
          upsertTool(convId, assistantId, String(payload.toolCallId), {
            name: String(payload.toolName ?? 'tool'),
            args: payload.args,
            status: 'running',
          });
          break;
        case 'tool-result':
          upsertTool(convId, assistantId, String(payload.toolCallId), {
            name: payload.toolName ? String(payload.toolName) : undefined,
            result: payload.result,
            status: 'done',
          });
          break;
        case 'tool-error':
          upsertTool(convId, assistantId, String(payload.toolCallId), {
            status: 'error',
            error: describeError(payload.error) ?? 'The tool failed',
          });
          break;
        case 'finish': {
          const output = payload.output as { usage?: Message['usage'] } | undefined;
          const metadata = payload.metadata as
            | { modelId?: string; modelMetadata?: { modelProvider?: string } }
            | undefined;
          patchMessage(convId, assistantId, (m) => ({
            ...m,
            usage: output?.usage ?? m.usage,
            modelId: metadata?.modelId ?? m.modelId,
          }));
          break;
        }
        case 'error': {
          const message = describeError(payload.error ?? payload.message);
          throw new ApiError(500, message ?? 'The model reported an error');
        }
        default:
          break; // start / step-* / text-start / text-end / source: nothing to render
      }
    },
    [patchMessage, queueText, upsertTool],
  );

  /** Returns the server thread for a conversation, creating it on first use. */
  const resolveThread = useCallback((convId: string, title: string): Promise<string> => {
    const known = threadIds.current.get(convId);
    if (known) return Promise.resolve(known);

    const inFlight = pendingThreads.current.get(convId);
    if (inFlight) return inFlight;

    const creating = createThread(title)
      .then((thread) => {
        threadIds.current.set(convId, thread.id);
        loadedThreads.current.add(convId);
        return thread.id;
      })
      .finally(() => {
        pendingThreads.current.delete(convId);
      });

    pendingThreads.current.set(convId, creating);
    return creating;
  }, []);

  const runGeneration = useCallback(
    async (convId: string, history: Message[], assistantId: string, mode: ReplyMode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setGeneratingIn(convId);

      const injectFailure = faultArmed;
      if (faultArmed) setFaultArmed(false);

      bufferRef.current = { id: assistantId, text: '' };

      const prompt = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
      // Reasoning asks the service for its reasoning tier; the composer's other
      // tool is a prompt-level instruction, since the service has no research mode.
      const requestedTier: Tier = mode === 'reasoning' ? 'reasoning' : tier;
      const message =
        mode === 'research'
          ? `${prompt}\n\nSearch the documentation thoroughly before answering, and list every passage id you relied on.`
          : prompt;

      try {
        if (live && !injectFailure) {
          const threadId = await resolveThread(convId, titleFrom(prompt));
          for await (const frame of streamAgent({
            agentId: agentRef.current,
            threadId,
            message,
            provider,
            tier: requestedTier,
            signal: controller.signal,
          })) {
            applyFrame(convId, assistantId, frame);
          }
        } else {
          await streamAssistantReply(history, {
            signal: controller.signal,
            injectFailure,
            mode,
            onToken: (chunk) => queueText(convId, assistantId, chunk),
          });
        }

        flushBuffer(convId);
        // Aborting cancels the reader, so the loop above ends *cleanly* rather
        // than throwing. Without this check a stopped turn was marked complete
        // and a truncated answer looked finished.
        const stopped = controller.signal.aborted;
        patchMessage(convId, assistantId, (m) => ({
          ...m,
          status: stopped ? 'stopped' : 'complete',
          tools: m.tools?.map((t) =>
            t.status === 'running' ? { ...t, status: stopped ? 'error' : 'done' } : t,
          ),
        }));
      } catch (err) {
        flushBuffer(convId);
        const aborted =
          err instanceof StreamAbortError ||
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError');

        if (aborted) {
          patchMessage(convId, assistantId, (m) => ({ ...m, status: 'stopped' }));
        } else {
          patchMessage(convId, assistantId, (m) => ({
            ...m,
            status: 'error',
            error: describeApiError(err),
          }));
        }
      } finally {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        bufferRef.current = null;
        abortRef.current = null;
        setGeneratingIn(null);
      }
    },
    [
      applyFrame,
      faultArmed,
      flushBuffer,
      live,
      patchMessage,
      provider,
      queueText,
      resolveThread,
      tier,
    ],
  );

  const startAssistantTurn = useCallback(
    (convId: string, history: Message[], mode: ReplyMode = 'standard', revision = 1) => {
      const assistant: Message = {
        id: uid('msg'),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        revision,
        mode,
        agentId: agentRef.current,
      };
      patchConversation(convId, (conv) => ({
        ...conv,
        updatedAt: Date.now(),
        messages: [...history, assistant],
      }));
      void runGeneration(convId, history, assistant.id, mode);
    },
    [patchConversation, runGeneration],
  );

  /* ──────────────────────────────────────────────────────────────── actions */

  const send = useCallback(
    (text: string, attachments: Attachment[] = [], mode: ReplyMode = 'standard') => {
      const body = text.trim();
      if (!body || generatingIn) return;

      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;

      const userMessage: Message = {
        id: uid('msg'),
        role: 'user',
        content: body,
        createdAt: Date.now(),
        status: 'complete',
        attachments: attachments.length ? attachments : undefined,
      };

      const history = [...conv.messages, userMessage];

      // The service stores threads with an empty title; the first message names
      // the chat, and the rename is pushed so the sidebar survives a reload.
      if (conv.messages.length === 0) {
        const title = titleFrom(body);
        patchConversation(conv.id, (c) => ({ ...c, title }));
        // The thread may not exist yet; rename once the turn has created it.
        if (live) {
          void (async () => {
            try {
              const threadId = await resolveThread(conv.id, title);
              await renameThread(threadId, title);
            } catch {
              // The chat still works; only the stored title lags.
            }
          })();
        }
      }

      startAssistantTurn(conv.id, history, mode);
    },
    [
      activeId,
      conversations,
      generatingIn,
      live,
      patchConversation,
      resolveThread,
      startAssistantTurn,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    const threadId = activeId ? threadIds.current.get(activeId) : undefined;
    if (live && threadId) void abortRun(threadId, agentRef.current);
  }, [activeId, live]);

  /** Discards a turn on the server too — the transcript lives there, not here. */
  const dropServerMessages = useCallback(
    (messages: Message[]) => {
      if (!live) return;
      // Locally-minted ids (uid('msg')) were never stored; only server ids are.
      const ids = messages.map((m) => m.id).filter((id) => !id.startsWith('msg-'));
      if (ids.length) void deleteMessages(ids).catch(() => {});
    },
    [live],
  );

  const regenerate = useCallback(
    (messageId: string) => {
      if (generatingIn) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const index = conv.messages.findIndex((m) => m.id === messageId);
      if (index < 1) return;

      const previous = conv.messages[index];
      dropServerMessages(conv.messages.slice(index));
      startAssistantTurn(
        conv.id,
        conv.messages.slice(0, index),
        previous.mode ?? 'standard',
        (previous.revision ?? 1) + 1,
      );
    },
    [activeId, conversations, dropServerMessages, generatingIn, startAssistantTurn],
  );

  const retry = regenerate;

  const editAndResend = useCallback(
    (messageId: string, nextText: string) => {
      if (generatingIn) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const index = conv.messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;

      const edited: Message = {
        ...conv.messages[index],
        id: uid('msg'),
        content: nextText.trim(),
        createdAt: Date.now(),
        revision: (conv.messages[index].revision ?? 1) + 1,
      };
      dropServerMessages(conv.messages.slice(index));
      const history = [...conv.messages.slice(0, index), edited];
      startAssistantTurn(conv.id, history, conv.messages[index + 1]?.mode ?? 'standard');
    },
    [activeId, conversations, dropServerMessages, generatingIn, startAssistantTurn],
  );

  const newConversation = useCallback(() => {
    const draft = blankConversation();
    loadedThreads.current.add(draft.id);
    setConversations((prev) => [draft, ...prev]);
    setActiveId(draft.id);
    return draft.id;
  }, []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      patchConversation(id, (c) => ({ ...c, title: clean }));
      const threadId = threadIds.current.get(id);
      if (live && threadId) void renameThread(threadId, clean).catch(() => {});
    },
    [live, patchConversation],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (generatingIn === id) abortRef.current?.abort();
      const threadId = threadIds.current.get(id);
      if (live && threadId) void deleteThread(threadId).catch(() => {});
      threadIds.current.delete(id);
      loadedThreads.current.delete(id);

      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          if (next.length) {
            setActiveId(next[0].id);
          } else {
            const blank = blankConversation();
            loadedThreads.current.add(blank.id);
            setActiveId(blank.id);
            return [blank];
          }
        }
        return next;
      });
    },
    [activeId, generatingIn, live],
  );

  const ordered = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  return {
    conversations: ordered,
    active,
    activeId,
    setActiveId,
    isGenerating: generatingIn === activeId,
    loadingThread,
    backend,
    send,
    stop,
    regenerate,
    retry,
    editAndResend,
    newConversation,
    renameConversation,
    deleteConversation,
    faultArmed,
    setFaultArmed,
    provider,
    setProvider,
    tier,
    setTier,
    agents,
    agentId,
    selectAgent,
  };
}

/* ───────────────────────────────────────────────────────────────── helpers */

function describeError(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (typeof value === 'object') {
    const obj = value as { message?: string; error?: string };
    return obj.message ?? obj.error ?? JSON.stringify(value).slice(0, 300);
  }
  return String(value);
}

/** Turns a thrown value into something worth putting in front of a person. */
function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return `${err.message}. Is the service running at ${API.baseUrl}?`;
    return err.message;
  }
  return err instanceof Error ? err.message : 'The response failed.';
}
