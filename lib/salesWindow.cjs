// Session de vente hebdomadaire : ouverte du samedi au lundi soir (heure de la Martinique), retrait le mercredi.
// Mode « auto » = suit ce rythme ; « open » / « closed » = bascule manuelle depuis l'espace pro.
const OFFSET_MS = -4 * 60 * 60 * 1000; // Martinique : UTC-4, pas d'heure d'été
const DAY_MS = 24 * 60 * 60 * 1000;
const MODES = ["auto", "open", "closed"];

// Horloge remplaçable dans les tests.
const clock = { now: () => new Date() };

function localDate(now) {
  return new Date(now.getTime() + OFFSET_MS); // lire avec les getters UTC*
}

function isoDay(local) {
  return local.toISOString().slice(0, 10);
}

// Samedi (6), dimanche (0), lundi (1) : la vente ferme lundi à minuit, heure locale.
function autoOpen(now) {
  return [6, 0, 1].includes(localDate(now).getUTCDay());
}

// Prochain mercredi (aujourd'hui compris), "YYYY-MM-DD".
function pickupDate(now) {
  const local = localDate(now);
  const ahead = (3 - local.getUTCDay() + 7) % 7;
  return isoDay(new Date(local.getTime() + ahead * DAY_MS));
}

// Jours avant la prochaine ouverture automatique (0 si ouverte).
function daysUntilOpening(now) {
  if (autoOpen(now)) return 0;
  return (6 - localDate(now).getUTCDay() + 7) % 7;
}

function salesStatus(mode = "auto", now = clock.now()) {
  const safeMode = MODES.includes(mode) ? mode : "auto";
  const open = safeMode === "open" || (safeMode === "auto" && autoOpen(now));
  return { mode: safeMode, open, pickupDate: pickupDate(now), opensInDays: open ? 0 : daysUntilOpening(now) };
}

// Clé stable de la semaine de vente en cours (pour n'envoyer un rappel qu'une fois) : le mercredi de retrait.
function sessionKey(now = clock.now()) {
  return pickupDate(now);
}

// Lundi, de midi à minuit (heure locale) : fenêtre d'envoi du rappel avant la clôture.
function isReminderTime(now = clock.now()) {
  const local = localDate(now);
  return local.getUTCDay() === 1 && local.getUTCHours() >= 12;
}

// Mardi, de midi à minuit (heure locale) : la veille du retrait.
function isPickupReminderTime(now = clock.now()) {
  const local = localDate(now);
  return local.getUTCDay() === 2 && local.getUTCHours() >= 12;
}

// Date du jour à la Martinique, "YYYY-MM-DD".
function localToday(now = clock.now()) {
  return isoDay(localDate(now));
}

module.exports = { MODES, clock, autoOpen, pickupDate, salesStatus, sessionKey, isReminderTime, isPickupReminderTime, localToday };
