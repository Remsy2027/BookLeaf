# Deployment guide

The user requested deployment files only for now. No hosted resources have been created.

## Local Docker

Install Docker Desktop and start its Linux container engine, then:

```sh
docker compose up --build -d
```

Open http://localhost:3001. The named `bookleaf-data` volume keeps tickets and sessions across container restarts. The Compose file intentionally uses development cookies for local HTTP. Stop with `docker compose down`; do not add `-v` unless you intentionally want to delete the demo database.

## Hosted single-instance container

Use a host supporting a persistent filesystem and HTTPS ingress, such as a private VPS or a single web-service instance with a persistent disk. This Dockerfile is not suitable for ephemeral serverless filesystems without replacing SQLite.

1. Push the source to a **private** repository or supply the ZIP through the host's private build workflow.
2. Build with the included Dockerfile. It builds the React assets, prunes development dependencies and runs as the non-root `node` user.
3. Mount a persistent disk at `/app/data`, writable by UID/GID 1000. A Docker named volume is initialized from the image directory with these permissions; external bind mounts may need administrator setup.
4. Set `NODE_ENV=production`, `PORT=3001`, `DATABASE_PATH=/app/data/bookleaf.sqlite`, a unique `DEMO_PASSWORD`, and the desired `ADMIN_EMAIL` **before the first start**. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the host's secret manager. Never add them as frontend build variables.
5. Route HTTPS traffic to port 3001. Set `TRUST_PROXY=1` only if there is exactly one trusted proxy between clients and the container. With production Secure cookies, plain HTTP login will not persist, as intended.
6. Use `/api/health` for readiness. Keep one instance/replica because SQLite and in-memory request limits are not a multi-instance architecture.
7. Confirm author and admin login, create a query, review a real AI draft, send a response, verify another author cannot see the query, and restart the container to check persistence.
8. Share the private repository/ZIP, hosted HTTPS URL and review credentials only with the intended technical team. Their collaborator email must be supplied before granting repository access.

## Backups and updates

Take a consistent SQLite backup using the SQLite backup API/CLI or stop the app before copying the database. Do not copy only the main `.sqlite` file while ignoring an active WAL. Encrypt backups and restrict access; they contain support messages and sample account information. Test restores before relying on a backup process.

Before updating, back up the database and run `npm test` and `npm run build`. The initial schema uses `CREATE TABLE IF NOT EXISTS`; this is not a migration system. Future schema changes must add versioned migrations. Re-seeding does not rotate existing account passwords.

## Real AI verification

After configuring the server key, submit a new ticket and confirm the admin shows **AI-classified** instead of fallback. Open it and verify that the response is based on the chosen book's actual values. Try a royalty query, an ISBN mismatch, a print defect and a production delay. Check that no exact payment date or invented delay reason appears. Remove the key or simulate provider failure and confirm manual support still works. Review the resulting text before sending; the application never auto-sends drafts.

## Selecting Gemini

For Gemini, configure `AI_PROVIDER=gemini`, `GEMINI_API_KEY` through the host secret manager, and `GEMINI_MODEL=gemini-2.5-flash-lite`. For OpenAI, use `AI_PROVIDER=openai` with the existing OpenAI settings. Restart after changing server environment variables.

## Selecting Groq (current default)

Configure `AI_PROVIDER=groq`, `GROQ_API_KEY` in the host secret manager and `GROQ_MODEL=openai/gpt-oss-120b`. The key is needed at runtime only, never at frontend build time. The Compose file forwards these settings. Run `node scripts/check-ai.mjs` for an opt-in synthetic live check. Keep the human-review step enabled for every response.
