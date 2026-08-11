export type Role = 'user' | 'assistant';

export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';

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
  /** Bumped whenever the turn is regenerated, shown in the margin rail. */
  revision?: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export type ThemeChoice = 'system' | 'light' | 'dark';
