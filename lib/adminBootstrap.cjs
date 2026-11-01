// Compte administrateur initial, créé à partir des variables d'environnement.
//
// ADMIN_EMAIL / ADMIN_PASSWORD servent UNIQUEMENT à amorcer le premier compte (table admins vide).
// Ensuite Genni gère ses accès depuis l'espace pro (email, mot de passe, autres administrateurs) :
// réécrire le mot de passe à chaque démarrage annulerait ses changements.
// Secours (mot de passe perdu) : ADMIN_FORCE_RESET=true réinitialise le plus ancien compte admin
// avec ADMIN_EMAIL / ADMIN_PASSWORD puis coupe ses sessions ; retirer la variable ensuite.
//
// Renvoie "skipped" | "created" | "reset" | "kept".
async function ensureAdmin({ query, hashPassword, env, log = console.log }) {
  const email = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(env.ADMIN_PASSWORD || "");
  if (!email || !password) {
    log("[migrate] ADMIN_EMAIL / ADMIN_PASSWORD non configurés — aucun compte admin créé automatiquement.");
    return "skipped";
  }

  const { rows } = await query("SELECT id FROM admins ORDER BY id LIMIT 1");

  if (rows.length === 0) {
    await query("INSERT INTO admins (email, password_hash) VALUES ($1,$2)", [email, await hashPassword(password)]);
    log(`[migrate] Compte admin créé pour ${email}.`);
    return "created";
  }

  if (env.ADMIN_FORCE_RESET === "true") {
    await query("UPDATE admins SET email = $1, password_hash = $2, token_version = token_version + 1 WHERE id = $3", [
      email,
      await hashPassword(password),
      rows[0].id
    ]);
    log(`[migrate] ADMIN_FORCE_RESET : accès admin réinitialisés pour ${email}. Retirez cette variable.`);
    return "reset";
  }

  return "kept";
}

module.exports = { ensureAdmin };
