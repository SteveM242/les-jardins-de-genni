const bcrypt = require("bcryptjs");

const MIN_PASSWORD = 8;
// bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence.
const MAX_PASSWORD = 72;
const PASSWORD_RULE = `Le mot de passe doit contenir entre ${MIN_PASSWORD} et ${MAX_PASSWORD} caractères.`;

// Comparé quand le compte n'existe pas : la réponse prend le même temps, qu'il existe ou non.
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice", 10);

// `hash` peut être absent (compte inconnu) : on compare quand même, puis on répond non.
async function passwordMatches(hash, password) {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return ok && Boolean(hash);
}

function validPassword(password) {
  return password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}

module.exports = { passwordMatches, validPassword, PASSWORD_RULE, MIN_PASSWORD, MAX_PASSWORD };
