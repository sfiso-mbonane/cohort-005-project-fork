import { statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fails when a file is too big for an agent to read in one go.
// Tokens are estimated cheaply as bytes / 4.
//
// Usage: tsx scripts/check-file-tokens.ts <file>...
// The pre-commit hook passes the staged files.

export const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;

// Generated or vendored files nobody edits by hand.
const IGNORED = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)skills-lock\.json$/,
  /^drizzle\//,
  /\.(db|db-shm|db-wal|png|jpe?g|gif|webp|ico|svg|woff2?|ttf|pdf)$/,
];

export function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

export function isIgnored(path: string): boolean {
  return IGNORED.some((pattern) => pattern.test(path));
}

export type OversizedFile = { path: string; tokens: number };

export function findOversizedFiles(
  files: { path: string; bytes: number }[]
): OversizedFile[] {
  return files
    .filter((file) => !isIgnored(file.path))
    .map((file) => ({ path: file.path, tokens: estimateTokens(file.bytes) }))
    .filter((file) => file.tokens > MAX_TOKENS);
}

function guidanceFor(path: string): string {
  if (/\.test\.tsx?$/.test(path)) {
    return [
      "This is a test file. Split it by behaviour under test:",
      "- Move each top-level `describe` block into its own `<subject>.<behaviour>.test.ts` file.",
      "- Move shared setup, builders and fixtures into a fixtures file next to the tests",
      "  (inside a module, keep it in that module's `tests/` folder).",
    ].join("\n");
  }
  if (/^app\/routes\//.test(path)) {
    return [
      "This is a route module. Keep the route thin:",
      "- Move loader/action business logic into a deep module under `app/modules/<name>/`",
      "  (see app/modules/README.md) and call it through the module's entry point.",
      "- Move large JSX sections into components in `app/components/`.",
      "- Leave only the loader, action, and top-level page component in the route file.",
    ].join("\n");
  }
  if (/\.tsx?$/.test(path)) {
    return [
      "Split this file by responsibility:",
      "- Identify groups of functions that change together and move each group to its own file.",
      "- If it is domain logic, make it a deep module under `app/modules/<name>/` with the",
      "  implementation in `lib/` and a small entry point (see app/modules/README.md).",
      "- Keep types next to the code that owns them; do not create a catch-all types file.",
    ].join("\n");
  }
  if (/\.md$/.test(path)) {
    return [
      "Split this document by topic:",
      "- Move each major section into its own file and link to it from a short index.",
      "- Keep the top-level file to what a reader needs first.",
    ].join("\n");
  }
  return "Split this file into smaller files, each with a single responsibility.";
}

export function formatReport(oversized: OversizedFile[]): string {
  const sections = oversized.map(
    (file) =>
      `✖ ${file.path} is ~${file.tokens} tokens (limit ${MAX_TOKENS}).\n${guidanceFor(file.path)}`
  );
  return [
    `File size check failed: ${oversized.length} file(s) exceed ~${MAX_TOKENS} tokens (bytes / 4).`,
    "",
    ...sections.flatMap((section) => [section, ""]),
    "Rules for splitting:",
    "- Do NOT shrink the file by minifying, deleting comments, or shortening names.",
    "- Do NOT split arbitrarily (e.g. part1/part2). Each new file needs a name that says what it does.",
    "- Behaviour must not change: run `npm run check` after splitting.",
  ].join("\n");
}

function main(paths: string[]): number {
  const files = paths.flatMap((path) => {
    try {
      return [{ path, bytes: statSync(path).size }];
    } catch {
      return []; // deleted or unreadable: nothing to check
    }
  });
  const oversized = findOversizedFiles(files);
  if (oversized.length === 0) return 0;
  console.error(formatReport(oversized));
  return 1;
}

const isRunDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isRunDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
