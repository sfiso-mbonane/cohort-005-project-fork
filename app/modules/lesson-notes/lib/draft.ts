export type NoteDraftStatus =
  | "empty"
  | "too-long"
  | "unsaved"
  | "saving"
  | "saved";

export type NoteDraft = {
  length: number;
  overBy: number;
  canSave: boolean;
  status: NoteDraftStatus;
};

export function describeDraft({
  draft,
  savedBody,
  saving,
  maxLength,
}: {
  draft: string;
  savedBody: string | null;
  saving: boolean;
  maxLength: number;
}): NoteDraft {
  const length = draft.length;
  const overBy = Math.max(0, length - maxLength);
  const trimmed = draft.trim();
  const blank = trimmed.length === 0;
  // The server trims before it stores, so surrounding whitespace is not a change.
  const changed = trimmed !== savedBody;

  const status: NoteDraftStatus = saving
    ? "saving"
    : overBy > 0
      ? "too-long"
      : blank
        ? "empty"
        : changed
          ? "unsaved"
          : "saved";

  return {
    length,
    overBy,
    // The action rejects a blank note, so the button never offers one.
    canSave: status === "unsaved",
    status,
  };
}
