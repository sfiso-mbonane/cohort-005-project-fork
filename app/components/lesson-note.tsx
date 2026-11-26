import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeNoteDraft, type NoteDraft } from "~/modules/lesson-notes";

export type SavedNote = { body: string; updatedAt: string } | null;

/**
 * The Student's private note on a lesson. Styled as a sibling of the
 * Questions & Discussion card so the two read as one set of lesson tools.
 */
export function LessonNote({ note }: { note: SavedNote }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const error = fetcher.data?.error;
  const draft = describeNoteDraft({
    draft: body,
    savedBody: note?.body ?? null,
    saving: fetcher.state !== "idle",
    maxLength: MAX_NOTE_LENGTH,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-32 resize-y"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!draft.canSave}>
              {draft.status === "saving" ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus draft={draft} note={note} error={error} />
            <span
              className={cn(
                "ml-auto text-xs",
                draft.overBy > 0 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {draft.length} / {MAX_NOTE_LENGTH}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteStatus({
  draft,
  note,
  error,
}: {
  draft: NoteDraft;
  note: SavedNote;
  error: string | undefined;
}) {
  if (error && draft.status !== "saved") {
    return <span className="text-xs text-destructive">{error}</span>;
  }
  if (draft.status === "too-long") {
    return (
      <span className="text-xs text-destructive">
        {draft.overBy.toLocaleString("en")} characters over the limit
      </span>
    );
  }
  if (draft.status === "unsaved") {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (draft.status === "saved" && note) {
    return (
      <span suppressHydrationWarning className="text-xs text-muted-foreground">
        Saved · edited {formatRelativeTime(note.updatedAt)}
      </span>
    );
  }
  return null;
}
