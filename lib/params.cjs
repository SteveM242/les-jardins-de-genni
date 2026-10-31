// À brancher avec router.param("id", numericId) : un id non numérique répond 404 au lieu de faire échouer SQL.
function numericId(req, res, next, id) {
  if (!/^\d{1,9}$/.test(id)) return res.status(404).json({ ok: false, error: "Introuvable." });
  next();
}

module.exports = { numericId };
