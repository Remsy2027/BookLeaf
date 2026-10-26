// Opt-in hosted smoke check: creates a labelled QA ticket and a manual response.
// Usage: node --env-file=<private-env-file> scripts/check-deployment.mjs <https-url>
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.argv[2];
if (!base?.startsWith("https://") || !process.env.DEMO_PASSWORD)
  throw new Error("HTTPS URL and DEMO_PASSWORD are required.");
async function call(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-BookLeaf-Request": "1",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data, headers: response.headers };
}
async function login(email) {
  const r = await call("/api/auth/login", {
    method: "POST",
    body: { email, password: process.env.DEMO_PASSWORD },
  });
  assert.equal(r.status, 200, "Login failed");
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  return cookie.split(";")[0];
}
assert.equal((await call("/api/health")).status, 200);
assert.equal((await call("/api/books")).status, 401);
const author = await login("priya.sharma@email.com");
const admin = await login(process.env.ADMIN_EMAIL || "admin@bookleaf.local");
assert.equal(
  (await call("/api/books", { cookie: author })).data.books.length,
  2,
);
assert.equal(
  (await call("/api/books", { cookie: admin })).data.books.length,
  18,
);
let result = await call("/api/tickets", {
  cookie: author,
  method: "POST",
  body: {
    subject: "Deployment QA: metadata update",
    description:
      "Synthetic deployment check: can the description of a published book be updated, and how long does it take?",
    book_id: null,
  },
});
assert.equal(result.status, 201);
const id = result.data.ticket.id;
let ticket = (await call(`/api/tickets/${id}`, { cookie: admin })).data.ticket;
assert.equal(ticket.ai_source, "ai", "Live classification did not succeed");
const drafted = await call(`/api/tickets/${id}/draft`, {
  cookie: admin,
  method: "POST",
});
assert.equal(drafted.data.source, "ai", "Live draft did not succeed");
assert.ok(drafted.data.draft.length > 30);
result = await call(`/api/tickets/${id}/messages`, {
  cookie: admin,
  method: "POST",
  body: {
    version: ticket.version,
    body: "Deployment QA private note",
    internal: true,
  },
});
assert.equal(result.status, 201);
ticket = result.data.ticket;
result = await call(`/api/tickets/${id}/messages`, {
  cookie: admin,
  method: "POST",
  body: {
    version: ticket.version,
    body: "Deployment QA: the public response channel is working. This is a test message.",
    internal: false,
  },
});
assert.equal(result.status, 201);
ticket = result.data.ticket;
result = await call(`/api/tickets/${id}`, {
  cookie: admin,
  method: "PATCH",
  body: { version: ticket.version, status: "Resolved", assigned_to: "me" },
});
assert.equal(result.status, 200);
const authorView = (await call(`/api/tickets/${id}`, { cookie: author })).data
  .ticket;
assert.equal(authorView.messages.length, 1);
assert.equal(authorView.status, "Resolved");
assert.equal(authorView.draft, undefined);
await call("/api/auth/logout", { cookie: author, method: "POST" });
assert.equal((await call("/api/auth/me", { cookie: author })).status, 401);
await call("/api/auth/logout", { cookie: admin, method: "POST" });
const report = {
  url: base,
  testedAt: new Date().toISOString(),
  ticketId: id,
  result: "PASS",
  checks: [
    "HTTPS health",
    "Secure/HttpOnly session cookies",
    "both roles",
    "book ownership",
    "live Groq classification",
    "live Groq draft",
    "private notes",
    "public response",
    "status/assignment",
    "logout revocation",
  ],
};
mkdirSync("output/qa", { recursive: true });
writeFileSync("output/qa/deployment.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
