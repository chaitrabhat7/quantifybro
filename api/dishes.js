// POST /api/dishes   → save a dish (id comes from the app, so retries don't duplicate)
// DELETE /api/dishes?id=…  → delete one
const store = require('./_store');
const { guarded, cleanName, isSection, isPositive } = require('./_auth');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = guarded(async (req, res) => {
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id.' });
    await store().deleteDish(id);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST or DELETE only.' });

  const b = req.body || {};
  const cooked = Number(b.cooked_g);
  const plate = Number(b.plate_g);
  if (!UUID.test(String(b.id || ''))) return res.status(400).json({ error: 'Bad id.' });
  if (!isPositive(cooked) || !isPositive(plate)) return res.status(400).json({ error: 'Weights must be more than 0.' });
  if (plate > cooked) return res.status(400).json({ error: "Plate can't weigh more than the cooked total." });
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 100) return res.status(400).json({ error: 'Add at least one ingredient.' });

  const rows = [];
  for (const r of b.rows) {
    const name = cleanName(r && r.name);
    const raw = Number(r && r.raw_g);
    if (!isSection(r && r.section) || !name || !isPositive(raw)) return res.status(400).json({ error: 'Bad ingredient row.' });
    rows.push({ section: r.section, name, raw_g: raw });
  }
  // Optional: the vessel it was weighed in (cooked_g is always food only).
  const vessel = cleanName(b.vessel) || null;
  // No name + weight 0 = "No vessel" (food weighed alone); neither = an old dish.
  const vesselG = vessel ? Number(b.vessel_g) : (b.vessel_g === 0 ? 0 : null);
  if (vessel && !(Number.isFinite(vesselG) && vesselG >= 0 && vesselG < 1e6)) return res.status(400).json({ error: 'Bad vessel weight.' });

  const created = new Date(b.created_at);
  await store().addDish({
    id: b.id,
    title: cleanName(b.title) || 'Dish',
    created_at: Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
    cooked_g: cooked,
    plate_g: plate,
    rows,
    text: String(b.text || '').slice(0, 5000),
    vessel,
    vessel_g: vesselG,
  });
  res.status(200).json({ ok: true });
});
