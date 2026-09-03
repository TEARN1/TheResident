# Edge functions

These are the deployed Supabase edge functions, kept in the repo so the tree is
the source of truth rather than the dashboard.

| Function | verify_jwt | What it does |
|---|---|---|
| `web-push-send` | on | Web Push delivery (Phase E). Also does its own service-role check, because a resident's JWT satisfies `verify_jwt` too. |
| `_shared/webPush.ts` | — | RFC 8291 encryption and RFC 8292 VAPID. Verified against the RFC's own test vector in `webPush.test.ts`, which runs in `npm test`. |
| `paystack-checkout` | on | Starts a Paystack checkout. Area licences additionally verify, against the database, that the caller may act for the unit being paid for. |
| `paystack-webhook` | off | Paystack authenticates with an HMAC signature rather than a JWT, so this is verified in-body and must stay `verify_jwt: false`. |

**Deno, not Node.** `tsconfig.json` excludes this directory from the Next.js
typecheck — these files target Deno and would otherwise be checked against the
DOM lib and fail on unrelated type differences. `_shared/webPush.test.ts` is
still run by `npm test`, because it touches nothing but `globalThis.crypto`.

`push-notify` is **not** listed here on purpose: it is Expo-based, reads
`profiles.push_token`, and belongs to the sibling Gruvs mobile app. It is not
modified by this project.
