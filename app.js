/* ============================================================
   FlashDesk — application source (readable, no build step).
   React + ReactDOM live in vendor-react.min.js (window.React / window.ReactDOM).
   Styles live in app.css.

   Data model (unchanged across versions — localStorage & Firestore compatible):
     state   = { decks: { [id]: {id, name, createdAt, reviews[], cards[]} }, order: [id] }
     card    = { id, front, back, type: "text"|"code", lang, box 0..4, dueAt, seen, lapses, hideLines? }
     session = { deckIds, mode, shuffle, scope, codeRecall, cards, queue, states,
                 wrongEver, attempts, correctCount, startedAt, elapsed, finished }
   ============================================================ */
"use strict";
(() => {

const { useState, useEffect, useRef, useCallback, useMemo } = React;
const h = React.createElement;
const Frag = React.Fragment;

/* ---------- persistence keys ---------- */
const STATE_KEY = "flashdesk-v1";
const SESSION_KEY = "flashdesk-session-v1";
const UPDATED_KEY = "flashdesk-updated-at";
const WRITER_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

const hasFirebaseConfig = () => {
  const cfg = typeof window !== "undefined" && window.FIREBASE_CONFIG;
  return !!(cfg && cfg.apiKey && !String(cfg.apiKey).includes("PASTE"));
};
const firebaseReady = () => typeof firebase !== "undefined" && hasFirebaseConfig();

/* ---------- cross-device sync (Firestore, last-write-wins by timestamp) ---------- */
const sync = {
  user: null,
  unsub: null,
  timer: null,
  onRemote: null,
  onStatus: null,
  docRef() {
    return firebase.firestore().collection("flashdesk").doc(this.user.uid);
  },
  schedulePush() {
    if (!this.user || !firebaseReady()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 900);
  },
  push() {
    if (!this.user || !firebaseReady()) return;
    const now = Date.now();
    try { localStorage.setItem(UPDATED_KEY, String(now)); } catch {}
    this.docRef().set({
      stateJson: localStorage.getItem(STATE_KEY) || "",
      sessionJson: localStorage.getItem(SESSION_KEY) || "",
      updatedAt: now,
      writer: WRITER_ID,
    }).then(() => this.onStatus && this.onStatus("synced"))
      .catch((err) => {
        console.error("push failed", err);
        this.onStatus && this.onStatus("error");
      });
  },
  applyRemote(data) {
    try {
      if (data.stateJson) localStorage.setItem(STATE_KEY, data.stateJson);
      if (data.sessionJson) localStorage.setItem(SESSION_KEY, data.sessionJson);
      else localStorage.removeItem(SESSION_KEY);
      localStorage.setItem(UPDATED_KEY, String(data.updatedAt || Date.now()));
    } catch {}
    this.onRemote && this.onRemote();
  },
  async start(user) {
    this.user = user;
    try {
      const snap = await this.docRef().get();
      const remote = snap.exists ? snap.data() : null;
      const localAt = Number(localStorage.getItem(UPDATED_KEY) || 0);
      if (remote && (remote.updatedAt || 0) > localAt) this.applyRemote(remote);
      else if (localStorage.getItem(STATE_KEY)) this.push();
      this.onStatus && this.onStatus("synced");
    } catch (err) {
      console.error(err);
      this.onStatus && this.onStatus("error");
    }
    this.unsub = this.docRef().onSnapshot((snap) => {
      const remote = snap.data();
      if (!remote || remote.writer === WRITER_ID) return;
      const localAt = Number(localStorage.getItem(UPDATED_KEY) || 0);
      if ((remote.updatedAt || 0) <= localAt) return;
      this.applyRemote(remote);
    });
  },
  stop() {
    if (this.unsub) this.unsub();
    this.unsub = null;
    this.user = null;
  },
  signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .catch(() => firebase.auth().signInWithRedirect(provider));
  },
  signOut() {
    firebase.auth().signOut();
  },
};

/* ---------- localStorage helpers (every save also schedules a sync push) ---------- */
function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
  } catch (err) { console.error("save failed", err); }
  sync.schedulePush();
}
function removeJSON(key) {
  try {
    localStorage.removeItem(key);
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
  } catch {}
  sync.schedulePush();
}

/* ---------- data model ---------- */
function normalizeCard(card) {
  return { type: "text", lang: "python", box: 0, dueAt: null, seen: 0, lapses: 0, ...card };
}
function normalizeState(raw) {
  const decks = {};
  Object.values(raw.decks || {}).forEach((d) => {
    decks[d.id] = { reviews: [], ...d, cards: (d.cards || []).map(normalizeCard) };
  });
  return { decks, order: (raw.order || []).filter((id) => decks[id]) };
}
function sampleState() {
  const id = uid();
  const card = (front, back, extra = {}) => normalizeCard({ id: uid(), front, back, ...extra });
  return {
    decks: {
      [id]: {
        id,
        name: "ML Warm-up (sample)",
        createdAt: Date.now(),
        reviews: [],
        cards: [
          card("Optimizer with per-parameter adaptive LR + momentum", "Adam"),
          card("Attention variant sharing K/V heads across query groups", "GQA"),
          card("Compute-optimal tokens-per-parameter ratio (Chinchilla)", "~20 tokens per parameter; 20"),
          card("DPO loss (per pair)", "-log σ(β(log πθ(yw|x)/πref(yw|x) - log πθ(yl|x)/πref(yl|x)))"),
          card("Why scale attention logits by 1/√d_k?", "keeps logit variance ~1 so softmax gradients don't vanish"),
          card("Softmax (numerically stable)", "def softmax(x):\n  z = x - x.max(-1, keepdims=True)\n  e = np.exp(z)\n  return e / e.sum(-1, keepdims=True)", { type: "code", lang: "python" }),
        ],
      },
    },
    order: [id],
  };
}

/* ---------- small utilities ---------- */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const shuffleArray = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/* ---------- answer grading (text cards) ---------- */
const normText = (s) => (s || "")
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/[.,;:!?"“”()\[\]{}]/g, "")
  .replace(/\s+/g, " ")
  .trim();

function editDistance(a, b) {
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[m];
}

/* Back side may hold alternates: "answer one; answer two" or "a / b". */
function gradeText(typed, back) {
  const guess = normText(typed);
  const targets = back.split(/;|\s\/\s/).map(normText).filter(Boolean);
  if (targets.length === 0) targets.push(normText(back));
  let best = { verdict: "wrong", dist: Infinity, target: targets[0] };
  for (const target of targets) {
    if (guess === target) return { verdict: "exact", dist: 0, target };
    const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : Math.min(3, Math.floor(target.length / 6));
    const dist = editDistance(guess, target);
    if (dist <= tolerance && dist < best.dist) best = { verdict: "typo", dist, target };
  }
  return best;
}

/* ---------- code-card blanks ---------- */
function pickBlankLines(code, fraction) {
  const candidates = code.split("\n")
    .map((text, i) => ({ text: text.trim(), i }))
    .filter((l) => l.text && !/^[{}()\[\];:]+$/.test(l.text) && l.text !== "pass");
  if (candidates.length === 0) return [];
  if (fraction >= 1) return candidates.map((l) => l.i);
  const pool = candidates.length > 1 ? candidates.slice(1) : candidates; // keep the signature visible
  const count = Math.max(1, Math.round(pool.length * fraction));
  return shuffleArray(pool).slice(0, count).map((l) => l.i).sort((a, b) => a - b);
}

const RECALL_FRACTIONS = { light: 0.4, heavy: 0.7, full: 1 };
const recallFraction = (mode, box) =>
  mode === "auto" ? [0.45, 0.55, 0.7, 0.85, 1][Math.min(box || 0, 4)] : (RECALL_FRACTIONS[mode] ?? 0.5);

/* Grade typed code lines against the expected hidden lines (order matters,
   indentation doesn't; small typos tolerated per line). */
function gradeCodeLines(typed, expectedLines) {
  const typedLines = typed.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = expectedLines.map((exp, i) => {
    const got = typedLines[i] || "";
    const expNorm = exp.trim().replace(/\s+/g, " ");
    const gotNorm = got.replace(/\s+/g, " ");
    if (expNorm === gotNorm && expNorm !== "") return { exp, typed: got, ok: true, exact: true };
    const dist = editDistance(expNorm, gotNorm);
    const sim = Math.max(0, 1 - dist / Math.max(expNorm.length, gotNorm.length, 1));
    return { exp, typed: got, ok: sim >= 0.88, exact: false };
  });
  const extra = typedLines.slice(expectedLines.length);
  const okCount = rows.filter((r) => r.ok).length;
  return {
    verdict: okCount === rows.length && extra.length === 0
      ? (rows.every((r) => r.exact) ? "exact" : "typo")
      : "wrong",
    rows, extra, okCount, total: rows.length, lines: true,
  };
}

/* ---------- formatting + Leitner scheduling ---------- */
const fmtDuration = (ms) => {
  const total = Math.floor((ms || 0) / 1000);
  const hrs = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return hrs > 0
    ? `${hrs}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${min}:${String(sec).padStart(2, "0")}`;
};
const timeAgo = (ts) => {
  if (!ts) return "never";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : new Date(ts).toLocaleDateString();
};

const DAY = 864e5;
const BOX_INTERVALS = [0, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY];
const isDue = (card) => !card.dueAt || card.dueAt <= Date.now();
const dayKey = (ts) => new Date(ts).toDateString();

function streakDays(decks) {
  const studied = new Set();
  Object.values(decks).forEach((d) => (d.reviews || []).forEach((r) => studied.add(dayKey(r.ts))));
  if (studied.size === 0) return 0;
  let streak = 0;
  const cursor = new Date(); // walk back by calendar days (DST-safe)
  if (!studied.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (studied.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------- tiny syntax highlighter ---------- */
const KEYWORDS = {
  python: "def return import from class if elif else for while in not and or is None True False lambda with as try except finally raise yield pass break continue global nonlocal assert del print self".split(" "),
  javascript: "const let var function return import from export class if else for while of in new this typeof instanceof null undefined true false async await try catch finally throw yield break continue switch case default".split(" "),
  cpp: "int float double char bool void auto const static return if else for while class struct public private template typename new delete nullptr true false include namespace using std vector string".split(" "),
  generic: "def return if else for while class import function const let var true false null None".split(" "),
};

function tokenizeCode(line, lang) {
  const kw = KEYWORDS[lang] || KEYWORDS.generic;
  const re = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
  const out = [];
  let last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    if (m[1]) out.push({ t: m[1], c: "tok-com" });
    else if (m[2]) out.push({ t: m[2], c: "tok-str" });
    else if (m[3]) out.push({ t: m[3], c: "tok-num" });
    else if (m[4]) out.push({ t: m[4], c: kw.includes(m[4]) ? "tok-kw" : undefined });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

function CodeBlock({ code, lang, small, badLines, hotLines }) {
  const lines = code.split("\n");
  return h("pre", { className: "fd-code" + (small ? " small" : "") },
    lines.map((line, i) => h("div", {
      key: i,
      className: "fd-codeline" + (badLines && badLines.has(i) ? " bad" : "") + (hotLines && hotLines.has(i) ? " hot" : ""),
    },
      tokenizeCode(line, lang || "generic").map((tok, j) =>
        tok.c ? h("span", { key: j, className: tok.c }, tok.t) : h("span", { key: j }, tok.t)),
      line === "" ? " " : "")));
}

function CodeWithBlanks({ code, lang, blanks }) {
  const hidden = new Set(blanks || []);
  const lines = code.split("\n");
  let slot = 0;
  return h("pre", { className: "fd-code" },
    lines.map((line, i) => {
      if (hidden.has(i)) {
        slot++;
        const indent = (line.match(/^[ \t]*/) || [""])[0];
        return h("div", { key: i, className: "fd-codeline slot" },
          indent,
          h("span", { className: "fd-slotnum" }, slot),
          " ····························");
      }
      return h("div", { key: i, className: "fd-codeline" },
        tokenizeCode(line, lang || "generic").map((tok, j) =>
          tok.c ? h("span", { key: j, className: tok.c }, tok.t) : h("span", { key: j }, tok.t)),
        line === "" ? " " : "");
    }));
}

/* Plain-textarea code editor: Tab indents, Enter auto-indents, ⌘/Ctrl+Enter submits. */
function CodePad({ value, onChange, onSubmit, placeholder }) {
  const ref = useRef(null);
  return h("textarea", {
    ref,
    className: "fd-codepad mono",
    value,
    spellCheck: false,
    placeholder: placeholder || "Type the code…  (Tab indents · ⌘/Ctrl+Enter checks)",
    onChange: (e) => onChange(e.target.value),
    onKeyDown: (e) => {
      const ta = e.target;
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart, end = ta.selectionEnd;
        const next = value.slice(0, start) + "  " + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit && onSubmit();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const start = ta.selectionStart;
        const before = value.slice(0, start);
        const lineStart = before.lastIndexOf("\n") + 1;
        const curLine = before.slice(lineStart);
        let indent = (curLine.match(/^[ \t]*/) || [""])[0];
        if (/[:{(\[]\s*$/.test(curLine)) indent += "  ";
        const next = before + "\n" + indent + value.slice(ta.selectionEnd);
        onChange(next);
        const pos = start + 1 + indent.length;
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos; });
      }
    },
    rows: Math.max(5, Math.min(14, value.split("\n").length + 1)),
  });
}

/* ============================================================
   Import parsers. parseAnything() dispatches over, in order:
   JSON cards / Jupyter notebooks, markdown with code fences,
   raw code files, header-markdown, CSV, and line pairs
   (front :: back, front | back, tab, Q:/A: blocks, **term** — def,
   term — def, cloze {{...}}).
   ============================================================ */

const normalizeLang = (raw) => {
  const l = (raw || "").toLowerCase();
  if (["py", "python", "python3"].includes(l)) return "python";
  if (["js", "javascript", "jsx", "ts", "tsx", "typescript", "node"].includes(l)) return "javascript";
  if (["cpp", "c++", "cc", "c", "cuda"].includes(l)) return "cpp";
  return l ? "generic" : "python";
};

const cleanHeading = (raw) => (raw || "")
  .replace(/^#{1,6}\s*/, "")
  .replace(/\*\*/g, "")
  .replace(/`/g, "")
  .replace(/[:\s]+$/, "")
  .trim();

/* One card per {{blank}} in the line (Anki-style cloze). */
function clozeCards(line) {
  const hidden = [];
  line.replace(/\{\{(.+?)\}\}/g, (_, s) => { hidden.push(s.trim()); return ""; });
  return hidden.map((answer, which) => {
    let n = 0;
    const front = line.replace(/\{\{(.+?)\}\}/g, (_, s) => (n++ === which ? "____" : s.trim()));
    return { front: front.trim(), back: answer, type: "text" };
  });
}

/* Line-based pairs. Q:/A: answers may span multiple lines (until a blank line
   or the next Q:). */
function parsePairs(text) {
  const cards = [];
  let pendingQ = null;
  let answerLines = null;
  const flushQA = () => {
    if (pendingQ && answerLines) {
      const back = answerLines.join("\n").trim();
      if (back) cards.push({ front: pendingQ, back });
    }
    pendingQ = null;
    answerLines = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flushQA(); continue; }
    const qm = line.match(/^(?:Q|Question)\s*[:.]\s*(.+)/i);
    if (qm) { flushQA(); pendingQ = qm[1].trim(); continue; }
    const am = line.match(/^(?:A|Answer)\s*[:.]\s*(.*)/i);
    if (am && pendingQ && !answerLines) { answerLines = am[1].trim() ? [am[1].trim()] : []; continue; }
    if (answerLines) { answerLines.push(line); continue; }
    if (/\{\{.+?\}\}/.test(line)) { cards.push(...clozeCards(line)); continue; }
    const m = line.match(/^[-*]?\s*(.+?)\s*::\s*(.+)$/)
      || line.match(/^(.+?)\t+(.+)$/)
      || line.match(/^(.+?)\s*\|\s*(.+)$/)
      || line.match(/^[-*]?\s*\*\*(.+?)\*\*\s*[-–—:]\s*(.+)$/)
      || line.match(/^[-*]?\s*(.+?)\s+[—–]\s+(.+)$/);
    if (m) cards.push({ front: m[1].trim(), back: m[2].trim() });
  }
  flushQA();
  return cards.filter((c) => c.front && c.back);
}

/* Markdown: each ```fence``` becomes a code card fronted by the nearest text
   line above it (or the current header). Header sections with a short
   paragraph become text cards; pair-style lines are parsed anywhere. */
function parseMarkdown(text) {
  const cards = [];
  let header = null;
  let inFence = false;
  let fenceLang = "";
  let fenceLines = [];
  let sectionText = [];
  let sectionHadCode = false;
  let fenceCount = 0;
  const flushSection = () => {
    const pairs = parsePairs(sectionText.join("\n"));
    if (pairs.length) {
      pairs.forEach((p) => cards.push({ ...p, type: p.type || "text" }));
    } else if (!sectionHadCode && header) {
      const para = sectionText.join(" ").replace(/\s+/g, " ").trim();
      if (para && para.length <= 220) cards.push({ front: header, back: para, type: "text" });
    }
    sectionText = [];
    sectionHadCode = false;
  };
  for (const line of text.split(/\r?\n/)) {
    if (inFence) {
      if (/^\s*```/.test(line)) {
        inFence = false;
        const code = fenceLines.join("\n").replace(/\s+$/, "");
        if (code.trim()) {
          fenceCount++;
          const lastText = [...sectionText].reverse().find((l) => l.trim());
          const front = cleanHeading(lastText || header || `Code block ${fenceCount}`);
          cards.push({ front, back: code, type: "code", lang: normalizeLang(fenceLang) });
          sectionHadCode = true;
          sectionText = [];
        }
      } else {
        fenceLines.push(line);
      }
      continue;
    }
    const fence = line.match(/^\s*```(\w+)?/);
    if (fence) { inFence = true; fenceLang = fence[1] || ""; fenceLines = []; continue; }
    const hm = line.match(/^#{1,6}\s+(.+)/);
    if (hm) { flushSection(); header = cleanHeading(hm[1]); continue; }
    sectionText.push(line);
  }
  flushSection();
  return cards;
}

/* Raw code files: each top-level def / class / function becomes a card,
   titled by its comment banner when present. */
const FN_RE = /^(def|class)\s+\w+|^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?const\s+\w+\s*=\s*(async\s*)?(\(|function)/;

function parseCodeFile(text) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  lines.forEach((line, i) => { if (FN_RE.test(line)) starts.push(i); });
  if (starts.length === 0) return [];
  const isPython = lines.some((l) => /^(def|class)\s/.test(l));
  const cards = [];
  starts.forEach((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    let j = start - 1;
    const banner = [];
    while (j >= 0 && /^\s*(#|\/\/)/.test(lines[j])) { banner.unshift(lines[j]); j--; }
    const title = banner
      .map((l) => l.replace(/^\s*(#|\/\/)+/, "").replace(/^[=\-*~\s]+|[=\-*~\s]+$/g, "").trim())
      .filter(Boolean)
      .join(" — ");
    const body = lines.slice(start, end);
    while (body.length && !body[body.length - 1].trim()) body.pop();
    const nameMatch = lines[start].match(/(?:def|class|function)\s+(\w+)/) || lines[start].match(/const\s+(\w+)/);
    const front = title && title.length > 2 ? title : `Implement ${nameMatch ? nameMatch[1] : "this"}`;
    cards.push({ front, back: body.join("\n"), type: "code", lang: isPython ? "python" : "javascript" });
  });
  return cards;
}

/* JSON: either an array of {front, back, type?, lang?} (paste cards straight
   from an LLM) or a Jupyter .ipynb notebook. */
function parseJSONCards(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (Array.isArray(data)) {
    return data
      .filter((x) => x && typeof x === "object" && x.front && x.back)
      .map((x) => ({
        front: String(x.front).trim(),
        back: String(x.back).replace(/\s+$/, ""),
        type: x.type === "code" ? "code" : "text",
        lang: normalizeLang(x.lang || (x.type === "code" ? "python" : "")),
      }));
  }
  if (data && Array.isArray(data.cells)) {
    const cards = [];
    let heading = null;
    let count = 0;
    for (const cell of data.cells) {
      const src = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "");
      if (cell.cell_type === "markdown") {
        const m = src.match(/^#{1,6}\s+(.+)$/m);
        if (m) heading = cleanHeading(m[1]);
      } else if (cell.cell_type === "code" && src.trim()) {
        count++;
        cards.push({
          front: heading || `Notebook cell ${count}`,
          back: src.replace(/\s+$/, ""),
          type: "code",
          lang: "python",
        });
        heading = null;
      }
    }
    return cards;
  }
  return [];
}

/* CSV / TSV with a front,back header or uniformly two columns. */
function parseCSVLine(line, sep) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"' && cur === "") inQuotes = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((l) => parseCSVLine(l, sep));
  const hasHeader = rows[0].length >= 2 && /^front$/i.test(rows[0][0]) && /^back$/i.test(rows[0][1]);
  const body = hasHeader ? rows.slice(1) : rows;
  // Without an explicit header, only accept clean uniform 2-column data.
  if (!hasHeader && (body.length < 3 || !body.every((r) => r.length === 2))) return [];
  return body
    .filter((r) => r.length >= 2 && r[0] && r[1])
    .map((r) => ({ front: r[0], back: r[1], type: "text" }));
}

function parseAnything(text) {
  const json = parseJSONCards(text);
  if (json.length) return json;
  if (/```/.test(text)) {
    const cards = parseMarkdown(text);
    if (cards.length) return cards;
  }
  if (text.split(/\r?\n/).some((l) => FN_RE.test(l))) {
    const cards = parseCodeFile(text);
    if (cards.length) return cards;
  }
  if (/^#{1,6}\s+\S/m.test(text)) {
    const cards = parseMarkdown(text);
    if (cards.length) return cards;
  }
  const csv = parseCSV(text);
  if (csv.length) return csv;
  return parsePairs(text).map((c) => ({ type: "text", ...c }));
}

/* ============================================================
   Explode: turn one code card into one fill-in-the-blank card per
   line (or per group of similar consecutive lines). Skips
   signatures, imports, decorators, comments, and docstrings.
   ============================================================ */

const lineSkeleton = (l) => l.trim().replace(/\b[A-Za-z_]\w*\b/g, "V").replace(/\s+/g, " ");
const skelTokens = (s) => s.split(/(\W)/).filter((x) => x.trim());
function skeletonSimilarity(a, b) {
  const A = skelTokens(a), B = skelTokens(b);
  if (!A.length || !B.length) return 0;
  const bag = {};
  let inter = 0;
  B.forEach((t) => { bag[t] = (bag[t] || 0) + 1; });
  A.forEach((t) => { if (bag[t] > 0) { inter++; bag[t]--; } });
  return inter / (A.length + B.length - inter);
}

function explodeCards(cards) {
  const out = [];
  for (const card of cards) {
    if (card.type !== "code") { out.push(card); continue; }
    const lines = card.back.split("\n");
    const blankable = [];
    let inDocstring = false;
    lines.forEach((line, i) => {
      const t = line.trim();
      const quotes = (t.match(/"""|'''/g) || []).length;
      if (inDocstring) {
        if (quotes % 2) inDocstring = false;
        blankable[i] = false;
        return;
      }
      if (quotes % 2) { inDocstring = true; blankable[i] = false; return; }
      if (!t || /^(import|from)\s/.test(t) || /^(def|class)\b/.test(t) || /^@/.test(t)
        || /^#/.test(t) || /^[{}()\[\];:,]+$/.test(t) || t === "pass" || t === "...") {
        blankable[i] = false;
        return;
      }
      blankable[i] = true;
    });
    const groups = [];
    let i = 0;
    while (i < lines.length) {
      if (!blankable[i]) { i++; continue; }
      const group = [i];
      const head = lineSkeleton(lines[i]);
      let j = i + 1;
      while (j < lines.length && blankable[j] && group.length < 8
        && skeletonSimilarity(head, lineSkeleton(lines[j])) >= 0.72) {
        group.push(j);
        j++;
      }
      groups.push(group);
      i = j;
    }
    if (!groups.length) { out.push(card); continue; }
    groups.forEach((group) => {
      const label = group.length > 1
        ? ` · L${group[0] + 1}–${group[group.length - 1] + 1}`
        : ` · L${group[0] + 1}`;
      out.push({ front: card.front + label, back: card.back, type: "code", lang: card.lang, hideLines: group });
    });
  }
  return out;
}

/* ============================================================
   Components
   ============================================================ */

const BOX_LABELS = ["new", "learning", "1-day", "3-day", "solid"];

function deckStats(deck) {
  const n = deck.reviews.length;
  const avg = n ? Math.round(deck.reviews.reduce((acc, r) => acc + r.accuracy, 0) / n) : null;
  const time = deck.reviews.reduce((acc, r) => acc + (r.durationMs || 0), 0);
  const last = n ? deck.reviews[n - 1].ts : null;
  const due = deck.cards.filter(isDue).length;
  return { n, avg, time, last, due };
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const W = 72, H = 20;
  const points = values.slice(-12).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * (W - 4) + 2;
    const y = H - 3 - (v / 100) * (H - 6);
    return `${x},${y}`;
  }).join(" ");
  return h("svg", { width: W, height: H, className: "fd-spark", "aria-label": "accuracy trend" },
    h("polyline", { points, fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }));
}

function SessionTimer({ session, setSession }) {
  const ticks = useRef(0);
  useEffect(() => {
    if (session.finished) return;
    const timer = setInterval(() => {
      setSession((s) => {
        if (!s || s.finished) return s;
        const next = { ...s, elapsed: Date.now() - s.startedAt };
        ticks.current++;
        if (ticks.current % 15 === 0) saveJSON(SESSION_KEY, next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session.finished, setSession]);
  return h("div", { className: "fd-chip mono" }, "⏱ ", fmtDuration(session.elapsed));
}

/* ---------- Library (deck grid) ---------- */
function Library({ state, selected, setSelected, savedSession, onResume, onDiscard, onOpen, onCreate, onStudy }) {
  const [name, setName] = useState("");
  const decks = state.order.map((id) => state.decks[id]).filter(Boolean);
  const toggle = (id) => setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const selectedCards = selected.reduce((acc, id) => acc + (state.decks[id]?.cards.length || 0), 0);
  const dueTotal = decks.reduce((acc, d) => acc + d.cards.filter(isDue).length, 0);
  const dueDeckIds = decks.filter((d) => d.cards.some(isDue)).map((d) => d.id);
  const savedDone = savedSession ? Object.values(savedSession.states).filter((s) => s === "done").length : 0;
  return h("div", null,
    savedSession && h("div", { className: "fd-resume" },
      h("div", null,
        h("strong", null, "Session in progress"),
        h("div", { className: "dim", style: { fontSize: 13 } },
          savedDone, "/", savedSession.cards.length, " retired · ", fmtDuration(savedSession.elapsed),
          " on the clock · ", savedSession.mode === "type" ? "typing" : "flip", " mode")),
      h("div", { style: { display: "flex", gap: 8 } },
        h("button", { className: "btn small", onClick: onDiscard }, "Discard"),
        h("button", { className: "btn small primary", onClick: onResume }, "Resume →"))),
    h("div", { className: "fd-hero" },
      h("h1", null, "Your card box"),
      h("p", { className: "fd-sub" },
        dueTotal > 0
          ? h(Frag, null, "You have ", h("strong", null, dueTotal), " card", dueTotal === 1 ? "" : "s", " due for review.")
          : "Nothing due — add material or run a full pass."),
      dueTotal > 0 && h("button", { className: "btn primary", onClick: () => onStudy(dueDeckIds) }, "Study everything due →")),
    h("div", { className: "fd-newdeck" },
      h("input", {
        value: name,
        placeholder: "New deck name…  (e.g. Transformer math)",
        onChange: (e) => setName(e.target.value),
        onKeyDown: (e) => { if (e.key === "Enter" && name.trim()) { onCreate(name.trim()); setName(""); } },
      }),
      h("button", { className: "btn", disabled: !name.trim(), onClick: () => { onCreate(name.trim()); setName(""); } }, "Create deck")),
    decks.length === 0 && h("div", { className: "fd-empty" }, "No decks yet. Create one above to get started."),
    h("div", { className: "fd-grid" },
      decks.map((deck) => {
        const st = deckStats(deck);
        const sel = selected.includes(deck.id);
        return h("div", { key: deck.id, className: "fd-deckcard" + (sel ? " sel" : "") },
          h("div", { className: "fd-deckcard-top" },
            h("label", { className: "fd-check", title: "Select for combined review" },
              h("input", { type: "checkbox", checked: sel, onChange: () => toggle(deck.id) })),
            h("button", { className: "fd-deckname", onClick: () => onOpen(deck.id) }, deck.name),
            st.due > 0 && h("span", { className: "fd-due" }, st.due, " due")),
          h("div", { className: "fd-deckmeta" },
            h("span", null, deck.cards.length, " cards"),
            h("span", null, "·"),
            h("span", null, st.n, " review", st.n === 1 ? "" : "s"),
            st.avg !== null && h(Frag, null, h("span", null, "·"), h("span", null, st.avg, "% avg"))),
          h("div", { className: "fd-deckmeta dim", style: { justifyContent: "space-between", display: "flex" } },
            h("span", null, st.time > 0 ? fmtDuration(st.time) + " studied · " : "", "last ", timeAgo(st.last)),
            h(Sparkline, { values: deck.reviews.map((r) => r.accuracy) })),
          h("div", { className: "fd-deckcard-actions" },
            h("button", { className: "btn small", onClick: () => onOpen(deck.id) }, "Open"),
            h("button", { className: "btn small primary", disabled: deck.cards.length === 0, onClick: () => onStudy([deck.id]) }, "Study")));
      })),
    selected.length > 0 && h("div", { className: "fd-multibar" },
      h("span", null, selected.length, " deck", selected.length === 1 ? "" : "s", " · ", selectedCards, " cards"),
      h("div", { style: { display: "flex", gap: 8 } },
        h("button", { className: "btn small ghostlight", onClick: () => setSelected([]) }, "Clear"),
        h("button", { className: "btn small light", disabled: selectedCards === 0, onClick: () => onStudy(selected) }, "Study together →"))));
}

/* ---------- Deck view ---------- */
function DeckView({ deck, onBack, onRename, onDelete, onAddCards, onUpdateCard, onDeleteCard, onExplodeCard, onImport, onPasteImport, onStudy }) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(deck.name);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isCode, setIsCode] = useState(false);
  const [lang, setLang] = useState("python");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortHardest, setSortHardest] = useState(false);
  const [query, setQuery] = useState("");
  const stats = deckStats(deck);

  const addCard = () => {
    if (!front.trim() || !back.trim()) return;
    onAddCards([{
      front: front.trim(),
      back: isCode ? back.replace(/\s+$/, "") : back.trim(),
      type: isCode ? "code" : "text",
      lang,
    }]);
    setFront("");
    setBack("");
  };

  // Paste notes anywhere on this page (outside an input) to import them.
  useEffect(() => {
    const onPaste = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const text = e.clipboardData?.getData("text");
      if (text && text.trim().length > 3) { e.preventDefault(); onPasteImport(text); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPasteImport]);

  const visibleCards = useMemo(() => {
    let cards = deck.cards;
    const q = query.trim().toLowerCase();
    if (q) cards = cards.filter((c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
    if (sortHardest) cards = [...cards].sort((a, b) => b.lapses - a.lapses || a.box - b.box);
    return cards;
  }, [deck.cards, query, sortHardest]);

  return h("div", null,
    h("button", { className: "fd-back", onClick: onBack }, "← All decks"),
    h("div", { className: "fd-deckhead" },
      renaming
        ? h("input", {
            className: "fd-nameinput", value: nameDraft, autoFocus: true,
            onChange: (e) => setNameDraft(e.target.value),
            onBlur: () => { onRename(nameDraft.trim() || deck.name); setRenaming(false); },
            onKeyDown: (e) => { if (e.key === "Enter") e.target.blur(); },
          })
        : h("h1", { onClick: () => { setNameDraft(deck.name); setRenaming(true); }, title: "Click to rename" },
            deck.name, " ", h("span", { className: "fd-pencil" }, "✎")),
      h("div", { className: "fd-deckmeta" },
        h("span", null, deck.cards.length, " cards"),
        stats.due > 0 && h(Frag, null, h("span", null, "·"), h("span", { className: "fd-due-inline" }, stats.due, " due now")),
        h("span", null, "·"),
        h("span", null, stats.n, " review", stats.n === 1 ? "" : "s"),
        stats.avg !== null && h(Frag, null, h("span", null, "·"), h("span", null, stats.avg, "% average")),
        stats.time > 0 && h(Frag, null, h("span", null, "·"), h("span", null, fmtDuration(stats.time), " studied"))),
      deck.reviews.length > 0 && h("div", { className: "fd-history" },
        deck.reviews.slice(-6).map((r, i) => h("span", {
          key: i, className: "fd-history-pill", title: new Date(r.ts).toLocaleString(),
        }, r.accuracy, "% · ", fmtDuration(r.durationMs)))),
      h("div", { className: "fd-deckhead-actions" },
        h("button", { className: "btn primary", disabled: deck.cards.length === 0, onClick: onStudy }, "Study this deck"),
        h("button", { className: "btn", onClick: onImport }, "Import cards"),
        confirmDelete
          ? h("span", { className: "fd-confirm" }, "Delete “", deck.name, "”? ",
              h("button", { className: "btn small danger", onClick: onDelete }, "Yes, delete"),
              h("button", { className: "btn small", onClick: () => setConfirmDelete(false) }, "Keep"))
          : h("button", { className: "btn danger-ghost", onClick: () => setConfirmDelete(true) }, "Delete deck"))),
    h("div", { className: "fd-addbox" },
      h("div", { className: "fd-addrow" },
        h("input", {
          placeholder: "Front — term or question", value: front,
          onChange: (e) => setFront(e.target.value),
          onKeyDown: (e) => { if (e.key === "Enter" && !isCode) addCard(); },
        }),
        isCode
          ? h(CodePad, { value: back, onChange: setBack, onSubmit: addCard, placeholder: "Answer code…  (Tab indents · ⌘/Ctrl+Enter adds)" })
          : h("input", {
              placeholder: "Back — answer  (use ; for alternates)", value: back,
              onChange: (e) => setBack(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter") addCard(); },
            })),
      h("div", { className: "fd-addopts" },
        h("label", { className: "fd-codetoggle" },
          h("input", { type: "checkbox", checked: isCode, onChange: (e) => setIsCode(e.target.checked) }),
          " Answer is code"),
        isCode && h("select", { value: lang, onChange: (e) => setLang(e.target.value) },
          h("option", { value: "python" }, "Python"),
          h("option", { value: "javascript" }, "JavaScript"),
          h("option", { value: "cpp" }, "C++"),
          h("option", { value: "generic" }, "Other")),
        h("span", { className: "fd-hint" }, "Tip: paste notes anywhere on this page to import them"),
        h("button", { className: "btn primary", disabled: !front.trim() || !back.trim(), onClick: addCard }, "Add card"))),
    deck.cards.length === 0
      ? h("div", { className: "fd-empty" }, "This deck is empty. Add a card above, paste notes right onto this page, or Import cards.")
      : h(Frag, null,
          h("div", { className: "fd-listbar" },
            h("span", { className: "dim", style: { fontSize: 13 } }, visibleCards.length, query.trim() ? ` of ${deck.cards.length}` : "", " cards"),
            h("input", {
              className: "fd-search", value: query, placeholder: "Search cards…",
              onChange: (e) => setQuery(e.target.value),
            }),
            h("button", { className: "btn small" + (sortHardest ? " primary" : ""), onClick: () => setSortHardest(!sortHardest) },
              sortHardest ? "Sorted: hardest first" : "Sort by hardest")),
          h("div", { className: "fd-cardlist" },
            visibleCards.map((card) => h("div", { key: card.id, className: "fd-cardrow" },
              editing?.id === card.id
                ? h("div", { className: "fd-editcard" },
                    h("input", { value: editing.front, onChange: (e) => setEditing({ ...editing, front: e.target.value }) }),
                    card.type === "code"
                      ? h(CodePad, { value: editing.back, onChange: (v) => setEditing({ ...editing, back: v }) })
                      : h("input", { value: editing.back, onChange: (e) => setEditing({ ...editing, back: e.target.value }) }),
                    h("div", { className: "fd-rowbtns" },
                      h("button", {
                        className: "btn small primary",
                        onClick: () => {
                          const patch = { front: editing.front, back: editing.back };
                          // A structural edit invalidates fixed hidden-line indexes.
                          if (card.hideLines && editing.back.split("\n").length !== card.back.split("\n").length) patch.hideLines = null;
                          onUpdateCard(card.id, patch);
                          setEditing(null);
                        },
                      }, "Save"),
                      h("button", { className: "btn small", onClick: () => setEditing(null) }, "Cancel")))
                : h(Frag, null,
                    h("div", { className: "fd-cardrow-main" },
                      h("div", { className: "fd-cardrow-front" }, card.front),
                      card.type === "code"
                        ? h(CodeBlock, { code: card.back, lang: card.lang, small: true, hotLines: new Set(card.hideLines || []) })
                        : h("div", { className: "fd-cardrow-back" }, card.back)),
                    h("div", { className: "fd-cardrow-side" },
                      h("span", {
                        className: "fd-box b" + (card.box || 0),
                        title: `box ${card.box || 0} of 4 · seen ${card.seen || 0}× · missed in ${card.lapses || 0} session${(card.lapses || 0) === 1 ? "" : "s"}`,
                      }, BOX_LABELS[card.box || 0], card.lapses > 0 ? ` · ${card.lapses}✕` : ""),
                      h("div", { className: "fd-rowbtns" },
                        card.type === "code" && !card.hideLines && h("button", {
                          className: "btn small", title: "Add one fill-in-the-blank card per line/group (keeps this card)",
                          onClick: () => onExplodeCard(card.id),
                        }, "→ blanks"),
                        h("button", { className: "btn small", onClick: () => setEditing({ id: card.id, front: card.front, back: card.back }) }, "Edit"),
                        h("button", { className: "btn small danger-ghost", onClick: () => onDeleteCard(card.id) }, "✕"))))))))
  );
}

/* ---------- Import modal ---------- */
function ImportModal({ deckName, onAdd, onClose, initialText }) {
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [text, setText] = useState(initialText || "");
  const [explode, setExplode] = useState(true);
  const fileRef = useRef(null);

  const parse = (input) => {
    setError(null);
    const cards = parseAnything(input !== undefined ? input : text);
    if (cards.length === 0) {
      setError("Nothing parseable found. Use markdown headers with ``` code fences, a code file with def/function blocks, JSON [{\"front\",\"back\"}], CSV, Q:/A: blocks, or one card per line (front :: back, term — definition, {{cloze}}).");
      return;
    }
    setParsed(cards);
  };

  useEffect(() => { if (initialText) parse(initialText); }, []); // eslint-disable-line

  const readFile = (file) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result)); parse(String(reader.result)); };
    reader.onerror = () => setError("Could not read the file");
    reader.readAsText(file);
  };

  const exploded = useMemo(() => (parsed ? explodeCards(parsed) : []), [parsed]);
  const addCount = parsed ? (explode ? exploded.length : parsed.length) : 0;

  return h("div", { className: "fd-overlay", onClick: onClose },
    h("div", { className: "fd-modal", onClick: (e) => e.stopPropagation() },
      h("div", { className: "fd-modal-head" },
        h("h2", null, "Import into “", deckName, "”"),
        h("button", { className: "fd-x", onClick: onClose }, "✕")),
      parsed
        ? h("div", { className: "fd-tabbody" },
            h("p", null, h("strong", null, parsed.length), " card", parsed.length === 1 ? "" : "s", " ready. Remove any you don’t want, then add."),
            h("div", { className: "fd-previewlist" },
              parsed.map((card, i) => h("div", { key: i, className: "fd-previewrow" },
                h("div", { style: { minWidth: 0 } },
                  h("strong", null, card.front),
                  card.type === "code"
                    ? h(CodeBlock, { code: card.back, lang: card.lang, small: true })
                    : h("div", { className: "dim" }, card.back)),
                h("button", { className: "fd-x", onClick: () => setParsed((cards) => cards.filter((_, j) => j !== i)) }, "✕")))),
            h("label", { className: "fd-codetoggle", style: { margin: "12px 0 0" } },
              h("input", { type: "checkbox", checked: explode, onChange: (e) => setExplode(e.target.checked) }),
              " Explode each code block into one fill-in-the-blank card per line"),
            h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
              h("button", { className: "btn primary", disabled: parsed.length === 0, onClick: () => onAdd(explode ? exploded : parsed) },
                "Add ", addCount, " card", addCount === 1 ? "" : "s"),
              h("button", { className: "btn", onClick: () => setParsed(null) }, "Back")))
        : h(Frag, null,
            h("div", { className: "fd-tabbody" },
              h("p", null, "Paste or upload your notes — parsed locally, no card limit. Understands:"),
              h("ul", { className: "fd-parselist" },
                h("li", null, h("strong", null, "Markdown"), " — each ", h("span", { className: "mono" }, "```code fence```"),
                  " becomes one code card, fronted by its header or the line above it; short header + definition sections become text cards"),
                h("li", null, h("strong", null, "Code files"), " — each top-level ", h("span", { className: "mono" }, "def"), " / ",
                  h("span", { className: "mono" }, "class"), " / ", h("span", { className: "mono" }, "function"),
                  " becomes a card, titled by its comment banner"),
                h("li", null, h("strong", null, "JSON"), " — ", h("span", { className: "mono" }, '[{"front": "...", "back": "..."}]'),
                  " (ask any LLM to emit this) or a Jupyter ", h("span", { className: "mono" }, ".ipynb")),
                h("li", null, h("strong", null, "Lines"), " — ", h("span", { className: "mono" }, "front :: back"), ", ",
                  h("span", { className: "mono" }, "front | back"), ", tab or CSV, ", h("span", { className: "mono" }, "term — definition"),
                  ", Q:/A: blocks, ", h("span", { className: "mono" }, "cloze {{hidden}}"))),
              h("input", {
                ref: fileRef, type: "file",
                accept: ".md,.markdown,.txt,.py,.js,.ts,.jsx,.tsx,.cpp,.cc,.h,.json,.ipynb,.csv,.tsv,text/*,application/json",
                style: { display: "none" },
                onChange: (e) => { readFile(e.target.files?.[0]); e.target.value = ""; },
              }),
              h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
                h("button", { className: "btn", onClick: () => fileRef.current?.click() }, "Upload .md / .py / .ipynb / .csv…")),
              h("textarea", {
                rows: 8, value: text,
                onChange: (e) => setText(e.target.value),
                placeholder: "## Softmax (stable)\n```python\ndef softmax(x):\n  z = x - x.max(-1, keepdims=True)\n  ...\n```\n\nKV cache stores {{keys and values}} per layer\nGQA :: K/V shared across query groups",
              }),
              h("button", { className: "btn primary", disabled: !text.trim(), onClick: () => parse() }, "Parse cards")),
            error && h("div", { className: "fd-error" }, error))));
}

/* ---------- Start-review modal ---------- */
function StartModal({ decks, buildCount, onStart, onClose }) {
  const [mode, setMode] = useState("type");
  const [shuffle, setShuffle] = useState(true);
  const [scope, setScope] = useState("all");
  const [recall, setRecall] = useState("auto");
  const counts = { all: buildCount("all"), due: buildCount("due"), hardest: buildCount("hardest") };
  const hasCode = decks.some((d) => d.cards.some((c) => c.type === "code"));
  return h("div", { className: "fd-overlay", onClick: onClose },
    h("div", { className: "fd-modal", onClick: (e) => e.stopPropagation() },
      h("div", { className: "fd-modal-head" },
        h("h2", null, "Start a review"),
        h("button", { className: "fd-x", onClick: onClose }, "✕")),
      h("p", { className: "dim", style: { margin: "0 0 14px" } }, decks.map((d) => d.name).join(" + ")),
      h("div", { className: "fd-scopes" },
        [
          { k: "all", label: "All cards", desc: "full pass" },
          { k: "due", label: "Due now", desc: "spaced repetition" },
          { k: "hardest", label: "Hardest", desc: "most-missed 20" },
        ].map((s) => h("button", {
          key: s.k, className: "fd-scope" + (scope === s.k ? " on" : ""), disabled: counts[s.k] === 0, onClick: () => setScope(s.k),
        },
          h("strong", null, s.label),
          h("span", null, counts[s.k], " card", counts[s.k] === 1 ? "" : "s", " · ", s.desc)))),
      h("div", { className: "fd-modes" },
        h("button", { className: "fd-mode" + (mode === "type" ? " on" : ""), onClick: () => setMode("type") },
          h("strong", null, "Type the answer"),
          h("span", null, "Full recall — typos tolerated, code gets an editor.")),
        h("button", { className: "fd-mode" + (mode === "flip" ? " on" : ""), onClick: () => setMode("flip") },
          h("strong", null, "Flip & self-grade"),
          h("span", null, "Flip the card, then mark got it / missed it."))),
      hasCode && h("div", { className: "fd-recall" },
        h("label", { className: "fd-recall-label" }, "Code cards — how much to hide"),
        h("div", { className: "fd-recall-opts" },
          [
            { k: "auto", label: "Auto", desc: "scales with mastery" },
            { k: "light", label: "Light", desc: "~40% of lines" },
            { k: "heavy", label: "Heavy", desc: "~70% of lines" },
            { k: "full", label: "Full", desc: "type it all" },
          ].map((r) => h("button", { key: r.k, className: "fd-scope" + (recall === r.k ? " on" : ""), onClick: () => setRecall(r.k) },
            h("strong", null, r.label),
            h("span", null, r.desc)))),
        h("p", { className: "fd-hint", style: { margin: "6px 0 0" } },
          "Hidden lines change every session. On Auto, cards you know well hide more — until it's the full definition. Full always asks for the whole thing.")),
      h("label", { className: "fd-shuffle" },
        h("input", { type: "checkbox", checked: shuffle, onChange: (e) => setShuffle(e.target.checked) }),
        " Shuffle cards"),
      h("button", { className: "btn primary big", disabled: counts[scope] === 0, onClick: () => onStart(mode, shuffle, scope, recall) },
        "Begin (", counts[scope], ") →"),
      h("p", { className: "fd-hint", style: { marginTop: 10 } },
        "Miss a card → wrong pile. One correct → review pile. A second correct retires it. Exit any time — progress is saved.")));
}

/* ---------- Review room ---------- */
const PILES = [
  { key: "new", label: "Unseen", color: "#7A8478" },
  { key: "wrong", label: "Wrong", color: "#C4504E" },
  { key: "mid", label: "Review", color: "#C08A2D" },
  { key: "done", label: "Correct", color: "#3E7C4F" },
];

function pileCounts(session) {
  const counts = { new: 0, wrong: 0, mid: 0, done: 0 };
  Object.values(session.states).forEach((s) => counts[s]++);
  return counts;
}

function ReviewRoom({ session, onAnswer, onRestart, onExit }) {
  const currentId = session.queue[0];
  const card = session.cards.find((c) => c.id === currentId);
  const cardState = card ? session.states[card.id] : null;
  const counts = pileCounts(session);
  const total = session.cards.length;
  const isCode = card?.type === "code";
  const [flipped, setFlipped] = useState(false);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState(null);
  const inputRef = useRef(null);
  const autoAdvance = useRef(null);
  const checkedCard = useRef(null);

  useEffect(() => {
    setFlipped(false);
    setTyped("");
    setVerdict(null);
    clearTimeout(autoAdvance.current);
    if (session.mode === "type" && !isCode) setTimeout(() => inputRef.current?.focus(), 60);
  }, [currentId, session.mode, isCode]);
  useEffect(() => () => clearTimeout(autoAdvance.current), []);

  const answer = (correct) => {
    clearTimeout(autoAdvance.current);
    onAnswer(correct);
  };

  const check = () => {
    if (!typed.trim() || verdict || !card) return;
    const expected = card.expectedLines && card.expectedLines.length
      ? card.expectedLines
      : card.back.split("\n").filter((l) => l.trim());
    const result = isCode ? gradeCodeLines(typed, expected) : gradeText(typed, card.back);
    setVerdict(result);
    setFlipped(true);
    checkedCard.current = currentId;
    if (result.verdict === "exact" && !isCode) {
      autoAdvance.current = setTimeout(() => { if (checkedCard.current === currentId) answer(true); }, 700);
    } else if (result.verdict === "typo" && !isCode) {
      autoAdvance.current = setTimeout(() => { if (checkedCard.current === currentId) answer(true); }, 1200);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && session.mode === "type" && !isCode && !verdict) check();
        return;
      }
      if (session.mode === "flip") {
        if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
        if (!flipped && e.key === "Enter") { e.preventDefault(); setFlipped(true); }
        if (flipped && (e.key === "1" || e.key === "ArrowLeft")) answer(false);
        if (flipped && (e.key === "2" || e.key === "ArrowRight")) answer(true);
      } else if (verdict) {
        if (verdict.verdict === "wrong" && (e.key === "Enter" || e.key === "ArrowRight")) answer(false);
        if (isCode && verdict.verdict !== "wrong" && e.key === "Enter") answer(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) return null;
  const pct = (key) => (counts[key] / total) * 100;
  const fullLineCount = card.back.split("\n").filter((l) => l.trim()).length;

  return h("div", { className: "fd-room" },
    h("div", { className: "fd-room-top" },
      h("button", { className: "fd-back", onClick: onExit, title: "Progress is saved" }, "← Save & exit"),
      h("div", { className: "fd-room-count mono" }, counts.done, "/", total, " retired"),
      h("button", { className: "btn small", onClick: onRestart }, "Restart")),
    h("div", { className: "fd-progress", role: "img", "aria-label": "pile progress" },
      PILES.map((p) => counts[p.key] > 0 && h("div", { key: p.key, style: { width: pct(p.key) + "%", background: p.color } }))),
    h("div", { className: "fd-piles" },
      PILES.map((p) => h("div", { key: p.key, className: "fd-pile" + (cardState === p.key ? " here" : "") },
        h("div", { className: "fd-pile-stack", style: { "--pc": p.color } }, h("span", { className: "mono" }, counts[p.key])),
        h("label", null, p.label)))),
    h("div", { className: "fd-cardstage" },
      h("div", {
        key: currentId,
        className: "fd-flip fd-enter" + (flipped ? " flipped" : "") + (isCode ? " tall" : ""),
        onClick: () => session.mode === "flip" && setFlipped((f) => !f),
        role: "button", tabIndex: 0,
      },
        h("div", { className: "fd-face fd-front" },
          h("div", { className: "fd-face-tag" },
            card.deckName,
            cardState === "wrong" ? " · from wrong pile" : cardState === "mid" ? " · review pile" : "",
            isCode
              ? (card.blanks && card.blanks.length < fullLineCount
                  ? ` · ${card.blanks.length} hidden line${card.blanks.length === 1 ? "" : "s"}`
                  : " · full recall")
              : ""),
          isCode
            ? h(Frag, null,
                h("div", { className: "fd-face-text codeprompt" }, card.front),
                h("div", { className: "fd-face-codewrap" },
                  h(CodeWithBlanks, { code: card.back, lang: card.lang, blanks: card.blanks || [] })))
            : h("div", { className: "fd-face-text" }, card.front),
          session.mode === "flip" && h("div", { className: "fd-face-hint" }, "tap or press space to flip")),
        h("div", { className: "fd-face fd-backface" },
          h("div", { className: "fd-face-tag" }, "answer", isCode && card.blanks?.length ? " · hidden lines highlighted" : ""),
          isCode
            ? h("div", { className: "fd-face-codewrap" },
                h(CodeBlock, { code: card.back, lang: card.lang, hotLines: new Set(card.blanks || []) }))
            : h("div", { className: "fd-face-text" }, card.back)))),
    session.mode === "flip"
      ? h("div", { className: "fd-controls" },
          flipped
            ? h("div", { className: "fd-grade" },
                h("button", { className: "btn big wrongbtn", onClick: () => answer(false) }, "✕ Missed it ", h("kbd", null, "1")),
                h("button", { className: "btn big rightbtn", onClick: () => answer(true) }, "✓ Got it ", h("kbd", null, "2")))
            : h("button", { className: "btn primary big", onClick: () => setFlipped(true) }, "Flip card"))
      : h("div", { className: "fd-controls" },
          verdict
            ? isCode
              ? h("div", { className: "fd-verdict-wrap wide" },
                  h("div", { className: "fd-verdict " + (verdict.verdict === "exact" ? "ok" : verdict.verdict === "typo" ? "typo" : "bad") },
                    verdict.verdict === "exact"
                      ? `✓ All ${verdict.total} line${verdict.total === 1 ? "" : "s"}`
                      : verdict.verdict === "typo"
                        ? `✓ ${verdict.okCount}/${verdict.total} — accepted with minor typos`
                        : `✕ ${verdict.okCount}/${verdict.total} lines`),
                  verdict.verdict !== "exact" && h("div", { className: "fd-fillrows" },
                    verdict.rows.map((row, i) => h("div", { key: i, className: "fd-fillrow" + (row.ok ? " ok" : " bad") },
                      h("span", { className: "fd-fillnum mono" }, i + 1),
                      h("div", { className: "fd-fillbody" },
                        h("code", { className: "mono exp" }, row.exp.trim()),
                        !row.ok && h("code", { className: "mono got" }, row.typed ? "you: " + row.typed : "— missing —")),
                      h("span", { className: "fd-fillmark" }, row.ok ? "✓" : "✕"))),
                    verdict.extra.length > 0 && h("div", { className: "fd-fillrow bad" },
                      h("span", { className: "fd-fillnum mono" }, "+"),
                      h("div", { className: "fd-fillbody" }, h("code", { className: "mono got" }, "extra: ", verdict.extra.join(" ⏎ "))),
                      h("span", { className: "fd-fillmark" }, "✕"))),
                  h("div", { className: "fd-grade" },
                    verdict.verdict === "wrong"
                      ? h(Frag, null,
                          h("button", { className: "btn big wrongbtn", onClick: () => answer(false) }, "Continue → wrong pile ", h("kbd", null, "↵")),
                          h("button", { className: "btn big", onClick: () => answer(true) }, "Count it correct"))
                      : h(Frag, null,
                          h("button", { className: "btn big rightbtn", onClick: () => answer(true) }, "✓ Continue ", h("kbd", null, "↵")),
                          h("button", { className: "btn big wrongbtn", onClick: () => answer(false) }, "Actually, missed it"))))
              : verdict.verdict === "exact"
                ? h("div", { className: "fd-verdict ok" }, "✓ Correct")
                : verdict.verdict === "typo"
                  ? h("div", { className: "fd-verdict typo" }, "✓ Close enough — “", typed.trim(), "” accepted as a typo")
                  : h("div", { className: "fd-verdict-wrap" },
                      h("div", { className: "fd-verdict bad" }, "✕ You typed “", typed.trim(), "”"),
                      h("div", { className: "fd-grade" },
                        h("button", { className: "btn big wrongbtn", onClick: () => answer(false) }, "Continue → wrong pile ", h("kbd", null, "↵")),
                        h("button", { className: "btn big", onClick: () => answer(true) }, "I was actually right")))
            : isCode
              ? h("div", { className: "fd-typecode" },
                  h("div", { className: "fd-typehint" },
                    card.expectedLines && card.expectedLines.length < fullLineCount
                      ? h(Frag, null, "Type the ", h("strong", null, card.expectedLines.length, " hidden line", card.expectedLines.length === 1 ? "" : "s"),
                          ", in order — one per line. Indentation doesn't matter.")
                      : h(Frag, null, "Type the ", h("strong", null, "full definition"), ", one line per line. Indentation doesn't matter.")),
                  h(CodePad, { value: typed, onChange: setTyped, onSubmit: check, placeholder: "Hidden lines, in order…  (Tab indents · ⌘/Ctrl+Enter checks)" }),
                  h("button", { className: "btn primary", disabled: !typed.trim(), onClick: check }, "Check ", h("kbd", null, "⌘↵")))
              : h("div", { className: "fd-typerow" },
                  h("input", { ref: inputRef, className: "mono", value: typed, placeholder: "Type the answer…", onChange: (e) => setTyped(e.target.value) }),
                  h("button", { className: "btn primary", disabled: !typed.trim(), onClick: check }, "Check"))));
}

/* ---------- Session summary ---------- */
function Summary({ session, onRestart, onDone }) {
  const accuracy = session.attempts ? Math.round((session.correctCount / session.attempts) * 100) : 100;
  const struggled = Object.keys(session.wrongEver).length;
  const firstTry = session.cards.length - struggled;
  const color = accuracy >= 90 ? "#3E7C4F" : accuracy >= 70 ? "#C08A2D" : "#C4504E";
  const missed = session.cards.filter((c) => session.wrongEver[c.id]);
  return h("div", { className: "fd-summary" },
    h("div", { className: "fd-summary-card" },
      h("div", { className: "fd-summary-stamp", style: { borderColor: color, color } }, accuracy, "%"),
      h("h1", null,
        accuracy === 100 ? "Clean run." : accuracy >= 90 ? "Nearly flawless." : accuracy >= 70 ? "Solid session." : "Tough deck — it happens."),
      h("p", { className: "dim" }, "Every card made it to the correct pile."),
      h("div", { className: "fd-summary-stats" },
        h("div", null, h("span", { className: "mono big" }, session.cards.length), h("label", null, "cards retired")),
        h("div", null, h("span", { className: "mono big" }, firstTry), h("label", null, "first try")),
        h("div", null, h("span", { className: "mono big" }, struggled), h("label", null, "struggled")),
        h("div", null, h("span", { className: "mono big" }, fmtDuration(session.elapsed)), h("label", null, "time on deck"))),
      missed.length > 0 && h("div", { className: "fd-missed" },
        h("label", null, "Worth another look"),
        missed.slice(0, 6).map((c) => h("span", { key: c.id }, c.front)),
        missed.length > 6 && h("span", { className: "dim" }, "+", missed.length - 6, " more")),
      h("div", { style: { display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" } },
        h("button", { className: "btn primary big", onClick: onRestart }, "Run it again"),
        h("button", { className: "btn big", onClick: onDone }, "Back to card box")),
      h("p", { className: "fd-hint", style: { marginTop: 14 } },
        "Cards you aced moved up a box (longer until next due). Missed cards reset to tomorrow.")));
}

/* ---------- Settings modal ---------- */
function SettingsModal({ user, state, onImportBackup, onClose }) {
  const fileRef = useRef(null);
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ state, exportedAt: Date.now() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flashdesk-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const restored = data.state || data;
        if (!restored.decks) throw new Error("bad file");
        onImportBackup(restored);
        onClose();
      } catch {
        alert("That doesn't look like a FlashDesk backup.");
      }
    };
    reader.readAsText(file);
  };
  return h("div", { className: "fd-overlay", onClick: onClose },
    h("div", { className: "fd-modal", onClick: (e) => e.stopPropagation() },
      h("div", { className: "fd-modal-head" },
        h("h2", null, "Settings"),
        h("button", { className: "fd-x", onClick: onClose }, "✕")),
      h("div", { className: "fd-setting" },
        h("label", { className: "fd-recall-label" }, "Cross-device sync"),
        hasFirebaseConfig()
          ? user
            ? h("div", { className: "fd-settingrow" },
                h("span", null, "Signed in as ", h("strong", null, user.email || user.displayName), " — decks and in-progress sessions sync automatically."),
                h("button", { className: "btn small", onClick: () => sync.signOut() }, "Sign out"))
            : h("div", { className: "fd-settingrow" },
                h("span", null, "Sign in once on each device — after that it just stays synced. No codes."),
                h("button", { className: "btn small primary", onClick: () => sync.signIn() }, "Sign in with Google"))
          : h("p", { className: "dim", style: { margin: 0 } },
              "Running in local-only mode. To sync across devices, paste your Firebase config into ",
              h("span", { className: "mono" }, "index.html"), " — see the README for the 5-minute setup.")),
      h("div", { className: "fd-setting" },
        h("label", { className: "fd-recall-label" }, "Backup"),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h("button", { className: "btn small", onClick: exportJSON }, "Export JSON"),
          h("input", {
            ref: fileRef, type: "file", accept: "application/json", style: { display: "none" },
            onChange: (e) => { importJSON(e.target.files?.[0]); e.target.value = ""; },
          }),
          h("button", { className: "btn small", onClick: () => fileRef.current?.click() }, "Restore from JSON")))));
}

/* ============================================================
   App
   ============================================================ */
function App() {
  const [state, setState] = useState(null);
  const [route, setRoute] = useState({ name: "library" });
  const [session, setSession] = useState(null);
  const [savedSession, setSavedSession] = useState(null);
  const [selected, setSelected] = useState([]);
  const [importFor, setImportFor] = useState(null); // { deckId, text? }
  const [startFor, setStartFor] = useState(null);   // { deckIds }
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState(hasFirebaseConfig() ? "off" : "none");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    const raw = loadJSON(STATE_KEY);
    setState(raw ? normalizeState(raw) : sampleState());
    const sess = loadJSON(SESSION_KEY);
    if (sess && sess.queue && sess.queue.length > 0) setSavedSession(sess);
  }, []);

  useEffect(() => {
    if (!firebaseReady()) return;
    try { if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG); } catch {}
    sync.onStatus = (s) => setSyncStatus(s);
    sync.onRemote = () => {
      const raw = loadJSON(STATE_KEY);
      if (raw) setState(normalizeState(raw));
      const sess = loadJSON(SESSION_KEY);
      setSavedSession(sess && sess.queue && sess.queue.length > 0 ? sess : null);
      setToast("Synced from another device");
      setTimeout(() => setToast((t) => (t === "Synced from another device" ? null : t)), 2600);
    };
    const unsub = firebase.auth().onAuthStateChanged((u) => {
      setUser(u);
      if (u) { setSyncStatus("synced"); sync.start(u); setSettingsOpen(false); }
      else { sync.stop(); setSyncStatus("off"); }
    });
    return () => { unsub(); sync.stop(); };
  }, []);

  const save = useCallback((next) => {
    setState(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveJSON(STATE_KEY, next), 350);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const createDeck = (name) => {
    const id = uid();
    const deck = { id, name: name || "Untitled deck", createdAt: Date.now(), cards: [], reviews: [] };
    save({ decks: { ...state.decks, [id]: deck }, order: [id, ...state.order] });
    setRoute({ name: "deck", id });
  };

  const renameDeck = (id, name) => save({
    ...state,
    decks: { ...state.decks, [id]: { ...state.decks[id], name } },
  });

  const deleteDeck = (id) => {
    const decks = { ...state.decks };
    delete decks[id];
    save({ decks, order: state.order.filter((x) => x !== id) });
    setSelected((sel) => sel.filter((x) => x !== id));
    setRoute({ name: "library" });
  };

  const addCards = (deckId, cards) => {
    const deck = state.decks[deckId];
    const withIds = cards.map((c) => normalizeCard({ id: uid(), ...c }));
    save({
      ...state,
      decks: { ...state.decks, [deckId]: { ...deck, cards: [...deck.cards, ...withIds] } },
    });
    showToast(`Added ${withIds.length} card${withIds.length === 1 ? "" : "s"} to ${deck.name}`);
  };

  const updateCard = (deckId, cardId, patch) => {
    const deck = state.decks[deckId];
    save({
      ...state,
      decks: {
        ...state.decks,
        [deckId]: { ...deck, cards: deck.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) },
      },
    });
  };

  const deleteCard = (deckId, cardId) => {
    const deck = state.decks[deckId];
    save({
      ...state,
      decks: { ...state.decks, [deckId]: { ...deck, cards: deck.cards.filter((c) => c.id !== cardId) } },
    });
  };

  const explodeExistingCard = (deckId, cardId) => {
    const deck = state.decks[deckId];
    const card = deck.cards.find((c) => c.id === cardId);
    if (!card || card.type !== "code") return;
    const pieces = explodeCards([card]);
    if (pieces.length === 1 && pieces[0] === card) {
      showToast("Nothing to explode — no hideable lines");
      return;
    }
    const newCards = pieces.map((p) => normalizeCard({ id: uid(), ...p }));
    const idx = deck.cards.findIndex((c) => c.id === cardId);
    const cards = [...deck.cards.slice(0, idx + 1), ...newCards, ...deck.cards.slice(idx + 1)];
    save({ ...state, decks: { ...state.decks, [deckId]: { ...deck, cards } } });
    showToast(`Added ${newCards.length} fill-in-the-blank card${newCards.length === 1 ? "" : "s"}`);
  };

  const buildPool = (deckIds, scope) => {
    const pool = [];
    deckIds.forEach((id) => {
      const deck = state.decks[id];
      if (deck) deck.cards.forEach((c) => pool.push({ ...c, deckId: id, deckName: deck.name }));
    });
    if (scope === "due") return pool.filter(isDue);
    if (scope === "hardest") {
      return pool.filter((c) => c.seen > 0).sort((a, b) => b.lapses - a.lapses || a.box - b.box).slice(0, 20);
    }
    return pool;
  };

  const startSession = (deckIds, mode, doShuffle, scope, recall = "auto") => {
    const pool = buildPool(deckIds, scope);
    if (pool.length === 0) return showToast(scope === "due" ? "Nothing due right now — nice." : "No cards to study");
    let cards = doShuffle ? shuffleArray(pool) : pool;
    cards = cards.map((card) => {
      if (card.type !== "code") return card;
      const lines = card.back.split("\n");
      const fixed = Array.isArray(card.hideLines) && card.hideLines.length
        ? card.hideLines.filter((i) => lines[i] != null && String(lines[i]).trim())
        : null;
      // Fixed per-card hidden lines win, except on Full recall — that always asks for everything.
      const blanks = fixed && fixed.length && recall !== "full"
        ? fixed
        : pickBlankLines(card.back, recallFraction(recall, card.box || 0));
      return { ...card, blanks, expectedLines: blanks.map((i) => lines[i]) };
    });
    const states = {};
    cards.forEach((c) => { states[c.id] = "new"; });
    const sess = {
      deckIds, mode, shuffle: doShuffle, scope, codeRecall: recall,
      cards, queue: cards.map((c) => c.id), states,
      wrongEver: {}, attempts: 0, correctCount: 0,
      startedAt: Date.now(), elapsed: 0, finished: false,
    };
    setSession(sess);
    setSavedSession(null);
    saveJSON(SESSION_KEY, sess);
    setStartFor(null);
    setRoute({ name: "review" });
  };

  const resumeSession = () => {
    if (!savedSession) return;
    const sess = { ...savedSession, startedAt: Date.now() - (savedSession.elapsed || 0), finished: false };
    setSession(sess);
    setSavedSession(null);
    setRoute({ name: "review" });
  };

  const discardSession = () => {
    setSavedSession(null);
    removeJSON(SESSION_KEY);
  };

  const finishSession = (sess) => {
    const accuracy = sess.attempts ? Math.round((sess.correctCount / sess.attempts) * 100) : 100;
    const review = { ts: Date.now(), accuracy, durationMs: sess.elapsed, attempts: sess.attempts, cards: sess.cards.length };
    const decks = { ...state.decks };
    const byDeck = {};
    sess.cards.forEach((c) => { (byDeck[c.deckId] = byDeck[c.deckId] || {})[c.id] = c; });
    sess.deckIds.forEach((deckId) => {
      if (!decks[deckId]) return;
      const inSession = byDeck[deckId] || {};
      const cards = decks[deckId].cards.map((card) => {
        if (!inSession[card.id]) return card;
        const missed = !!sess.wrongEver[card.id];
        const box = missed ? 1 : Math.min((card.box || 0) + 1, 4);
        return {
          ...card,
          seen: (card.seen || 0) + 1,
          lapses: (card.lapses || 0) + (missed ? 1 : 0),
          box,
          dueAt: Date.now() + BOX_INTERVALS[box],
        };
      });
      decks[deckId] = { ...decks[deckId], cards, reviews: [...decks[deckId].reviews, review] };
    });
    save({ ...state, decks });
    removeJSON(SESSION_KEY);
    setRoute({ name: "summary" });
  };

  const answerCard = (correct) => {
    setSession((sess) => {
      if (!sess || sess.finished || sess.queue.length === 0) return sess;
      const cardId = sess.queue[0];
      const prev = sess.states[cardId];
      const nextState = correct ? (prev === "wrong" ? "mid" : "done") : "wrong";
      const queue = sess.queue.slice(1);
      if (nextState !== "done") queue.push(cardId);
      const next = {
        ...sess,
        states: { ...sess.states, [cardId]: nextState },
        wrongEver: correct ? sess.wrongEver : { ...sess.wrongEver, [cardId]: true },
        queue,
        attempts: sess.attempts + 1,
        correctCount: sess.correctCount + (correct ? 1 : 0),
        elapsed: Date.now() - sess.startedAt,
      };
      if (queue.length === 0) {
        next.finished = true;
        setTimeout(() => finishSession(next), 0);
      } else {
        saveJSON(SESSION_KEY, next);
      }
      return next;
    });
  };

  const exitReview = () => {
    if (session && !session.finished) {
      const sess = { ...session, elapsed: Date.now() - session.startedAt };
      saveJSON(SESSION_KEY, sess);
      setSavedSession(sess);
      showToast("Session saved — resume any time");
    }
    setSession(null);
    setRoute({ name: "library" });
  };

  const restartSession = () => {
    if (session) startSession(session.deckIds, session.mode, session.shuffle, session.scope, session.codeRecall || "auto");
  };

  if (!state) {
    return h("div", {
      style: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#EEF1EA", fontFamily: "system-ui", color: "#22372B" },
    }, "Opening your card box…");
  }

  const streak = streakDays(state.decks);

  return h("div", { className: "fd-root" },
    h("header", { className: "fd-top" },
      h("button", { className: "fd-wordmark", onClick: () => setRoute({ name: "library" }) },
        h("span", { className: "fd-mark" }), " FlashDesk"),
      h("div", { style: { display: "flex", gap: 10, alignItems: "center" } },
        streak > 0 && route.name !== "review" && h("div", { className: "fd-chip", title: "days studied in a row" },
          "🔥 ", streak, " day", streak === 1 ? "" : "s"),
        route.name === "review" && session && h(SessionTimer, { session, setSession }),
        h("button", { className: "fd-chip fd-chipbtn", onClick: () => setSettingsOpen(true), title: "Settings & sync" },
          user
            ? h(Frag, null, "● ", user.displayName ? user.displayName.split(" ")[0] : "synced")
            : syncStatus === "none" ? "⚙ Local only" : "⚙ Sign in to sync"))),
    h("main", { className: "fd-main" },
      route.name === "library" && h(Library, {
        state, selected, setSelected, savedSession,
        onResume: resumeSession,
        onDiscard: discardSession,
        onOpen: (id) => setRoute({ name: "deck", id }),
        onCreate: createDeck,
        onStudy: (deckIds) => setStartFor({ deckIds }),
      }),
      route.name === "deck" && state.decks[route.id] && h(DeckView, {
        deck: state.decks[route.id],
        onBack: () => setRoute({ name: "library" }),
        onRename: (name) => renameDeck(route.id, name),
        onDelete: () => deleteDeck(route.id),
        onAddCards: (cards) => addCards(route.id, cards),
        onUpdateCard: (cardId, patch) => updateCard(route.id, cardId, patch),
        onDeleteCard: (cardId) => deleteCard(route.id, cardId),
        onExplodeCard: (cardId) => explodeExistingCard(route.id, cardId),
        onImport: () => setImportFor({ deckId: route.id }),
        onPasteImport: (text) => setImportFor({ deckId: route.id, text }),
        onStudy: () => setStartFor({ deckIds: [route.id] }),
      }),
      route.name === "review" && session && h(ReviewRoom, {
        session,
        onAnswer: answerCard,
        onRestart: restartSession,
        onExit: exitReview,
      }),
      route.name === "summary" && session && h(Summary, {
        session,
        onRestart: restartSession,
        onDone: () => { setSession(null); setRoute({ name: "library" }); },
      })),
    startFor && h(StartModal, {
      decks: startFor.deckIds.map((id) => state.decks[id]).filter(Boolean),
      buildCount: (scope) => buildPool(startFor.deckIds, scope).length,
      onStart: (mode, doShuffle, scope, recall) => startSession(startFor.deckIds, mode, doShuffle, scope, recall),
      onClose: () => setStartFor(null),
    }),
    importFor && h(ImportModal, {
      deckName: state.decks[importFor.deckId]?.name,
      initialText: importFor.text,
      onAdd: (cards) => { addCards(importFor.deckId, cards); setImportFor(null); },
      onClose: () => setImportFor(null),
    }),
    settingsOpen && h(SettingsModal, {
      user, state,
      onImportBackup: (restored) => { save(normalizeState(restored)); showToast("Backup restored"); },
      onClose: () => setSettingsOpen(false),
    }),
    toast && h("div", { className: "fd-toast" }, toast));
}

/* expose parsers for tests */
if (typeof window !== "undefined") {
  window.__flashdesk = { parseAnything, parseMarkdown, parsePairs, parseCSV, parseJSONCards, parseCodeFile, explodeCards, gradeText, gradeCodeLines, pickBlankLines, clozeCards, normalizeState };
}

if (typeof document !== "undefined" && document.getElementById("root")) {
  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
}

})();
