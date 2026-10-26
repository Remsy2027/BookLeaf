# Mac mini deployment

Live URL: https://bookleaf.mohitpatel.de

Private source: https://github.com/Remsy2027/BookLeaf

The app lives at `/Users/remsy/BookLeaf`, using the `bookleaf` Compose project, its own persistent database volume, and a dedicated named Cloudflare Tunnel. Other Mac services are not modified.

## Start/update

```sh
cd /Users/remsy/BookLeaf
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
docker compose -f compose.yaml -f compose.review.yaml up --build -d
```

The stable hostname routes to tunnel `2be4fc5b-5b88-47d0-ae8b-b826dce85983` (name `bookleaf`). The ingress configuration is in `deploy/cloudflared.yml`. All other hostnames receive 404 from this tunnel. HTTPS terminates at Cloudflare and traffic reaches the Mac over the encrypted tunnel. The app listens on loopback port 3001 and uses Secure cookies; sign in at the HTTPS URL.

## Secrets and credentials

The Mac `.env` is mode 600 and contains the Groq key and randomly generated demo password. All seeded demo accounts use this password, supplied privately in the Windows file `output/mac-demo-access.txt`. The README's development password does not apply to this deployment.

The tunnel credentials are in `.cloudflared/bookleaf.json`, mode 600 inside a mode-700 directory. Both Git and Docker build context exclude that directory. The tunnel container mounts the credentials read-only and runs as root inside its unprivileged, read-only container to read this protected file. The app container remains non-root. Neither the API key, demo password nor tunnel credentials are committed.

A fresh checkout on another machine needs the private `.env` and tunnel credential file transferred separately. Do not display `docker compose config` or full container inspection output in shared logs, as these can include resolved secrets.

## Availability

The custom hostname does not change when the tunnel restarts. The Mac must still be powered on, awake, connected to the internet and running Docker Desktop. A dedicated `caffeinate -i` process prevents idle sleep; its PID is in `.caffeinate.pid`. It does not change global power settings and does not survive a reboot. After reboot, log in, start Docker Desktop, run the start command and check the public health endpoint.

## Check and stop

```sh
docker compose -f compose.yaml -f compose.review.yaml ps
curl https://bookleaf.mohitpatel.de/api/health
docker compose -f compose.yaml -f compose.review.yaml logs --tail=50 bookleaf
```

To stop intentionally, run `docker compose -f compose.yaml -f compose.review.yaml down`. Do not add `-v`, which would delete database records. To stop the keep-awake process, confirm the PID in `.caffeinate.pid` belongs to this deployment's `caffeinate -i` process before terminating it.

The Mac checkout was transferred using a Git bundle over SSH. Its origin points to the private repository; future direct pulls require a GitHub identity with repository access. Alternatively, transfer another bundle from the authenticated Windows machine and fast-forward the checkout.
