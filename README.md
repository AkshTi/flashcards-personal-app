# FlashDesk — deploy guide

The app is four files, works three ways:

| file | what it is |
|---|---|
| `index.html` | small shell: Firebase config + script/style tags |
| `app.js` | **the app — readable source, edit freely** |
| `app.css` | all styles (light + dark) |
| `vendor-react.min.js` | React 18 runtime (don't edit) |

1. **Local-only** — open `index.html` in any browser. Everything works (including markdown/code import); data lives in that browser's localStorage.
2. **Deployed, local-only** — host the folder anywhere; each device keeps its own data.
3. **Deployed + synced (recommended)** — add a Firebase config and sign in with Google **once per device**. After that, decks, stats, Leitner boxes, and even in-progress review sessions sync automatically across your phone and laptop. No sync codes, ever.

## Firebase setup (~5 minutes, same flow as The Ledger)

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project (Analytics off is fine).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Set the support email.
3. **Build → Firestore Database → Create database** (production mode, any region).
4. Firestore → **Rules** tab → replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /flashdesk/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Publish. (Each user can only touch their own doc.)

5. **Project settings (gear) → Your apps → Web app (</>) → Register.** Copy the `firebaseConfig` object.
6. Open `index.html`, find `window.FIREBASE_CONFIG = { ... }` near the top, and paste your values over the placeholders.

## Deploy to GitHub Pages

Push to `main`. Repo → Settings → Pages → Source: `main` / root. Done.

**Last step:** Firebase console → Authentication → Settings → **Authorized domains** → add your Pages domain (localhost is pre-authorized for testing). Without this, Google sign-in is blocked on the deployed site.

## Import

No API keys — the **Import cards** button on any deck parses locally, no card limit. You can also just **paste onto a deck page** (outside any input) to open the importer pre-filled. Understands:

- **Markdown** — each ` ```code fence``` ` becomes one code card, fronted by its header or the line just above it; short header + one-line-definition sections become text cards; `**term** — definition` bullets become text cards anywhere
- **Code files** — upload a `.py`/`.js`/etc. directly; each top-level `def`/`class`/`function` becomes its own card, titled by its comment banner if present
- **JSON** — `[{"front": "...", "back": "...", "type": "code", "lang": "python"}]` — ask any LLM to emit cards in this shape and paste them straight in; Jupyter `.ipynb` notebooks also work (each code cell becomes a card)
- **CSV / TSV** — `front,back` with an optional header row, quoted fields supported
- **Line pairs** — `front :: back`, `front | back`, tab-separated, `term — definition`
- **Q:/A: blocks** — the answer may span multiple lines (until a blank line)
- **Cloze** — `The KV cache stores {{keys and values}} per layer` → one fill-in-the-blank card per `{{...}}`

Check **"Explode each code block"** during import to turn every code card into one fill-in-the-blank card per line (similar consecutive lines are grouped, signatures/imports/comments are never hidden). Existing code cards have a **→ blanks** button in the deck view that does the same thing after the fact.

## Study modes

- **Type the answer** — text answers tolerate typos (`;` separates accepted alternates on a card's back); code cards give you an editor and are graded line by line, indentation ignored.
- **Flip & self-grade** — space/enter flips, `1`/`2` grade.
- **Code recall depth** — Auto scales how many lines are hidden with how well you know the card (Leitner box); Light ≈ 40%, Heavy ≈ 70%, **Full always asks for the whole definition** (it overrides per-card fixed blanks).
- Scopes: **All**, **Due now** (Leitner: 1/3/7/14-day boxes), **Hardest** (20 most-missed).
- Exit any time — the in-progress session is saved (and synced) for resume.

## Deck files in this repo

`*-deck.md` (PyTorch implementations, PyTorch API commands, parallelism, rooflines, TPU hardware, LLaMA training, FLOP counting) are ready to import: open a deck → Import cards → upload the file. `pytorch-api-deck.md` is built for **Type the answer + Full** — the front describes an operation, you type the exact PyTorch line.

## Sync model (for the curious)

- localStorage is the source of truth for instant UX; every change debounce-pushes the full state to `flashdesk/{uid}` in Firestore with a timestamp + writer id.
- Other devices receive it via a snapshot listener; last-write-wins by timestamp, own writes are ignored.
- On sign-in, newer side wins (remote vs. local), so first sign-in on a fresh phone pulls everything down.
- Settings → Export JSON gives you a full backup any time.

## Hacking on it

`app.js` is plain readable JavaScript (React without JSX — `h(...)` is `React.createElement`). No build step: edit, reload, push. Parsers are pure functions exposed on `window.__flashdesk` for quick console testing.
