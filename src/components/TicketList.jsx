import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  ArrowUpRight,
  Search,
  Sparkles,
} from "lucide-react";
import { api, date, badge } from "../lib.jsx";

export function TicketList({ admin, overview, meta, onSelect, onNew }) {
  const [data, setData] = useState(null),
    [filters, setFilters] = useState({}),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    async function load() {
      try {
        const q = new URLSearchParams({ ...filters, page });
        const r = await api(`/tickets?${q}`, { signal: controller.signal });
        if (live) {
          setData(r);
          setError("");
        }
      } catch (e) {
        if (live && e.name !== "AbortError") setError(e.message);
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [filtersKey, page]);
  function filter(key, value) {
    setFilters((f) => {
      const next = { ...f };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setPage(1);
  }
  const tickets = data?.tickets || [];
  return (
    <section className="ticket-section">
      <div className="section-heading">
        <div>
          <h2>
            {overview
              ? admin
                ? "Your support queue"
                : "Recent support queries"
              : admin
                ? "All author queries"
                : "Your conversations"}
          </h2>
          <p>
            {admin
              ? "Urgent first. Oldest unresolved next."
              : "A direct line to your publishing team."}
          </p>
        </div>
        <span className="sync">
          <i />
          Refreshes every 5 seconds
        </span>
      </div>
      {admin && overview && (
        <div className="queue-banner">
          <MessageSquare size={24} />
          <div>
            <strong>
              {data?.total ?? "…"} support{" "}
              {data?.total === 1 ? "query" : "queries"}
            </strong>
            <p>
              Review priority, check the context, and make each response your
              own.
            </p>
          </div>
          <span className="ai-pill">
            <Sparkles size={14} /> AI-assisted · Human-led
          </span>
        </div>
      )}
      <div className="panel queue">
        <div className="filters">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search tickets"
              placeholder={
                admin ? "Search queries or authors…" : "Search your queries…"
              }
              value={filters.search || ""}
              onChange={(e) => filter("search", e.target.value)}
            />
          </div>
          <select
            aria-label="Filter status"
            value={filters.status || ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {meta?.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {admin && (
            <>
              <select
                aria-label="Filter priority"
                value={filters.priority || ""}
                onChange={(e) => filter("priority", e.target.value)}
              >
                <option value="">All priorities</option>
                {meta?.priorities.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter category"
                value={filters.category || ""}
                onChange={(e) => filter("category", e.target.value)}
              >
                <option value="">All categories</option>
                {meta?.categories.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <label className="date-filter">
                From
                <input
                  type="date"
                  value={filters.from || ""}
                  onChange={(e) => filter("from", e.target.value)}
                />
              </label>
              <label className="date-filter">
                To
                <input
                  type="date"
                  value={filters.to || ""}
                  onChange={(e) => filter("to", e.target.value)}
                />
              </label>
            </>
          )}
          {Object.keys(filters).length > 0 && (
            <button
              className="text-button"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            {error} Automatic updates will retry.
          </div>
        )}
        {!data && !error ? (
          <div className="empty">Loading conversations…</div>
        ) : tickets.length === 0 ? (
          <div className="empty">
            <MessageSquare size={32} />
            <h3>
              {Object.keys(filters).length
                ? "No matching queries"
                : "A fresh page."}
            </h3>
            <p>
              {Object.keys(filters).length
                ? "Try adjusting your filters."
                : admin
                  ? "New author queries will appear here automatically."
                  : "No support queries yet. We’re here whenever you need us."}
            </p>
            {!admin && !Object.keys(filters).length && (
              <button className="secondary" onClick={onNew}>
                Start a conversation <Plus size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>QUERY</th>
                  {admin && <th>AUTHOR</th>}
                  <th>STATUS</th>
                  {admin && <th>PRIORITY</th>}
                  <th>OPENED</th>
                  <th>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="ticket-link"
                        onClick={() => onSelect(t.id)}
                      >
                        {t.subject}
                      </button>
                      <span className="table-sub">
                        {t.book_title || "General / Account Level"}
                        {admin && <> · {t.category}</>}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        {t.author_name}
                        <span className="table-sub">
                          {t.assigned_to ? "Assigned" : "Unassigned"}
                        </span>
                      </td>
                    )}
                    <td>{badge(t.status)}</td>
                    {admin && <td>{badge(t.priority)}</td>}
                    <td className="date-cell">
                      {date(t.created_at)}
                      {!["Resolved", "Closed"].includes(t.status) &&
                        Date.now() - Date.parse(t.created_at) > 172800000 && (
                          <span className="aged">Waiting 2+ days</span>
                        )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${t.subject}`}
                        onClick={() => onSelect(t.id)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.total > 50 && (
          <div className="pagination">
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(data.total / 50)}
            </span>
            <button
              className="secondary"
              disabled={page * 50 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
