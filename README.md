# FlashDesk — deploy guide

One file (`index.html`), works three ways:

1. **Local-only** — open `index.html` in any browser. Everything works (including markdown/code import); data lives in that browser's localStorage.
2. **Deployed, local-only** — host it anywhere; each device keeps its own data.
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

```bash
# new repo, or a folder in an existing one
git init flashdesk && cd flashdesk
cp /path/to/index.html .
git add . && git commit -m "flashdesk"
git branch -M main
git remote add origin git@github.com:akshti/flashdesk.git
git push -u origin main
```

Repo → Settings → Pages → Source: `main` / root. Your site appears at `https://akshti.github.io/flashdesk/`.

**Last step:** Firebase console → Authentication → Settings → **Authorized domains** → add `akshti.github.io` (localhost is pre-authorized for testing). Without this, Google sign-in is blocked on the deployed site.

## Import

Settings and card creation don't need any API key. The **Import cards** button on any deck parses locally, no card limit:
- **Markdown** — each ` ```code fence``` ` becomes one code card, fronted by its header or the line just above it; short header + one-line-definition sections become text cards
- **Code files** — upload a `.py`/`.js`/etc. directly; each top-level `def`/`class`/`function` becomes its own card, titled by its comment banner if present
- **Line pairs** — `front :: back`, `front | back`, tab-separated, or `Q:`/`A:` pairs, one per line

## Sync model (for the curious)

- localStorage is the source of truth for instant UX; every change debounce-pushes the full state to `flashdesk/{uid}` in Firestore with a timestamp + writer id.
- Other devices receive it via a snapshot listener; last-write-wins by timestamp, own writes are ignored.
- On sign-in, newer side wins (remote vs. local), so first sign-in on a fresh phone pulls everything down.
- Settings → Export JSON gives you a full backup any time.
