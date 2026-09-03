# Turning on push notifications (Phase E)

Everything for Web Push is built, tested and deployed. It is **inert until you
set three secrets** — the app cannot hold them for you, and a private key
committed to this repository would be a private key on GitHub.

Until you do this, nothing breaks: urgent notices still land in the app's bell
and the urgent banner, exactly as before. They just will not reach a phone with
the app closed.

## The keypair

A VAPID keypair was generated for this project. The public half is not secret
and is already compiled into the client (`src/utils/webPush.ts`) and the edge
function:

```
BMoPkJgUw8AUXmQzwW5fjKYHuGUv6P8P94BRyr1870KkgK_kIhiGlkfocyHAP-X6Wiwf_C_HVKxuiCDNspGHLGk
```

**The private half is in the message where this was handed over, not in this
file.** Paste it into step 1 below and it never needs to exist anywhere else.
If it ever leaks, generate a new pair (`node scripts/generate-vapid.mjs`),
update the public key in both places above, and re-deploy — every existing
subscription will need to be re-created, so do it only if you must.

## 1. Edge function secrets

Supabase Dashboard → **Edge Functions → Secrets** → add two:

| Name | Value |
|---|---|
| `VAPID_PRIVATE_KEY` | the private key you were given |
| `VAPID_SUBJECT` | `mailto:` and a real address you monitor, e.g. `mailto:support@theresident.co.za` |

`VAPID_SUBJECT` is required by RFC 8292: push services use it to contact you if
your sending misbehaves. A fake address risks being blocked.

## 2. Vault secret, so the database can call the function

Supabase Dashboard → **Project Settings → Vault** → new secret:

| Name | Value |
|---|---|
| `service_role_key` | the project's service role key (Settings → API) |

This is how `res_push_area_broadcast` authenticates to `web-push-send`. It goes
in Vault rather than a schema file for the obvious reason.

## 3. Vercel environment variable (optional but recommended)

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the public key above.

The key is already hardcoded as a fallback, so this only matters if you ever
rotate the keypair — then you can change it without a code deploy.

## Checking it works

1. Open the app on a phone, go to **Profile → Emergency Alerts**, press
   **Turn on emergency alerts**, and accept the browser prompt.
2. Confirm a row appeared: `select count(*) from web_push_subscriptions where user_id = '<you>';`
3. Send an `urgent` area broadcast from a verified unit.
4. Close the app entirely. The notice should arrive as a system notification.

If step 4 does nothing, check the edge function logs — a missing secret returns
`vapid_not_configured` rather than failing silently.

## What is deliberately not automatic

- **The prompt is never fired on page load.** A browser gives a site one chance
  to ask, and a dialog shown to someone who does not know why gets denied
  permanently, with no way for the page to ask again. The panel explains first;
  the resident presses the button.
- **Only `urgent` and `critical` push.** Anything quieter does not justify
  vibrating a phone.
- **`critical` stays on screen until dismissed** (`requireInteraction`), the
  same rule the in-app urgent banner follows.
- **A push failure can never fail a broadcast.** The notice is already in the
  rail before push is attempted, and every error in that path is swallowed.
  Rolling back a delivered evacuation notice because a push gateway was down
  would be plainly worse than not pushing.

## Still not covered

**SMS.** Officials will expect it, and it is the only channel that reaches a
feature phone or someone with no data. It costs real money per message, so it
is named here rather than scoped.
