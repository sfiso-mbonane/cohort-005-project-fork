# SuprSend: clearing shared admin Notifications and batching New Enrollments

**Date checked:** 2026-11-16. Ticket: [#8](https://github.com/sfiso-mbonane/cohort-005-project-fork/issues/8).
SDK versions: `@suprsend/node-sdk` 1.15.1 and `@suprsend/web-sdk` 5.4.0, as installed for the `prototype/notification-feed` branch.

## Question

1. When one Platform Admin handles a Refund Request or a failed Refund, can our server archive (or mark read) the **other** admins' Inbox copies of that Notification? What is the API, how do we address "the copies of this event", and what are the limits?
2. Can SuprSend batch New Enrollments into one Notification per Instructor per Course over a time window? Which node, what key, how does the template read the items, and what are the window limits?

## TL;DR

1. **Yes. Verified against Staging.** Trigger the Notification **once**, with every admin in `recipients` and an `idempotency_key` derived from the domain event, for example `refund-request-opened:<refundRequestId>`. Each admin's Inbox message carries that same `idempotency_key`. When one admin handles it, the server:
   - calls `GET /v1/message/?idempotency_key=<key>&channel=inbox` (`suprsend.messages.list(...)`),
   - drops the handler's own copy from the results,
   - calls `PATCH /v1/bulk/message/` with `action: "archived"` (or `"read"`) for each remaining `message_id` (`suprsend.messages.bulk_update(...)`).

   The archived copy then disappears from that admin's default Inbox feed.
2. **Yes, but this is from the docs only. I did not run it on Staging.** Use a **Batch** node with `batch_key: ".course_id"` and a fixed window such as `fixed_window: "1h"`. SuprSend opens one batch per **recipient + tenant + workflow + batch_key value**, so sending to the Instructor with key `course_id` gives one Notification per Instructor per Course. The template reads `{{$batched_events_count}}` and `{{#each $batched_events}}…{{/each}}`. Each batched event is the trigger's `data`.

   Window limits:
   - Fixed window: greater than 0 and at most 90 days.
   - Retained items: 1–100 (default 10). The count always covers every item, even ones not retained.

   The Batch node batches **every** run of its workflow, so New Enrollment needs its own workflow, or its own Branch path in front of the batch.

## 1. Clearing other admins' copies

### The API

The Node SDK exposes `suprsend.messages` (`node_modules/@suprsend/node-sdk/src/messages_api.js`):

- `list(options)` → `GET https://hub.suprsend.com/v1/message/`. Array options `recipient_id`, `status`, and `category` are sent as `key[]=…`.
- `bulk_update(messages)` → `PATCH https://hub.suprsend.com/v1/bulk/message/` with body `{ messages: [{ message_id, action }] }`.
- Both are signed with the workspace key/secret, the same as triggers. No extra credential is needed.

**List Messages** ([docs](https://docs.suprsend.com/reference/list-messages)) filters:

- `idempotency_key`: "the idempotency key associated with the message at trigger time"
- `execution_id`
- `workflow_slug`
- `recipient_id[]`
- `channel`
- `status[]`
- `category[]`
- `tenant_id`
- `created_at_gte` / `created_at_lte`
- `message_id`

`limit` defaults to 10, with a maximum of 1000. Pagination uses `after`/`before` cursors. Each result includes:

- `message_id`
- `idempotency_key`
- `execution_id`
- `recipient.distinct_id`
- `channel`
- `status`
- `is_read`
- `is_archived`

**Bulk Update Message Status** ([docs](https://docs.suprsend.com/reference/bulk-update-messages)):

- Batch size: 1–1000 items, with no duplicate `message_id`.
- Inbox-only actions:
  - `read` / `unread` toggle `is_read`.
  - `archived` / `unarchived` toggle `is_archived`.
  - Both pairs can be flipped repeatedly.
- `seen` and `clicked` work on all channels, but status only moves forward.
- Response: `202` with per-item `records[]` (`status_code` 202 / 404 / 422 / 500). A 202 overall does **not** mean every item succeeded. Check each record.

### Addressing "the copies of this event": `idempotency_key`

| Candidate | Verdict |
|---|---|
| **`idempotency_key`** | **Use this.** Set once per trigger. With multiple `recipients`, SuprSend fans the trigger out into one execution per recipient ([trigger docs](https://docs.suprsend.com/docs/trigger-workflow): up to 100 recipients per trigger, "converted into separate workflow triggers"). Every copy keeps the same key, which is filterable in List Messages. Max 255 chars ([idempotent requests](https://docs.suprsend.com/reference/idempotent-requests); SDK JSON schema `request_json/workflow_trigger.json`). |
| `execution_id` | Per recipient (`dsl_w…_<requestId>_0`, `…_1`), so it doesn't address the group. The trigger's 202 response only returns a request id, not message ids. |
| `tenant_id` / `category` / `workflow_slug` | Too coarse. They match every Notification of that kind, not one event. |
| `metadata` on the trigger | Not a List Messages filter. |
| `cancellation_key` | Only stops runs still inside the workflow (via a Cancel node). It doesn't touch Inbox messages already delivered. |

### Staging experiment (2026-11-16)

Scripts were throwaway and lived outside the repo. Workflow: `cadence-notification-prototype`.

1. I triggered **one** request with `recipients: [cadence-research-admin-a, cadence-research-admin-b]` and `idempotency_key = research-refund-request-opened-1794818053644`. Then I sent **the identical request again**. Both returned 202.
2. Straight after the trigger, `messages.list({ idempotency_key, channel: "inbox" })` returned `count 0`. About 45 seconds later it returned **2** messages, one per admin, both with that `idempotency_key`. The duplicate trigger was suppressed, so there were 2 messages, not 4.
3. `messages.bulk_update([{ message_id: <admin-b's>, action: "archived" }])` returned `{"records":[{"message_id":"01M7HQW6R1D4P37YN5AHXHA6TZ","status_code":202}]}`. Re-listing **immediately** still showed `is_archived: false`. About 30 seconds later it showed `is_archived: true` for admin-b and `false` for admin-a.
4. I fetched each admin's feed the way `@suprsend/web-sdk` does (`GET https://inboxs.live/v1/feed/notifications?distinct_id=…`, public key plus signed user JWT):
   - admin-b's default feed was **empty**.
   - admin-a's still showed the Notification.

   The feed's `n_id` equals the messages API `message_id`.

### Limits and gotchas

- **Idempotency suppression lasts 24 hours.** SuprSend "will skip processing requests with same `idempotency_key` for next 24 hours" ([docs](https://docs.suprsend.com/reference/idempotent-requests)), and that held on Staging. The key must therefore be unique **per occurrence** of the event. A second payout failure on the same Refund needs a new key, for example one that includes the failure or attempt id. Otherwise it is silently dropped.
- **Everything is asynchronous.** Messages appeared in List Messages tens of seconds after the 202, and the archive took effect tens of seconds after its 202. If an admin handles the item within seconds of it being raised, `list` may return nothing or only some copies. The clear-up should run as a retried background job: re-list after a delay, and stop when every copy is archived or a time limit passes. It should not be a one-shot inline call.
- **Fan-out cap.** One trigger takes at most 100 recipients. If Cadence ever has more than 100 Platform Admins, it needs several triggers. Those can reuse the same key only if each trigger is a separate SuprSend request id. Untested, so it's safer to use `<key>:<chunk>` and list per chunk.
- **Bulk update cap.** 1000 messages per call, and List returns up to 1000 per page.
- **Admins added after the trigger** never received a copy, so there is nothing to clear for them.
- **Real-time update in an open feed: not verified.** `@suprsend/web-sdk` subscribes to `notification_update` and `bulk_notification_update` socket events (`dist/es/index.js`), which suggests a server-side archive is pushed to open tabs. I did not observe this. In any case the next feed fetch excludes the archived copy.
- **`read` vs `archived`.** `read` keeps the item in the feed, just not bold. `archived` removes it from the default feed. For "someone else handled this", `archived` matches the prototype decision. The handler's own copy can be archived or marked read in the same call.
- Leftover Staging data: test subscribers `cadence-research-admin-a` and `cadence-research-admin-b` each have one research Notification (b's is archived).

## 2. Batching New Enrollments

### Node and keying

The Batch node ([guide](https://docs.suprsend.com/docs/batch); [JSON schema](https://github.com/suprsend/schema/blob/main/workflow/v1/node_batch_schema.json)) has these properties:

- `mode`: `accumulate_all`, or `flush_leading_item` (send the first item at once, then batch the rest).
- `window_type`: `fixed`, `dynamic`, or `relative_to`.
  - `fixed_window` uses the format `^(\d+[dhms])+$`, for example `1h`, `30m`, `1h30m`.
  - `dynamic_window_expr` is a jq expression over the payload that resolves to seconds, a duration string, or a future RFC 3339 timestamp. If it is missing or invalid, the run stops with an error.
- `batch_key`: a **jq expression over the trigger payload**, for example `".course_id"`.
- `retain_count`: 1–100, default 10.
- `retain_order`: `first` (default) or `last`. `last` gives the newest N, newest first.

Grouping: "one open batch per recipient + tenant + workflow + `batch_key` value" (SuprSend's own [workflow-schema skill notes](https://github.com/suprsend/skills/blob/main/skills/suprsend-workflow-schema/references/node-batch.md); the public doc says "recipient and batch key"). The window opens on the first event. An open window can't be extended or changed by later triggers.

Duration rules on save (same skill notes, "Duration format"):

- Total greater than 0 and at most 90 days.
- Hours 0–23, minutes and seconds 0–59 (roll over, so write `1h30m`, not `90m`).
- No spaces.

For "one Notification per Instructor per Course": recipient = the Instructor, `batch_key: ".course_id"`, `window_type: "fixed"`, `fixed_window: "1h"` (or whatever window the product picks).

```json
{ "node_type": "batch",
  "properties": { "mode": "accumulate_all", "window_type": "fixed", "fixed_window": "1h",
                  "batch_key": ".course_id", "retain_count": 10, "retain_order": "last" } }
```

### Template

After the batch, templates get:

- `$batched_events`: the array of each trigger's `data`, capped by `retain_count`.
- `$batched_events_count`: the true total, not capped. It is plural; the singular form fails to render.
- `$batch_key`.

```handlebars
{{$batched_events_count}} new Enrollment(s) in {{$batched_events.[0].course_title}}:
{{#each $batched_events}}- {{student_name}}{{/each}}
```

This uses only the syntax shown in SuprSend's docs (`$batched_events.[0].field`, `#each`). I haven't checked which comparison helpers SuprSend's Handlebars supports for a singular/plural switch.

Course-level fields such as `course_title` and `url` must be inside each trigger's `data`. Read them from `$batched_events.[0]`.

A Transform node can derive extra keys, but `$batched_events`, `$batched_events_count`, `$batch_key`, and `$idempotency_key` are reserved names. Write to a new key instead.

Template mock data has an "Enable batching" toggle for previewing ([guide](https://docs.suprsend.com/docs/batch)).

### Batch vs Digest

**Digest** sends on a recurring schedule, such as daily at 09:00, optionally from the category's per-user digest schedule. **Batch** is a window that starts at the first event. "New Enrollments over a time window" is a Batch.

### Constraints

- **The Batch node batches its whole workflow.** The prototype sends every event through the single `cadence-notification-prototype` workflow. A Batch node there would merge different event types for the same recipient and key. New Enrollment needs **its own workflow**, for example `new-enrollment`, or a Branch on `.event` so that only enrollments reach the Batch node.
- **Delay.** Instructors see nothing until the window closes, unless `mode: flush_leading_item` sends the first enrollment at once and batches the rest.
- **Not verified on Staging.** Building a Batch workflow needs a dashboard edit or the management API. The `.env` keys are workspace keys, not a management/service token, so I did not test this part.

## What this means for trigger shape (next ticket: "Triggering and recipient sync")

- **Every trigger carries `idempotency_key`**, built from the domain event and **unique per occurrence**. Repeats within 24 hours are silently dropped. Examples:
  - `refund-request-opened:<refundRequestId>`
  - `refund-failed:<refundId>:<failureId>`
  - `new-enrollment:<enrollmentId>`

  Max 255 characters, trimmed.
- **Shared admin Notifications are one trigger with all admins in `recipients`** (≤100), not one trigger per admin. Otherwise the copies don't share a key.
- **Store the key on our side**, for example on the Refund Request or Refund row, or derive it deterministically from the row. The "handled" action needs it to find the copies.
- **Clearing is a background, retried job.** Steps: `messages.list({ idempotency_key, channel: "inbox" })`, filter out the handler, `messages.bulk_update(... "archived")`, check the per-record `status_code`, re-list until settled.
- **New Enrollment triggers go to a dedicated workflow (or a branch) with a Batch node keyed on `.course_id`.** The recipient is the Instructor's `distinct_id`, so `course_id` must be a top-level field in `data`. Every field the template shows must also be in each trigger's `data`, for example `course_title`, `student_name`, and `url`.
- **If we use `tenant_id`, it must be the same for all enrollments in one Course.** Batches are also split per tenant.
- Carried over from the prototype: no inline `$email` on recipients, because it makes SuprSend skip the Inbox node. A 202 only means "accepted".

## Sources

- SuprSend Node SDK 1.15.1 source: `node_modules/@suprsend/node-sdk/src/messages_api.js`, `src/workflow_request.js`, `src/request_json/workflow_trigger.json`
- SuprSend web SDK 5.4.0: `node_modules/@suprsend/web-sdk/dist/es/index.js` (feed URL `…/v1/feed/notifications`, store `archived` filter, socket `notification_update` / `bulk_notification_update`)
- https://docs.suprsend.com/reference/list-messages
- https://docs.suprsend.com/reference/bulk-update-messages
- https://docs.suprsend.com/reference/idempotent-requests
- https://docs.suprsend.com/docs/trigger-workflow
- https://docs.suprsend.com/docs/batch
- https://docs.suprsend.com/docs/best-practices-for-batching-digest
- https://github.com/suprsend/schema/blob/main/workflow/v1/node_batch_schema.json and `fragment_schema.json`
- https://github.com/suprsend/skills/blob/main/skills/suprsend-workflow-schema/references/node-batch.md and `workflow-schema-guide.md`
- Staging experiment, 2026-11-16 (described above)
