export type Role = 'user' | 'assistant';

export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';

/** Composer tools. Each changes what the model is asked to produce. */
export type ReplyMode = 'standard' | 'reasoning' | 'research';

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
  /** Which model produced this reply, and with which tool enabled. */
  modelId?: string;
  mode?: ReplyMode;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export type ThemeChoice = 'system' | 'light' | 'dark';
