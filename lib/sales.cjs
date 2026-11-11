const { query } = require("../db.cjs");
const { salesStatus } = require("./salesWindow.cjs");

// Statut courant de la vente, d'après le réglage « Vente de la semaine » de l'espace pro.
async function currentSales() {
  const res = await query("SELECT value FROM site_settings WHERE key = 'sales'");
  const setting = res?.rows?.[0]?.value || {};
  return { ...salesStatus(setting.mode), closedMessage: setting.closedMessage || "" };
}

module.exports = { currentSales };
