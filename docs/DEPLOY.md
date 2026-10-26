# Deploying to a server (Timeweb Cloud or any Linux VPS)

The goal: put the project in **its own directory** and touch nothing else on the server.

## 1. Upload

From this repository on your computer (ssh asks for your key passphrase or password):

```bash
./scripts/deploy-timeweb.sh root@SERVER_IP            # code only, into ~/stom-ad-call-coach, refuses to overwrite
./scripts/deploy-timeweb.sh root@SERVER_IP --env      # + .env.local, .agents.json, knowledge base (secrets, over SSH)
./scripts/deploy-timeweb.sh root@SERVER_IP --build    # + npm ci && npm run build in that directory
./scripts/deploy-timeweb.sh root@SERVER_IP --update   # refresh only our own files later
./scripts/deploy-timeweb.sh --dry-run                 # list the archive, no connection
```

The archive is built from `git ls-files` plus new files minus everything in `.gitignore`, and the script refuses to continue if the archive contains `.env`, `.env.local`, `.agents.json`, the knowledge base, `node_modules` or `.next`.
`REMOTE_DIR=my-dir` changes the directory (relative to the remote home, no `..`).

## 2. Run

Needs Node.js >= 20.9 (check with `node -v`). On the server:

```bash
cd ~/stom-ad-call-coach
npm ci && npm run build
npx next start -H 127.0.0.1 -p 3010   # localhost only. Plain `npm start` listens on ALL interfaces and would expose the app over HTTP
```

Create `.env.local` on the server if you did not use `--env` (see `.env.example`). Keep it `chmod 600`.
Keep it running with your usual process manager. Example with systemd (a new unit file; nothing existing is edited):

```ini
# /etc/systemd/system/stom-ad-call-coach.service
[Unit]
Description=Stom AD Call Coach
After=network.target

[Service]
WorkingDirectory=/root/stom-ad-call-coach
ExecStart=/usr/bin/env npx next start -H 127.0.0.1 -p 3010
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now stom-ad-call-coach && systemctl status stom-ad-call-coach --no-pager
```

## 3. HTTPS is required

The microphone (`getUserMedia`) works only in a secure context, and the CRM session cookie is `Secure` in production. So the voice features and the amoCRM import do **not** work over plain `http://SERVER_IP:3010`.

**No domain yet:** use an SSH tunnel (the app listens on localhost only, so the tunnel is the only way in) (`localhost` counts as secure):

```bash
ssh -L 3000:localhost:3010 root@SERVER_IP     # then open http://localhost:3000
```

**With a (sub)domain:** add a *separate* nginx server block for it (do not edit existing ones), test, reload:

```nginx
# /etc/nginx/sites-available/stom-ad.conf  (symlink into sites-enabled, then: nginx -t && systemctl reload nginx)
server {
  server_name stom.example.com;
  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # the per-IP rate limit reads this header
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;                         # evaluations can take up to a minute
  }
}
```

Then issue a certificate for that name only: `certbot --nginx -d stom.example.com`.

## 4. Notes

- The knowledge base is one JSON file (`data/knowledge-base.json`) in the app directory. Back it up; it is not in git.
- The public demo has a per-IP rate limit in memory (single instance).
- Do not expose the app publicly without thinking about who may call the voice agents: every call uses your ElevenLabs and Gemini quota.
