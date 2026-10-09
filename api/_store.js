// Data layer. Neon Postgres when DATABASE_URL is set (Vercel), otherwise a local
// JSON file (.local-data.json) so the app can be tried on the laptop without a DB.
const fs = require('fs');
const path = require('path');

// Vessels added the first time the vessels table is created. After that they're
// ordinary rows: weights can be changed and vessels removed from the app.
const STARTING_VESSELS = [
  ['3l cooker XL', 1614], ['3l cooker', 1350], ['2l cooker', 875], ['Black kadai', 734],
  ['Steel small kadai', 673], ['Big steel kadai', 1923], ['Medium steel kadai', 1564],
  ['Glass bowl big', 596],
];

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
      await q`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS vessel text`;
      await q`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS vessel_g numeric`;
      await q`CREATE TABLE IF NOT EXISTS custom_ingredients (
        section text NOT NULL,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now())`;
      await q`CREATE UNIQUE INDEX IF NOT EXISTS custom_ingredients_uniq
        ON custom_ingredients (section, lower(name))`;
      await q`CREATE TABLE IF NOT EXISTS vessels (
        name text NOT NULL,
        weight_g numeric NOT NULL,
        sort int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now())`;
      await q`CREATE UNIQUE INDEX IF NOT EXISTS vessels_uniq ON vessels (lower(name))`;
      await q`CREATE TABLE IF NOT EXISTS app_flags (key text PRIMARY KEY)`;
      const first = await q`INSERT INTO app_flags (key) VALUES ('vessels_seeded')
        ON CONFLICT DO NOTHING RETURNING key`;
      if (first.length) {
        for (const [i, [name, w]] of STARTING_VESSELS.entries()) {
          await q`INSERT INTO vessels (name, weight_g, sort) VALUES (${name}, ${w}, ${i + 1})
            ON CONFLICT DO NOTHING`;
        }
      }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const neonStore = {
  async all() {
    await setup();
    const q = sql();
    const dishes = await q`SELECT id, title, created_at, cooked_g::float AS cooked_g,
      plate_g::float AS plate_g, rows, text, vessel, vessel_g::float AS vessel_g
      FROM dishes ORDER BY created_at DESC LIMIT 200`;
    const custom = await q`SELECT section, name FROM custom_ingredients ORDER BY lower(name)`;
    const usual = await q`SELECT r->>'section' AS section, r->>'name' AS name, count(*)::int AS n
      FROM dishes, jsonb_array_elements(rows) r GROUP BY 1, 2`;
    const vessels = await q`SELECT name, weight_g::float AS weight_g FROM vessels ORDER BY sort, created_at`;
    return { dishes, custom, usual, vessels };
  },
  async addDish(d) {
    await setup();
    await sql()`INSERT INTO dishes (id, title, created_at, cooked_g, plate_g, rows, text, vessel, vessel_g)
      VALUES (${d.id}, ${d.title}, ${d.created_at}, ${d.cooked_g}, ${d.plate_g},
      ${JSON.stringify(d.rows)}::jsonb, ${d.text}, ${d.vessel}, ${d.vessel_g}) ON CONFLICT (id) DO NOTHING`;
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
  // Same name (any case) → just updates the weight.
  async saveVessel(name, weight) {
    await setup();
    await sql()`INSERT INTO vessels (name, weight_g, sort)
      VALUES (${name}, ${weight}, (SELECT coalesce(max(sort), 0) + 1 FROM vessels))
      ON CONFLICT (lower(name)) DO UPDATE SET weight_g = EXCLUDED.weight_g`;
  },
  async deleteVessel(name) {
    await setup();
    await sql()`DELETE FROM vessels WHERE lower(name) = lower(${name})`;
  },
};

// ---------- Local JSON file (laptop only) ----------
const FILE = path.join(__dirname, '..', '.local-data.json');
const load = () => {
  let db;
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = { dishes: [], custom: [] }; }
  if (!db.vessels) db.vessels = STARTING_VESSELS.map(([name, weight_g]) => ({ name, weight_g }));
  return db;
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
    return { dishes, custom: db.custom, usual, vessels: db.vessels };
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
  async saveVessel(name, weight) {
    const db = load();
    const v = db.vessels.find((x) => same(x.name, name));
    if (v) v.weight_g = weight; else db.vessels.push({ name, weight_g: weight });
    save(db);
  },
  async deleteVessel(name) {
    const db = load();
    db.vessels = db.vessels.filter((x) => !same(x.name, name));
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
