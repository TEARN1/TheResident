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
droplet, once `theresidentcrew.com` points there. V-Gruvs setup lives in the
the_gruvs repo, in `infra/vgruvs/README.md`.

- `next.config.ts` sets `output: 'standalone'`, so `npm run build` also
  produces a self-contained `server.js`. Vercel ignores this setting.
- `.github/workflows/deploy-vgruvs.yml` deploys `main` after the quality
  pipeline passes. It stays skipped until the `VGRUVS_SSH_KEY` secret is set.
  The `NEXT_PUBLIC_*` values it builds with are listed at the top of that
  file.
- On the droplet, the new release starts beside the old one. nginx switches
  to it only once it answers, and switches back by itself if the site stops
  answering.
- Server-only secrets are set on the droplet, not in GitHub:
  `vgruvs env theresident set SUPABASE_SERVICE_ROLE_KEY '...'`.

To deploy by hand:

```bash
npm run build && bash scripts/vgruvs-release.sh
VGRUVS_HOST=deploy@144.126.236.75 bash scripts/vgruvs-deploy.sh theresident --from .next/vgruvs-release
```

To roll back: `ssh deploy@144.126.236.75 sudo vgruvs rollback theresident`.

Pages that revalidate (ISR) keep their fresh copies in memory, as on Vercel
(`isrFlushToDisk: false`). The release folder stays read-only to the app.

The `Dockerfile` builds the same standalone server on Node 22.
