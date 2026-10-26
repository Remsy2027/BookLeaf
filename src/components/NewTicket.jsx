import React, { useRef, useState } from "react";
import { MessageSquare, Send, Paperclip, RefreshCw } from "lucide-react";
import { api } from "../lib.jsx";
import { PageTitle } from "./ui.jsx";
export function NewTicket({ books, onCreated }) {
  const [form, setForm] = useState({
      book_id: "",
      subject: "",
      description: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInput = useRef(null);
  function chooseAttachment(event) {
    const file = event.target.files?.[0];
    setAttachmentError("");
    if (!file) return;
    if (
      file.size > 10 * 1024 * 1024 ||
      !/\.(pdf|png|jpe?g|txt)$/i.test(file.name)
    ) {
      setAttachment(null);
      event.target.value = "";
      setAttachmentError("Choose a PDF, PNG, JPG or TXT file up to 10 MB.");
      return;
    }
    setAttachment({ name: file.name, size: file.size });
  }
  function field(key, value) {
    setForm({ ...form, [key]: value });
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onCreated(
        (
          await api("/tickets", {
            method: "POST",
            body: { ...form, book_id: form.book_id || null },
          })
        ).ticket,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="LET’S WORK THROUGH IT TOGETHER"
        title="How can we help?"
        subtitle="Tell us what’s on your mind. Our team will take it from here."
      />
      <div className="form-layout">
        <form className="panel query-form" onSubmit={submit}>
          <label>
            Which book is this about?
            <select
              value={form.book_id}
              onChange={(e) => field("book_id", e.target.value)}
            >
              <option value="">General / Account Level</option>
              {books.map((b) => (
                <option key={b.book_id} value={b.book_id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input
              required
              maxLength={160}
              value={form.subject}
              onChange={(e) => field("subject", e.target.value)}
              placeholder="A short summary of your question"
            />
          </label>
          <label>
            Tell us a little more
            <textarea
              required
              rows={8}
              maxLength={8000}
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
              placeholder="Include the details that will help us understand — dates, platform names, or what you expected to happen."
            />
            <small>
              {form.description.length.toLocaleString()} / 8,000 characters
            </small>
          </label>
          <div className="attachment">
            <Paperclip size={18} />
            <div>
              <strong>Attachment (optional)</strong>
              <p>
                Demo selection only: the file stays on your device and will not
                be uploaded or included in the submitted ticket. PDF, PNG, JPG
                or TXT, up to 10 MB.
              </p>
              <label className="attachment-picker">
                Choose a file
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={chooseAttachment}
                />
              </label>
              {attachment && (
                <div className="selected-file" role="status">
                  <span>
                    {attachment.name} (
                    {Math.max(1, Math.ceil(attachment.size / 1024))} KB) —
                    selected locally only
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      fileInput.current.value = "";
                    }}
                  >
                    Remove file
                  </button>
                </div>
              )}
              {attachmentError && (
                <p className="error" role="alert">
                  {attachmentError}
                </p>
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Submitting your query…" : "Submit support query"}
            <Send size={16} />
          </button>
        </form>
        <aside className="help-card">
          <MessageSquare size={26} />
          <h3>A little detail goes a long way.</h3>
          <p>
            Choose the relevant book so our team can see the right sales,
            royalty, and production information.
          </p>
          <hr />
          <strong>What happens next?</strong>
          <p>
            Your query joins our support queue. You can follow its status and
            read our responses in My tickets.
          </p>
          <span>
            <RefreshCw size={14} /> Updates appear automatically
          </span>
        </aside>
      </div>
    </>
  );
}
