// PROTOTYPE — throwaway. Lives on the `prototype/notification-feed` branch only.
// Answers: does SuprSend's Node SDK + headless feed work for Cadence's Notification Feed?
import { createPrivateKey, sign } from "node:crypto";
import { Suprsend, WorkflowTriggerRequest } from "@suprsend/node-sdk";

// Nothing in the repo loads .env yet (see "Sign up for the chosen vendor" ticket).
try {
  process.loadEnvFile();
} catch {}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`PROTOTYPE: ${name} missing from .env`);
  return value;
}

export const WORKFLOW_SLUG = "cadence-notification-prototype";

export function distinctIdFor(userId: number) {
  return `cadence-user-${userId}`;
}

// --- Feed user token: ES256 JWT, signed server-side with SUPRSEND_SIGNING_KEY ---

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function signUserToken(userId: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    entity_type: "subscriber",
    entity_id: distinctIdFor(userId),
    iat: now,
    exp: now + 60 * 60,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(env("SUPRSEND_SIGNING_KEY").replace(/\\n/g, "\n"));
  // JWS wants raw r||s, not DER.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

export function publicKey() {
  return env("SUPRSEND_PUBLIC_KEY");
}

// --- Catalogue events (from "Notification catalogue: which events notify whom") ---

export type Urgency = "action" | "fyi";

export const SAMPLE_EVENTS = {
  "refund-request-opened": {
    urgency: "action",
    title: "Refund Request opened",
    body: "Emma Wilson asked for a refund on **Intro to TypeScript** ($49).",
    url: "/admin/refunds",
  },
  "refund-request-decided": {
    urgency: "fyi",
    title: "Refund Request approved",
    body: "Your refund for **Intro to TypeScript** was approved. Your Enrollment has ended.",
    url: "/courses",
  },
  "refund-issued": {
    urgency: "fyi",
    title: "Refund issued",
    body: "$49 is on its way back to your card.",
    url: "/courses",
  },
  "refund-failed": {
    urgency: "action",
    title: "Refund failed",
    body: "The payout for Emma Wilson's refund on **Intro to TypeScript** failed.",
    url: "/admin/refunds",
  },
  "question-asked": {
    urgency: "action",
    title: "New Question",
    body: "James Park asked in *Generics in Practice*: “Why does `infer` only work in conditional types?”",
    url: "/instructor/questions",
  },
  "answer-given": {
    urgency: "fyi",
    title: "Your Question was answered",
    body: "Sarah Chen answered your Question in *Generics in Practice*.",
    url: "/courses",
  },
  "seat-claimed": {
    urgency: "fyi",
    title: "Seat claimed",
    body: "Olivia Martinez claimed a Seat on **React Fundamentals** (4 of 10 used).",
    url: "/team",
  },
  "new-enrollment": {
    urgency: "fyi",
    title: "New Enrollment",
    body: "Liam Thompson enrolled in **Intro to TypeScript**.",
    url: "/instructor",
  },
} satisfies Record<string, { urgency: Urgency; title: string; body: string; url: string }>;

export type SampleEventKey = keyof typeof SAMPLE_EVENTS;

let client: InstanceType<typeof Suprsend> | undefined;
function suprsend() {
  client ??= new Suprsend(env("SUPRSEND_WORKSPACE_KEY"), env("SUPRSEND_WORKSPACE_SECRET"));
  return client;
}

export async function triggerSample(
  eventKey: SampleEventKey,
  recipient: { id: number; name: string; email: string }
) {
  const event = SAMPLE_EVENTS[eventKey];
  const request = new WorkflowTriggerRequest(
    {
      workflow: WORKFLOW_SLUG,
      recipients: [
        {
          distinct_id: distinctIdFor(recipient.id),
          // No $email here: inline channels made SuprSend skip the Inbox node
          // ("no common channels found between delivery-node channels and '$channels'").
          name: recipient.name,
        },
      ],
      data: { event: eventKey, ...event },
    },
    { idempotency_key: `${eventKey}-${recipient.id}-${Date.now()}` }
  );
  return suprsend().workflows.trigger(request);
}
