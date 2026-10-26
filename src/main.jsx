import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Leaf,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Plus,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import "./styles.css";

import { api, money } from "./lib.jsx";
import { Brand, Nav, PageTitle, Stat } from "./components/ui.jsx";
import { Login } from "./components/Login.jsx";
import { Books } from "./components/Books.jsx";
import { NewTicket } from "./components/NewTicket.jsx";
import { TicketList } from "./components/TicketList.jsx";
import { TicketDetail } from "./components/TicketDetail.jsx";
function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [view, setView] = useState("overview"),
    [selected, setSelected] = useState(null),
    [books, setBooks] = useState([]),
    [meta, setMeta] = useState(null),
    [notice, setNotice] = useState("");
  const [dataOwner, setDataOwner] = useState(null);
  const [dataError, setDataError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setDataError("");
    Promise.all([api("/books"), api("/meta")])
      .then(([b, m]) => {
        if (!active) return;
        setBooks(b.books);
        setMeta(m);
        setDataOwner(user.id);
      })
      .catch((e) => {
        if (active) setDataError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user, loadAttempt]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function navigate(next) {
    setSelected(null);
    setView(next);
  }
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, selected]);
  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setBooks([]);
      setDataOwner(null);
      setSelected(null);
    } catch (e) {
      setNotice(e.message);
    }
  }
  if (boot) return <div className="loading">Opening your workspace…</div>;
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setView("overview");
        }}
      />
    );
  const admin = user.role === "admin";
  if (dataOwner !== user.id)
    return (
      <div className="loading">
        <div className="workspace-loading" role="status">
          {dataError ? (
            <>
              <p role="alert">{dataError}</p>
              <button
                className="primary"
                onClick={() => setLoadAttempt((n) => n + 1)}
              >
                Retry loading
              </button>
              <button className="text-button" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            "Loading your books and workspace…"
          )}
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          {admin ? "OPERATIONS WORKSPACE" : "AUTHOR WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          <Nav
            icon={LayoutDashboard}
            active={view === "overview"}
            onClick={() => navigate("overview")}
          >
            Overview
          </Nav>
          {!admin && (
            <Nav
              icon={BookOpen}
              active={view === "books"}
              onClick={() => navigate("books")}
            >
              My books <span className="nav-count">{books.length}</span>
            </Nav>
          )}
          <Nav
            icon={MessageSquare}
            active={view === "tickets"}
            onClick={() => navigate("tickets")}
          >
            {admin ? "Ticket queue" : "My tickets"}
          </Nav>
          {!admin && (
            <Nav
              icon={Plus}
              active={view === "new"}
              onClick={() => navigate("new")}
            >
              New support query
            </Nav>
          )}
        </nav>
        <div className="sidebar-note">
          <Leaf size={25} />
          <strong>
            Every story deserves
            <br />a little support.
          </strong>
          <p>
            Your publishing journey,
            <br />
            with a team by your side.
          </p>
        </div>
        <div className="account">
          <span className="avatar">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{admin ? "Support team" : "BookLeaf author"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            BookLeaf <span className="slash">/</span>{" "}
            {admin ? "Support operations" : "Author portal"}
          </span>
          <span className="private-label">
            <LockKeyhole size={13} /> Private workspace
          </span>
          <button
            className="icon-button mobile-signout"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut size={17} />
          </button>
        </header>
        <div className="page">
          {notice && (
            <div role="status" className="toast">
              {notice}
            </div>
          )}
          {selected ? (
            <TicketDetail
              key={selected}
              id={selected}
              admin={admin}
              meta={meta}
              onBack={() => setSelected(null)}
              notify={setNotice}
            />
          ) : view === "new" ? (
            <NewTicket
              books={books}
              onCreated={(t) => {
                setView("tickets");
                setSelected(t.id);
                setNotice("Your query has been submitted.");
              }}
            />
          ) : view === "books" ? (
            <>
              <PageTitle
                eyebrow="YOUR PUBLISHING JOURNEY"
                title="My books"
                subtitle="A clear view of your stories, sales, and royalties."
              />
              <Books books={books} />
            </>
          ) : (
            <>
              <PageTitle
                eyebrow={
                  admin
                    ? "A LITTLE CLARITY. A LOT OF CARE."
                    : "YOUR NEXT CHAPTER STARTS HERE"
                }
                title={
                  view === "overview"
                    ? admin
                      ? "Let’s keep the stories moving."
                      : `Welcome back, ${user.name.split(" ")[0]}.`
                    : admin
                      ? "Ticket queue"
                      : "My support tickets"
                }
                subtitle={
                  admin
                    ? "Help authors move forward, one thoughtful response at a time."
                    : "Your books, your progress, and the support you need. All in one place."
                }
                action={
                  !admin && (
                    <button className="primary" onClick={() => navigate("new")}>
                      <Plus size={17} />
                      New support query
                    </button>
                  )
                }
              />
              {view === "overview" && !admin && (
                <>
                  <div className="stats">
                    <Stat
                      label="BOOKS IN YOUR SHELF"
                      value={books.length}
                      note={`${books.filter((b) => b.status === "Published & Live").length} published & live`}
                      icon={BookOpen}
                    />
                    <Stat
                      label="COPIES SOLD"
                      value={books
                        .reduce((n, b) => n + b.total_copies_sold, 0)
                        .toLocaleString("en-IN")}
                      note="Across your published titles"
                    />
                    <Stat
                      label="TOTAL ROYALTIES"
                      value={money(
                        books.reduce((n, b) => n + b.total_royalty_earned, 0),
                      )}
                      note="Your lifetime earnings"
                    />
                    <Stat
                      label="PENDING ROYALTIES"
                      value={money(
                        books.reduce((n, b) => n + b.royalty_pending, 0),
                      )}
                      note="Subject to quarterly payout policy"
                    />
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>Your bookshelf</h2>
                      <p>Every book is a milestone.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("books")}
                    >
                      View all books <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <Books books={books.slice(0, 2)} compact />
                </>
              )}
              <TicketList
                admin={admin}
                overview={view === "overview"}
                meta={meta}
                onSelect={setSelected}
                onNew={() => navigate("new")}
              />
            </>
          )}
          <footer>
            <Leaf size={13} /> BookLeaf Publishing{" "}
            <span>Made for the people behind the pages.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
