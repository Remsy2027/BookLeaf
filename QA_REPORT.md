# Chrome QA report — 26 October 2026

## Verdict

**The core application and live Mac demo are verified. Manual file-selection verification remains outstanding; the public tunnel is temporary.**

The Mac deployment is now live at https://endorsement-chess-black-wines.trycloudflare.com. Hosted smoke tests passed for both roles, secure cookies, book ownership, Groq classification/drafting, private notes, replies, status/assignment and logout. Ticket and message persistence passed after restarting the Mac application container. Chrome also verified the public administrator workspace. See [deployment results](docs/qa/deployment.json) and [screenshot](docs/qa/mac-live-demo.jpg). The source repository is private. The tunnel URL can change on restart and requires the Mac to remain awake/online.

The earlier deployment blocker is resolved for a temporary reviewer demo; a permanent domain and production hosting are outside this setup.

## Follow-up verification ? current status

- Groq `openai/gpt-oss-120b`: live connection, six-category classification and two synthetic draft checks pass. Results: [ai-live.json](docs/qa/ai-live.json).
- Chrome: real AI classification and an editable metadata reply were observed. The draft correctly uses the current conversation and the 3?5 business-day policy; it was not sent automatically.
- Prompt/model refinement followed observed hallucinations. Unverified email addresses/URLs are now blocked; human review is still mandatory.
- **19 automated tests pass**, including Groq errors and rejection of invented contact destinations. Production build passes.
- Attachment picker added with type/size limits, filename and removal. Chrome displayed the control and opened the chooser. Actual automated file selection was blocked by the extension's missing ?Allow access to file URLs? permission; selection/removal interaction remains unverified in Chrome.
- Mobile cover-title widths no longer overflow. Heading now reads ?You write the story. We?re here for every chapter.? with proper spacing. Screenshots: [books](docs/qa/fixed-mobile-books.jpg), [login](docs/qa/fixed-mobile-login.jpg).
- Workspace data now has a loading/error/retry state and ignores stale requests; zero totals are no longer rendered before the account data loads. Network failure recovery was not fault-injected in this follow-up.
- [Live Groq draft screenshot](docs/qa/groq-live-draft.jpg).

The sections below record the initial QA pass; their blocked/gap findings are superseded by this follow-up where noted.

This pass assessed the current production build in Google Chrome. No application behavior was changed during QA. Two labelled local test tickets were created and retained; the database is excluded from the source ZIP.

## Method

- Windows, Node 24, Chrome, production assets served by Express on port 3001.
- Independent author (`localhost`) and admin (`127.0.0.1`) origins provided separate cookies against the same database.
- Provider keys were disabled only in the QA server process to exercise fallback without sending confidential records. The user's `.env` was not changed.
- A separate generic Gemini prompt using the configured key returned HTTP 400: **API key not valid. Please pass a valid API key.** No assignment policy or author information was sent in that probe.
- Mobile checks used a verified 390 × 844 viewport; overrides were reset afterwards.
- This was functional QA plus automated API coverage, not a penetration test, accessibility certification, load test, or production deployment audit.

## Initial Chrome results (before follow-up fixes)

| Check | Result | Observed behavior |
| --- | --- | --- |
| Incorrect password | PASS | Clear error; access denied |
| Author/admin login and logout | PASS | Correct workspace; desktop/mobile logout returned to login |
| Dataset display | PASS | Priya: 2 books, 531 copies, INR 19,908 earned, INR 3,570 pending |
| Required My Books fields | PASS | Title, ISBN, genre, publication date, status, MRP, sold, earned, paid and pending displayed |
| Account separation | PASS | Rohit saw his own books and initially no tickets, not Priya's tickets |
| Production/null values | PASS | Midnight in Mysore: Cover Design, zero sales/royalties, unset price/date, unassigned print partner |
| Empty/whitespace subject | PASS | Native required validation and server field-specific validation respectively |
| Book-specific query | PASS | Own-book dropdown and correct context on created ticket |
| General/account query | PASS | Ticket created without a book; no misleading book context |
| Safe text rendering | PASS | Literal `<b>not bold HTML</b>` displayed as text, not interpreted markup |
| Fallback triage | PASS | Six-month royalty query → Royalty & Payments / High; bio query → General Inquiry / Low |
| Queue ordering | PASS | High unresolved above Medium; Closed Critical below unresolved tickets |
| Combined filters | PASS | Status, category, priority and same-day From/To narrowed to expected ticket |
| Search/empty state | PASS | “Rohit” matched his query; an unmatched priority showed No matching queries |
| Self-assignment | PASS | Assigned state persisted |
| Priority/category override | PASS | High → Critical; category change also updated policy reference |
| Lifecycle | PASS | Open → In Progress → Resolved → Closed persisted |
| AI outage experience | PASS | Explicit unavailable notice; manual composer and policy reference remained usable |
| Internal note | PASS | Visible to admin; absent from author's open ticket |
| Public reply | PASS | Sent successfully; composer cleared |
| Automatic reply/status updates | PASS | Already-open author ticket received reply, In Progress and Closed without reload or navigation |
| Mobile form/books/navigation | PASS with polish issues | Actual document and viewport width both 390; form, books and logout usable |
| Captured JavaScript errors | PASS | No errors returned in captured author/admin browser logs |
| Live AI quality | BLOCKED | Configured Gemini key rejected; real AI classification and drafting not validated |
| Attachment picker | GAP | Explanatory text only; no file picker/selected-file display |
| Hosted demo | NOT DONE | No deployed URL; intentionally deferred |

## Supporting checks

- **16 automated tests pass** (`npm test`): authentication, sessions, role/ownership boundaries, foreign-book rejection, private notes/drafts, filtering, validation, version conflicts, cached/stale drafts, Gemini/OpenAI contracts and failure handling.
- **Production build passes** (`npm run build`).
- Direct database comparison: all **18 book records** and ownership match the supplied dataset of **10 authors**.
- No configured Gemini key found in `src` or `dist`; no private `.env` in the submission ZIP.
- Docker build and restart persistence passed in the prior implementation pass; they were **not repeated** during this Chrome pass.

## Findings

### High: live AI blocked

Google rejects the configured key. Mocked tests and manual fallback do not demonstrate real model quality. Add a valid key privately, then verify all six categories, priorities, editable drafts, policy fidelity, and misleading user instructions. Use synthetic or approved data with a free-tier provider. AI represents 25% of the assignment evaluation.

### Submission blocker: no live demo

The brief requires a hosted URL. Deployment files are present, but an HTTPS deployment, persistence check and hosted author/admin walkthrough are still needed. This is deferred work, not a local application defect.

### Medium: attachment UI missing

Reproduce: author → New support query → Attachments. Only a paragraph is shown. Add an optional picker, selected filename and remove control. Clearly label it UI-only if nothing is uploaded; actual upload/storage remains a bonus.

### Low: visual polish

- Long cover text such as `Ctrl+Alt+Delete` extends beyond the decorative cover area. Constrain/wrap the cover title.
- Mobile login heading joins words where line breaks are hidden, such as “story.We’re” and “forevery”. Preserve spaces.
- Immediately after login, dashboard counts briefly show zeros before book data arrives. Use a loading state instead of temporary incorrect totals.

## Evidence

- [Admin ticket workspace](docs/qa/admin-ticket.jpg)
- [Mobile support form](docs/qa/mobile-form.jpg)
- [Mobile books](docs/qa/mobile-books.jpg)

The screenshots show layout; the recorded interactions establish behavior. QA tickets begin `QA-20261026:`. No real support email, payout, escalation or external submission occurred.

## Before submission

1. Manually verify selecting/removing an attachment, or enable file-URL access for the Chrome extension and rerun that UI check.
2. Deploy when authorized; verify HTTPS, persistence and both roles on the hosted URL.
3. Submit the refreshed private source ZIP/docs with the live URL and reviewer credentials.
