# Mac mini reviewer deployment

Private source: https://github.com/Remsy2027/BookLeaf

Current reviewer URL (26 October 2026): https://endorsement-chess-black-wines.trycloudflare.com

The deployment lives at `/Users/remsy/BookLeaf`. It uses the `bookleaf` Docker Compose project, its own persistent `bookleaf-data` volume, and an isolated Cloudflare Quick Tunnel. Existing Mac containers are not modified.

## Start or update

```sh
cd /Users/remsy/BookLeaf
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
docker compose -f compose.yaml -f compose.review.yaml up --build -d
```

Production cookies are Secure. Use the public HTTPS URL for login, not the local HTTP endpoint. `127.0.0.1:3001/api/health` remains available for local health checks. The port is not bound to the LAN interface.

Find the current public URL:

```sh
docker compose -f compose.yaml -f compose.review.yaml logs tunnel | grep -o 'https://[-a-z0-9]*\.trycloudflare\.com' | tail -1
```

The public URL is a temporary reviewer link, **not permanent hosting**. It may change when the tunnel restarts. Quick Tunnels have no uptime guarantee. A stable production-style deployment needs a named tunnel and a domain, or a hosted server.

## Credentials and secrets

The Mac `.env` has mode `600`, contains the Groq key and a randomly generated reviewer password, and is not committed. The password was set before the first seed. All seeded demo accounts use it. The local Windows file `output/mac-demo-access.txt` holds the access details; send it only to intended reviewers. The README's local development password does not apply to this deployment.

Do not run `docker compose config` in shared logs: it prints resolved environment values. Do not copy `.env` into Git or a submission ZIP.

## Keep the demo online

The Mac must be powered on, connected to the internet, and running Docker Desktop. A dedicated `caffeinate -i` process is used to prevent idle sleep; its PID is recorded in `.caffeinate.pid`. It does not change global power settings and does not survive a reboot. After reboot, log in, start Docker Desktop, run the start command, and check the current URL.

To stop the demo intentionally:

```sh
cd /Users/remsy/BookLeaf
docker compose -f compose.yaml -f compose.review.yaml down
```

This preserves the named database volume. Never add `-v` unless you intend to delete all database records. To stop the keep-awake process, inspect the PID in `.caffeinate.pid`, confirm it belongs to this deployment's `caffeinate -i` process, and terminate it.

## Health and logs

```sh
docker compose -f compose.yaml -f compose.review.yaml ps
curl http://127.0.0.1:3001/api/health
docker compose -f compose.yaml -f compose.review.yaml logs --tail=50 bookleaf
```

The initial checkout was transferred using a Git bundle over SSH, so no new GitHub credential was installed on the Mac. Its `origin` points to the private GitHub repository. Future `git pull` requires a GitHub identity with repository access on the Mac; alternatively transfer an updated Git bundle from the authenticated Windows machine and fast-forward the checkout.
