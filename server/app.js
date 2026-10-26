import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { z, ZodError } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "./constants.js";
import { createAI, fallbackClassification } from "./ai.js";
import { COMPANY, POLICIES } from "./knowledge.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const text = (max) => z.string().trim().min(1).max(max);
const error = (status, message) =>
  Object.assign(new Error(message), { status });
const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
});

export function createApp(
  db,
  { ai = createAI(), staticDir = resolve("dist") } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("X-BookLeaf-Request") !== "1"
    )
      return next(error(403, "Missing same-origin request header."));
    next();
  });
  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          message: "Too many login attempts. Try again in 15 minutes.",
        },
      }),
  });
  const expensiveLimit = rateLimit({
    windowMs: 60000,
    limit: 15,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: { message: "Request limit reached. Please wait one minute." },
      }),
  });
  const dummyHash = bcrypt.hashSync("timing-defense-only", 12);
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const input = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email.trim().toLowerCase());
    const valid = await bcrypt.compare(
      input.password,
      user?.password_hash || dummyHash,
    );
    if (!user || !valid) throw error(401, "Email or password is incorrect.");
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    if (req.cookies.session)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        hash(req.cookies.session),
      );
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      hash(token),
      user.id,
      Date.now() + 8 * 60 * 60 * 1000,
    );
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ user: publicUser(user) });
  });
  app.use("/api", (req, res, next) => {
    const user = db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(hash(req.cookies.session || ""), Date.now());
    if (!user) return next(error(401, "Please sign in to continue."));
    req.user = publicUser(user);
    next();
  });
  const admin = (req, res, next) =>
    req.user.role === "admin"
      ? next()
      : next(error(403, "Admin access required."));
  function ticketFor(req) {
    const row = db
      .prepare("SELECT * FROM tickets WHERE id=?")
      .get(req.params.id);
    if (!row || (req.user.role !== "admin" && row.author_id !== req.user.id))
      throw error(404, "Ticket not found.");
    return row;
  }
  function serialize(ticket, user, detail = false) {
    const author = db
      .prepare("SELECT name FROM users WHERE id=?")
      .get(ticket.author_id);
    const book = ticket.book_id
      ? JSON.parse(
          db.prepare("SELECT data FROM books WHERE id=?").get(ticket.book_id)
            .data,
        )
      : null;
    const { draft, draft_source, ai_source, ai_reason, ...safe } = ticket;
    const result = {
      ...safe,
      author_name: author.name,
      book_title: book?.title || null,
    };
    if (user.role === "admin") Object.assign(result, { ai_source, ai_reason });
    if (detail) {
      result.book = book;
      result.messages = db
        .prepare(
          `SELECT m.id,m.body,m.internal,m.created_at,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.user_id WHERE ticket_id=? ${user.role === "admin" ? "" : "AND internal=0"} ORDER BY m.created_at,m.rowid`,
        )
        .all(ticket.id);
      if (user.role === "admin")
        Object.assign(result, {
          draft,
          draft_source,
          policy: POLICIES[ticket.category],
        });
    }
    return result;
  }
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      hash(req.cookies.session || ""),
    );
    res.clearCookie("session", {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(204).end();
  });
  app.get("/api/meta", (req, res) =>
    res.json({
      categories: CATEGORIES,
      priorities: PRIORITIES,
      statuses: STATUSES,
    }),
  );
  app.get("/api/books", (req, res) => {
    const rows =
      req.user.role === "admin"
        ? db.prepare("SELECT * FROM books").all()
        : db.prepare("SELECT * FROM books WHERE author_id=?").all(req.user.id);
    res.json({
      books: rows.map((b) => ({
        ...JSON.parse(b.data),
        author_id: b.author_id,
      })),
    });
  });
  app.get("/api/knowledge", admin, (req, res) =>
    res.json({ company: COMPANY, policies: POLICIES }),
  );
  app.get("/api/tickets", (req, res) => {
    const q = z
      .object({
        status: z.enum(STATUSES).optional(),
        category: z.enum(CATEGORIES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        search: z.string().max(200).optional(),
        page: z.coerce.number().int().min(1).default(1),
      })
      .strict()
      .parse(req.query);
    if (q.from && q.to && q.from > q.to)
      throw error(400, "Start date must be before end date.");
    const where = [],
      args = [];
    if (req.user.role !== "admin") {
      where.push("t.author_id=?");
      args.push(req.user.id);
    }
    for (const field of ["status", "category", "priority"])
      if (q[field]) {
        where.push(`t.${field}=?`);
        args.push(q[field]);
      }
    if (q.from) {
      where.push("t.created_at>=?");
      args.push(`${q.from}T00:00:00.000Z`);
    }
    if (q.to) {
      where.push("t.created_at<=?");
      args.push(`${q.to}T23:59:59.999Z`);
    }
    if (q.search) {
      where.push("(t.subject LIKE ? OR t.id LIKE ? OR u.name LIKE ?)");
      args.push(...Array(3).fill(`%${q.search}%`));
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const base = `FROM tickets t JOIN users u ON u.id=t.author_id ${clause}`;
    const total = db
      .prepare(`SELECT COUNT(*) AS count ${base}`)
      .get(...args).count;
    const rows = db
      .prepare(
        `SELECT t.* ${base} ORDER BY CASE WHEN t.status IN ('Resolved','Closed') THEN 1 ELSE 0 END, CASE t.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,t.created_at ASC LIMIT 50 OFFSET ?`,
      )
      .all(...args, (q.page - 1) * 50);
    res.json({
      tickets: rows.map((t) => serialize(t, req.user)),
      total,
      page: q.page,
      pageSize: 50,
    });
  });
  app.post("/api/tickets", expensiveLimit, async (req, res) => {
    if (req.user.role !== "author")
      throw error(403, "Only authors can create support tickets.");
    const input = z
      .object({
        book_id: z.string().nullable().optional(),
        subject: text(160),
        description: text(8000),
      })
      .strict()
      .parse(req.body);
    if (
      input.book_id &&
      !db
        .prepare("SELECT id FROM books WHERE id=? AND author_id=?")
        .get(input.book_id, req.user.id)
    )
      throw error(400, "Select one of your own books.");
    const id = randomUUID();
    const time = now();
    const fallback = fallbackClassification(input.subject, input.description);
    db.prepare(
      "INSERT INTO tickets (id,author_id,book_id,subject,description,category,priority,ai_source,ai_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      req.user.id,
      input.book_id || null,
      input.subject,
      input.description,
      fallback.category,
      fallback.priority,
      fallback.source,
      fallback.reason,
      time,
      time,
    );
    // Persist first: a provider failure cannot lose the author’s query.
    const classification = await ai.classify(input.subject, input.description);
    db.prepare(
      "UPDATE tickets SET category=?,priority=?,ai_source=?,ai_reason=? WHERE id=? AND version=1",
    ).run(
      classification.category,
      classification.priority,
      classification.source,
      classification.reason,
      id,
    );
    res.status(201).json({
      ticket: serialize(
        db.prepare("SELECT * FROM tickets WHERE id=?").get(id),
        req.user,
        true,
      ),
    });
  });
  app.get("/api/tickets/:id", (req, res) =>
    res.json({ ticket: serialize(ticketFor(req), req.user, true) }),
  );
  app.patch("/api/tickets/:id", admin, (req, res) => {
    const ticket = ticketFor(req);
    const input = z
      .object({
        version: z.number().int().positive(),
        status: z.enum(STATUSES).optional(),
        category: z.enum(CATEGORIES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        assigned_to: z.enum(["me", "unassigned"]).optional(),
      })
      .strict()
      .parse(req.body);
    const changed = db
      .prepare(
        "UPDATE tickets SET status=?,category=?,priority=?,assigned_to=?,draft=NULL,draft_source=NULL,version=version+1,updated_at=? WHERE id=? AND version=?",
      )
      .run(
        input.status || ticket.status,
        input.category || ticket.category,
        input.priority || ticket.priority,
        input.assigned_to === "me"
          ? req.user.id
          : input.assigned_to === "unassigned"
            ? null
            : ticket.assigned_to,
        now(),
        ticket.id,
        input.version,
      );
    if (!changed.changes)
      throw error(409, "This ticket changed. Reload it before saving.");
    res.json({ ticket: serialize(ticketFor(req), req.user, true) });
  });
  app.post("/api/tickets/:id/messages", admin, (req, res) => {
    const ticket = ticketFor(req);
    const input = z
      .object({
        body: text(8000),
        internal: z.boolean().default(false),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    db.exec("BEGIN");
    try {
      const changed = db
        .prepare(
          "UPDATE tickets SET version=version+1,updated_at=?,draft=NULL,draft_source=NULL WHERE id=? AND version=?",
        )
        .run(now(), ticket.id, input.version);
      if (!changed.changes)
        throw error(409, "This ticket changed. Reload it before sending.");
      db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(
        randomUUID(),
        ticket.id,
        req.user.id,
        input.body,
        input.internal ? 1 : 0,
        now(),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.status(201).json({ ticket: serialize(ticketFor(req), req.user, true) });
  });
  const draftJobs = new Map();
  app.post(
    "/api/tickets/:id/draft",
    admin,
    expensiveLimit,
    async (req, res) => {
      const ticket = ticketFor(req);
      if (ticket.draft)
        return res.json({
          draft: ticket.draft,
          source: ticket.draft_source,
          cached: true,
        });
      if (draftJobs.has(ticket.id))
        return res.json(await draftJobs.get(ticket.id));
      const book = ticket.book_id
        ? JSON.parse(
            db.prepare("SELECT data FROM books WHERE id=?").get(ticket.book_id)
              .data,
          )
        : null;
      const author = db
        .prepare("SELECT name FROM users WHERE id=?")
        .get(ticket.author_id);
      const messages = db
        .prepare(
          "SELECT body FROM messages WHERE ticket_id=? AND internal=0 ORDER BY created_at DESC LIMIT 3",
        )
        .all(ticket.id)
        .reverse();
      const job = (async () => {
        const result = await ai.draft(ticket, book, author.name, messages);
        const current = ticketFor(req);
        if (current.version !== ticket.version)
          throw error(
            409,
            "Ticket changed while generating a draft. Open it again.",
          );
        if (result.draft)
          db.prepare(
            "UPDATE tickets SET draft=?,draft_source=? WHERE id=? AND version=?",
          ).run(result.draft, result.source, ticket.id, ticket.version);
        return result;
      })();
      draftJobs.set(ticket.id, job);
      try {
        res.json(await job);
      } finally {
        draftJobs.delete(ticket.id);
      }
    },
  );
  app.use("/api", (req, res, next) =>
    next(error(404, "API endpoint not found.")),
  );
  app.use(express.static(staticDir));
  app.get("/{*path}", (req, res) =>
    res.sendFile(resolve(staticDir, "index.html")),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err instanceof ZodError ? 400 : err.status || 500;
    if (status >= 500) console.error("Request failed:", err.name); // Avoid leaking prompts, keys or personal data.
    res.status(status).json({
      error: {
        message:
          err instanceof ZodError
            ? "Please check the submitted fields."
            : status >= 500
              ? "Something went wrong. Please try again."
              : err.message,
        ...(err instanceof ZodError
          ? {
              fields: err.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            }
          : {}),
      },
    });
  });
  return app;
}
