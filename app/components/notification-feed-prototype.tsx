// PROTOTYPE — throwaway (prototype/notification-feed branch).
// Three structurally different Notification Feeds, switchable via ?variant=A|B|C,
// all reading the REAL SuprSend Staging feed through @suprsend/web-sdk (headless).
//   A: bell in the sidebar header → dropdown popover
//   B: "Notifications" nav item with unread count → full page at /notifications
//   C: top bar bell → right-hand drawer split into Needs action / Updates
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, useFetcher, useNavigate, useSearchParams } from "react-router";
import type { Feed, IFeedData, IRemoteNotification } from "@suprsend/web-sdk";
import { Bell, BellDot, Check, CheckCheck, Archive, X, Circle, Send } from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------- feed hook

type Urgency = "action" | "fyi";

interface FeedState {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  data?: IFeedData;
  reachability?: string;
  log: string[];
}

interface FeedApi extends FeedState {
  notifications: IRemoteNotification[];
  unreadCount: number;
  unseenCount: number;
  markAsRead(id: string): Promise<void>;
  markAsUnread(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  markAsArchived(id: string): Promise<void>;
  markSeen(ids: string[]): Promise<void>;
  resetBadge(): Promise<void>;
}

const FeedContext = createContext<FeedApi | null>(null);

export function useNotificationFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("PROTOTYPE: NotificationFeedProvider missing");
  return ctx;
}

export function urgencyOf(n: IRemoteNotification): Urgency {
  try {
    return JSON.parse(n.message.extra_data ?? "{}").urgency === "action" ? "action" : "fyi";
  } catch {
    return "fyi";
  }
}

export function NotificationFeedProvider({
  userId,
  children,
}: {
  userId: number | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<FeedState>({ status: "idle", log: [] });
  const feedRef = useRef<Feed | null>(null);

  const log = useCallback((line: string) => {
    console.log("[PROTOTYPE feed]", line);
    setState((s) => ({ ...s, log: [`${new Date().toLocaleTimeString()} ${line}`, ...s.log].slice(0, 30) }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const res = await fetch("/api/prototype-notifications");
        if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
        const { publicKey, distinctId, userToken } = await res.json();
        const { SuprSend } = await import("@suprsend/web-sdk");
        const client = new SuprSend(publicKey);
        const identified = await client.identify(distinctId, userToken, {
          refreshUserToken: async () => {
            const r = await fetch("/api/prototype-notifications");
            return (await r.json()).userToken;
          },
        });
        log(`identify ${distinctId} → ${JSON.stringify(identified)}`);
        if (cancelled) return;

        const feed = client.feeds.initialize({ pageSize: 20, reachability: true });
        feedRef.current = feed;
        feed.emitter.on("feed.store_update", (data) => {
          setState((s) => ({ ...s, status: "ready", data: { ...data } }));
        });
        feed.emitter.on("feed.new_notification", (n) => log(`socket: new ${n.n_id} "${n.message.header}"`));
        feed.emitter.on("feed.reachability_change", (r) =>
          setState((s) => ({ ...s, reachability: r.status }))
        );
        feed.initializeSocketConnection();
        const fetched = await feed.fetch();
        log(`fetch → ${JSON.stringify(fetched?.status ?? fetched)}`);
        teardown = () => {
          feed.remove();
          client.reset({ unsubscribePush: false });
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`ERROR ${message}`);
        setState((s) => ({ ...s, status: "error", error: message }));
      }
    })();

    return () => {
      cancelled = true;
      teardown?.();
      feedRef.current = null;
    };
  }, [userId, log]);

  const call = useCallback(
    async (label: string, fn: (feed: Feed) => Promise<unknown>) => {
      const feed = feedRef.current;
      if (!feed) return;
      const res = await fn(feed);
      log(`${label} → ${JSON.stringify((res as { status?: string })?.status ?? res)}`);
    },
    [log]
  );

  const notifications = (state.data?.notifications ?? []).filter((n) => !n.archived);
  const api: FeedApi = {
    ...state,
    notifications,
    unreadCount: notifications.filter((n) => !n.read_on).length,
    unseenCount: state.data?.meta?.badge ?? notifications.filter((n) => !n.seen_on).length,
    markAsRead: (id) => call(`markAsRead ${id}`, (f) => f.markAsRead(id)),
    markAsUnread: (id) => call(`markAsUnread ${id}`, (f) => f.markAsUnread(id)),
    markAllAsRead: () => call("markAllAsRead", (f) => f.markAllAsRead()),
    markAsArchived: (id) => call(`markAsArchived ${id}`, (f) => f.markAsArchived(id)),
    markSeen: (ids) => (ids.length ? call(`markBulkAsSeen ×${ids.length}`, (f) => f.markBulkAsSeen(ids)) : Promise.resolve()),
    resetBadge: () => call("resetBadgeCount", (f) => f.resetBadgeCount()),
  };

  return <FeedContext.Provider value={api}>{children}</FeedContext.Provider>;
}

// ---------------------------------------------------------------- shared bits

function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Body arrives as markdown from the template; the prototype only renders **bold**.
function Body({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p.replace(/[*`]/g, "")}</span>
      )}
    </p>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white", className)}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

function FeedStatus() {
  const feed = useNotificationFeed();
  if (feed.status === "error") return <p className="p-4 text-sm text-red-600">Feed error: {feed.error}</p>;
  if (feed.status !== "ready") return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (feed.notifications.length === 0)
    return <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>;
  return null;
}

function useOpenNotification() {
  const feed = useNotificationFeed();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (n: IRemoteNotification) => {
    if (!n.read_on) feed.markAsRead(n.n_id);
    if (n.message.url) {
      const url = new URL(n.message.url, window.location.origin);
      if (params.get("variant")) url.searchParams.set("variant", params.get("variant")!);
      navigate(url.pathname + url.search);
    }
  };
}

// ---------------------------------------------------------------- Variant A
// Bell in the sidebar header; dropdown popover. Badge = unseen. Opening clears the badge;
// clicking a row marks it read and navigates. "Mark all read" in the header.

export function VariantABell() {
  const feed = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const open_ = useOpenNotification();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    feed.resetBadge();
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-4" />
        <CountBadge count={feed.unseenCount} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={() => feed.markAllAsRead()}
              disabled={feed.unreadCount === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            <FeedStatus />
            {feed.notifications.map((n) => (
              <button
                key={n.n_id}
                onClick={() => {
                  open_(n);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-accent",
                  !n.read_on && "bg-primary/5"
                )}
              >
                <span className="mt-1.5 w-2 shrink-0">
                  {!n.read_on && <Circle className="size-2 fill-primary text-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", !n.read_on && "font-semibold")}>{n.message.header}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.created_on)}</span>
                  </span>
                  <Body text={n.message.text} className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Variant B
// Sidebar nav item with unread count; a full page with All / Unread tabs and an explicit
// read/unread toggle per row. Nothing is marked read just by looking.

export function VariantBNavItem() {
  const feed = useNotificationFeed();
  return (
    <NavLink
      to="/notifications?variant=B"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      <span className="flex-1">Notifications</span>
      <CountBadge count={feed.unreadCount} />
    </NavLink>
  );
}

export function VariantBPage() {
  const feed = useNotificationFeed();
  const open_ = useOpenNotification();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const rows = tab === "all" ? feed.notifications : feed.notifications.filter((n) => !n.read_on);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{feed.unreadCount} unread</p>
        </div>
        <button
          onClick={() => feed.markAllAsRead()}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Mark all as read
        </button>
      </div>
      <div className="mb-4 flex gap-1 border-b">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm capitalize",
              tab === t ? "border-primary font-medium" : "border-transparent text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <FeedStatus />
      <table className="w-full text-sm">
        <tbody>
          {rows.map((n) => (
            <tr key={n.n_id} className="group border-b">
              <td className="w-6 py-3 align-top">
                {!n.read_on && <Circle className="mt-1.5 size-2 fill-primary text-primary" />}
              </td>
              <td className="cursor-pointer py-3 pr-4" onClick={() => open_(n)}>
                <div className={cn(!n.read_on && "font-semibold")}>{n.message.header}</div>
                <Body text={n.message.text} className="text-muted-foreground" />
              </td>
              <td className="w-24 py-3 text-right align-top text-xs text-muted-foreground">
                {new Date(n.created_on).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="w-10 py-3 text-right align-top">
                <button
                  title={n.read_on ? "Mark as unread" : "Mark as read"}
                  onClick={() => (n.read_on ? feed.markAsUnread(n.n_id) : feed.markAsRead(n.n_id))}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                >
                  {n.read_on ? <Circle className="size-3.5" /> : <Check className="size-3.5" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Variant C
// A slim top bar with a bell that opens a right-hand drawer, split by urgency.
// Needs action stays unread until handled (click-through) or dismissed (archive);
// Updates (FYI) are marked read as soon as the drawer is opened.

export function VariantCTopBar() {
  const feed = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const open_ = useOpenNotification();
  const actionNeeded = feed.notifications.filter((n) => urgencyOf(n) === "action");
  const updates = feed.notifications.filter((n) => urgencyOf(n) === "fyi");
  const pendingActions = actionNeeded.filter((n) => !n.read_on).length;
  const unreadUpdates = updates.filter((n) => !n.read_on).length;

  function openDrawer() {
    setOpen(true);
    updates.filter((n) => !n.read_on).forEach((n) => feed.markAsRead(n.n_id));
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex h-12 items-center justify-end gap-3 border-b bg-background/90 px-6 backdrop-blur">
        {pendingActions > 0 && (
          <button onClick={openDrawer} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            {pendingActions} need{pendingActions === 1 ? "s" : ""} your action
          </button>
        )}
        <button onClick={openDrawer} className="relative rounded-md p-2 hover:bg-accent" title="Notifications">
          {unreadUpdates + pendingActions > 0 ? <BellDot className="size-5" /> : <Bell className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-[420px] flex-col bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FeedStatus />
              {actionNeeded.length > 0 && (
                <section className="p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Needs action</h3>
                  <div className="space-y-2">
                    {actionNeeded.map((n) => (
                      <div
                        key={n.n_id}
                        className={cn(
                          "rounded-lg border p-3",
                          n.read_on ? "opacity-60" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{n.message.header}</div>
                          <button
                            title="Dismiss"
                            onClick={() => feed.markAsArchived(n.n_id)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        </div>
                        <Body text={n.message.text} className="mt-1 text-xs text-muted-foreground" />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{timeAgo(n.created_on)}</span>
                          <button
                            onClick={() => {
                              open_(n);
                              setOpen(false);
                            }}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground"
                          >
                            Review →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {updates.length > 0 && (
                <section className="border-t p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updates</h3>
                  <ul>
                    {updates.map((n) => (
                      <li key={n.n_id}>
                        <button
                          onClick={() => {
                            open_(n);
                            setOpen(false);
                          }}
                          className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <Body text={n.message.text} className="flex-1" />
                          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.created_on)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- dev panel
// Fires catalogue events at the current user through the real Node SDK, and shows the
// raw feed state (rule 5: surface the state).

const EVENTS = [
  "refund-request-opened",
  "refund-request-decided",
  "refund-issued",
  "refund-failed",
  "question-asked",
  "answer-given",
  "seat-claimed",
  "new-enrollment",
];

export function NotificationDevPanel() {
  const feed = useNotificationFeed();
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-16 left-60 z-[60] w-80 rounded-lg border bg-zinc-900 text-[11px] text-zinc-100 shadow-xl">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 font-semibold">
        <Send className="size-3" /> PROTOTYPE · feed {feed.status}
        {feed.reachability && ` · ${feed.reachability}`} · {feed.unreadCount} unread · badge {feed.unseenCount}
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-700 p-3">
          <div className="grid grid-cols-2 gap-1">
            {EVENTS.map((e) => (
              <fetcher.Form key={e} method="post" action="/api/prototype-notifications">
                <button name="event" value={e} className="w-full rounded bg-zinc-700 px-2 py-1 text-left hover:bg-zinc-600">
                  {e}
                </button>
              </fetcher.Form>
            ))}
          </div>
          {fetcher.data != null && (
            <pre className="max-h-20 overflow-auto whitespace-pre-wrap text-zinc-400">
              {JSON.stringify(fetcher.data)}
            </pre>
          )}
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-zinc-400">{feed.log.join("\n")}</pre>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-zinc-500">
            meta {JSON.stringify(feed.data?.meta)}
            {"\n"}
            {feed.notifications
              .map((n) => `${n.read_on ? "R" : "·"}${n.seen_on ? "S" : "·"} ${urgencyOf(n)} ${n.message.header}`)
              .join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
