#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build. Exit 1 = build.
#
# WHY THIS EXISTS.
#
# Vercel builds every push to every branch by default, and keeps the build
# artifacts of every deployment. On 8 September 2026 the team hit 100% of the
# free tier's 10 GB Deployment Storage and Vercel began asking for a $20/month
# Pro upgrade "to avoid service disruption".
#
# A large share of that was self-inflicted: development happens on long-lived
# `claude/**` branches and every commit was pushed to TWO of them, so a single
# day's work produced dozens of full preview deployments that nobody ever
# opened. The storage they consume is permanent until the deployments are
# deleted.
#
# Preview deployments are genuinely useful for a pull request someone is going
# to look at. They are pure cost for a working branch that gets twenty commits
# a day. So: build production, build real PRs, skip everything else.
set -euo pipefail

BRANCH="${VERCEL_GIT_COMMIT_REF:-}"
PR="${VERCEL_GIT_PULL_REQUEST_ID:-}"

# Production branch — always build.
if [ "$BRANCH" = "main" ]; then
  echo "→ $BRANCH is the production branch: building."
  exit 1
fi

# A real pull request — someone wants to look at this. Build it.
if [ -n "$PR" ]; then
  echo "→ pull request #$PR: building a preview."
  exit 1
fi

echo "→ '$BRANCH' is a working branch with no open pull request: skipping."
echo "  Every skipped build is storage not consumed on the free tier."
echo "  Open a PR to get a preview, or push to main to deploy."
exit 0
