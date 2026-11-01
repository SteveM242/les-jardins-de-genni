const MAX_DAYS_AHEAD = 60;

class DesiredDateError extends Error {}

function midnightUtc(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Jour souhaité par le client ("YYYY-MM-DD", facultatif) -> chaîne validée, ou null s'il est vide.
// Accepte de la veille (décalage horaire Martinique/serveur) jusqu'à 60 jours d'avance.
function parseDesiredDate(value, now = new Date()) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new DesiredDateError("Le jour souhaité n'est pas valide.");

  const date = new Date(`${raw}T00:00:00Z`);
  // new Date("2026-02-31") déborde sur mars : on vérifie que la date relue est identique.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new DesiredDateError("Le jour souhaité n'est pas valide.");
  }

  const day = 24 * 60 * 60 * 1000;
  const today = midnightUtc(now);
  if (date.getTime() < today - day || date.getTime() > today + MAX_DAYS_AHEAD * day) {
    throw new DesiredDateError(`Choisissez un jour dans les ${MAX_DAYS_AHEAD} prochains jours.`);
  }
  return raw;
}

// "2026-11-04" -> "mercredi 4 novembre" (pour les emails)
function formatDay(isoDay) {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC"
  });
}

module.exports = { DesiredDateError, parseDesiredDate, formatDay, MAX_DAYS_AHEAD };
