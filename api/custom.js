// POST /api/custom {section, name}          → remember a new ingredient
// DELETE /api/custom?section=…&name=…       → forget it
const store = require('./_store');
const { guarded, cleanName, isSection } = require('./_auth');

module.exports = guarded(async (req, res) => {
  const src = req.method === 'DELETE' ? req.query : req.body || {};
  const section = String(src.section || '');
  const name = cleanName(src.name);
  if (!isSection(section) || !name) return res.status(400).json({ error: 'Bad ingredient.' });

  if (req.method === 'POST') await store().addCustom(section, name);
  else if (req.method === 'DELETE') await store().deleteCustom(section, name);
  else return res.status(405).json({ error: 'POST or DELETE only.' });
  res.status(200).json({ ok: true });
});
