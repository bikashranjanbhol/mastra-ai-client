import { API, CONTEXT_KEYS, type ProviderId, type Tier } from './config';
import { openStream, request } from './http';
import { readFrames } from './sse';

/* ─────────────────────────────────────────────────────────── agent metadata */

export interface AgentSummary {
  id: string;
  name: string;
  description?: string;
  modelId?: string;
  tools?: Record<string, unknown>;
}

/** GET /api/agents — keyed by agent id (`docs-agent`, `triage-agent`). */
export async function listAgents(signal?: AbortSignal): Promise<AgentSummary[]> {
  const byId = await request<Record<string, AgentSummary>>('/agents', { signal });
  return Object.entries(byId).map(([id, agent]) => ({ ...agent, id: agent.id ?? id }));
}

export interface ProviderStatus {
  id: string;
  name: string;
  envVar?: string;
  connected: boolean;
}

/**
 * GET /api/agents/providers — every provider Mastra's registry knows, with a
 * `connected` flag reflecting whether the server has a key for it. The list is
 * long; callers filter it down to the providers this service actually offers.
 */
export async function listProviders(signal?: AbortSignal): Promise<ProviderStatus[]> {
  const res = await request<{ providers: ProviderStatus[] }>('/agents/providers', { signal });
  return res.providers ?? [];
}

/* ────────────────────────────────────────────────────────────── the stream */

/**
 * Frames emitted by POST /api/agents/{id}/stream.
 *
 * Recorded from a live server rather than transcribed from docs. Text, tool
 * calls and finish were observed directly; reasoning, source and error frames
 * are in the same union in `@mastra/core` and are handled here so a reasoning
 * model or a mid-stream failure does not fall through silently.
 */
export type StreamFrame =
  | { type: 'start'; payload: { id?: string; messageId?: string } }
  | { type: 'step-start'; payload: { messageId?: string } }
  | { type: 'text-start'; payload: { id: string } }
  | { type: 'text-delta'; payload: { id: string; text: string } }
  | { type: 'text-end'; payload: { id: string } }
  | { type: 'reasoning-start'; payload: { id: string } }
  | { type: 'reasoning-delta'; payload: { id: string; text?: string } }
  | { type: 'reasoning-end'; payload: { id: string } }
  | { type: 'tool-call-input-streaming-start'; payload: { toolCallId: string; toolName: string } }
  | { type: 'tool-call-delta'; payload: { toolCallId: string; argsTextDelta?: string } }
  | { type: 'tool-call-input-streaming-end'; payload: { toolCallId: string } }
  | { type: 'tool-call'; payload: { toolCallId: string; toolName: string; args?: unknown } }
  | { type: 'tool-result'; payload: { toolCallId: string; toolName: string; result?: unknown } }
  | { type: 'tool-error'; payload: { toolCallId: string; toolName?: string; error?: unknown } }
  | { type: 'source'; payload: Record<string, unknown> }
  | { type: 'error'; payload: { error?: unknown; message?: string } }
  | { type: 'abort'; payload?: Record<string, unknown> }
  | { type: 'step-finish'; payload: Record<string, unknown> }
  | {
      type: 'finish';
      payload: {
        messageId?: string;
        stepResult?: { reason?: string };
        metadata?: { modelId?: string; modelMetadata?: { modelProvider?: string } };
        output?: { usage?: TokenUsage };
      };
    }
  | { type: string; payload?: Record<string, unknown> };

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export interface StreamOptions {
  agentId?: string;
  threadId: string;
  resourceId?: string;
  /** Plain text, or AI-SDK style message parts for attachments. */
  message: string;
  provider?: ProviderId;
  tier?: Tier;
  /** Pins a single provider so a failure is attributable rather than masked. */
  pinProvider?: boolean;
  signal: AbortSignal;
}

/**
 * POST /api/agents/{id}/stream.
 *
 * Mastra persists both the user turn and the reply into thread memory on the
 * server, so the client does not save messages itself — reloading the thread
 * returns them.
 */
export async function* streamAgent(options: StreamOptions): AsyncGenerator<StreamFrame> {
  const {
    agentId = API.agentId,
    threadId,
    resourceId = API.resourceId,
    message,
    provider,
    tier,
    pinProvider,
    signal,
  } = options;

  const requestContext: Record<string, string> = {};
  if (provider) requestContext[CONTEXT_KEYS.provider] = provider;
  if (tier) requestContext[CONTEXT_KEYS.tier] = tier;
  if (pinProvider) requestContext[CONTEXT_KEYS.fallback] = 'off';

  const response = await openStream(
    `/agents/${encodeURIComponent(agentId)}/stream`,
    {
      messages: message,
      memory: { thread: threadId, resource: resourceId },
      ...(Object.keys(requestContext).length ? { requestContext } : {}),
    },
    signal,
  );

  yield* readFrames<StreamFrame>(response, signal);
}

/**
 * POST /api/agents/{id}/threads/abort — stops the run server-side.
 *
 * Aborting the fetch alone only drops our end of the pipe; the model call keeps
 * running and keeps billing. This tells the service to stop.
 */
export async function abortRun(
  threadId: string,
  agentId: string = API.agentId,
  resourceId: string = API.resourceId,
): Promise<boolean> {
  try {
    const res = await request<{ aborted: boolean }>(
      `/agents/${encodeURIComponent(agentId)}/threads/abort`,
      { method: 'POST', body: { threadId, resourceId }, timeout: 5_000 },
    );
    return res.aborted;
  } catch {
    // The local abort already happened; a failure here is not worth surfacing.
    return false;
  }
}
