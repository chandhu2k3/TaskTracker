import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import templateAIService from "../services/templateAIService";
import "./TemplateAIBuilder.css";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const fmtDur = (ms) => {
  const mins = Math.round((Number(ms) || 0) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const TemplateAIBuilder = ({
  categories = [],
  selectedTemplate = null,
  onSaved,
  onApplyTemplate,
}) => {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);
  const [showResume, setShowResume] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, open]);

  const startSession = async (mode = "create") => {
    try {
      setSending(true);
      const { session: s } = await templateAIService.createSession({
        mode,
        sourceTemplateId: mode === "edit" ? selectedTemplate?._id : null,
      });
      setSession(s);
      setMessages(s.messages || []);
      setOpen(true);
      setShowResume(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't start AI builder");
    } finally {
      setSending(false);
    }
  };

  const resumeSession = async (id) => {
    try {
      setSending(true);
      const { session: s } = await templateAIService.getSession(id);
      setSession(s);
      setMessages(s.messages || []);
      setOpen(true);
      setShowResume(false);
    } catch {
      toast.error("Couldn't resume session");
    } finally {
      setSending(false);
    }
  };

  const loadPast = async () => {
    try {
      const { sessions } = await templateAIService.listSessions();
      setPastSessions(sessions || []);
      setShowResume((v) => !v);
    } catch {
      toast.error("Couldn't load past sessions");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !session || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setSending(true);
    try {
      const res = await templateAIService.sendMessage(session._id || session.id, text, session.draftVersion);
      setSession(res.session);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // Replace nothing — backend message already appended; just add assistant reply
        void last;
        return [...prev, { role: "assistant", text: res.reply }];
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Couldn't send — try again";
      toast.error(msg);
      if (err.response?.status === 409) {
        try {
          const { session: s } = await templateAIService.getSession(session._id || session.id);
          setSession(s);
          setMessages(s.messages || []);
        } catch { /* keep local */ }
      }
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    if (!session || saving) return;
    setSaving(true);
    try {
      const idempotencyKey = `${session._id || session.id}-${session.draftVersion}`;
      const { template, idempotent } = await templateAIService.saveSession(session._id || session.id, {
        idempotencyKey,
        updateExisting: false,
      });
      toast.success(idempotent ? "Already saved ✓" : `Template "${template.name}" saved ✓`);
      setSession((prev) => (prev ? { ...prev, status: "SAVED", savedTemplateId: template._id } : prev));
      setMessages((prev) => [...prev, { role: "assistant", text: `Saved "${template.name}". Use Apply to put it on a week — nothing was applied automatically.` }]);
      if (onSaved) await onSaved(template);
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!session) { setOpen(false); return; }
    if (!window.confirm("Discard this AI draft?")) return;
    try {
      await templateAIService.deleteSession(session._id || session.id);
    } catch { /* best effort */ }
    setSession(null);
    setMessages([]);
    setOpen(false);
  };

  const draft = session?.draftTemplate || null;
  const errors = session?.validationErrors || [];
  const warnings = session?.validationWarnings || [];
  const canSave = draft && errors.length === 0 && ["PREVIEW_READY", "AWAITING_SAVE_CONFIRMATION"].includes(session?.status);
  const grouped = draft
    ? DAYS.map((day) => ({
        day,
        tasks: (draft.tasks || []).filter((t) => t.day === day),
        quickTodos: (draft.quickTodos || []).filter((t) => t.day === day),
      })).filter((g) => g.tasks.length > 0 || g.quickTodos.length > 0)
    : [];

  return (
    <div className="template-ai-entry">
      <button className="btn-ai-template" onClick={() => startSession("create")} disabled={sending} title="Describe your week in plain language">
        ✨ Create with AI
      </button>
      {selectedTemplate && (
        <button className="btn-ai-refine" onClick={() => startSession("edit")} disabled={sending} title="Refine the selected template conversationally">
          ✨ Refine with AI
        </button>
      )}
      <button className="btn-ai-resume" onClick={loadPast} title="Resume a previous AI session">
        🕘 Resume
      </button>
      {showResume && (
        <div className="template-ai-resume-list">
          {(pastSessions || []).length === 0 && <div className="resume-empty">No past sessions.</div>}
          {(pastSessions || []).map((s) => (
            <button key={s._id || s.id} className="resume-item" onClick={() => resumeSession(s._id || s.id)}>
              <span className="resume-status">{s.status}</span>
              <span className="resume-name">{s.draftTemplate?.name || s.requirements?.templateName || "Untitled"}</span>
              <span className="resume-date">{new Date(s.updatedAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}

      {open && ReactDOM.createPortal(
        <div className="template-ai-overlay" onClick={() => setOpen(false)}>
          <div className="template-ai-panel" onClick={(e) => e.stopPropagation()}>
            <div className="template-ai-header">
              <div>
                <h3>✨ AI Template Builder</h3>
                <p className="template-ai-sub">
                  {session?.status ? `Status: ${session.status}` : "Describe your week"} • drafts save only when you press Save
                </p>
              </div>
              <div className="template-ai-header-actions">
                <button className="btn-ai-icon" onClick={() => startSession("create")} title="Restart">↺</button>
                <button className="btn-ai-icon" onClick={() => setOpen(false)} title="Close">✕</button>
              </div>
            </div>

            <div className="template-ai-body">
              <div className="template-ai-thread" ref={threadRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`template-ai-bubble ${m.role}`}>
                    {m.text.split("\n").map((line, j) => (<p key={j}>{line}</p>))}
                  </div>
                ))}
                {sending && <div className="template-ai-bubble assistant typing">Thinking…</div>}
              </div>

              <div className="template-ai-composer">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder='e.g. "GATE prep: 2h DSA daily, gym Mon–Fri evenings, college 9–4, Sunday free"'
                  maxLength={2000}
                />
                <button onClick={send} disabled={sending || !input.trim()} className="btn-ai-send">
                  {sending ? "…" : "Send"}
                </button>
              </div>

              {draft && (
                <div className="template-ai-preview">
                  <div className="preview-head">
                    <strong>Draft: {draft.name}</strong>
                    <span className="preview-ver">v{session.draftVersion}</span>
                    {session?.status === "SAVED" ? <span className="preview-saved">SAVED ✓</span> : <span className="preview-draft-tag">DRAFT</span>}
                  </div>
                  {errors.length > 0 && (
                    <div className="preview-errors">
                      {errors.map((e, i) => (<div key={i}>⛔ {e}</div>))}
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="preview-warnings">
                      {warnings.map((w, i) => (<div key={i}>⚠️ {w}</div>))}
                    </div>
                  )}
                  <div className="preview-days">
                    {grouped.map((g) => (
                      <div key={g.day} className="preview-day">
                        <div className="preview-day-name">{g.day}</div>
                        {g.tasks.map((t, i) => (
                          <div key={i} className="preview-task">
                            <span className="preview-task-name">{t.name}</span>
                            <span className="preview-task-meta">
                              {t.category} • {fmtDur(t.plannedTime)}
                              {t.scheduledStartTime ? ` • ${t.scheduledStartTime}${t.scheduledEndTime ? `–${t.scheduledEndTime}` : ""}` : ""}
                              {t.addToCalendar ? " • 📅" : ""}
                            </span>
                          </div>
                        ))}
                        {g.quickTodos.map((td, i) => (
                          <div key={i} className="preview-todo">✓ {td.text}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="preview-actions">
                    <button className="btn-ai-cancel" onClick={handleDiscard}>Discard</button>
                    {session?.status === "SAVED" && session?.savedTemplateId && onApplyTemplate ? (
                      <button className="btn-ai-apply" onClick={() => onApplyTemplate(session.savedTemplateId)}>
                        Apply to week
                      </button>
                    ) : (
                      <button className="btn-ai-save" onClick={handleSave} disabled={!canSave || saving} title={!canSave ? "Fix validation errors first" : "Save template"}>
                        {saving ? "Saving…" : "Save template"}
                      </button>
                    )}
                  </div>
                  {!canSave && session?.status !== "SAVED" && (
                    <div className="preview-hint">Save unlocks when validation passes and the draft is preview-ready.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default TemplateAIBuilder;
