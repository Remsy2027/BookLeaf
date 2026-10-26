# Verification record

**Latest verdict:** see [QA_REPORT.md](QA_REPORT.md). Groq is working and tested live; the attachment picker and visual/loading fixes are implemented. There are 19 passing automated tests. Hosted deployment remains deferred, and automated file selection is limited by the Chrome extension permission. Earlier notes below are historical.

Verified locally on 26 October 2026 with Node 24, Windows, Chrome and Docker Desktop (Linux containers).

## Completed

- `npm ci` / installation: lockfile created; dependency audit reported no known vulnerabilities at installation time.
- `npm test`: **14 passing tests**, covering authentication, role and ownership boundaries, seed records/nulls, private data isolation, ticket mutations, version conflicts, draft caching/staleness, filtering and AI failure paths.
- `npm run build`: production React bundle builds successfully.
- Browser author login: verified Priya's two books, 531 sold copies, INR 19,908 royalties earned and INR 3,570 pending.
- Browser support workflow: submitted a book-specific query, opened it in the admin queue, confirmed the explicit AI-unavailable/manual-writing message and policy reference, saved an internal note and sent a public response.
- Browser privacy check: logged back in as the author and confirmed the sent response appears while the internal note is absent.
- Browser composer check: a typed public response remains intact while switching to and saving a separate internal note.
- Responsive check: inspected the ticket/reply workspace at 390 × 844 and verified mobile sign-out; restored the original desktop viewport afterwards.
- Docker image build: successful with the supplied Dockerfile, including the production asset build and non-root runtime.
- Container smoke test: health endpoint, initial seed (11 accounts / 18 books), login, query creation and session/ticket persistence across a container restart.

The automated tests use an isolated in-memory database and mocked provider responses. Browser testing uses a local SQLite database. Local QA tickets are excluded from the source archive.

## Not claimed as verified

- No actual OpenAI key was configured, so real model quality, provider-account availability and latency have not been measured.
- No hosted HTTPS deployment has been created or verified. Deployment configuration is supplied at the user's request.
- No multi-instance load test, accessibility audit, penetration test or backup-restore drill has been performed.
- No attachment upload is implemented; the UI explicitly says so.

Before external submission, configure the live provider, follow `DEPLOYMENT.md`, run the reviewer walkthrough against the hosted URL, and include the correct review credentials privately.

## Gemini integration update

Added Gemini structured generation, header-based key authentication, and quota/incomplete-output fallback tests. All 16 tests and the production build pass. A generic connection check returned HTTP 400: API key not valid. No confidential ticket or assignment policy was sent during that check. A valid key and successful live evaluation are still needed.
