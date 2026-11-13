// PROTOTYPE — throwaway (prototype/notification-feed branch).
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.prototype-notifications";
import { db } from "~/db";
import { users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import {
  SAMPLE_EVENTS,
  distinctIdFor,
  publicKey,
  signUserToken,
  triggerSample,
  type SampleEventKey,
} from "~/lib/notifications-prototype.server";

async function requireUser(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw new Response("Select a user from the DevUI panel", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Response("Unknown user", { status: 401 });
  return user;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    publicKey: publicKey(),
    distinctId: distinctIdFor(user.id),
    userToken: signUserToken(user.id),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const event = String(form.get("event"));
  if (!(event in SAMPLE_EVENTS)) throw new Response("Unknown event", { status: 400 });
  const started = Date.now();
  const response = await triggerSample(event as SampleEventKey, user);
  console.log("[PROTOTYPE] trigger", event, "→", JSON.stringify(response), `${Date.now() - started}ms`);
  return { event, response };
}
