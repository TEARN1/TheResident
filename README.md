This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying

The site runs on Vercel today, and on **V-Gruvs**, our own DigitalOcean
droplet, once `theresidentcrew.com` points there. V-Gruvs setup and the
research behind it live in the the_gruvs repo, in `infra/vgruvs/`.

**How the build fits V-Gruvs:**

- `next.config.ts` sets `output: 'standalone'`, so `npm run build` also
  produces a self-contained `server.js`. Vercel ignores this setting.
- Pages that revalidate (ISR) keep their fresh copies in memory, as on Vercel
  (`isrFlushToDisk: false`). The release folder stays read-only to the app.

**Deploys** (`.github/workflows/deploy-vgruvs.yml`):

- `main` is deployed after the quality pipeline passes. The workflow stays
  skipped until the `VGRUVS_SSH_KEY` secret is set. The `NEXT_PUBLIC_*`
  values it builds with are listed at the top of that file.
- Each build is stamped with its release id (`NEXT_DEPLOYMENT_ID`), so
  pages ask for `/_next/static/...?dpl=<release>` and the droplet serves that
  exact release's files, even after a newer deploy (skew protection).
- The new release starts beside the old one, and nginx switches only once it
  answers. Set `ROLLOUT` on the droplet to roll it out in stages instead.
- For five minutes after a deploy, the droplet's autopilot watches real
  traffic and rolls the release back by itself if errors jump.

**On the droplet:**

- Server-only secrets are set there, not in GitHub:
  `vgruvs env theresident set SUPABASE_SERVICE_ROLE_KEY '...'`.
- Pages Next marks cacheable (static and ISR) are served by nginx's edge
  cache for visitors without a login cookie, and stay up if Next is down.
- `vgruvs insights theresident` shows traffic and errors, and
  `vgruvs vitals theresident` shows real-user speed.

To deploy by hand:

```bash
npm run build && bash scripts/vgruvs-release.sh
VGRUVS_HOST=deploy@144.126.236.75 bash scripts/vgruvs-deploy.sh theresident --from .next/vgruvs-release
```

To undo, run the **Rollback (V-Gruvs)** workflow (rollback, promote rollout,
stop rollout), or `ssh deploy@144.126.236.75 sudo vgruvs rollback theresident`.

The `Dockerfile` builds the same standalone server on Node 22.
