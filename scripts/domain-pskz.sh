#!/usr/bin/env bash
# Serve the coach under a domain on the ps.kz server (after deploy-pskz.sh), keeping https://<IP> working.
#
#   SSH_KEY=~/.ssh/stomad_coach scripts/domain-pskz.sh root@213.155.20.240 coach.stom-ad.com stom-ad.com www.stom-ad.com
#
# The first name serves the app; the others redirect to it (until they get a site of their own).
# All names must already resolve to the server: Let's Encrypt checks them over HTTP. Rerunnable.
set -euo pipefail

HOST="${1:-}"; APP_NAME="${2:-}"; shift 2 || true
[ -n "$HOST" ] && [ -n "$APP_NAME" ] || { echo "usage: SSH_KEY=... $0 root@IP app.example.com [redirect.example.com ...]" >&2; exit 2; }
REDIRECTS="$*"
SSH_ARGS=(-o ServerAliveInterval=15)
[ -n "${SSH_KEY:-}" ] && SSH_ARGS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)

ssh "${SSH_ARGS[@]}" "$HOST" "APP_NAME='$APP_NAME' REDIRECTS='$REDIRECTS' PORT=3010 bash -s" <<'REMOTE'
set -euo pipefail
names="$APP_NAME $REDIRECTS"
# One certificate (classic 90-day profile) for every name; the IP default site already answers ACME on port 80.
certbot certonly --webroot -w /var/www/acme --cert-name "$APP_NAME" $(for n in $names; do printf -- '-d %s ' "$n"; done) \
  --non-interactive --agree-tos --register-unsafely-without-email --expand --deploy-hook "systemctl reload nginx"

proxy="proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;"
tls="ssl_certificate /etc/letsencrypt/live/$APP_NAME/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$APP_NAME/privkey.pem;"
{
  echo "server {
  listen 80;
  server_name $names;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { return 301 https://$APP_NAME\$request_uri; }
}
server {
  listen 443 ssl http2;
  server_name $APP_NAME;
  $tls
  client_max_body_size 25m;
  location / { $proxy }
}"
  if [ -n "$REDIRECTS" ]; then echo "server {
  listen 443 ssl http2;
  server_name $REDIRECTS;
  $tls
  return 301 https://$APP_NAME\$request_uri;
}"; fi
} > "/etc/nginx/sites-available/$APP_NAME"
ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
nginx -t -q && systemctl reload nginx
echo "https://$APP_NAME is up"
REMOTE

for n in "$APP_NAME" $REDIRECTS; do
  printf '%-22s %s\n' "$n" "$(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' --max-time 20 "https://$n/app")"
done
