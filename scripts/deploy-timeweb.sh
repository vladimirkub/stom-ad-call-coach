#!/usr/bin/env bash
# Uploads Stom AD Call Coach to a server into its OWN directory. It never touches anything else on the server.
#
#   scripts/deploy-timeweb.sh root@SERVER_IP              upload the code only (new directory, refuses to overwrite)
#   scripts/deploy-timeweb.sh root@SERVER_IP --env        also copy .env.local, .agents.json and the knowledge base (secrets!)
#   scripts/deploy-timeweb.sh root@SERVER_IP --build      also run `npm ci && npm run build` inside that directory
#   scripts/deploy-timeweb.sh root@SERVER_IP --update     re-upload into the existing directory (only our own files)
#   scripts/deploy-timeweb.sh --dry-run                     build the archive and list it, no connection
#
# Authentication is yours: ssh asks for your key passphrase or password. REMOTE_DIR (default: stom-ad-call-coach,
# relative to the remote home) is the only place that is written.
set -euo pipefail

HOST=""; WITH_ENV=0; BUILD=0; UPDATE=0; DRY=0
for a in "$@"; do
  case "$a" in
    --env) WITH_ENV=1 ;; --build) BUILD=1 ;; --update) UPDATE=1 ;; --dry-run) DRY=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) HOST="$a" ;;
  esac
done
[ "$DRY" = 1 ] || [ -n "$HOST" ] || { echo "usage: $0 user@host [--env] [--build] [--update] | --dry-run" >&2; exit 2; }

# One multiplexed connection: a single login (one password prompt) serves every ssh call below.
SSH_OPTS=(-o ControlMaster=auto -o "ControlPath=/tmp/stomad-cm-%C" -o ControlPersist=120 -o ServerAliveInterval=15)
ssh_() { ssh "${SSH_OPTS[@]}" "$@"; }

DIR="${REMOTE_DIR:-stom-ad-call-coach}"
case "$DIR" in /*|*..*|"") echo "REMOTE_DIR must be a relative path without '..'" >&2; exit 2 ;; esac

cd "$(dirname "$0")/.."
TAR="$(mktemp "${TMPDIR:-/tmp}/stomad.XXXXXX")"
trap 'rm -f "$TAR"; [ -n "$HOST" ] && ssh -O exit "${SSH_OPTS[@]}" "$HOST" >/dev/null 2>&1 || true' EXIT

# Tracked + new files minus everything .gitignore excludes (so no .env*, node_modules, .next, data/, .agents.json).
git ls-files --cached --others --exclude-standard -z | tar --no-xattrs --null -czf "$TAR" -T -
COUNT=$(tar -tzf "$TAR" | wc -l | tr -d ' ')
if tar -tzf "$TAR" | grep -E '(^|/)(\.env$|\.env\.local$|\.env\.(production|development)(\.local)?$|\.agents\.json|knowledge-base\.json|node_modules/|\.next/)' >/dev/null; then
  echo "refusing: the archive contains a secret or build artifact" >&2; exit 4
fi
echo "Archive ready: $COUNT files, $(du -h "$TAR" | cut -f1), no secrets."
if [ "$DRY" = 1 ]; then tar -tzf "$TAR" | head -15; echo "..."; exit 0; fi

# Ask the server, and tell a failed connection apart from an existing directory.
STATE=$(ssh_ "$HOST" "if [ -e '$DIR' ]; then echo EXISTS; else echo FREE; fi") || {
  echo "Could not log in to $HOST (wrong password or key, or the server closed the connection). Nothing was uploaded." >&2
  echo "Check it by hand first: ssh $HOST" >&2
  exit 6
}
if [ "$STATE" = "EXISTS" ] && [ "$UPDATE" = 0 ]; then
  echo "~/$DIR already exists on the server: not overwriting. Use --update to refresh only our files." >&2; exit 3
fi
echo "Uploading to $HOST:~/$DIR ..."
ssh_ "$HOST" "mkdir -p '$DIR' && tar -xzf - -C '$DIR'" < "$TAR"

if [ "$WITH_ENV" = 1 ]; then
  echo "Copying secrets over SSH (.env.local, .agents.json, knowledge base) ..."
  ssh_ "$HOST" "umask 077 && mkdir -p '$DIR/data' && cat > '$DIR/.env.local'" < .env.local
  [ -f .agents.json ] && ssh_ "$HOST" "umask 077 && cat > '$DIR/.agents.json'" < .agents.json
  [ -f data/knowledge-base.json ] && ssh_ "$HOST" "umask 077 && cat > '$DIR/data/knowledge-base.json'" < data/knowledge-base.json
fi

if [ "$BUILD" = 1 ]; then
  ssh_ "$HOST" "cd '$DIR' && command -v node >/dev/null || { echo 'Node.js is not installed on the server (need >= 20.9)' >&2; exit 5; }
    node -e 'process.exit(parseInt(process.versions.node)>=20?0:1)' || { echo \"Node \$(node -v) is too old (need >= 20.9)\" >&2; exit 5; }
    npm ci && npm run build"
fi

PORT=$(ssh_ "$HOST" 'for p in $(seq 3010 3040); do (ss -ltn 2>/dev/null | grep -q ":$p ") || { echo $p; break; }; done')
cat <<MSG

Done. Files are in ~/$DIR on the server; nothing else was touched.
Next (on the server):
  cd ~/$DIR && npm ci && npm run build            (skip if you used --build)
  npx next start -H 127.0.0.1 -p ${PORT:-3010}    (port ${PORT:-3010} is free right now; localhost only, NOT exposed to the internet)
Voice and the CRM cookie need HTTPS. Without a domain, open it through an SSH tunnel (localhost counts as secure):
  ssh -L 3000:localhost:${PORT:-3010} $HOST   then open http://localhost:3000
See docs/DEPLOY.md for nginx + HTTPS on a separate domain.
MSG
