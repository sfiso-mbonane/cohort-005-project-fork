import { describeDraft as describe, type NoteDraft } from "./lib/draft";

export type { NoteDraft, NoteDraftStatus } from "./lib/draft";

/**
 * What the note editor shows for the text in the box: the character count,
 * how far over the limit it is, whether Save is offered, and one status
 * (empty, too-long, unsaved, saving, saved). `savedBody` is null when the
 * Student has no note on this lesson yet.
 */
export function describeNoteDraft(input: {
  draft: string;
  savedBody: string | null;
  saving: boolean;
  maxLength: number;
}): NoteDraft {
  return describe(input);
}
