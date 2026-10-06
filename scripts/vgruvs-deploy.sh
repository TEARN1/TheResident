#!/usr/bin/env bash
# Ship a build to V-Gruvs, from a laptop or from CI. For this repo:
#
#   npm run build && bash scripts/vgruvs-release.sh
#   VGRUVS_HOST=deploy@144.126.236.75 bash scripts/vgruvs-deploy.sh theresident --from .next/vgruvs-release
#
# A copy of the_gruvs/infra/vgruvs/client/vgruvs-deploy.sh, where V-Gruvs
# (our DigitalOcean host) lives; keep the two the same.
#
#   VGRUVS_HOST=deploy@144.126.236.75 vgruvs-deploy.sh <app> --from dist          # a directory's contents
#   VGRUVS_HOST=deploy@144.126.236.75 vgruvs-deploy.sh <app> dist api vercel.json # paths, kept as they are
#   ... --preview pr-12        deploy as a preview instead of going live
#   ... --release <id>         name the release (default: date + git commit)
#
# Environment:
#   VGRUVS_HOST         user@host to deploy to (required)
#   VGRUVS_SSH_KEY      contents of a private key (CI); otherwise ssh's defaults
#
# The droplet unpacks the archive into a new release, checks it, switches to
# it and rolls back by itself if the site stops answering.
set -euo pipefail

die() { printf 'vgruvs-deploy: %s\n' "$*" >&2; exit 1; }
[[ $# -ge 2 ]] || die "usage: vgruvs-deploy.sh <app> (--from <dir> | <path>...) [--preview <name>] [--release <id>]"
[[ -n "${VGRUVS_HOST:-}" ]] || die "set VGRUVS_HOST, e.g. deploy@144.126.236.75"

app="$1"
shift
from='' preview='' release='' paths=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) from="$2"; shift 2 ;;
    --preview) preview="$2"; shift 2 ;;
    --release) release="$2"; shift 2 ;;
    *) paths+=("$1"); shift ;;
  esac
done
if [[ -z "$release" ]]; then
  release="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=10 HEAD 2>/dev/null || echo local)"
fi

ssh_opts=(-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15)
if [[ -n "${VGRUVS_SSH_KEY:-}" ]]; then
  keyfile="$(mktemp)"
  trap 'rm -f "$keyfile"' EXIT
  printf '%s\n' "$VGRUVS_SSH_KEY" >"$keyfile"
  chmod 600 "$keyfile"
  ssh_opts+=(-i "$keyfile" -o IdentitiesOnly=yes)
fi

remote=(sudo /usr/local/bin/vgruvs receive "$app" "$release")
[[ -n "$preview" ]] && remote+=(--preview "$preview")
# ssh hands the remote shell one string: quote every word so a release or
# preview name (often a branch name in CI) can never run as a command there.
remote_cmd="$(printf '%q ' "${remote[@]}")"

echo "==> shipping $app $release${preview:+ as preview $preview} to $VGRUVS_HOST"
if [[ -n "$from" ]]; then
  [[ -d "$from" ]] || die "no directory $from"
  tar -czf - -C "$from" . | ssh "${ssh_opts[@]}" "$VGRUVS_HOST" "$remote_cmd"
else
  [[ ${#paths[@]} -gt 0 ]] || die "nothing to ship"
  tar -czf - "${paths[@]}" | ssh "${ssh_opts[@]}" "$VGRUVS_HOST" "$remote_cmd"
fi
