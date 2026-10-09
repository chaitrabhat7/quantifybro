// GET /api/data → everything the app needs: saved dishes, your added
// ingredients, and how often you've used each ingredient.
const store = require('./_store');
const { guarded } = require('./_auth');

module.exports = guarded(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only.' });
  const { dishes, custom, usual, vessels } = await store().all();
  const byS = () => ({ veg: [], starch: [], fat: [], extra: [] });
  const customOut = byS();
  for (const c of custom) if (customOut[c.section]) customOut[c.section].push(c.name);
  const usualOut = { veg: {}, starch: {}, fat: {}, extra: {} };
  for (const u of usual) if (usualOut[u.section]) usualOut[u.section][u.name] = u.n;
  res.status(200).json({ dishes, custom: customOut, usual: usualOut, vessels });
});
