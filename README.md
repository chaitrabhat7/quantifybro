# QuantifyBro

Weigh the raw ingredients of a dish, weigh the cooked dish, weigh your plate —
QuantifyBro tells you how many grams of each raw ingredient are on your plate,
as a WhatsApp-ready message. Every dish is saved automatically ("The stash").

**Maths:** grams on plate = raw grams × (plate ÷ food weight), where food weight =
weighed total − the vessel you picked (cookers, kadais… with their empty weights,
editable in the app; table `vessels`).

## How it's put together
- `index.html` — the whole app (plain HTML/CSS/JS, no build step). The built-in
  ingredient lists are at the top of its `<script>`.
- `api/` — Vercel serverless functions: `data` (load everything), `dishes`
  (save/delete), `custom` (your own ingredients). Files starting with `_` are helpers.
- Saved in **Neon Postgres** (tables `dishes`, `custom_ingredients`, created
  automatically). "Your usual" is counted from saved dishes.
- Locked with a passphrase: env var `APP_PIN`, asked once per device.
- `sw.js` + `manifest.webmanifest` — installable on the phone, opens offline;
  changes made offline sync when you're back online.

## Run on the laptop
```bash
npm run dev
```
Opens on http://localhost:3100 (PIN `1234` unless `.env.local` sets `APP_PIN`).
Without `DATABASE_URL` it saves to `.local-data.json` instead of the cloud.

## Deploy (Vercel)
1. Import the GitHub repo in Vercel (Framework preset: **Other**, no build command).
2. Storage → Create Database → **Neon** (free) → connect to this project.
   This adds `DATABASE_URL` automatically.
3. Settings → Environment Variables → add `APP_PIN` (your passphrase).
4. Deployments → Redeploy.
5. On the phone: open the site in Chrome → enter PIN → ⋮ → **Add to Home screen**.

Icons: `npm run icons` redraws `icons/*.png`.
