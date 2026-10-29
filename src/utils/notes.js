/** "PEPEUSDT", "PEPE/USDT", "PEPE-PERP" -> "PEPE". Falls back to the raw symbol. */
export function normalizeSymbol(symbol) {
  const raw = String(symbol || "").toUpperCase().replace(/[-_/\s]/g, "");
  const stripped = raw.replace(/(USDT|USDC|BUSD|USD|PERP)$/, "");
  return stripped || raw;
}

/**
 * Builds { PEPE: { count, pnl } } from your trades rows, so each asset group
 * can show how much you have traded it. Pass the result to <NotesTab tradeStats />.
 */
export function buildTradeStats(trades = []) {
  const stats = {};
  for (const t of trades) {
    const key = normalizeSymbol(t.symbol);
    if (!stats[key]) stats[key] = { count: 0, pnl: 0 };
    stats[key].count += 1;
    stats[key].pnl += Number(t.realized_pnl) || 0;
  }
  return stats;
}

export function getNotesForTicker(notes, ticker) {
  const t = normalizeSymbol(ticker);
  return notes
    .filter((n) => n.ticker === t)
    .map((n) => n.text)
    .join(" | ");
}

export function notesToCsv(notes) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };
  const rows = notes.map((n) => [
    n.ticker,
    n.text,
    formatDate(n.createdAt),
    formatDate(n.updatedAt),
  ]);
  const csvContent = [["ticker", "notes", "created_at", "updated_at"], ...rows]
    .map((r) => r.map(esc).join(","))
    .join("\n");
  return "\uFEFF" + csvContent;
}
