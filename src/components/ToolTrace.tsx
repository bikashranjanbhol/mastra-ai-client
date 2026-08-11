import { useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Loader, Wrench } from 'lucide-react';
import type { ToolRun } from '../types';

const TOOL_LABEL: Record<string, string> = {
  search_docs: 'Searched documentation',
  create_ticket: 'Filed a ticket',
};

const label = (name: string) => TOOL_LABEL[name] ?? name.replace(/_/g, ' ');

/** One-line summary of what a tool call actually did, without dumping JSON. */
function summarise(run: ToolRun): string | null {
  const args = run.args as Record<string, unknown> | undefined;
  const result = run.result as Record<string, unknown> | undefined;

  if (run.name === 'search_docs') {
    const query = typeof args?.query === 'string' ? `“${args.query}”` : null;
    const hits = Array.isArray(result?.results) ? result.results.length : null;
    if (query && hits !== null) return `${query} · ${hits} passage${hits === 1 ? '' : 's'}`;
    return query;
  }
  if (run.name === 'create_ticket') {
    const id = result?.id ?? result?.ticketId;
    const severity = args?.severity ?? result?.severity;
    if (typeof id === 'string') return severity ? `${id} · ${severity}` : id;
  }
  const keys = args ? Object.keys(args) : [];
  return keys.length ? keys.join(', ') : null;
}

/**
 * The agent's tool calls, shown as steps above its answer.
 *
 * The service's docs agent is required to search before it answers, so the
 * retrieval step is part of the answer's provenance — worth showing, and worth
 * being able to open when someone wants to check what was actually retrieved.
 */
export function ToolTrace({ runs }: { runs: ToolRun[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="mb-2.5 space-y-1">
      {runs.map((run) => {
        const open = openId === run.id;
        const detail = summarise(run);
        const Icon =
          run.status === 'error' ? AlertTriangle : run.status === 'running' ? Loader : Check;

        return (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : run.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 rounded-ctl border border-edge bg-surface px-2.5 py-1.5 text-left transition-colors hover:bg-hover"
            >
              <Icon
                aria-hidden="true"
                size={13}
                strokeWidth={2.25}
                className={
                  run.status === 'error'
                    ? 'shrink-0 text-danger'
                    : run.status === 'running'
                      ? 'shrink-0 animate-spin text-muted'
                      : 'shrink-0 text-success'
                }
              />
              <Wrench aria-hidden="true" size={12} strokeWidth={2} className="shrink-0 text-muted" />
              <span className="text-[13px] font-semibold text-ink">{label(run.name)}</span>
              {detail && <span className="min-w-0 flex-1 truncate meta text-muted">{detail}</span>}
              <ChevronRight
                aria-hidden="true"
                size={13}
                strokeWidth={2.25}
                className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
              />
            </button>

            {open && (
              <div className="mt-1 overflow-x-auto rounded-ctl border border-edge bg-surface p-2.5">
                {run.error && <p className="mb-2 text-[13px] text-danger">{run.error}</p>}
                <p className="label pb-1 text-muted">Arguments</p>
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-ink">
                  {JSON.stringify(run.args ?? {}, null, 2)}
                </pre>
                {run.result !== undefined && (
                  <>
                    <p className="label pb-1 pt-2.5 text-muted">Result</p>
                    <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-ink">
                      {JSON.stringify(run.result, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
