export type Role = 'user' | 'assistant';

export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';

/** Composer tools. Each changes what the model is asked to produce. */
export type ReplyMode = 'standard' | 'reasoning' | 'research';

/** A tool the agent invoked during a turn, and how it went. */
export interface ToolRun {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  status: 'running' | 'done' | 'error';
  error?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: 'text' | 'image' | 'data' | 'other';
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status: MessageStatus;
  /** Present when status === 'error'; shown in the retry banner. */
  error?: string;
  attachments?: Attachment[];
  /** Bumped whenever the turn is regenerated, shown next to the speaker. */
  revision?: number;
  /** Which agent and model produced this reply, and with which tool enabled. */
  agentId?: string;
  modelId?: string;
  mode?: ReplyMode;
  /** Tools the agent called while producing this turn. */
  tools?: ToolRun[];
  /** Reasoning trace, when the model emits one. */
  reasoning?: string;
  /** Token accounting reported by the service on finish. */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export type ThemeChoice = 'system' | 'light' | 'dark';
