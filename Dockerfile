# Base image
# Node 20: the CI pipeline builds and tests on 20.x, and shipping a container
# built on a different major than everything is verified against is how a
# runtime-only bug reaches production.
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The service worker names its cache after this, so an installed PWA picks up
# a new deploy instead of serving the previous one. On Vercel it comes from
# VERCEL_GIT_COMMIT_SHA; here it has to be passed in, because .git is not in
# the build context. DigitalOcean App Platform: set it from the commit in
# .do/app.yaml. Falls back to a timestamp, which over-invalidates (safe)
# rather than under-invalidating (stale app).
ARG APP_BUILD_SHA
ENV APP_BUILD_SHA=$APP_BUILD_SHA

# NEXT_PUBLIC_* is INLINED INTO THE BUNDLE AT BUILD TIME, not read at runtime.
# Setting them only as runtime environment variables produces an app that
# builds cleanly and then cannot reach Supabase at all, because the client was
# compiled with `undefined` where the URL should be. On Vercel this is
# invisible — it injects them into the build automatically. In a container it
# has to be done deliberately, so they are build args here.
#
# Only PUBLIC values belong in this list. They ship to every browser either
# way, so a build arg leaks nothing that the bundle does not already contain.
# The service role key and other secrets are runtime-only and must NEVER be
# added here — a build arg is recorded in the image's layer history.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_OSRM_ROUTING_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_OSRM_ROUTING_URL=$NEXT_PUBLIC_OSRM_ROUTING_URL

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMEtry_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
