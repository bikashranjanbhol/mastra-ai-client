/**
 * Incremental server-sent-event decoder.
 *
 * The service streams `text/event-stream` with one JSON object per `data:`
 * line, terminated by `data: [DONE]` (verified against a live run). A network
 * chunk can end mid-line, mid-event, or mid-UTF-8-codepoint, so nothing is
 * assumed about where boundaries fall — the buffer is the whole trick.
 */
export class EventDecoder {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8', { fatal: false });

  /** Feed bytes; get back whole `data:` payloads, `[DONE]` filtered out. */
  push(bytes: Uint8Array): string[] {
    // `stream: true` holds an incomplete codepoint back until the rest of it
    // arrives, instead of emitting U+FFFD.
    this.buffer += this.decoder.decode(bytes, { stream: true });

    const out: string[] = [];
    for (;;) {
      const match = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer);
      if (!match) break;
      const block = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const data = this.parseBlock(block);
      if (data !== null) out.push(data);
    }
    return out;
  }

  /** Call on close; surfaces a trailing event with no blank line after it. */
  flush(): string[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const data = this.parseBlock(this.buffer);
    this.buffer = '';
    return data === null ? [] : [data];
  }

  private parseBlock(block: string): string | null {
    const lines: string[] = [];
    for (const line of block.split(/\r\n|\n|\r/)) {
      if (!line || line.startsWith(':')) continue; // comment / keep-alive
      if (!line.startsWith('data:')) continue; // event:/id:/retry: are unused here
      lines.push(line.slice(5).replace(/^ /, ''));
    }
    if (!lines.length) return null;
    const data = lines.join('\n');
    return data === '[DONE]' ? null : data;
  }
}

/**
 * Reads a streaming response as parsed JSON frames.
 *
 * One malformed frame is dropped rather than killing the connection — a
 * dropped token is recoverable, a dead stream is not.
 */
export async function* readFrames<T>(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<T> {
  const reader = response.body!.getReader();
  const decoder = new EventDecoder();
  const onAbort = () => void reader.cancel().catch(() => {});
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const data of decoder.push(value)) {
        const frame = safeParse<T>(data);
        if (frame) yield frame;
      }
    }
    for (const data of decoder.flush()) {
      const frame = safeParse<T>(data);
      if (frame) yield frame;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function safeParse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
