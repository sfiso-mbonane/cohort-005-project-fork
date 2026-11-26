import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

const base = { savedBody: null, saving: false, maxLength: 10 };

describe("describeNoteDraft", () => {
  it("is empty and not saveable before anything is written", () => {
    expect(describeNoteDraft({ ...base, draft: "" })).toEqual({
      length: 0,
      overBy: 0,
      canSave: false,
      status: "empty",
    });
  });

  it("does not offer to save whitespace", () => {
    const draft = describeNoteDraft({ ...base, draft: "   " });
    expect(draft.status).toBe("empty");
    expect(draft.canSave).toBe(false);
  });

  it("offers to save new text", () => {
    const draft = describeNoteDraft({ ...base, draft: "hello" });
    expect(draft).toEqual({
      length: 5,
      overBy: 0,
      canSave: true,
      status: "unsaved",
    });
  });

  it("is saved when the box matches the stored note", () => {
    const draft = describeNoteDraft({
      ...base,
      savedBody: "hello",
      draft: "hello",
    });
    expect(draft.status).toBe("saved");
    expect(draft.canSave).toBe(false);
  });

  it("is unsaved when the stored note has been edited", () => {
    const draft = describeNoteDraft({
      ...base,
      savedBody: "hello",
      draft: "hello!",
    });
    expect(draft.status).toBe("unsaved");
    expect(draft.canSave).toBe(true);
  });

  it("does not offer to save a stored note cleared to blank", () => {
    const draft = describeNoteDraft({ ...base, savedBody: "hello", draft: "" });
    expect(draft.status).toBe("empty");
    expect(draft.canSave).toBe(false);
  });

  it("allows exactly the maximum length", () => {
    const draft = describeNoteDraft({ ...base, draft: "a".repeat(10) });
    expect(draft.overBy).toBe(0);
    expect(draft.canSave).toBe(true);
  });

  it("reports how far over the limit the text is and refuses to save", () => {
    const draft = describeNoteDraft({ ...base, draft: "a".repeat(13) });
    expect(draft).toEqual({
      length: 13,
      overBy: 3,
      canSave: false,
      status: "too-long",
    });
  });

  it("is saving while a save is in flight, whatever the text", () => {
    const draft = describeNoteDraft({
      ...base,
      draft: "a".repeat(13),
      saving: true,
    });
    expect(draft.status).toBe("saving");
    expect(draft.canSave).toBe(false);
  });

  it("treats surrounding whitespace as already saved, as the server trims it", () => {
    const draft = describeNoteDraft({
      ...base,
      savedBody: "hello",
      draft: "  hello\n",
    });
    expect(draft.status).toBe("saved");
  });
});
