/**
 * Backend configuration.
 *
 * Points at the mastra-ai-service HTTP API. Every value can be overridden with
 * a Vite env var so the same build runs against local, staging and production.
 */

const trimSlash = (s: string) => s.replace(/\/+$/, '');

export const API = {
  /** Root of the Mastra HTTP API, e.g. http://localhost:4111/api */
  baseUrl: trimSlash(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4111/api'),

  /**
   * Agent the chat talks to. The service registers agents under their `id`
   * (verified against GET /api/agents): `docs-agent` and `triage-agent`.
   */
  agentId: import.meta.env.VITE_AGENT_ID ?? 'docs-agent',

  /**
   * Mastra scopes memory by `resourceId` — the end user. Wire this to the real
   * session id once auth exists; until then every browser shares one demo user.
   */
  resourceId: import.meta.env.VITE_RESOURCE_ID ?? 'demo-user',

  /** Workflow registry key (GET /api/workflows), not the workflow's display name. */
  workflowId: import.meta.env.VITE_WORKFLOW_ID ?? 'triageAndFileWorkflow',

  /** Request timeout for non-streaming calls. Streaming calls are not capped. */
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 20_000),
} as const;

/**
 * Model selection is passed per request in Mastra's `requestContext`. The
 * service reads exactly these three keys (src/mastra/config/models.ts):
 * `provider`, `tier`, and `fallback: 'off'` to pin a single provider.
 */
export const CONTEXT_KEYS = { provider: 'provider', tier: 'tier', fallback: 'fallback' } as const;

/** Tiers the service understands. `reasoning` falls back to flagship where absent. */
export const TIERS = ['fast', 'flagship', 'reasoning'] as const;
export type Tier = (typeof TIERS)[number];

/** Providers the service's own registry accepts. */
export const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'mistral', 'openrouter'] as const;
export type ProviderId = (typeof PROVIDERS)[number];
