import { request } from './http';

export interface ToolSummary {
  id: string;
  /** Registry key, which is what the execute route accepts alongside the id. */
  key: string;
  description?: string;
  inputSchema?: unknown;
}

/** GET /api/tools — the capabilities the agents can call. */
export async function listTools(signal?: AbortSignal): Promise<ToolSummary[]> {
  const byKey = await request<Record<string, { id?: string; description?: string; inputSchema?: unknown }>>(
    '/tools',
    { signal },
  );
  return Object.entries(byKey).map(([key, tool]) => ({
    key,
    id: tool.id ?? key,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export interface DocPassage {
  id: string;
  title: string;
  section: string;
  owner: string;
  text: string;
  score?: number;
}

/**
 * POST /api/tools/{toolId}/execute.
 *
 * Runs the agent's own retrieval tool directly, so Explore searches exactly the
 * corpus the assistant answers from — not a second index that could drift.
 */
export async function searchDocs(
  query: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<DocPassage[]> {
  const res = await request<{ results?: DocPassage[] }>('/tools/search_docs/execute', {
    method: 'POST',
    body: { data: { query, limit } },
    signal,
  });
  return res.results ?? [];
}
