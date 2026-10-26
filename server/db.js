import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import bcrypt from "bcryptjs";

export function openDatabase(
  path = process.env.DATABASE_PATH || "./data/bookleaf.sqlite",
) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('author','admin')), profile TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), book_id TEXT REFERENCES books(id), subject TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', assigned_to TEXT REFERENCES users(id), ai_source TEXT NOT NULL, ai_reason TEXT NOT NULL, draft TEXT, draft_source TEXT, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, internal INTEGER NOT NULL DEFAULT 0 CHECK(internal IN (0,1)), created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS tickets_author ON tickets(author_id);
    CREATE INDEX IF NOT EXISTS tickets_queue ON tickets(status, priority, created_at);
    CREATE INDEX IF NOT EXISTS messages_ticket ON messages(ticket_id,created_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
  return db;
}

export function seed(db) {
  const password = process.env.DEMO_PASSWORD || "BookLeafDemo!2026";
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.DEMO_PASSWORD || password === "BookLeafDemo!2026")
  )
    throw new Error(
      "Set a unique DEMO_PASSWORD before the first production seed.",
    );
  const hash = bcrypt.hashSync(password, 12);
  const data = JSON.parse(
    readFileSync(
      new URL("../bookleaf_sample_data.json", import.meta.url),
      "utf8",
    ),
  );
  db.exec("BEGIN");
  try {
    const user = db.prepare("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?)");
    const book = db.prepare("INSERT OR IGNORE INTO books VALUES (?,?,?)");
    for (const { books, ...author } of data.authors) {
      user.run(
        author.author_id,
        author.name,
        author.email,
        hash,
        "author",
        JSON.stringify(author),
      );
      for (const b of books)
        book.run(b.book_id, author.author_id, JSON.stringify(b));
    }
    user.run(
      "ADMIN001",
      "BookLeaf Support",
      process.env.ADMIN_EMAIL || "admin@bookleaf.local",
      hash,
      "admin",
      "{}",
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
