import React, { useState } from "react";
import { BookOpen, Leaf, ArrowUpRight, LockKeyhole } from "lucide-react";
import { api } from "../lib.jsx";
import { Brand } from "./ui.jsx";
export function Login({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        (
          await api("/auth/login", {
            method: "POST",
            body: { email, password },
          })
        ).user,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">THE PEOPLE BEHIND THE PAGES</div>
          <h1>
            You write the story. <br />
            We’re here for <br />
            <em>every chapter.</em>
          </h1>
          <p>
            A home for your books, a clear view of your royalties,
            <br />
            and a direct line to your publishing team.
          </p>
          <div className="book-art" aria-hidden="true">
            <div>
              STORIES
              <br />
              <i>worth telling.</i>
              <Leaf size={50} />
            </div>
            <div>
              THE NEXT
              <br />
              CHAPTER
              <BookOpen size={42} />
            </div>
            <div>
              words
              <br />
              <i>take root.</i>
              <Leaf size={45} />
            </div>
          </div>
        </div>
        <small>BOOKLEAF PUBLISHING · INDIA & US</small>
      </section>
      <section className="login-form">
        <div className="eyebrow">YOUR BOOKLEAF WORKSPACE</div>
        <h2>Good to see you.</h2>
        <p>Sign in to continue your publishing journey.</p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to your workspace"}
            <ArrowUpRight size={18} />
          </button>
        </form>
        <p className="login-help">
          <LockKeyhole size={14} /> Your books and account details stay private.
        </p>
        <div className="demo-info">
          <strong>Reviewing the assignment?</strong>
          <p>Author and admin test credentials are in the project README.</p>
        </div>
      </section>
    </div>
  );
}
