import React from "react";
import { Leaf } from "lucide-react";
import { money, date } from "../lib.jsx";

export function Books({ books, compact = false }) {
  return (
    <div className="books-grid">
      {books.length === 0 ? (
        <div className="empty">Your bookshelf is empty.</div>
      ) : (
        books.map((b, i) => (
          <article
            className={`book-card ${compact ? "compact" : ""}`}
            key={b.book_id}
          >
            <div className={`book-cover cover-${i % 4}`} aria-hidden="true">
              <small>BOOKLEAF EDITIONS</small>
              <strong>{b.title}</strong>
              <Leaf size={30} />
              <span>{b.genre}</span>
            </div>
            <div className="book-info">
              <span
                className={`book-state ${b.publication_date ? "live" : "production"}`}
              >
                <i />
                {b.status}
              </span>
              <h3>{b.title}</h3>
              <p className="muted">{b.genre}</p>
              <p className="isbn">ISBN {b.isbn}</p>
              <div className="book-numbers">
                <div>
                  <span>Copies sold</span>
                  <strong>{b.total_copies_sold.toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  <span>Royalties earned</span>
                  <strong>{money(b.total_royalty_earned)}</strong>
                </div>
              </div>
              {!compact && (
                <>
                  <dl>
                    <div>
                      <dt>Published</dt>
                      <dd>{date(b.publication_date)}</dd>
                    </div>
                    <div>
                      <dt>MRP</dt>
                      <dd>{money(b.mrp)}</dd>
                    </div>
                    <div>
                      <dt>Royalty per copy</dt>
                      <dd>{money(b.author_royalty_per_copy)}</dd>
                    </div>
                    <div>
                      <dt>Royalty paid</dt>
                      <dd>{money(b.royalty_paid)}</dd>
                    </div>
                    <div>
                      <dt>Royalty pending</dt>
                      <dd>{money(b.royalty_pending)}</dd>
                    </div>
                    <div>
                      <dt>Last payout</dt>
                      <dd>{date(b.last_royalty_payout_date)}</dd>
                    </div>
                    <div>
                      <dt>Print partner</dt>
                      <dd>{b.print_partner || "Not assigned"}</dd>
                    </div>
                  </dl>
                  <div className="platforms">
                    {b.available_on.length ? (
                      b.available_on.map((p) => <span key={p}>{p}</span>)
                    ) : (
                      <span>Distribution not yet started</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
