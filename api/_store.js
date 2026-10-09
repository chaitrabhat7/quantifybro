// Data layer. Neon Postgres when DATABASE_URL is set (Vercel), otherwise a local
// JSON file (.local-data.json) so the app can be tried on the laptop without a DB.
const fs = require('fs');
const path = require('path');

// ---------- Neon ----------
let sqlFn = null;
let ready = null;

function sql() {
  if (!sqlFn) {
    const { neon } = require('@neondatabase/serverless');
    sqlFn = neon(process.env.DATABASE_URL);
  }
  return sqlFn;
}

function setup() {
  if (!ready) {
    const q = sql();
    ready = (async () => {
      await q`CREATE TABLE IF NOT EXISTS dishes (
        id uuid PRIMARY KEY,
        title text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        cooked_g numeric NOT NULL,
        plate_g numeric NOT NULL,
        rows jsonb NOT NULL,
        text text NOT NULL)`;
      await q`CREATE TABLE IF NOT EXISTS custom_ingredients (
        section text NOT NULL,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now())`;
      await q`CREATE UNIQUE INDEX IF NOT EXISTS custom_ingredients_uniq
        ON custom_ingredients (section, lower(name))`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const neonStore = {
  async all() {
    await setup();
    const q = sql();
    const dishes = await q`SELECT id, title, created_at, cooked_g::float AS cooked_g,
      plate_g::float AS plate_g, rows, text FROM dishes ORDER BY created_at DESC LIMIT 200`;
    const custom = await q`SELECT section, name FROM custom_ingredients ORDER BY lower(name)`;
    const usual = await q`SELECT r->>'section' AS section, r->>'name' AS name, count(*)::int AS n
      FROM dishes, jsonb_array_elements(rows) r GROUP BY 1, 2`;
    return { dishes, custom, usual };
  },
  async addDish(d) {
    await setup();
    await sql()`INSERT INTO dishes (id, title, created_at, cooked_g, plate_g, rows, text)
      VALUES (${d.id}, ${d.title}, ${d.created_at}, ${d.cooked_g}, ${d.plate_g},
      ${JSON.stringify(d.rows)}::jsonb, ${d.text}) ON CONFLICT (id) DO NOTHING`;
  },
  async deleteDish(id) {
    await setup();
    await sql()`DELETE FROM dishes WHERE id = ${id}`;
  },
  async addCustom(section, name) {
    await setup();
    await sql()`INSERT INTO custom_ingredients (section, name) VALUES (${section}, ${name})
      ON CONFLICT DO NOTHING`;
  },
  async deleteCustom(section, name) {
    await setup();
    await sql()`DELETE FROM custom_ingredients
      WHERE section = ${section} AND lower(name) = lower(${name})`;
  },
};

// ---------- Local JSON file (laptop only) ----------
const FILE = path.join(__dirname, '..', '.local-data.json');
const load = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { dishes: [], custom: [] }; }
};
const save = (db) => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

const fileStore = {
  async all() {
    const db = load();
    const dishes = [...db.dishes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
    const counts = new Map();
    for (const d of db.dishes) for (const r of d.rows) {
      const k = r.section + '\u0000' + r.name;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const usual = [...counts].map(([k, n]) => {
      const [section, name] = k.split('\u0000');
      return { section, name, n };
    });
    return { dishes, custom: db.custom, usual };
  },
  async addDish(d) {
    const db = load();
    if (!db.dishes.some((x) => x.id === d.id)) db.dishes.push(d);
    save(db);
  },
  async deleteDish(id) {
    const db = load();
    db.dishes = db.dishes.filter((x) => x.id !== id);
    save(db);
  },
  async addCustom(section, name) {
    const db = load();
    if (!db.custom.some((c) => c.section === section && same(c.name, name))) db.custom.push({ section, name });
    save(db);
  },
  async deleteCustom(section, name) {
    const db = load();
    db.custom = db.custom.filter((c) => !(c.section === section && same(c.name, name)));
    save(db);
  },
};

module.exports = () => {
  if (process.env.DATABASE_URL) return neonStore;
  if (process.env.VERCEL) {
    const e = new Error('Database not connected — add Neon in Vercel → Storage.');
    e.expose = true;
    throw e;
  }
  return fileStore;
};
