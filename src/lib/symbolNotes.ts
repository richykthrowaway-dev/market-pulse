export const STORAGE_KEY = 'dash-notes-v1';

export type NotesMap = Record<string, string>;

/** Self-healing parse: bad JSON / non-object / non-string values → {}. Pure. */
export function parseNotes(raw: string | null): NotesMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: NotesMap = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof k === 'string' && typeof val === 'string') out[k.toUpperCase()] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Return a new map with `sym`'s note set; empty/whitespace text removes the
 * key. Symbol upper-cased. Pure (does not mutate `map`).
 */
export function setNote(map: NotesMap, sym: string, text: string): NotesMap {
  const key = String(sym ?? '').trim().toUpperCase();
  const next: NotesMap = { ...(map && typeof map === 'object' ? map : {}) };
  if (!key) return next;
  if (!text || !text.trim()) {
    delete next[key];
  } else {
    next[key] = text;
  }
  return next;
}
