import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  ArrowLeft,
  Send,
  Sparkles,
  LockKeyhole,
  Clock3,
  Check,
} from "lucide-react";
import { api, money, date, stamp, badge } from "../lib.jsx";
import { PageTitle } from "./ui.jsx";
export function TicketDetail({ id, admin, meta, onBack, notify }) {
  const [ticket, setTicket] = useState(null),
    [error, setError] = useState(""),
    [reply, setReply] = useState(""),
    [note, setNote] = useState(""),
    [internal, setInternal] = useState(false),
    [busy, setBusy] = useState(false),
    [aiBusy, setAiBusy] = useState(false),
    [aiNote, setAiNote] = useState("");
  const edited = useRef(false),
    draftStarted = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function load() {
    const r = await api(`/tickets/${id}`);
    if (alive.current) {
      setTicket((previous) =>
        !previous || r.ticket.version >= previous.version ? r.ticket : previous,
      );
      setError("");
    }
    return r.ticket;
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      5000,
    );
    return () => clearInterval(timer);
  }, [id]);
  async function generate() {
    setAiBusy(true);
    setAiNote("");
    try {
      const r = await api(`/tickets/${id}/draft`, { method: "POST" });
      if (alive.current) {
        if (!edited.current) setReply(r.draft);
        setAiNote(
          r.source === "ai"
            ? "AI draft · Review all facts and proposed commitments before sending."
            : r.message,
        );
      }
    } catch (e) {
      if (alive.current) setAiNote(e.message);
    } finally {
      if (alive.current) setAiBusy(false);
    }
  }
  useEffect(() => {
    if (admin && ticket && !draftStarted.current) {
      draftStarted.current = true;
      generate();
    }
  }, [ticket, admin]);
  async function update(body) {
    setBusy(true);
    try {
      const r = await api(`/tickets/${id}`, {
        method: "PATCH",
        body: { ...body, version: ticket.version },
      });
      setTicket(r.ticket);
      notify("Ticket updated.");
    } catch (e) {
      setError(e.message);
      if (e.status === 409) await load();
    } finally {
      setBusy(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api(`/tickets/${id}/messages`, {
        method: "POST",
        body: {
          body: internal ? note : reply,
          internal,
          version: ticket.version,
        },
      });
      setTicket(r.ticket);
      if (internal) setNote("");
      else {
        setReply("");
        edited.current = true;
      }
      setAiNote("");
      notify(
        internal ? "Internal note added." : "Response sent to the author.",
      );
    } catch (e) {
      setError(e.message);
      if (e.status === 409) await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to tickets
      </button>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!ticket ? (
        <div className="empty">Loading ticket…</div>
      ) : (
        <>
          <PageTitle
            eyebrow={`SUPPORT QUERY · ${ticket.id.slice(0, 8).toUpperCase()}`}
            title={ticket.subject}
            subtitle={`${ticket.author_name} · Opened ${stamp(ticket.created_at)}`}
          />
          <div className="detail-layout">
            <div>
              <article className="panel conversation">
                <div className="conversation-heading">
                  {badge(ticket.status)}
                  <span>{ticket.book_title || "General / Account Level"}</span>
                </div>
                <div className="message original">
                  <div className="message-meta">
                    <strong>{ticket.author_name}</strong>
                    <time>{stamp(ticket.created_at)}</time>
                  </div>
                  <p>{ticket.description}</p>
                </div>
                {ticket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message ${m.internal ? "internal" : "response"}`}
                  >
                    <div className="message-meta">
                      <strong>
                        {m.internal ? (
                          <>
                            <LockKeyhole size={13} /> Internal note ·{" "}
                          </>
                        ) : null}
                        {m.sender_name}
                      </strong>
                      <time>{stamp(m.created_at)}</time>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}
                {ticket.messages.length === 0 && (
                  <div className="waiting">
                    <Clock3 size={16} />{" "}
                    {admin
                      ? "This conversation is waiting for your first response."
                      : "Your query is with our team. Responses will appear here automatically."}
                  </div>
                )}
              </article>
              {admin && (
                <form className="panel composer" onSubmit={send}>
                  <div className="section-heading">
                    <h2>{internal ? "Internal note" : "Reply to author"}</h2>
                    <span className="ai-pill">
                      <Sparkles size={14} /> AI-assisted
                    </span>
                  </div>
                  <div className="composer-tabs">
                    <button
                      type="button"
                      className={!internal ? "selected" : ""}
                      onClick={() => setInternal(false)}
                    >
                      Public reply
                    </button>
                    <button
                      type="button"
                      className={internal ? "selected" : ""}
                      onClick={() => setInternal(true)}
                    >
                      <LockKeyhole size={13} /> Internal note
                    </button>
                  </div>
                  <div className="ai-note" role="status">
                    {aiBusy
                      ? "Preparing an AI draft. You can start writing now…"
                      : aiNote ||
                        "Review your response before sending. Nothing is sent automatically."}
                  </div>
                  <label className="sr-only" htmlFor="reply">
                    {internal ? "Internal note" : "Response to author"}
                  </label>
                  <textarea
                    id="reply"
                    rows={9}
                    maxLength={8000}
                    required
                    value={internal ? note : reply}
                    onChange={(e) => {
                      if (internal) setNote(e.target.value);
                      else {
                        edited.current = true;
                        setReply(e.target.value);
                      }
                    }}
                    placeholder={
                      internal
                        ? "Only the support team can see this note."
                        : "Write a thoughtful response…"
                    }
                  />
                  <div className="composer-bottom">
                    <button
                      type="button"
                      className="text-button"
                      disabled={internal || aiBusy || !!reply.trim()}
                      onClick={() => {
                        edited.current = false;
                        generate();
                      }}
                    >
                      <Sparkles size={15} />{" "}
                      {aiBusy ? "Drafting…" : "Get AI draft"}
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !(internal ? note : reply).trim()}
                    >
                      {internal ? (
                        <LockKeyhole size={15} />
                      ) : (
                        <Send size={15} />
                      )}{" "}
                      {busy
                        ? "Saving…"
                        : internal
                          ? "Save internal note"
                          : "Send response"}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <aside className="ticket-context">
              {admin && (
                <section className="panel context">
                  <h3>Ticket management</h3>
                  <label>
                    Status
                    <select
                      disabled={busy}
                      value={ticket.status}
                      onChange={(e) => update({ status: e.target.value })}
                    >
                      {meta?.statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select
                      disabled={busy}
                      value={ticket.priority}
                      onChange={(e) => update({ priority: e.target.value })}
                    >
                      {meta?.priorities.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      disabled={busy}
                      value={ticket.category}
                      onChange={(e) => update({ category: e.target.value })}
                    >
                      {meta?.categories.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <p className="triage-note">
                    <Sparkles size={14} />
                    {ticket.ai_source === "ai"
                      ? "AI-classified"
                      : "Fallback classification"}{" "}
                    · {ticket.ai_reason}
                  </p>
                  <button
                    className="secondary full"
                    disabled={busy}
                    onClick={() =>
                      update({
                        assigned_to: ticket.assigned_to ? "unassigned" : "me",
                      })
                    }
                  >
                    {ticket.assigned_to ? (
                      <>
                        <Check size={15} /> Assigned · Unassign
                      </>
                    ) : (
                      "Assign to me"
                    )}
                  </button>
                </section>
              )}
              {ticket.book && (
                <section className="panel context">
                  <div className="eyebrow">BOOK CONTEXT</div>
                  <h3>{ticket.book.title}</h3>
                  <p>{ticket.book.status}</p>
                  <dl>
                    <div>
                      <dt>Copies sold</dt>
                      <dd>{ticket.book.total_copies_sold}</dd>
                    </div>
                    <div>
                      <dt>Royalty earned</dt>
                      <dd>{money(ticket.book.total_royalty_earned)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{money(ticket.book.royalty_paid)}</dd>
                    </div>
                    <div>
                      <dt>Pending</dt>
                      <dd>{money(ticket.book.royalty_pending)}</dd>
                    </div>
                    <div>
                      <dt>Last payout</dt>
                      <dd>{date(ticket.book.last_royalty_payout_date)}</dd>
                    </div>
                  </dl>
                </section>
              )}
              {admin && (
                <section className="help-card policy">
                  <BookOpen size={22} />
                  <h3>Policy reference</h3>
                  <p>{ticket.policy}</p>
                  <small>
                    Use this reference to check the draft or write a manual
                    response.
                  </small>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
