# QuantifyBro

Chaitra's personal phone web app: pick ingredients + raw grams, pick the vessel,
weigh the cooked dish and your plate → raw grams on your plate, as WhatsApp text.
Live at quantifybro.vercel.app (repo chaitrabhat7/quantifybro, `main`; Vercel
auto-deploys on push). Details: [README.md](README.md).

- Plain HTML/JS in `index.html` (no build), Vercel Node functions in `api/`,
  Neon Postgres via Vercel (`DATABASE_URL`), passphrase in `APP_PIN`.
- Local: `npm run dev` → http://localhost:3100 (PIN 1234, saves to
  `.local-data.json`, git-ignored — delete test data after testing).
- After a change to `index.html`, bump `CACHE` in `sw.js` so phones get it.

## How Chaitra wants work done (her standing rules)

1. **Plan first.** Any code change starts as a plan she approves.
2. **Review every code change with a subagent.** Once the code is changed (and
   tested), spawn a review subagent before pushing. Brief it with:
   - the agreed plan (the plan file) and the diff (`git diff` / `git show HEAD`);
   - check the change does what the plan says, look for real bugs (maths, edge
     cases, offline queue, existing live data, XSS, SQL), and anything that
     feels off for a non-expert who wants it extremely simple;
   - read-only: no edits, commits or network calls;
   - report in **simple plain language**: "What changed", "Plan check"
     (✅/⚠️/❌), "Problems found" (most serious first, file:line, one-line fix,
     guesses marked), "Nice to have" (max 3), under ~500 words.
   Relay its summary to Chaitra in plain words, fix what's real, retest, then push.
3. **Commits are Chaitra's:** no `Co-Authored-By` / "Generated with Claude Code".
4. Cost first: free tiers only; no paid services without asking.
