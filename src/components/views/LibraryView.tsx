import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { listTools, type ToolSummary } from '../../lib/api/tools';
import { listAgents, type AgentSummary } from '../../lib/api/agents';
import { ApiError } from '../../lib/api/http';

/** Pulls the named fields out of a tool's JSON input schema, if it has one. */
function inputFields(schema: unknown): Array<{ name: string; required: boolean; type?: string }> {
  const s = schema as
    | { properties?: Record<string, { type?: string }>; required?: string[] }
    | undefined;
  if (!s?.properties) return [];
  const required = new Set(s.required ?? []);
  return Object.entries(s.properties).map(([name, def]) => ({
    name,
    required: required.has(name),
    type: def?.type,
  }));
}

/**
 * Library — what this assistant is, in the service's own words.
 *
 * The agents and tools are read from the running service, so the page cannot
 * drift from what is actually deployed the way a written list would.
 */
export function LibraryView({ live }: { live: boolean }) {
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    Promise.all([listTools(controller.signal), listAgents(controller.signal)])
      .then(([t, a]) => {
        setTools(t);
        setAgents(a);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Could not load the catalogue.');
      });
    return () => controller.abort();
  }, [live]);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-6">
      <h1 className="text-[1.35rem] font-bold text-ink">Library</h1>
      <p className="mt-1 max-w-[70ch] text-[14px] text-muted">
        The agents and tools this workspace is running, read live from the service.
      </p>

      {!live && (
        <p className="mt-4 rounded-ctl border border-edge bg-surface px-3 py-2 text-[13px] text-muted">
          Connect to the service to see what it is running.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-ctl border border-danger px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      {agents.length > 0 && (
        <>
          <h2 className="mt-6 label text-muted">Agents · {agents.length}</h2>
          <ul className="mt-2 space-y-2">
            {agents.map((agent) => (
              <li key={agent.id} className="rounded-card border border-edge bg-raised p-3.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="text-[14px] font-bold text-ink">{agent.name?.trim() || agent.id}</h3>
                  <span className="meta text-muted">{agent.id}</span>
                  {agent.modelId && (
                    <span className="rounded-pill bg-wash px-2 py-px text-[11px] font-bold text-accent-text">
                      {agent.modelId}
                    </span>
                  )}
                </div>
                {agent.description && (
                  <p className="mt-1 text-[14px] leading-[1.5] text-muted">{agent.description}</p>
                )}
                {agent.tools && Object.keys(agent.tools).length > 0 && (
                  <p className="mt-1.5 meta text-muted">
                    Tools: {Object.keys(agent.tools).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tools.length > 0 && (
        <>
          <h2 className="mt-6 label text-muted">Tools · {tools.length}</h2>
          <ul className="mt-2 space-y-2">
            {tools.map((tool) => {
              const fields = inputFields(tool.inputSchema);
              return (
                <li key={tool.key} className="rounded-card border border-edge bg-raised p-3.5">
                  <div className="flex items-center gap-2">
                    <Wrench aria-hidden="true" size={14} strokeWidth={2} className="text-accent-text" />
                    <h3 className="text-[14px] font-bold text-ink">{tool.id}</h3>
                  </div>
                  {tool.description && (
                    <p className="mt-1 text-[14px] leading-[1.5] text-muted">{tool.description}</p>
                  )}
                  {fields.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {fields.map((field) => (
                        <li
                          key={field.name}
                          className="rounded-pill border border-edge bg-surface px-2 py-0.5 meta text-muted"
                        >
                          <span className="text-ink">{field.name}</span>
                          {field.type ? ` · ${field.type}` : ''}
                          {field.required ? ' · required' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
