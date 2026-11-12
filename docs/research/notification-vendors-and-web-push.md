# Hosted notification vendors and web push reach for Cadence

**Date checked:** 2026-11-12. All pricing and limits below were checked on 2026-11-12 and may change.

## Question

Cadence (React Router v7, SQLite, Node server) needs a hosted notification vendor, with no self-hosting. It should have a free tier that works for development, require few new signups, offer a headless in-app feed API (we build our own UI), include a Node/TypeScript server SDK, support web push, send email through our existing Postmark account, support per-user preferences, and offer a dev/test mode that sends nothing real. Which of Knock, Novu Cloud, MagicBell, SuprSend, and Courier fits best? And how much reach does web push actually give us?

## TL;DR

**Shortlist:**

1. **SuprSend.** It is the only vendor here that meets all eight criteria from its own docs. Free tier: 10k notifications/month. It has a Postmark integration and its own VAPID web push, so we don't need FCM or OneSignal. It has a headless JS feed SDK with a real-time socket, a Node SDK, three-level preferences, and a Staging workspace with a Test Mode that delivers only to internal testers.
2. **Knock.** This is the strongest pick on the in-app feed and developer experience. Free tier: 10k messages/month with unlimited environments. It supports Postmark, has a headless `@knocklabs/client` with websockets, and has per-channel **sandbox mode** that renders messages without delivering them. The gap is web push: Knock has **no native VAPID web push**, only APNs, FCM, Expo, OneSignal, and Amazon SNS. We would need FCM or OneSignal, or we send web push ourselves.

**What to drop:**

- **MagicBell:** no Postmark integration, and only 1,000 deliveries/month on the free tier.
- **Courier:** no web push provider except via OneSignal or similar, and its no-delivery mock key is Enterprise-only.
- **Novu Cloud:** usable, but it has no native web push, and its demo email provider only reaches your own account email (300/month).

**Web push:** desktop reach is good. On iOS it only works for Home Screen web apps. Permission grant rates are low. Email through Postmark should stay the default channel, with web push opt-in only.

## Comparison (checked 2026-11-12)

| Criterion | Knock | Novu Cloud | MagicBell | SuprSend | Courier |
|---|---|---|---|---|---|
| 1. Free tier / paid entry | Free: 10,000 messages/mo, unlimited environments. Starter: $250/mo for 50k, then $0.005/msg | Free: 10,000 workflow runs/mo, 5 workflows, 2 envs (Dev+Prod), 24h activity retention. Pro: from $30/mo for 30k runs, $1.20/1k over | Free "Builder": 1,000 deliveries/mo, 1 project. Startup: $249/mo for 50k, $0.0025/extra | Free: 10k notifications/mo, unlimited channels. Essentials: $100/mo (billed annually $1,200) for 50k, $2/1k extra | Free "Developer": up to 10k sends/mo. Business: $0.005 per send, including the first 10k |
| 2. New signups | Knock only. Bring Postmark; push needs FCM/OneSignal etc. | Novu only. Bring Postmark; push needs FCM/OneSignal etc. | MagicBell only (built-in VAPID web push), but email needs SES/SendGrid/Mailgun/SMTP | **SuprSend only.** Postmark plus its own VAPID web push | Courier only. Bring Postmark; web push needs OneSignal or similar |
| 3. Headless feed + real-time | Yes. `@knocklabs/client`, websocket | Yes. `@novu/js`, WebSocket | API exists (list, mark read/seen, archive); real-time via Ably connection | Yes. `@suprsend/web-sdk` feeds, socket | Yes. `@trycourier/courier-js`, socket |
| 4. Node/TS SDK | Yes. `knock-node` (GitHub knocklabs/knock-node) | Yes. `@novu/api` | Yes. `magicbell-js` (`ProjectClient`) | Yes. `@suprsend/node-sdk` (TypeScript typing unverified) | Yes. `@trycourier/courier` (typed, TS 4.9+) |
| 5. Web push | No native VAPID. APNs, FCM, Expo, OneSignal, SNS | No native VAPID. FCM, APNs, Expo, OneSignal, Pushpad, Pusher Beams, Push Webhook | **Native VAPID** | **Native VAPID** (SuprSend generates keys) | No native VAPID. FCM, OneSignal, others (12 push providers) |
| 6. Postmark | Yes | Yes | **No** (generic SMTP may work, unverified) | Yes | Yes |
| 7. Preferences | Per channel type, category, workflow | Global and per-workflow, per channel | Per category × channel | Global channel, category, and channel-within-category | Subscription topics + channel routing |
| 8. Dev/test mode | Dev environment + per-channel **sandbox mode** (no delivery); test email channel sends only to account members, 100/mo | Dev environment; demo email sends only to your account email, 300/mo | Separate projects for staging/prod (free tier has only 1 project) | Sandbox (30-day trial), **Staging with Test Mode** (internal testers or catch-all only) | Test environment and Test key; test email sends only to signup address; Mock key (no provider call) is Enterprise-only |

## Per-vendor notes

### Knock

- **Pricing:** Free: 10,000 messages, unlimited environments and channels. Starter: $250/mo plus usage, 50,000 messages, then $0.005 each. [knock.app/pricing](https://knock.app/pricing)
- **What counts as a message:** one notification delivered to one user on one channel. Steps skipped because of preferences don't count. [docs.knock.app/manage-your-account/knock-plans](https://docs.knock.app/manage-your-account/knock-plans)
- **Email:** Postmark is a supported provider. Knock's built-in email sender is labelled "testing only." [docs.knock.app/integrations/email/overview](https://docs.knock.app/integrations/email/overview) The test channel only delivers to members of your Knock account, up to 100/month. [docs.knock.app/integrations/email/knock-test](https://docs.knock.app/integrations/email/knock-test)
- **Push:** Amazon SNS, APNs, Expo, FCM, and OneSignal. Native VAPID web push isn't listed. [docs.knock.app/integrations/push/overview](https://docs.knock.app/integrations/push/overview)
- **In-app feed:** The in-app API "comes ready with websocket support." [docs.knock.app/in-app-ui/overview](https://docs.knock.app/in-app-ui/overview) The feeds API lets clients fetch messages and update their seen, read, interacted, and archived state. [docs.knock.app/in-app-ui/feeds/overview](https://docs.knock.app/in-app-ui/feeds/overview) There is a non-React package, `@knocklabs/client`, with "managed websocket connections." [docs.knock.app/in-app-ui/javascript/overview](https://docs.knock.app/in-app-ui/javascript/overview)
- **Server SDK:** Server SDKs exist for Node and seven other languages; the Node repo is github.com/knocklabs/knock-node. [docs.knock.app/developer-tools/sdks](https://docs.knock.app/developer-tools/sdks)
- **Preferences:** a PreferenceSet per user covering channel types, categories, and workflows. [docs.knock.app/concepts/preferences](https://docs.knock.app/concepts/preferences) Per-tenant preferences are Enterprise-only. [knock-plans](https://docs.knock.app/manage-your-account/knock-plans)
- **Dev/test:** Each environment has isolated data and its own API keys. [docs.knock.app/concepts/environments](https://docs.knock.app/concepts/environments) Sandbox mode, set per channel per environment, "enables you to generate and preview messages ... without delivering them." [docs.knock.app/integrations/overview](https://docs.knock.app/integrations/overview) Sandboxed messages don't count toward usage, and the in-app channel doesn't support sandbox mode. [knock-test](https://docs.knock.app/integrations/email/knock-test), [knock-plans](https://docs.knock.app/manage-your-account/knock-plans)

### Novu Cloud

- **Pricing:** Free: $0, 10,000 workflow runs/mo, up to 5 workflows, 2 environments (Dev and Prod), 24h activity retention, 3 team members. Pro: from $30/mo, 30,000+ runs, $1.20 per 1k extra, 20 workflows. [novu.co/pricing](https://novu.co/pricing)
- **Email:** Postmark is supported. [docs.novu.co/platform/integrations/email](https://docs.novu.co/platform/integrations/email) The demo email provider is capped at 300/month and only delivers to your logged-in account's address. It is Novu Cloud only. [docs.novu.co/platform/integrations/demo-providers](https://docs.novu.co/platform/integrations/demo-providers)
- **Push:** FCM, Expo, APNS, OneSignal, Push Webhook, Pusher Beams, and Pushpad. No VAPID or native web push is documented. [docs.novu.co/platform/integrations/push](https://docs.novu.co/platform/integrations/push)
- **In-app feed:** `@novu/js` is the headless client. It keeps a WebSocket open and offers list, count, read, archive, and snooze. `@novu/headless` is legacy. [docs.novu.co/platform/sdks/javascript](https://docs.novu.co/platform/sdks/javascript), [migration guide](https://docs.novu.co/platform/inbox/migration-guide)
- **Server SDK:** `@novu/api` (`npm add @novu/api`). [docs.novu.co/platform/sdks/server/typescript](https://docs.novu.co/platform/sdks/server/typescript)
- **Preferences:** set at workflow, subscriber-global, and subscriber-per-workflow level, resolved per channel. Critical workflows bypass opt-outs. [docs.novu.co/platform/concepts/preferences](https://docs.novu.co/platform/concepts/preferences) Novu's pages disagree on the exact order in which these levels are applied.
- **Dev/test:** Integrations are configured per environment. Dev environment, demo providers as above.

### MagicBell

- **Pricing:** Builder: $0, 1,000 deliveries/mo, 1 project. Startup: $249/mo, 50,000 deliveries, $0.0025 per extra, 5 projects. [magicbell.com/pricing](https://www.magicbell.com/pricing)
- **Email:** Ping Email, SendGrid, Mailgun, Amazon SES, and SMTP. **Postmark isn't listed.** [magicbell.com/docs/channels/email](https://www.magicbell.com/docs/channels/email) Postmark does accept SMTP using the server API token, at smtp.postmarkapp.com on ports 25, 2525, or 587. [postmarkapp.com SMTP guide](https://postmarkapp.com/developer/user-guide/send-email-with-smtp) So MagicBell over SMTP to Postmark is plausible, but neither vendor documents it as tested (**unverified**).
- **Web push:** native. You configure VAPID public and private keys, and the browser `PushSubscription` (endpoint, auth, p256dh) is stored as a channel token. [magicbell.com/docs/channels/web_push](https://www.magicbell.com/docs/channels/web_push)
- **In-app feed:** The API reference lists operations to list notifications, mark read, mark all seen, archive, and count unread. Inbox tokens carry a `connection_id` for "a specific Ably connection" (real-time). [magicbell.com/docs/api/reference](https://www.magicbell.com/docs/api/reference)
- **Server SDK:** `magicbell-js`, with a `ProjectClient` imported from `magicbell-js/project-client`. [magicbell.com/docs/libraries/magicbell-js](https://www.magicbell.com/docs/libraries/magicbell-js)
- **Preferences:** set by category and channel, via `GET`/`PUT /channels/user_preferences`. [API reference](https://www.magicbell.com/docs/api/reference)
- **Dev/test:** The quick start says to create separate projects for staging and production. [magicbell.com/docs/quick-start](https://www.magicbell.com/docs/quick-start) The free tier has only 1 project, so it has no separate dev environment. No sandbox or no-delivery mode was found (**unverified**).

### SuprSend

- **Pricing:** Free: $0, 10k notifications/mo, unlimited channels, no credit card. Essentials: $100/mo, billed annually at $1,200, 50k notifications/mo, $2 per 1k extra. [suprsend.com/pricing](https://www.suprsend.com/pricing) How many workspaces the free tier includes was not legible on the pricing page (**unverified**).
- **Email:** Postmark is a vendor, set up with a Server Token, a verified sender, and a webhook for delivery, open, and click status. It also supports fallback to other vendors. [docs.suprsend.com/docs/postmark](https://docs.suprsend.com/docs/postmark)
- **Web push:** SuprSend's own VAPID setup. "SuprSend generates the VAPID key pair for you," and the private key stays in SuprSend. It needs HTTPS (localhost is fine), `/serviceworker.js` at the site root, and permission asked from a user action. FCM is only mentioned for Android mobile push. [docs.suprsend.com/docs/web-push-quick-start](https://docs.suprsend.com/docs/web-push-quick-start), [docs.suprsend.com/docs/js-webpush](https://docs.suprsend.com/docs/js-webpush) Safari is not mentioned on these pages.
- **In-app feed:** The headless `@suprsend/web-sdk` provides `feeds.initialize()`, `initializeSocketConnection()`, `fetch()`, `markAsRead`, `markAsSeen`, `markAsArchived`, and `markAllAsRead`. [docs.suprsend.com/docs/js-inapp-feed](https://docs.suprsend.com/docs/js-inapp-feed)
- **Server SDK:** `@suprsend/node-sdk`. [docs.suprsend.com/docs/node-create-user-profile](https://docs.suprsend.com/docs/node-create-user-profile) Whether it ships TypeScript types is **unverified**.
- **Preferences:** global channel opt-outs, category opt-in/out, and channel opt-outs within a category. Categories can be set to On, Off, or Can't Unsubscribe. [docs.suprsend.com/docs/user-preferences](https://docs.suprsend.com/docs/user-preferences)
- **Dev/test:** three isolated workspaces: Sandbox (30-day trial, pre-configured vendors, sends only to verified channels), Staging, and Production. Test Mode in Staging delivers only to designated internal testers, with an optional catch-all channel. [docs.suprsend.com/docs/best-practices-notification-system-design](https://docs.suprsend.com/docs/best-practices-notification-system-design), [changelog](https://docs.suprsend.com/changelog/overview) The docs describe Test Mode slightly differently across pages.

### Courier

- **Pricing:** Developer: up to 10k sends/mo free. Business: $0.005 per send, including the first 10,000, with no per-seat or channel add-ons. [courier.com/pricing](https://www.courier.com/pricing)
- **Email:** Postmark is supported: "Courier sends through your Postmark account." [courier.com/docs/external-integrations/email/postmark](https://www.courier.com/docs/external-integrations/email/postmark)
- **Push:** 12 providers (APNs, FCM, Expo, OneSignal, Airship, SNS, Pusher Beams, Pusher, MagicBell, Pushbullet, Beamer, NowPush). None is a native VAPID provider. [courier.com/docs/integrations/push/overview](https://www.courier.com/docs/integrations/push/overview)
- **In-app feed:** `@trycourier/courier-js` reads and updates inbox data "without UI components." It provides `getMessages`, `read`, `archive`, `readAll`, and `inbox.socket.connect()` for real-time. The unread count is not pushed over the socket, so you refetch it. [courier.com/docs/sdk-libraries/courier-js-web](https://www.courier.com/docs/sdk-libraries/courier-js-web)
- **Server SDK:** `@trycourier/courier`, typed, needs Node 20+ and TS 4.9+. [courier.com/docs/sdk-libraries/node](https://www.courier.com/docs/sdk-libraries/node)
- **Preferences:** subscription topics plus per-user channel routing. [Courier API reference](https://docs.courier.com/reference/introduction)
- **Dev/test:** Production and Test environments, each with its own keys. Test email only delivers to the signup address. A Mock key that skips provider calls is Enterprise-only. [courier.com/docs/platform/workspaces/environments-api-keys](https://courier.com/docs/platform/workspaces/environments-api-keys)

### Other contenders

None was researched beyond these five. MagicBell appears as a push provider inside Courier, which suggests MagicBell can act as a web-push transport. That is not a reason to add a sixth vendor.

## Web push reach

### Browser and OS support

- **Push API** (caniuse, [caniuse.com/push-api](https://caniuse.com/push-api)):
  - Chrome 50+, Edge 17+, Firefox 44+, Opera 42+, Samsung Internet 4+, plus current Chrome and Firefox for Android.
  - Safari on macOS is full from 18.0 and partial in 16.1–17.6.
  - Safari on iOS/iPadOS is "partial" from 16.4 onward.
  - Global usage: 96.93% (83.36% full + 13.57% partial).
  - caniuse gives no footnote explaining the Safari "partial" rating. The iOS restriction is documented by WebKit (see below).
- **Notifications API** (caniuse, [caniuse.com/notifications](https://caniuse.com/notifications)):
  - Full support in desktop Chrome, Edge, Firefox, and Safari.
  - iOS Safari is partial from 16.4. Samsung Internet and Android are marked partial or none.
  - The likely reason is in MDN: the `new Notification()` constructor "throws a `TypeError` when called in nearly all mobile browsers." On mobile, notifications must go through a service worker with `ServiceWorkerRegistration.showNotification()`. [MDN Notification()](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)
  - This is not an issue for web push, which always shows notifications from the service worker. [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- **Safari on macOS:** Web Push arrived in Safari 16 on macOS Ventura. It uses the standard Push API, Notifications API, and Service Workers, and needs no Apple Developer account. Subscribing "requires an explicit user gesture" and `userVisibleOnly: true`. Endpoints are on `*.push.apple.com`. [webkit.org/blog/12945/meet-web-push](https://webkit.org/blog/12945/meet-web-push/)

### iOS and iPadOS

- **Requirements:** Web Push arrived in iOS/iPadOS 16.4, **only for web apps added to the Home Screen**. The site needs a web app manifest with `display` set to `standalone` or `fullscreen`. The permission request must come from direct user interaction, such as tapping a subscribe button. Delivery goes through APNs, and no developer account is needed. [webkit.org/blog/13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- **Declarative Web Push:** shipped in iOS/iPadOS 18.4, again for Home Screen web apps only. It shows notifications from a standard JSON payload without needing a service worker. It reached macOS in Safari 18.5. [webkit.org/blog/16574](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [webkit.org/blog/16535](https://webkit.org/blog/16535/meet-declarative-web-push/), [webkit.org/blog/16923](https://webkit.org/blog/16923/webkit-features-in-safari-18-5/)
- **EU (DMA):** Apple first said iOS 17.4 would remove Home Screen web apps in the EU, then reversed that in early March 2024 and kept WebKit-based Home Screen web apps. Apple's current DMA developer page ([developer.apple.com/support/dma-and-apps-in-the-eu](https://developer.apple.com/support/dma-and-apps-in-the-eu/)) no longer carries the statement, and I could not load an archived copy. The reversal is therefore **unverified against a live Apple primary source**. I found no Apple source saying EU Home Screen web apps or web push were removed later.

### Permission grant rates

- **Firefox (Mozilla telemetry, Firefox 63 Release, one month):**
  - 1.45 billion prompts were shown and only 23.66 million accepted, about 1.6%, or "for each prompt that is accepted, sixty are denied or ignored."
  - A Release study found ~99% of prompts unaccepted and 48% actively denied.
  - When the prompt followed a user interaction, 24% of existing users and 56% of new users accepted.
  - Firefox 72 then made notification prompts require a user gesture.
  - Source: [blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/)
- **Chrome:**
  - The quieter permission UI shipped in Chrome 80. Chrome automatically enrols sites with "very low Accept rates" in it, separately for mobile and desktop. No numeric threshold is published.
  - Chrome publishes per-origin Accept, Block, Ignore, and Dismiss rates in CrUX (`experimental.permission.notifications`, from the 202001 dataset).
  - Its one worked example, Google News, shows 82.3% accept, 4.8% block, 5.0% ignore, and 7.9% dismiss. That is a single high-trust site, **not an average**.
  - Source: [developer.chrome.com/blog/notification-permission-data-in-crux](https://developer.chrome.com/blog/notification-permission-data-in-crux/), [blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html](https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html)
- **Chrome engagement (October 10, 2025):** "Less than 1% of all notifications receive any interaction from users." Chrome now auto-revokes notification permission for low-engagement, high-volume sites, but "does not revoke notifications for any installed web apps." [blog.google/chromium/automatic-notification-permission](https://blog.google/chromium/automatic-notification-permission/)
- **Chrome rate limits (January 6, 2026):** Push API rate limits roll out for disruptive low-engagement sites. They allow no fewer than 1,000 messages/min, with HTTP 429 above that, and "nearly all websites will be unaffected." [developer.chrome.com/blog/web-push-rate-limits](https://developer.chrome.com/blog/web-push-rate-limits)
- **Caveats:** The Mozilla data is from 2019 and counts all sites, including spammy prompt-on-load sites. Chrome has published no aggregate cross-web accept rate that I could find. A course app with signed-in learners who ask for notifications after a click should do far better than 1.6%, but no primary source gives a number for that case (**unverified**).

### What this means for Cadence

- **Desktop:** reach is good. Chrome, Edge, Firefox, and Safari on macOS all support standard VAPID web push.
- **Android:** Chrome, Firefox, and Samsung Internet work through the service worker path.
- **iOS/iPadOS:** reach is limited to learners who install Cadence to the Home Screen. That needs a manifest with `display: standalone` and a subscribe button the user taps. Expect few iPhone users to get there.
- **Grant rates:** low and falling across the web. Chrome may also auto-revoke permission from sites people don't engage with (installed web apps are exempt). Ask only after a meaningful action, such as "notify me when the next lesson drops," never on page load.
- **Default channel:** email through the existing Postmark account should stay the default, reliable channel. In-app feed second, web push opt-in third. That favours a vendor whose Postmark integration and in-app feed are both first-class, and native VAPID web push avoids adding Firebase or OneSignal.

## Recommendation

- **Pick SuprSend** if we want web push from the vendor with no extra signups. It is the only one of the five that documents Postmark, native VAPID web push, a headless real-time feed, a Node SDK, preferences, and a no-real-delivery Test Mode.
- **Pick Knock** if in-app feed quality and dev ergonomics matter more than vendor-managed web push. Its sandbox mode and unlimited free environments are the cleanest dev story.
  - For web push we would send it ourselves, for example with the `web-push` library, outside Knock. Or we could add FCM, which means one more signup.
- Before committing, spike each shortlisted vendor's free tier against the open questions below. Treat the free tiers as development-only. Paid entry for both vendors is $100–$250/month.

**Open questions to confirm in a spike:**

- How many workspaces SuprSend's free tier includes.
- Whether `@suprsend/node-sdk` ships TypeScript types.
- How SuprSend's web push behaves in Safari.

## Sources

- Knock: https://knock.app/pricing, https://docs.knock.app/manage-your-account/knock-plans, https://docs.knock.app/integrations/email/overview, https://docs.knock.app/integrations/email/knock-test, https://docs.knock.app/integrations/push/overview, https://docs.knock.app/in-app-ui/overview, https://docs.knock.app/in-app-ui/feeds/overview, https://docs.knock.app/in-app-ui/javascript/overview, https://docs.knock.app/developer-tools/sdks, https://docs.knock.app/concepts/preferences, https://docs.knock.app/concepts/environments, https://docs.knock.app/integrations/overview
- Novu: https://novu.co/pricing, https://docs.novu.co/platform/integrations/email, https://docs.novu.co/platform/integrations/demo-providers, https://docs.novu.co/platform/integrations/push, https://docs.novu.co/platform/sdks/javascript, https://docs.novu.co/platform/inbox/migration-guide, https://docs.novu.co/platform/sdks/server/typescript, https://docs.novu.co/platform/concepts/preferences
- MagicBell: https://www.magicbell.com/pricing, https://www.magicbell.com/docs/channels/email, https://www.magicbell.com/docs/channels/web_push, https://www.magicbell.com/docs/channels/in_app, https://www.magicbell.com/docs/api/reference, https://www.magicbell.com/docs/libraries/magicbell-js, https://www.magicbell.com/docs/quick-start
- SuprSend: https://www.suprsend.com/pricing, https://docs.suprsend.com/docs/postmark, https://docs.suprsend.com/docs/web-push-quick-start, https://docs.suprsend.com/docs/js-webpush, https://docs.suprsend.com/docs/js-inapp-feed, https://docs.suprsend.com/docs/node-create-user-profile, https://docs.suprsend.com/docs/user-preferences, https://docs.suprsend.com/docs/best-practices-notification-system-design, https://docs.suprsend.com/changelog/overview
- Courier: https://www.courier.com/pricing, https://www.courier.com/docs/external-integrations/email/postmark, https://www.courier.com/docs/integrations/push/overview, https://www.courier.com/docs/sdk-libraries/courier-js-web, https://www.courier.com/docs/sdk-libraries/node, https://courier.com/docs/platform/workspaces/environments-api-keys, https://docs.courier.com/reference/introduction
- Postmark: https://postmarkapp.com/developer/user-guide/send-email-with-smtp
- Browser support: https://caniuse.com/push-api, https://caniuse.com/notifications, https://developer.mozilla.org/en-US/docs/Web/API/Push_API, https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification
- WebKit/Apple: https://webkit.org/blog/12945/meet-web-push/, https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/, https://webkit.org/blog/16535/meet-declarative-web-push/, https://webkit.org/blog/16574/webkit-features-in-safari-18-4/, https://webkit.org/blog/16923/webkit-features-in-safari-18-5/, https://developer.apple.com/support/dma-and-apps-in-the-eu/
- Permission data: https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/, https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html, https://developer.chrome.com/blog/notification-permission-data-in-crux/, https://blog.google/chromium/automatic-notification-permission/, https://developer.chrome.com/blog/web-push-rate-limits
