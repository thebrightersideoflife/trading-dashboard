import { useEffect, useMemo, useRef, useState } from "react";
import {
  NotebookTabs,
  Plus,
  Download,
  Search,
  Sparkles,
  ChevronRight,
  Edit3,
  Trash2,
  Undo2,
  Filter,
  X,
  Clock,
  Layers,
  Check,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { useAssetNotes } from "../../hooks/useAssetNotes.js";
import { notesToCsv } from "../../utils/notes.js";
import "./NotesTab.css";

/* ================================================================== */
/* Draft storage (local only)                                          */
/* Notes live in Supabase (see useAssetNotes.js). Drafts stay on this  */
/* device: they are scratch space, not data.                           */
/* ================================================================== */
const DRAFT_KEY = "asset-notes:draft";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Could not write", key, err);
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function downloadCsv(notes) {
  const blob = new Blob([notesToCsv(notes)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cogentlog-asset-notes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================== */
/* Small utilities                                                     */
/* ================================================================== */

/** "PEPE: meme coin from..." -> { ticker: "PEPE", text: "meme coin from..." } */
function parseCapture(input) {
  const m = input.match(/^\s*\$?([A-Za-z0-9]{1,20})\s*:\s*([\s\S]+\S)\s*$/);
  return m ? { ticker: m[1].toUpperCase(), text: m[2].trim() } : null;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function timeAgo(iso) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function Highlight({ text, query }) {
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .split(new RegExp(`(${safe})`, "ig"))
    .map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function hueFor(ticker) {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) % 360;
  return h;
}

function TickerBadge({ ticker, small = false }) {
  const label = (ticker.replace(/^\d+/, "") || ticker).slice(0, 2);
  return (
    <span
      className={`notes-badge ${small ? "notes-badge--sm" : ""}`}
      style={{ "--h": hueFor(ticker) }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

function NotesSkeleton() {
  return (
    <div className="notes-skeleton" aria-hidden="true">
      {[62, 48, 55].map((w, i) => (
        <div key={i} className="notes-skeleton__group">
          <span className="notes-skeleton__badge" />
          <span className="notes-skeleton__line" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Editor                                                              */
/* Used for: new note, new note on a known asset, and editing.         */
/* ================================================================== */
function NoteEditor({
  initial,
  lockedTicker,
  prefillTicker,
  tickerCounts,
  draftKey,
  onSave,
  onClose,
}) {
  const stored = useMemo(() => (draftKey ? readJson(draftKey, null) : null), [draftKey]);
  const [ticker, setTicker] = useState(
    initial?.ticker ?? lockedTicker ?? prefillTicker ?? stored?.ticker ?? ""
  );
  const [text, setText] = useState(initial?.text ?? stored?.text ?? "");
  const [error, setError] = useState(null);
  const restored = Boolean(stored && (stored.text || stored.ticker) && !initial);

  const tickerRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const target = ticker ? textRef.current : tickerRef.current;
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftKey) return;
    if (ticker || text) writeJson(draftKey, { ticker, text });
    else removeKey(draftKey);
  }, [draftKey, ticker, text]);

  const existing = !initial ? tickerCounts[ticker] || 0 : 0;

  function submit() {
    if (!ticker) return setError({ field: "ticker", message: "Enter a ticker, like PEPE or BTC." });
    if (!text.trim()) return setError({ field: "text", message: "Write a note before saving." });
    if (draftKey) removeKey(draftKey);
    onSave({ ticker, text: text.trim() });
  }

  function discard() {
    if (draftKey) removeKey(draftKey);
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  }

  return (
    <div className="notes-editor" onKeyDown={onKeyDown}>
      {restored && <p className="notes-editor__restored">Draft restored from your last session.</p>}

      {!lockedTicker && (
        <label className="notes-field">
          <span>Asset Symbol</span>
          <input
            ref={tickerRef}
            className="notes-input notes-input--ticker"
            list="notes-tickers"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setError(null);
            }}
            placeholder="PEPE"
            maxLength={20}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error?.field === "ticker"}
          />
        </label>
      )}

      {existing > 0 && (
        <p className="notes-editor__info">
          {ticker} already has {existing} {existing === 1 ? "note" : "notes"}. This note will be added
          to its ledger.
        </p>
      )}

      <label className="notes-field">
        <span>{lockedTicker ? `Note for ${lockedTicker}` : "Note"}</span>
        <textarea
          ref={textRef}
          className="notes-input notes-input--text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="What is it, where did it come from, what's driving the catalyst?"
          rows={4}
          aria-invalid={error?.field === "text"}
        />
      </label>

      {error && (
        <p className="notes-error" role="alert">
          {error.message}
        </p>
      )}

      <div className="notes-editor__actions">
        <button type="button" className="notes-btn notes-btn--primary" onClick={submit}>
          <Check size={14} />
          Save note
        </button>
        {draftKey ? (
          <button type="button" className="notes-btn" onClick={discard}>
            Discard
          </button>
        ) : (
          <button type="button" className="notes-btn" onClick={onClose}>
            Cancel
          </button>
        )}
        <span className="notes-hint">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves{draftKey ? ", Esc keeps draft" : ""}
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* One note item beneath an asset                                      */
/* ================================================================== */
const COLLAPSE_AT = 220;

function NoteItem({ note, query, flash, selected, onToggleSelect, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const long = note.text.length > COLLAPSE_AT;

  return (
    <li className={`notes-item ${flash ? "is-new" : ""} ${selected ? "is-selected" : ""}`}>
      <label className="notes-checkbox-wrap" title="Select note for bulk actions">
        <input
          type="checkbox"
          className="notes-checkbox"
          checked={selected}
          onChange={() => onToggleSelect(note.id)}
        />
        <span className="notes-checkbox-custom" />
      </label>
      <div className="notes-item__body">
        <p className={`notes-item__text ${long && !expanded ? "is-clamped" : ""}`}>
          <Highlight text={note.text} query={query} />
        </p>
        <div className="notes-item__meta">
          <time dateTime={note.updatedAt} title={new Date(note.updatedAt).toLocaleString()}>
            <Clock size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "-1px" }} />
            {timeAgo(note.updatedAt)}
          </time>
          {long && (
            <button
              type="button"
              className="notes-link"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          <span className="notes-item__actions">
            <button type="button" className="notes-action-btn" title="Edit note" onClick={() => onEdit(note.id)}>
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
            <button type="button" className="notes-action-btn notes-action-btn--danger" title="Delete note" onClick={() => onDelete(note.id)}>
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </span>
        </div>
      </div>
    </li>
  );
}

/* ================================================================== */
/* Asset Card Component (Main Overview Grid Item)                     */
/* ================================================================== */
function AssetCard({
  ticker,
  items,
  isAllSelected,
  onToggleGroupSelect,
  onClick,
  searchTerm,
}) {
  const latestNote = items[0];

  return (
    <div className="notes-card" style={{ "--h": hueFor(ticker) }} onClick={onClick}>
      <div className="notes-card__head">
        <div className="notes-card__identity">
          <TickerBadge ticker={ticker} />
          <div className="notes-card__ticker-wrap">
            <span className="notes-card__ticker">
              <Highlight text={ticker} query={searchTerm} />
            </span>
            <span className="notes-card__badge">{items.length} {items.length === 1 ? "note" : "notes"}</span>
          </div>
        </div>

        <label
          className="notes-checkbox-wrap"
          title={`Select all notes for ${ticker}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="notes-checkbox"
            checked={isAllSelected}
            onChange={() => onToggleGroupSelect(items)}
          />
          <span className="notes-checkbox-custom" />
        </label>
      </div>

      <div className="notes-card__body">
        {latestNote ? (
          <p className="notes-card__snippet">{latestNote.text}</p>
        ) : (
          <p className="notes-card__snippet notes-card__snippet--empty">
            No notes recorded yet. Click to open ledger and add your first note.
          </p>
        )}
      </div>

      <div className="notes-card__foot">
        <div className="notes-card__meta">
          {latestNote && (
            <span>
              <Clock size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "-1px" }} />
              {timeAgo(latestNote.updatedAt)}
            </span>
          )}
        </div>
        <button type="button" className="notes-card__action" aria-label={`Open ${ticker} ledger`}>
          <span>View Ledger</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Asset Detail Pop-up Modal                                          */
/* ================================================================== */
function AssetDetailModal({
  ticker,
  items,
  editingId,
  setEditingId,
  composer,
  setComposer,
  selectedIds,
  onToggleSelect,
  onSaveNote,
  onUpdateNote,
  onDeleteNote,
  onClose,
  tickerCounts,
  flashId,
  notes,
  selectAll,
  deselectAll,
  setConfirmDeleteModal,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isAllNotesSelected = notes.length > 0 && selectedIds.size === notes.length;

  return (
    <div className="notes-modal-overlay" onClick={onClose}>
      <div className="notes-modal notes-modal--large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="notes-modal__header notes-modal__header--detail">
          <div className="notes-modal__detail-title">
            <TickerBadge ticker={ticker} />
            <div>
              <h3>{ticker} Ledger</h3>
              <p className="notes-modal__detail-sub">
                {items.length} {items.length === 1 ? "note" : "notes"} recorded
              </p>
            </div>
          </div>

          <div className="notes-modal__detail-actions">
            <button
              type="button"
              className="notes-btn notes-btn--primary"
              onClick={() => setComposer({ ticker })}
            >
              <Plus size={14} />
              <span>Add Note</span>
            </button>
            <button
              type="button"
              className="notes-action-btn"
              title="Close modal"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="notes-modal__detail-body">
          {selectedIds.size > 0 && (
            <div className="notes-bulk-bar notes-bulk-bar--integrated" style={{ marginBottom: "1rem" }}>
              <div className="notes-bulk-bar__info">
                <CheckSquare size={16} className="notes-bulk-bar__icon" />
                <span>
                  <strong>{selectedIds.size}</strong> of {notes.length} notes selected
                </span>
              </div>
              <div className="notes-bulk-bar__actions">
                <button
                  type="button"
                  className="notes-btn notes-btn--outline"
                  onClick={selectAll}
                  disabled={isAllNotesSelected}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="notes-btn notes-btn--outline"
                  onClick={deselectAll}
                >
                  Deselect
                </button>
                <button
                  type="button"
                  className="notes-btn notes-btn--danger"
                  onClick={() => setConfirmDeleteModal({ type: "selected", count: selectedIds.size })}
                >
                  <Trash2 size={14} />
                  Delete Selected ({selectedIds.size})
                </button>
                <button
                  type="button"
                  className="notes-action-btn"
                  title="Clear selection"
                  onClick={deselectAll}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {composer?.ticker === ticker && (
            <div style={{ marginBottom: "1rem" }}>
              <NoteEditor
                lockedTicker={ticker}
                tickerCounts={tickerCounts}
                onSave={onSaveNote}
                onClose={() => setComposer(null)}
              />
            </div>
          )}

          {items.length === 0 ? (
            <div className="notes-trades-empty">
              <p>No notes written for <strong>{ticker}</strong> yet.</p>
            </div>
          ) : (
            <ul className="notes-items">
              {items.map((note) =>
                editingId === note.id ? (
                  <li key={note.id} className="notes-item notes-item--editing">
                    <NoteEditor
                      initial={note}
                      lockedTicker={note.ticker}
                      tickerCounts={tickerCounts}
                      onSave={(data) => onUpdateNote(note.id, data)}
                      onClose={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <NoteItem
                    key={note.id}
                    note={note}
                    query=""
                    flash={flashId === note.id}
                    selected={selectedIds.has(note.id)}
                    onToggleSelect={onToggleSelect}
                    onEdit={(id) => setEditingId(id)}
                    onDelete={onDeleteNote}
                  />
                )
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Notes tab                                                           */
/* ================================================================== */
export default function NotesTab() {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState(null);
  const [composer, setComposer] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null); // null | { type: 'selected' | 'all', count: number }

  const searchRef = useRef(null);
  const addBtnRef = useRef(null);
  const toastTimer = useRef(null);

  const {
    notes,
    loading,
    loadError,
    reload,
    addNote: createNote,
    updateNote: saveNote,
    deleteNote: removeNote,
    deleteNotes: removeNotes,
    deleteAllNotes: removeAllNotes,
  } = useAssetNotes({
    onError: (message) => showToast(message),
    onAddFailed: ({ ticker, text }, message) => {
      writeJson(DRAFT_KEY, { ticker, text });
      showToast(`${message} Your text is kept as a draft.`);
    },
  });

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* Keyboard shortcuts: "/" jumps to search, "n" starts a new note */
  useEffect(() => {
    function onKey(e) {
      const el = e.target;
      const typing =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setComposer({});
        setEditingId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- derived data ---------- */
  const capture = parseCapture(query);
  const searchTerm = (capture ? capture.ticker : query).trim().toLowerCase();

  const tickerCounts = useMemo(() => {
    const counts = {};
    notes.forEach((n) => (counts[n.ticker] = (counts[n.ticker] || 0) + 1));
    return counts;
  }, [notes]);

  const topTickers = useMemo(
    () =>
      Object.entries(tickerCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([t]) => t),
    [tickerCounts]
  );

  const groups = useMemo(() => {
    const filtered = notes.filter((n) => {
      if (chip && n.ticker !== chip) return false;
      if (!searchTerm) return true;
      return capture
        ? n.ticker.toLowerCase().includes(searchTerm)
        : n.ticker.toLowerCase().includes(searchTerm) || n.text.toLowerCase().includes(searchTerm);
    });
    const map = new Map();
    for (const n of filtered) {
      if (!map.has(n.ticker)) map.set(n.ticker, []);
      map.get(n.ticker).push(n);
    }
    return [...map.entries()]
      .map(([ticker, items]) => {
        items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { ticker, items, latest: items[0].updatedAt };
      })
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [notes, chip, searchTerm, capture]);

  const resultCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const filtering = Boolean(chip || (searchTerm && !capture));

  /* Selection helper functions */
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(notes.map((n) => n.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleGroupSelect = (groupNotes) => {
    const groupIds = groupNotes.map((n) => n.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  /* ---------- actions ---------- */
  function showToast(message, undo) {
    clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  function addNote({ ticker, text }) {
    const id = createNote({ ticker, text });
    setSelectedAsset(ticker);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1800);
    setComposer(null);
    showToast(`Saved to ${ticker}`);
    addBtnRef.current?.focus();
  }

  function updateNote(id, data) {
    saveNote(id, data);
    setEditingId(null);
    showToast("Note updated");
  }

  function deleteNote(id) {
    const result = removeNote(id);
    if (!result) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast(`Deleted note on ${result.note.ticker}`, () => {
      result.undo();
      setToast(null);
    });
  }

  function handleConfirmBulkDelete() {
    if (!confirmDeleteModal) return;
    let result = null;

    if (confirmDeleteModal.type === "all") {
      result = removeAllNotes();
      setSelectedIds(new Set());
    } else {
      result = removeNotes(Array.from(selectedIds));
      setSelectedIds(new Set());
    }

    setConfirmDeleteModal(null);

    if (result) {
      showToast(`Deleted ${result.notes.length} ${result.notes.length === 1 ? "note" : "notes"}`, () => {
        result.undo();
        setToast(null);
      });
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === "Enter" && capture) {
      e.preventDefault();
      addNote(capture);
      setQuery("");
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else e.currentTarget.blur();
    }
  }

  const openComposer = (opts = {}) => {
    if (opts.ticker) setSelectedAsset(opts.ticker);
    setComposer(opts);
    setEditingId(null);
  };

  /* ---------- render ---------- */
  const totalAssets = Object.keys(tickerCounts).length;
  const isAllNotesSelected = notes.length > 0 && selectedIds.size === notes.length;
  const selectedAssetGroup = groups.find((g) => g.ticker === selectedAsset);

  return (
    <section className="notes-tab" aria-labelledby="notes-title">
      <datalist id="notes-tickers">
        {Object.keys(tickerCounts).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* ── Page Header ─────────────────────────────────────────── */}
      <header className="notes-header">
        <div>
          <div className="notes-title-row">
            <NotebookTabs className="notes-header-icon" size={26} />
            <h1 id="notes-title" className="notes-title">
              Asset Notes
            </h1>
          </div>
          <p className="notes-subtitle">
            Capture catalysts, coin characteristics, and trade hypotheses in one place
            {!loading && notes.length > 0 && (
              <span className="notes-subtitle-meta">
                {" "}· <strong>{notes.length}</strong> {notes.length === 1 ? "note" : "notes"} across <strong>{totalAssets}</strong> {totalAssets === 1 ? "asset" : "assets"}
              </span>
            )}
          </p>
        </div>
        <div className="notes-header__actions">
          {notes.length > 0 && (
            <>
              <button
                type="button"
                className="notes-btn notes-btn--danger-outline"
                onClick={() => setConfirmDeleteModal({ type: "all", count: notes.length })}
              >
                <Trash2 size={14} />
                <span>Delete All</span>
              </button>

              <button type="button" className="notes-btn notes-btn--outline" onClick={() => downloadCsv(notes)}>
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </>
          )}

          <button
            ref={addBtnRef}
            type="button"
            className="notes-btn notes-btn--primary"
            onClick={() => openComposer({})}
            disabled={composer && !composer.ticker}
          >
            <Plus size={15} />
            Add Note <kbd className="notes-kbd">n</kbd>
          </button>
        </div>
      </header>

      {/* ── Integrated Toolbar & Contextual Action Bar ──────────────── */}
      <div className="notes-toolbar-wrap">
        {selectedIds.size > 0 && !selectedAsset ? (
          <div className="notes-bulk-bar notes-bulk-bar--integrated">
            <div className="notes-bulk-bar__info">
              <CheckSquare size={16} className="notes-bulk-bar__icon" />
              <span>
                <strong>{selectedIds.size}</strong> of {notes.length} notes selected
              </span>
            </div>
            <div className="notes-bulk-bar__actions">
              <button
                type="button"
                className="notes-btn notes-btn--outline"
                onClick={selectAll}
                disabled={isAllNotesSelected}
              >
                Select All
              </button>
              <button
                type="button"
                className="notes-btn notes-btn--outline"
                onClick={deselectAll}
              >
                Deselect
              </button>
              <button
                type="button"
                className="notes-btn notes-btn--danger"
                onClick={() => setConfirmDeleteModal({ type: "selected", count: selectedIds.size })}
              >
                <Trash2 size={14} />
                Delete Selected ({selectedIds.size})
              </button>
              <button
                type="button"
                className="notes-action-btn"
                title="Clear selection"
                onClick={deselectAll}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="notes-toolbar">
            <div className={`notes-searchwrap ${capture ? "is-capturing" : ""}`}>
              <div className="notes-searchwrap__icon">
                {capture ? (
                  <TickerBadge ticker={capture.ticker} small />
                ) : (
                  <Search size={16} />
                )}
              </div>
              <input
                ref={searchRef}
                type="search"
                className="notes-input notes-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search notes, or type  PEPE: your thought  and press Enter"
                aria-label="Search notes or capture a quick note"
              />
              {query ? (
                <button
                  type="button"
                  className="notes-searchwrap__clear"
                  title="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd className="notes-kbd notes-searchwrap__kbd">/</kbd>
              )}
            </div>

            {capture && (
              <p className="notes-capture-hint" role="status">
                <Sparkles size={14} className="notes-sparkles-icon" />
                Press <kbd>Enter</kbd> to save note to <strong>{capture.ticker}</strong>
                {tickerCounts[capture.ticker]
                  ? ` (${tickerCounts[capture.ticker]} existing)`
                  : " (new asset)"}
              </p>
            )}

            {topTickers.length >= 2 && (
              <div className="notes-chips" role="group" aria-label="Filter by asset">
                {topTickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`notes-chip ${chip === t ? "is-active" : ""}`}
                    style={{ "--h": hueFor(t) }}
                    aria-pressed={chip === t}
                    onClick={() => setChip((cur) => (cur === t ? null : t))}
                  >
                    <span className="notes-chip__dot" aria-hidden="true" />
                    {t}
                  </button>
                ))}
                {chip && (
                  <button
                    type="button"
                    className="notes-chip notes-chip--clear"
                    onClick={() => setChip(null)}
                  >
                    <X size={12} />
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Composer Form (Top Level) ─────────────────────────────── */}
      {composer && !composer.ticker && (
        <NoteEditor
          prefillTicker={composer.prefill}
          tickerCounts={tickerCounts}
          draftKey={DRAFT_KEY}
          onSave={addNote}
          onClose={() => {
            setComposer(null);
            addBtnRef.current?.focus();
          }}
        />
      )}

      {/* ── Results Summary Bar ──────────────────────────────────── */}
      {filtering && (
        <div className="notes-count">
          <span aria-live="polite">
            Showing {resultCount} {resultCount === 1 ? "note" : "notes"} across {groups.length}{" "}
            {groups.length === 1 ? "asset" : "assets"}
          </span>
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────────────── */}
      {loading && (
        <>
          <p className="notes-sr" role="status">
            Loading notes
          </p>
          <NotesSkeleton />
        </>
      )}

      {/* ── Load Error State ─────────────────────────────────────── */}
      {loadError && (
        <div className="notes-status notes-status--error" role="alert">
          <p>Could not load asset notes: {loadError}</p>
          <button type="button" className="notes-btn notes-btn--outline" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {/* ── Asset Card View Grid ─────────────────────────────────── */}
      {!loading && !loadError && (
        <div className="notes-cards-grid">
          {groups.map(({ ticker, items }) => {
            const groupIds = items.map((n) => n.id);
            const isGroupAllSelected = items.length > 0 && groupIds.every((id) => selectedIds.has(id));

            return (
              <AssetCard
                key={ticker}
                ticker={ticker}
                items={items}
                isAllSelected={isGroupAllSelected}
                onToggleGroupSelect={toggleGroupSelect}
                onClick={() => setSelectedAsset(ticker)}
                searchTerm={searchTerm}
              />
            );
          })}
        </div>
      )}

      {/* ── Asset Detail Pop-up Modal ────────────────────────────── */}
      {selectedAssetGroup && (
        <AssetDetailModal
          ticker={selectedAssetGroup.ticker}
          items={selectedAssetGroup.items}
          editingId={editingId}
          setEditingId={setEditingId}
          composer={composer}
          setComposer={setComposer}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSaveNote={addNote}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
          onClose={() => setSelectedAsset(null)}
          tickerCounts={tickerCounts}
          flashId={flashId}
          notes={notes}
          selectAll={selectAll}
          deselectAll={deselectAll}
          setConfirmDeleteModal={setConfirmDeleteModal}
        />
      )}

      {/* ── Empty State ──────────────────────────────────────────── */}
      {groups.length === 0 && !composer && !loading && !loadError && (
        <div className="notes-empty">
          {notes.length === 0 ? (
            <>
              <div className="notes-empty__icon-wrap">
                <NotebookTabs size={38} className="notes-empty__icon" />
              </div>
              <h3 className="notes-empty__title">No asset notes recorded yet</h3>
              <p className="notes-empty__text">Jot down coin catalysts, sentiment triggers, or trade hypotheses.</p>
              <button
                type="button"
                className="notes-ghost"
                onClick={() => {
                  setQuery("PEPE: ");
                  searchRef.current?.focus();
                }}
              >
                <TickerBadge ticker="PEPE" />
                <span>
                  <strong>PEPE:</strong> meme coin, hype driven by sentiment catalysts...
                </span>
              </button>
              <p className="notes-empty__tip">
                Type a ticker, a colon, then your thought, and press Enter. Click the example to
                start.
              </p>
            </>
          ) : (
            <>
              <p className="notes-empty__text">Nothing matches {chip ? chip : `"${query.trim()}"`}.</p>
              {!chip && /^[A-Za-z0-9]{1,20}$/.test(query.trim()) && (
                <button
                  type="button"
                  className="notes-btn notes-btn--primary"
                  onClick={() => openComposer({ prefill: query.trim().toUpperCase() })}
                >
                  <Plus size={14} />
                  Add a note for {query.trim().toUpperCase()}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Confirmation Modal for Bulk Deletion ──────────────────── */}
      {confirmDeleteModal && (
        <div className="notes-modal-overlay" onClick={() => setConfirmDeleteModal(null)}>
          <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notes-modal__header">
              <div className="notes-modal__icon-wrap">
                <AlertTriangle size={24} className="notes-modal__icon" />
              </div>
              <h3>
                Delete {confirmDeleteModal.count}{" "}
                {confirmDeleteModal.count === 1 ? "Note" : "Notes"}?
              </h3>
            </div>
            <p className="notes-modal__body">
              {confirmDeleteModal.type === "all"
                ? `Are you sure you want to delete ALL ${confirmDeleteModal.count} notes from your account?`
                : `Are you sure you want to delete ${confirmDeleteModal.count} selected notes?`}
              <br />
              You can undo this action immediately after deleting.
            </p>
            <div className="notes-modal__actions">
              <button
                type="button"
                className="notes-btn notes-btn--outline"
                onClick={() => setConfirmDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="notes-btn notes-btn--danger"
                onClick={handleConfirmBulkDelete}
              >
                <Trash2 size={14} />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications (Undoable) ───────────────────────── */}
      {toast && (
        <div className="notes-toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button type="button" className="notes-toast__undo" onClick={toast.undo}>
              <Undo2 size={13} />
              Undo
            </button>
          )}
        </div>
      )}
    </section>
  );
}
