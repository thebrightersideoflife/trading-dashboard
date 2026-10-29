import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../api/supabaseClient";

const TABLE = "asset_notes";
const UNDO_MS = 6000; // how long "Undo" is offered before a delete is committed

// DB row (snake_case, `note`) -> UI shape the component uses
const fromRow = (r) => ({
  id: r.id,
  ticker: r.ticker,
  text: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Loads and mutates the signed-in user's asset notes.
 *
 * Writes are optimistic: the UI changes instantly and rolls back if Supabase
 * rejects the change.
 *   - A failed add reports the note back via onAddFailed so no typing is lost.
 *   - Deletes wait UNDO_MS before hitting the database, so Undo is a plain
 *     local restore and never needs a re-insert.
 *
 * Options:
 *   onError(message)               generic failure message for the toast
 *   onAddFailed(note, message)     called with the note that could not be saved
 */
export function useAssetNotes({ onError, onAddFailed } = {}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const notesRef = useRef(notes);
  const handlers = useRef({ onError, onAddFailed });
  const pending = useRef(new Map()); // id -> { timer, commit }

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    handlers.current = { onError, onAddFailed };
  });

  /* ---------- load ---------- */
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setLoadError(error.message);
    else setNotes((data || []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (!active) return;
      if (error) setLoadError(error.message);
      else setNotes((data || []).map(fromRow));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ---------- add ---------- */
  // Returns the new id synchronously so the UI can highlight it right away.
  const addNote = useCallback(({ ticker, text }) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setNotes((prev) => [{ id, ticker, text, createdAt: now, updatedAt: now }, ...prev]);

    (async () => {
      // user_id is filled by the column default (auth.uid())
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ id, ticker, note: text })
        .select()
        .single();

      if (error) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        handlers.current.onAddFailed?.({ ticker, text }, `Could not save the note (${error.message}).`);
      } else {
        setNotes((prev) => prev.map((n) => (n.id === id ? fromRow(data) : n)));
      }
    })();

    return id;
  }, []);

  /* ---------- update ---------- */
  const updateNote = useCallback((id, { ticker, text }) => {
    const previous = notesRef.current.find((n) => n.id === id);
    if (!previous) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ticker, text, updatedAt: new Date().toISOString() } : n
      )
    );

    (async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ticker, note: text })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        setNotes((prev) => prev.map((n) => (n.id === id ? previous : n)));
        handlers.current.onError?.(`Could not update the note (${error.message}).`);
      } else {
        // pick up the trigger-maintained updated_at
        setNotes((prev) => prev.map((n) => (n.id === id ? fromRow(data) : n)));
      }
    })();
  }, []);

  /* ---------- delete (delayed, undoable) ---------- */
  // Returns { note, undo } or null if the note does not exist.
  const deleteNote = useCallback((id) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return null;

    setNotes((prev) => prev.filter((n) => n.id !== id));

    const commit = async () => {
      pending.current.delete(id);
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) {
        setNotes((prev) => [note, ...prev]);
        handlers.current.onError?.(`Could not delete the note (${error.message}). It was restored.`);
      }
    };

    const timer = setTimeout(commit, UNDO_MS);
    pending.current.set(id, { timer, commit });

    const undo = () => {
      const entry = pending.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(id);
      setNotes((prev) => [note, ...prev]);
    };

    return { note, undo };
  }, []);

  /* ---------- bulk delete (delayed, undoable) ---------- */
  const deleteNotes = useCallback((ids) => {
    const idSet = new Set(ids);
    const toDelete = notesRef.current.filter((n) => idSet.has(n.id));
    if (!toDelete.length) return null;

    setNotes((prev) => prev.filter((n) => !idSet.has(n.id)));

    const batchKey = `bulk_${crypto.randomUUID()}`;

    const commit = async () => {
      pending.current.delete(batchKey);
      const { error } = await supabase.from(TABLE).delete().in("id", Array.from(idSet));
      if (error) {
        setNotes((prev) => [...toDelete, ...prev]);
        handlers.current.onError?.(`Could not delete notes (${error.message}). They were restored.`);
      }
    };

    const timer = setTimeout(commit, UNDO_MS);
    pending.current.set(batchKey, { timer, commit });

    const undo = () => {
      const entry = pending.current.get(batchKey);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(batchKey);
      setNotes((prev) => [...toDelete, ...prev]);
    };

    return { notes: toDelete, undo };
  }, []);

  const deleteAllNotes = useCallback(() => {
    const allIds = notesRef.current.map((n) => n.id);
    return deleteNotes(allIds);
  }, [deleteNotes]);

  /* Commit any waiting deletes if the user leaves the tab or page.
     Best effort: browsers may cancel requests during page close. */
  useEffect(() => {
    const flush = () => {
      for (const { timer, commit } of pending.current.values()) {
        clearTimeout(timer);
        commit();
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return { notes, loading, loadError, reload, addNote, updateNote, deleteNote, deleteNotes, deleteAllNotes };
}
