#!/usr/bin/env bash
# Assemble what V-Gruvs (our DigitalOcean host) runs, after `npm run build`:
# the standalone server plus public/ and .next/static, which Next leaves out
# of .next/standalone. Writes .next/vgruvs-release/.
#
#   npm run build && bash scripts/vgruvs-release.sh
#   VGRUVS_HOST=deploy@144.126.236.75 bash scripts/vgruvs-deploy.sh theresident --from .next/vgruvs-release
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -s .next/standalone/server.js ]] || { echo "no .next/standalone/server.js: run npm run build (next.config.ts has output: 'standalone')" >&2; exit 1; }
out=.next/vgruvs-release
rm -rf "$out"
cp -a .next/standalone "$out"
cp -a public "$out/public"
mkdir -p "$out/.next"
cp -a .next/static "$out/.next/static"
echo "release ready in $out ($(du -sh "$out" | cut -f1))"
