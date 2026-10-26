import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { openDatabase, seed } from "../server/db.js";
import { createApp } from "../server/app.js";
import { createAI } from "../server/ai.js";

let db, app, author, other, admin, ticket;
const write = (req) => req.set("X-BookLeaf-Request", "1");
before(async () => {
  db = openDatabase(":memory:");
  seed(db);
  app = createApp(db, { ai: createAI({ apiKey: "" }) });
  author = request.agent(app);
  other = request.agent(app);
  admin = request.agent(app);
  for (const [agent, email] of [
    [author, "priya.sharma@email.com"],
    [other, "rohit.kapoor@email.com"],
    [admin, "admin@bookleaf.local"],
  ])
    await write(agent.post("/api/auth/login"))
      .send({ email, password: "BookLeafDemo!2026" })
      .expect(200);
});
after(() => db.close());
test("all protected endpoints require authentication; unsafe requests require same-origin header", async () => {
  await request(app).get("/api/books").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "x@example.com", password: "x" })
    .expect(403);
  await write(request(app).post("/api/auth/login"))
    .send({ email: "priya.sharma@email.com", password: "wrong" })
    .expect(401);
});
test("seed is idempotent and book data is scoped, including production nulls", async () => {
  seed(db);
  assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 11);
  const a = await author.get("/api/books").expect(200);
  assert.equal(a.body.books.length, 2);
  assert.ok(a.body.books.every((b) => b.author_id === "AUTH001"));
  const all = await admin.get("/api/books").expect(200);
  assert.equal(all.body.books.length, 18);
  assert.equal(all.body.books.find((b) => b.book_id === "BK013").mrp, null);
});
test("author cannot attach another author’s book or inject unexpected fields", async () => {
  await write(author.post("/api/tickets"))
    .send({ book_id: "BK003", subject: "Wrong book", description: "Test" })
    .expect(400);
  await write(author.post("/api/tickets"))
    .send({ subject: "Test", description: "Test", status: "Resolved" })
    .expect(400);
  await write(author.post("/api/tickets"))
    .send({ subject: "   ", description: "Test" })
    .expect(400);
});
test("ticket persists without an AI key, cross-account access is hidden, admin-only routes are denied", async () => {
  const r = await write(author.post("/api/tickets"))
    .send({
      book_id: "BK001",
      subject: "Royalty not paid for 6 months",
      description: "Please check my pending royalties.",
    })
    .expect(201);
  ticket = r.body.ticket;
  assert.equal(ticket.priority, "High");
  assert.equal(ticket.status, "Open");
  assert.equal(ticket.ai_reason, undefined);
  await other.get(`/api/tickets/${ticket.id}`).expect(404);
  assert.equal((await other.get("/api/tickets")).body.total, 0);
  await write(author.patch(`/api/tickets/${ticket.id}`))
    .send({ version: 1, status: "Closed" })
    .expect(403);
  await write(author.post(`/api/tickets/${ticket.id}/draft`)).expect(403);
  await write(author.post(`/api/tickets/${ticket.id}/messages`))
    .send({ body: "Hidden", internal: true, version: 1 })
    .expect(403);
});
test("admin can override triage and assign; stale edits conflict", async () => {
  const r = await write(admin.patch(`/api/tickets/${ticket.id}`))
    .send({
      version: 1,
      status: "In Progress",
      priority: "Critical",
      category: "Royalty & Payments",
      assigned_to: "me",
    })
    .expect(200);
  assert.equal(r.body.ticket.assigned_to, "ADMIN001");
  assert.equal(r.body.ticket.version, 2);
  await write(admin.patch(`/api/tickets/${ticket.id}`))
    .send({ version: 1, status: "Closed" })
    .expect(409);
});
test("internal notes and unsent drafts never leak to authors; sent replies appear on polling", async () => {
  await write(admin.post(`/api/tickets/${ticket.id}/messages`))
    .send({
      version: 2,
      body: "Internal investigation details",
      internal: true,
    })
    .expect(201);
  db.prepare("UPDATE tickets SET draft=? WHERE id=?").run(
    "Unsent confidential draft",
    ticket.id,
  );
  let r = await author.get(`/api/tickets/${ticket.id}`).expect(200);
  assert.equal(r.body.ticket.messages.length, 0);
  assert.equal(r.body.ticket.draft, undefined);
  assert.equal(r.body.ticket.policy, undefined);
  await write(admin.post(`/api/tickets/${ticket.id}/messages`))
    .send({
      version: 3,
      body: "We will review your payout records and follow up within 48 hours.",
    })
    .expect(201);
  r = await author.get(`/api/tickets/${ticket.id}`).expect(200);
  assert.equal(r.body.ticket.messages.length, 1);
  assert.match(r.body.ticket.messages[0].body, /48 hours/);
  assert.equal(
    (await admin.get(`/api/tickets/${ticket.id}`)).body.ticket.messages.length,
    2,
  );
  await write(admin.post(`/api/tickets/${ticket.id}/messages`))
    .send({ version: 3, body: "Duplicate" })
    .expect(409);
});
test("manual response stays available when AI draft cannot be generated", async () => {
  const r = await write(admin.post(`/api/tickets/${ticket.id}/draft`)).expect(
    200,
  );
  assert.equal(r.body.source, "unavailable");
  assert.equal(r.body.draft, "");
});
test("queue filtering and validation work", async () => {
  assert.equal(
    (await admin.get("/api/tickets?priority=Critical&status=In%20Progress"))
      .body.total,
    1,
  );
  assert.equal((await admin.get("/api/tickets?priority=Low")).body.total, 0);
  assert.equal((await admin.get("/api/tickets?search=Priya")).body.total, 1);
  await admin.get("/api/tickets?status=Something").expect(400);
  await admin.get("/api/tickets?from=2026-12-31&to=2026-01-01").expect(400);
  await admin.get("/api/tickets?page=0").expect(400);
});
test("logout invalidates server-side session", async () => {
  await write(other.post("/api/auth/logout")).expect(204);
  await other.get("/api/books").expect(401);
});

test("drafts cache successful output and reject stale in-flight requests", async () => {
  let calls = 0,
    release,
    started;
  const provider = {
    draft: async () => {
      calls++;
      return { draft: "Reviewed facts only.", source: "ai" };
    },
  };
  const isolated = request.agent(createApp(db, { ai: provider }));
  await write(isolated.post("/api/auth/login"))
    .send({ email: "admin@bookleaf.local", password: "BookLeafDemo!2026" })
    .expect(200);
  await write(isolated.post(`/api/tickets/${ticket.id}/draft`)).expect(200);
  const cached = await write(
    isolated.post(`/api/tickets/${ticket.id}/draft`),
  ).expect(200);
  assert.equal(cached.body.cached, true);
  assert.equal(calls, 1);
  let version = (await isolated.get(`/api/tickets/${ticket.id}`)).body.ticket
    .version;
  await write(isolated.patch(`/api/tickets/${ticket.id}`))
    .send({ version, status: "Open" })
    .expect(200);
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  provider.draft = async () => {
    calls++;
    started();
    await new Promise((resolve) => {
      release = resolve;
    });
    return { draft: "Stale draft.", source: "ai" };
  };
  const first = write(isolated.post(`/api/tickets/${ticket.id}/draft`)).then(
    (r) => r,
  );
  await ready;
  version = (await isolated.get(`/api/tickets/${ticket.id}`)).body.ticket
    .version;
  await write(isolated.patch(`/api/tickets/${ticket.id}`))
    .send({ version, status: "In Progress" })
    .expect(200);
  release();
  assert.equal((await first).status, 409);
  const current = await isolated.get(`/api/tickets/${ticket.id}`);
  assert.equal(current.body.ticket.draft, null);
});
