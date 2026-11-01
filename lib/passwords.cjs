const bcrypt = require("bcryptjs");

// Comparé quand le compte n'existe pas : la réponse prend le même temps, qu'il existe ou non.
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice", 10);

// `hash` peut être absent (compte inconnu) : on compare quand même, puis on répond non.
async function passwordMatches(hash, password) {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return ok && Boolean(hash);
}

module.exports = { passwordMatches };
