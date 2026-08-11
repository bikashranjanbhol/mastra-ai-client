import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Conversation, Message } from '../types';
import { seedConversations, uid } from '../lib/seed';
import { StreamAbortError, streamAssistantReply } from '../lib/mockModel';

const titleFrom = (text: string): string => {
  const line = text.trim().split('\n')[0].replace(/[#*`>_]/g, '').trim();
  if (!line) return 'New chat';
  return line.length > 52 ? `${line.slice(0, 51).trimEnd()}…` : line;
};

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(seedConversations);
  const [activeId, setActiveId] = useState<string>(seedConversations[0].id);
  const [generatingIn, setGeneratingIn] = useState<string | null>(null);
  /** One-shot: arms a simulated connection drop on the next response. */
  const [faultArmed, setFaultArmed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<{ id: string; text: string } | null>(null);
  const frameRef = useRef<number | null>(null);

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

  /**
   * Tokens arrive every ~15ms. Committing each one to React state directly is a
   * render per token; instead they accumulate in a ref and flush once per frame.
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

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const runGeneration = useCallback(
    async (convId: string, history: Message[], assistantId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setGeneratingIn(convId);

      const injectFailure = faultArmed;
      if (faultArmed) setFaultArmed(false);

      bufferRef.current = { id: assistantId, text: '' };

      try {
        await streamAssistantReply(history, {
          signal: controller.signal,
          injectFailure,
          onToken: (chunk) => {
            const pending = bufferRef.current;
            if (pending && pending.id === assistantId) pending.text += chunk;
            if (frameRef.current === null) {
              frameRef.current = requestAnimationFrame(() => flushBuffer(convId));
            }
          },
        });
        flushBuffer(convId);
        patchMessage(convId, assistantId, (m) => ({ ...m, status: 'complete' }));
      } catch (err) {
        flushBuffer(convId);
        if (err instanceof StreamAbortError) {
          patchMessage(convId, assistantId, (m) => ({ ...m, status: 'stopped' }));
        } else {
          patchMessage(convId, assistantId, (m) => ({
            ...m,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown transport error.',
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
    [faultArmed, flushBuffer, patchMessage],
  );

  /** Appends an empty assistant turn and starts streaming into it. */
  const startAssistantTurn = useCallback(
    (convId: string, history: Message[], revision = 1) => {
      const assistant: Message = {
        id: uid('msg'),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        revision,
      };
      patchConversation(convId, (conv) => ({
        ...conv,
        updatedAt: Date.now(),
        messages: [...history, assistant],
      }));
      void runGeneration(convId, history, assistant.id);
    },
    [patchConversation, runGeneration],
  );

  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
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
      const isFirst = conv.messages.length === 0;
      if (isFirst) {
        patchConversation(conv.id, (c) => ({ ...c, title: titleFrom(body) }));
      }
      startAssistantTurn(conv.id, history);
    },
    [activeId, conversations, generatingIn, patchConversation, startAssistantTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Re-runs the turn that produced `messageId`, discarding it and anything after. */
  const regenerate = useCallback(
    (messageId: string) => {
      if (generatingIn) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const index = conv.messages.findIndex((m) => m.id === messageId);
      if (index < 1) return;
      const previous = conv.messages[index];
      startAssistantTurn(conv.id, conv.messages.slice(0, index), (previous.revision ?? 1) + 1);
    },
    [activeId, conversations, generatingIn, startAssistantTurn],
  );

  const retry = regenerate;

  /** Rewrites a user message and re-runs everything downstream of it. */
  const editAndResend = useCallback(
    (messageId: string, nextText: string) => {
      if (generatingIn) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const index = conv.messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;

      const edited: Message = {
        ...conv.messages[index],
        content: nextText.trim(),
        createdAt: Date.now(),
        revision: (conv.messages[index].revision ?? 1) + 1,
      };
      const history = [...conv.messages.slice(0, index), edited];
      startAssistantTurn(conv.id, history);
    },
    [activeId, conversations, generatingIn, startAssistantTurn],
  );

  const newConversation = useCallback(() => {
    const conv: Conversation = {
      id: uid('conv'),
      title: 'New chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }, []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const clean = title.trim();
      patchConversation(id, (c) => ({ ...c, title: clean || c.title }));
    },
    [patchConversation],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (generatingIn === id) abortRef.current?.abort();
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          if (next.length) {
            setActiveId(next[0].id);
          } else {
            const blank: Conversation = {
              id: uid('conv'),
              title: 'New chat',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: [],
            };
            setActiveId(blank.id);
            return [blank];
          }
        }
        return next;
      });
    },
    [activeId, generatingIn],
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
  };
}
