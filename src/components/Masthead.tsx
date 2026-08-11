import type { Conversation } from '../types';
import { plural, relativeDay } from '../lib/format';

interface Props {
  conversation: Conversation;
}

/**
 * The chat's own header, under the app bar. Slim by design — the brand and the
 * global controls live in the bar above, so this only names the conversation.
 */
export function Masthead({ conversation }: Props) {
  return (
    <div className="flex shrink-0 items-baseline gap-3 border-b border-edge bg-raised px-4 py-2 md:px-6">
      <h2 className="truncate text-[15px] font-bold leading-tight text-ink">
        {conversation.title}
      </h2>
      <p className="shrink-0 meta text-muted">
        {plural(conversation.messages.length, 'message')} · updated{' '}
        {relativeDay(conversation.updatedAt)}
      </p>
    </div>
  );
}
