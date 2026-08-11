import type { Attachment, Message, ToolRun } from '../../types';
import { API } from './config';
import { request } from './http';

/* ─────────────────────────────────────────────────────────────── the wire */

export interface ThreadDto {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/** Stored message shape returned by GET /threads/{id}/messages (`format: 2`). */
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  createdAt: string;
  threadId?: string;
  content: {
    format?: number;
    content?: string;
    parts?: MessagePart[];
  };
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text?: string; reasoning?: string }
  | {
      type: 'tool-invocation';
      toolInvocation: {
        state: 'call' | 'partial-call' | 'result';
        toolCallId: string;
        toolName: string;
        args?: unknown;
        result?: unknown;
      };
    }
  | { type: 'file'; filename?: string; mimeType?: string; data?: string }
  | { type: string; [key: string]: unknown };

/* ───────────────────────────────────────────────────────────────── threads */

/** GET /api/memory/threads — newest first, as the sidebar wants them. */
export async function listThreads(signal?: AbortSignal): Promise<ThreadDto[]> {
  const res = await request<{ threads: ThreadDto[] }>('/memory/threads', {
    query: {
      agentId: API.agentId,
      resourceId: API.resourceId,
      page: 0,
      perPage: 100,
    },
    signal,
  });
  return [...(res.threads ?? [])].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export async function createThread(title: string, signal?: AbortSignal): Promise<ThreadDto> {
  return request<ThreadDto>('/memory/threads', {
    method: 'POST',
    query: { agentId: API.agentId },
    body: { resourceId: API.resourceId, title },
    signal,
  });
}

export async function renameThread(threadId: string, title: string): Promise<ThreadDto> {
  return request<ThreadDto>(`/memory/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    query: { agentId: API.agentId },
    body: { title },
  });
}

export async function deleteThread(threadId: string): Promise<void> {
  await request(`/memory/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    query: { agentId: API.agentId, resourceId: API.resourceId },
  });
}

/* ──────────────────────────────────────────────────────────────── messages */

export async function listMessages(threadId: string, signal?: AbortSignal): Promise<Message[]> {
  const res = await request<{ messages: StoredMessage[] }>(
    `/memory/threads/${encodeURIComponent(threadId)}/messages`,
    {
      query: { agentId: API.agentId, resourceId: API.resourceId, page: 0, perPage: 200 },
      signal,
    },
  );
  return (res.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map(toMessage)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * POST /api/memory/messages/delete.
 *
 * Used by regenerate and edit-and-resend: the server owns the transcript, so
 * discarding a turn means deleting it there, not just locally.
 */
export async function deleteMessages(messageIds: string[]): Promise<void> {
  if (!messageIds.length) return;
  await request('/memory/messages/delete', {
    method: 'POST',
    query: { agentId: API.agentId, resourceId: API.resourceId },
    body: { messageIds },
  });
}

/**
 * GET /api/memory/search.
 *
 * Present on the server but only returns hits when the agent's Memory is
 * configured with semantic recall; the current service is not, so this returns
 * an empty set and the sidebar falls back to filtering loaded threads.
 */
export async function searchMemory(
  query: string,
  signal?: AbortSignal,
): Promise<Array<{ id?: string; threadId?: string; content?: unknown }>> {
  const res = await request<{ results: Array<{ id?: string; threadId?: string }> }>(
    '/memory/search',
    {
      query: {
        agentId: API.agentId,
        resourceId: API.resourceId,
        searchQuery: query,
        limit: 20,
      },
      signal,
    },
  );
  return res.results ?? [];
}

/* ───────────────────────────────────────────────────────────────── mapping */

/** Flattens the stored `parts` array into the shape the transcript renders. */
function toMessage(stored: StoredMessage): Message {
  const parts = stored.content?.parts ?? [];
  const text: string[] = [];
  const reasoning: string[] = [];
  const tools: ToolRun[] = [];
  const attachments: Attachment[] = [];

  for (const part of parts) {
    if (part.type === 'text' && typeof (part as { text?: string }).text === 'string') {
      text.push((part as { text: string }).text);
    } else if (part.type === 'reasoning') {
      const value = (part as { text?: string; reasoning?: string });
      reasoning.push(value.text ?? value.reasoning ?? '');
    } else if (part.type === 'tool-invocation') {
      const call = (part as Extract<MessagePart, { type: 'tool-invocation' }>).toolInvocation;
      tools.push({
        id: call.toolCallId,
        name: call.toolName,
        args: call.args,
        result: call.result,
        status: call.state === 'result' ? 'done' : 'running',
      });
    } else if (part.type === 'file') {
      const file = part as { filename?: string; mimeType?: string };
      attachments.push({
        id: `${stored.id}-file-${attachments.length}`,
        name: file.filename ?? 'attachment',
        size: 0,
        kind: file.mimeType?.startsWith('image/') ? 'image' : 'other',
      });
    }
  }

  const body = text.join('') || (typeof stored.content?.content === 'string' ? stored.content.content : '');

  return {
    id: stored.id,
    role: stored.role === 'user' ? 'user' : 'assistant',
    content: body,
    createdAt: Date.parse(stored.createdAt) || Date.now(),
    status: 'complete',
    reasoning: reasoning.join('') || undefined,
    tools: tools.length ? tools : undefined,
    attachments: attachments.length ? attachments : undefined,
  };
}

export const threadToConversationTitle = (thread: ThreadDto): string =>
  thread.title?.trim() || 'New chat';
