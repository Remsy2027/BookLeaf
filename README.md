# BookLeaf Author Support & Communication Portal

A private, full-stack assignment submission built with React, Express and SQLite. Authors can review their books and raise support queries; the operations team can triage, draft, respond, add private notes and manage tickets.

**Delivery status:** implemented and tested locally, with working Groq AI classification and drafting verified through live synthetic fixtures and Chrome. Groq, Gemini and OpenAI are supported; Groq is selected locally. Nineteen automated tests and the production build pass. The hosted demo remains deferred. Keys stay in the ignored `.env` and are excluded from the source archive.

## Run locally

Requirements: **Node.js 24+** and npm. Node's built-in SQLite currently emits an experimental warning; this is expected. No separate database installation is needed.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if preferred. Open **http://localhost:3001**. First startup automatically seeds a new database. For development, use `npm run dev` and open **http://localhost:5173**; Vite proxies `/api` to Express on port 3001. `npm run seed` inserts missing sample records without deleting or overwriting existing records, passwords or tickets.

```sh
npm test
npm run build
```

### Demo credentials

All local demo accounts use password **`BookLeafDemo!2026`** unless `DEMO_PASSWORD` was changed before the initial seed.

| Role / scenario                                       | Email                       |
| ----------------------------------------------------- | --------------------------- |
| Admin                                                 | `admin@bookleaf.local`      |
| Author: pending and fully paid books                  | `priya.sharma@email.com`    |
| Author: multiple pending payouts                      | `rohit.kapoor@email.com`    |
| Author: production-stage book                         | `sneha.kulkarni@email.com`  |
| Author: production book and below-threshold royalties | `kavita.deshmukh@email.com` |

Every other author email in `bookleaf_sample_data.json` also works with the same demo password. The exact 10 authors and 18 books are seeded. Production requires a non-default `DEMO_PASSWORD` on initial seed. The seed is deliberately idempotent: changing the environment later does **not** rotate existing passwords.

### Configuration

| Variable         | Default / purpose                                           |
| ---------------- | ----------------------------------------------------------- |
| `PORT`           | `3001` — Express listener                                   |
| `DATABASE_PATH`  | `./data/bookleaf.sqlite` — persistent SQLite file           |
| `DEMO_PASSWORD`  | Local demo password above; customize before first seed      |
| `ADMIN_EMAIL`    | `admin@bookleaf.local`; applied at seed time                |
| `OPENAI_API_KEY` | Optional; server only. Never use a `VITE_` prefix           |
| `OPENAI_MODEL`   | `gpt-4o-mini`; configurable structured-output-capable model |
| `NODE_ENV`       | Use `production` behind HTTPS; enables Secure cookies       |
| `TRUST_PROXY`    | Set `1` only behind one trusted reverse proxy               |

Environment files, database files and dependencies are excluded from the source ZIP and Git tracking. The included dataset is confidential and must stay in a private submission.

## Reviewer walkthrough

1. Sign in as Priya. Check the two books, 531 copies sold, INR 19,908 earned and INR 3,570 pending.
2. Submit a query about a book or choose General / Account Level. Provide a subject and description.
3. Open an independent browser profile or incognito window as the admin. The queue refreshes every five seconds. Filter by status, category, priority, date or search text.
4. Open the query. Check book context, classification, priority and the relevant knowledge-base policy. An AI draft is requested automatically; without a key, a clear manual-writing notice appears.
5. Override triage if needed, assign to yourself and change status. Add an internal note, then switch to Public reply and send an edited response. The two composer fields are kept separate.
6. In the author window, the reply and status appear within about five seconds without a refresh. Internal notes and unsent drafts never appear in author API responses.
7. Sign in as Sneha or Kavita to inspect in-production books with unset prices, publication dates and print partners.

A fresh installation starts with no tickets; queries created during local QA exist only in the ignored local database and are not part of the submission archive.

## Architecture and design decisions

```text
React SPA ── same-origin REST /api ── Express
                                       ├── SQLite (users, books, tickets, messages, sessions)
                                       └── OpenAI Responses API (server-side only)
```

| Location                     | Responsibility                                                           |
| ---------------------------- | ------------------------------------------------------------------------ |
| `src/main.jsx`               | Session bootstrap, navigation and dashboard composition                  |
| `src/components/`            | Login, books, ticket list, query form and ticket workspace               |
| `src/lib.jsx`                | HTTP client and display formatting                                       |
| `server/app.js`              | REST endpoints, validation, authentication and role boundaries           |
| `server/db.js`               | Schema and transactional, idempotent dataset import                      |
| `server/ai.js`               | Strict AI schemas, context bounds, timeout, fallback and circuit breaker |
| `server/knowledge.js`        | Assignment policies and response-tone guidance                           |
| `tests/`                     | API integration and provider-contract/failure tests                      |
| `Dockerfile`, `compose.yaml` | Reproducible container build and local persistent-volume deployment      |

**Database:** relational ownership and foreign keys protect authors, books, tickets and messages. Book attributes retain the original JSON snapshot, including intentional nulls and placeholder ISBNs. Query-relevant fields are normalized; indexes support ownership, queue and message lookups. SQLite/WAL keeps the demo portable and persistent. It is intended for one application instance on a persistent disk. PostgreSQL and migrations would be the next step for a horizontally scaled service.

**Authentication:** bcrypt-hashed passwords and random 256-bit opaque sessions. Only a SHA-256 session-token hash is stored in the database. Sessions expire after eight hours, use HttpOnly/SameSite=Strict cookies, and are invalidated on logout. Production cookies are Secure. All API endpoints except login and minimal health are authenticated; admin actions enforce role checks. Author book ownership is checked when creating a ticket. Unauthorized ticket IDs return 404. No JWT or API key is stored in browser storage.

**Request security:** Helmet headers, no permissive CORS, a required `X-BookLeaf-Request: 1` header on writes, strict input schemas, parameterized SQL, body-length bounds, login throttling and per-user AI/ticket request limits. The custom header and same-origin configuration prevent cross-origin form writes. React renders query text as text, not HTML. Sensitive API responses use `Cache-Control: no-store`. Internal notes, draft text and AI rationale are removed from author responses at serialization time.

**Consistency:** status, assignment, triage and message mutations require the latest ticket `version`. Concurrent edits return 409 instead of silently overwriting changes. Message insert plus version update is transactional. Drafts are invalidated on ticket changes and replies. A generated draft is rejected if the ticket changes during generation. Queue ordering places unresolved tickets first, then Critical → High → Medium → Low, then oldest first. Unresolved queries older than two days get a visible waiting indicator.

**Near-real-time updates:** list and detail views poll every five seconds. This avoids extra infrastructure and works through normal HTTP proxies. In production, add visibility-aware backoff or SSE and stop polling on expired sessions. Pagination limits queue responses to 50 tickets.

## Groq configuration (selected provider)

Set `AI_PROVIDER=groq`, `GROQ_API_KEY` privately, and `GROQ_MODEL=openai/gpt-oss-120b`. Restart after changing server variables. The model is served by Groq; an OpenAI key is not used for this provider. Groq uses strict JSON schemas through its Chat Completions endpoint, followed by server-side validation. See [Groq structured outputs](https://console.groq.com/docs/structured-outputs).

The stronger model was selected after live evaluation exposed unsupported claims in a smaller-model draft. Prompts explicitly forbid invented payout dates, completed actions, UI sections and contact addresses; drafts containing email addresses or links are withheld because no approved destinations are supplied. Human review remains mandatory: this guard does not guarantee every factual claim is correct.

Run `node scripts/check-ai.mjs` for an opt-in live evaluation. It consumes provider quota, uses synthetic author/book fixtures with the project policy context, and writes `output/qa/ai-live.json`. Six categories and two policy-grounded drafts were checked successfully. Model behavior can vary; rerun after changing prompts or models.

## Gemini configuration (optional alternative)

To use Gemini instead, set `AI_PROVIDER=gemini` and `GEMINI_MODEL=gemini-2.5-flash-lite`. Set `GEMINI_API_KEY` privately to a valid Google AI Studio key and restart the server. The key is sent only in a server-side authentication header, never in the URL or frontend bundle. Do not commit `.env`.

Gemini uses the `generateContent` API with JSON schema output and the same prompts, validation, timeout, circuit breaker and human-review workflow described below. Its free tier has quotas and may use submitted content to improve Google products; use synthetic data unless you have authorization for confidential material. See [Gemini API documentation](https://ai.google.dev/api/generate-content).

To select the original provider, set `AI_PROVIDER=openai` and configure `OPENAI_API_KEY` and `OPENAI_MODEL`. A key from one provider cannot authenticate to the other.

## AI integration

The OpenAI default `gpt-4o-mini` is a small, cost-conscious model suited to classification and concise support drafting, and is explicitly compatible with strict structured output. Model selection is configurable. No claim about measured cost, latency or answer quality is made without a live evaluation. The implementation follows the [OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

1. **Creation and triage:** save the ticket with conservative rule-based triage first, then request category, priority and a short operational rationale in one structured call. Enumerated categories/priorities and a strict JSON schema constrain output; Zod validates it again. The AI result replaces fallback triage only if an admin has not already changed the ticket.
2. **Drafting:** opening a ticket asks for an unsent draft. The prompt combines company facts, tone rules, the selected category's policy, the selected book, author name, ticket text and at most three recent public replies. Author email, phone, other authors' records, internal notes and passwords are never sent by this integration. Ticket text is explicitly untrusted data; the model has no tools or mutation authority.
3. **Grounding:** policies cover the 80/20 net-profit split, quarterly payments, 45-day window, INR 1,000 threshold, ISBN escalation, verified free reprints, listing/re-sync windows, production stages and metadata changes. The prompt forbids inventing exact payout dates, bank status, delay reasons or completed escalations. A pending balance does not prove overdue payment. The dataset does not include accrual periods or bank verification, so drafts should propose investigation instead of promising a transfer date.
4. **Failures:** a 12-second timeout, failed HTTP status, refusal, incomplete output, malformed JSON or failed validation produces fallback triage or an empty manual-response composer. A 30-second circuit breaker avoids repeated provider calls during an outage. There are no automatic retries that multiply spend. Ticket creation remains persisted independently of the provider.
5. **Cost controls:** category and priority share one call; drafting is lazy; successful drafts are cached until the ticket changes; concurrent draft requests are coalesced. Queries are capped to 4,000 AI-input characters, reply history to 3 × 1,200 characters, and generation to 900 output tokens for OpenAI/Gemini or 1,800 completion tokens (including reasoning) for Groq. Only one category policy is sent for a draft, not the whole brief. `store: false` is set on OpenAI requests. Provider account retention policies still apply.
6. **Human review:** no AI response is sent automatically. Admins can edit the draft, change classification/priority, or write manually using the policy reference. Rule-based fallback is explicitly identified. Editing a response while a draft is loading prevents the returned draft from replacing typed text.

## REST API reference

Base URL: `/api`. JSON bodies, cookie-based sessions. For all POST/PATCH requests send `Content-Type: application/json` and `X-BookLeaf-Request: 1`. API clients must retain the login cookie. No API key is accepted from the frontend.

| Method / endpoint            | Access            | Input and result                                                                                            |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /health`                | Public            | `{status:"ok"}` after a DB check                                                                            |
| `POST /auth/login`           | Public, throttled | `{email,password}` → `{user:{id,name,email,role}}`, session cookie                                          |
| `GET /auth/me`               | Signed in         | `{user}`                                                                                                    |
| `POST /auth/logout`          | Signed in         | Empty body; invalidates session; 204                                                                        |
| `GET /meta`                  | Signed in         | `{categories,priorities,statuses}` arrays                                                                   |
| `GET /books`                 | Signed in         | `{books:[...]}`; authors see only their books; admin sees all                                               |
| `GET /knowledge`             | Admin             | `{company,policies}`                                                                                        |
| `GET /tickets`               | Signed in         | `{tickets,total,page,pageSize}`; author-scoped automatically                                                |
| `POST /tickets`              | Author            | `{book_id?:string                                                                                           | null,subject,description}`→ 201`{ticket}`          |
| `GET /tickets/:id`           | Owner/admin       | `{ticket}` including public messages and selected book; admin also gets internal messages, draft and policy |
| `PATCH /tickets/:id`         | Admin             | `{version,status?,category?,priority?,assigned_to?:"me"                                                     | "unassigned"}`→`{ticket}` with incremented version |
| `POST /tickets/:id/messages` | Admin             | `{version,body,internal?:boolean}` → 201 `{ticket}`; `internal` defaults to false                           |
| `POST /tickets/:id/draft`    | Admin, throttled  | Empty body; `{draft,source:"ai",cached?:true}` or `{draft:"",source:"unavailable",message}`                 |

### Filters and validation

`GET /tickets` accepts `status`, `category`, `priority`, `from`, `to`, `search` and `page`. Dates use ISO `YYYY-MM-DD`, inclusively in UTC; `from` must not follow `to`. Search matches subject, full ticket ID or author name. Page starts at 1; page size is fixed at 50. Unknown query/body fields are rejected. Subject: 1–160 trimmed characters; description/message: 1–8,000 trimmed characters. Blank strings, invalid enums and foreign book IDs return 400.

- Status: `Open`, `In Progress`, `Resolved`, `Closed`.
- Priority: `Critical`, `High`, `Medium`, `Low`.
- Category: `Royalty & Payments`, `ISBN & Metadata Issues`, `Printing & Quality`, `Distribution & Availability`, `Book Status & Production Updates`, `General Inquiry`.

Common errors: 400 invalid input, 401 missing/expired login, 403 role/header violation, 404 missing/inaccessible ticket, 409 concurrent modification, 413 oversized body, 429 throttling, 500 unexpected server error. Error shape:

```json
{
  "error": {
    "message": "Please check the submitted fields.",
    "fields": [{ "path": "subject", "message": "..." }]
  }
}
```

`fields` is present for schema errors only. Server errors do not disclose stack traces, prompts or credentials.

Example after cookie-based login:

```http
POST /api/tickets
Content-Type: application/json
X-BookLeaf-Request: 1
Cookie: session=<login cookie>

{"book_id":"BK001","subject":"Pending royalty","description":"Please explain my INR 3,570 pending balance."}
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for local Docker and a single-instance HTTPS deployment. Keep the repository private. Do not publish the assignment brief, dataset, credentials or solution to a public repository. Provide the reviewer with the hosted URL and the customized demo password separately once deployed. No email or external submission has been sent by this project setup.

## Verification and remaining limitations

Automated coverage includes exact seed counts and nulls, idempotent seeding, login/session invalidation, author isolation, foreign-book rejection, admin authorization, private-note/draft isolation, reply visibility, conflict handling, filters, schema constraints and AI outage/malformed-output behavior. See [QA.md](QA.md) for the checks actually run and manual review steps.

- Groq was tested live with six synthetic classification cases and two draft cases, plus an editable draft in Chrome. This is a small evaluation, not a guarantee of factual accuracy; all replies require human review.
- The optional attachment picker shows a filename, validates PDF/PNG/JPG/TXT up to 10 MB, and supports removal. It is clearly labelled local selection only; no bytes or filename are submitted. Browser automation verified the control but could not set a file because the Chrome extension lacks file-URL access.
- No password reset, email notifications, author follow-up messages, audit-history UI, real payment operations or external platform integrations. Authors can create a new query for a follow-up; admins can reopen a ticket via status.
- The sample dataset has no per-platform sales ledger, payout accrual quarter, bank details or production estimates. Those values are never fabricated.
- SQLite JSON book snapshots are simple for this fixed dataset, not a substitute for a normalized sales ledger in production. No horizontal scaling, durable AI job queue, automated backup scheduler or schema migration framework is included.
- Rate limits and provider circuit state are process-local. Multi-instance deployment requires shared limits and jobs. Sessions themselves are persisted in SQLite.
- AI requests are synchronous after persistence; a disconnected browser may not know whether creation succeeded. Production should add idempotency keys and background jobs.
- The demo uses one configurable password across seeded users. Replace with invitation/reset flows and unique credentials before real author access.
- Dates in queue filters are UTC; display timestamps use the browser locale. No contractual SLA or payout-date calculation is inferred from the old sample records.
- Google Fonts improves typography when reachable; system-font fallbacks keep the interface usable offline.

The email specifies four days, while the attached brief specifies five. Treat the email's four-day deadline as controlling; calculate it from the actual receipt date. See [APPROACH.md](APPROACH.md) for the short design write-up.
