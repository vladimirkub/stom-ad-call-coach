#!/usr/bin/env bash
# Public test server on a fresh ps.kz VPS (Ubuntu 22.04), reachable as https://<IP> without a domain.
#
#   SSH_KEY=~/.ssh/stomad_coach scripts/deploy-pskz.sh root@213.155.20.240           first install
#   SSH_KEY=~/.ssh/stomad_coach scripts/deploy-pskz.sh root@213.155.20.240 --update  ship new code
#
# First install: swap, Node 22, nginx, ufw (22/80/443), key-only SSH, the app via deploy-timeweb.sh (with secrets),
# a systemd unit, and a short-lived Let's Encrypt certificate for the bare IP (renewed automatically).
# Run it only after `ssh -i $SSH_KEY host` works: it switches password logins off.
set -euo pipefail

HOST="${1:-}"; MODE="${2:-}"
[ -n "$HOST" ] || { echo "usage: SSH_KEY=... $0 root@IP [--update]" >&2; exit 2; }
IP="${HOST#*@}"
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "host must be user@IPv4 (the certificate is issued for the IP)" >&2; exit 2; }
PORT=3010
APP_DIR=/root/stom-ad-call-coach
SSH_ARGS=(-o ServerAliveInterval=15 -o StrictHostKeyChecking=accept-new)
[ -n "${SSH_KEY:-}" ] && SSH_ARGS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
remote() { ssh "${SSH_ARGS[@]}" "$HOST" "$@"; }
cd "$(dirname "$0")/.."

remote true || { echo "cannot log in to $HOST with the key; nothing was changed" >&2; exit 6; }

if [ "$MODE" = "--update" ]; then
  scripts/deploy-timeweb.sh "$HOST" --update --build
  remote "systemctl restart stom-ad-call-coach"
else
  echo "== server packages, swap, firewall, key-only ssh"
  remote 'bash -s' <<'SETUP'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# 2 GB RAM is tight for `next build`
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg nginx ufw snapd >/dev/null
if ! node -v 2>/dev/null | grep -q '^v2[2-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ufw allow OpenSSH >/dev/null && ufw allow 'Nginx Full' >/dev/null && ufw --force enable >/dev/null
# The key works (we are here), so password logins can go
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-stomad-keys-only.conf
sshd -t && systemctl reload ssh
echo "node $(node -v), nginx $(nginx -v 2>&1 | cut -d/ -f2)"
SETUP

  echo "== app upload and build"
  if remote "test -d $APP_DIR"; then scripts/deploy-timeweb.sh "$HOST" --update --env --build
  else scripts/deploy-timeweb.sh "$HOST" --env --build; fi

  echo "== systemd unit, nginx, certificate"
  remote "PORT=$PORT APP_DIR=$APP_DIR IP=$IP bash -s" <<'WIRE'
set -euo pipefail
cat > /etc/systemd/system/stom-ad-call-coach.service <<UNIT
[Unit]
Description=Stom AD Call Coach
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/node_modules/.bin/next start -H 127.0.0.1 -p $PORT
Restart=on-failure
Environment=NODE_ENV=production
# ps.kz has no working IPv6 route to Google: DNS returns the AAAA record first and connects hang for 10 s
Environment=NODE_OPTIONS=--dns-result-order=ipv4first

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now stom-ad-call-coach >/dev/null && systemctl restart stom-ad-call-coach

mkdir -p /var/www/acme
proxy="proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;"
write_site() {  # $1 = with-tls?
  {
    echo "server {
  listen 80 default_server;
  location /.well-known/acme-challenge/ { root /var/www/acme; }"
    if [ "$1" = yes ]; then echo "  location / { return 301 https://\$host\$request_uri; }"; else echo "  location / { $proxy }"; fi
    echo "}"
    if [ "$1" = yes ]; then echo "server {
  listen 443 ssl http2 default_server;  # nginx 1.18 on Ubuntu 22.04 has no separate http2 directive
  ssl_certificate /etc/letsencrypt/live/$IP/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$IP/privkey.pem;
  client_max_body_size 25m;
  location / { $proxy }
}"; fi
  } > /etc/nginx/sites-available/stom-ad-call-coach
  ln -sf /etc/nginx/sites-available/stom-ad-call-coach /etc/nginx/sites-enabled/stom-ad-call-coach
  rm -f /etc/nginx/sites-enabled/default
  nginx -t -q && systemctl reload nginx
}
write_site no

# Let's Encrypt issues IP certificates only on the short-lived profile (~6 days); certbot's timer renews them.
# Needs certbot >= 5.4 for --ip-address with webroot: the snap is current, the apt package is far too old.
snap list certbot >/dev/null 2>&1 || snap install --classic certbot >/dev/null
ln -sf /snap/bin/certbot /usr/bin/certbot
certbot certonly --webroot -w /var/www/acme --ip-address "$IP" --preferred-profile shortlived \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --deploy-hook "systemctl reload nginx"
write_site yes
echo "https://$IP is up"
WIRE
fi

echo "== smoke test"
# next start needs a few seconds after a restart; nginx answers 502 until then
for _ in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$IP/")" = 200 ] && break; sleep 1; done
for path in / /app /calculator; do
  printf '%-14s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$IP$path")"
done
