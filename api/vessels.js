// POST /api/vessels {name, weight_g}   → add a vessel, or update its weight
// DELETE /api/vessels?name=…           → remove it
const store = require('./_store');
const { guarded, cleanName } = require('./_auth');

const MAX_VESSEL_G = 20000;

module.exports = guarded(async (req, res) => {
  const src = req.method === 'DELETE' ? req.query : req.body || {};
  const name = cleanName(src.name);
  if (!name) return res.status(400).json({ error: 'Give the vessel a name.' });

  if (req.method === 'DELETE') {
    await store().deleteVessel(name);
  } else if (req.method === 'POST') {
    const w = Number(src.weight_g);
    if (!Number.isFinite(w) || w <= 0 || w > MAX_VESSEL_G) {
      return res.status(400).json({ error: `Vessel weight must be between 1 and ${MAX_VESSEL_G} g.` });
    }
    await store().saveVessel(name, w);
  } else {
    return res.status(405).json({ error: 'POST or DELETE only.' });
  }
  res.status(200).json({ ok: true });
});
