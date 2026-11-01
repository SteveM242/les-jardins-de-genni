// Chiffres du tableau de bord : calculés en JavaScript à partir des commandes des 30 derniers jours
// (volume modeste pour une petite exploitation, et requête SQL triviale).
const { roundMoney } = require("./pricing.cjs");

const DAY = 24 * 60 * 60 * 1000;
const TOP_COUNT = 5;

// orders : [{ total, status, created_at, items: [{ name, qty }] }]
// Les commandes annulées ne comptent ni dans le chiffre d'affaires ni dans le classement.
function computeStats(orders, now = new Date()) {
  const weekStart = now.getTime() - 7 * DAY;
  const monthStart = now.getTime() - 30 * DAY;
  const week = { orders: 0, revenue: 0 };
  const month = { orders: 0, revenue: 0 };
  const sold = new Map();

  for (const order of orders) {
    if (order.status === "annulee") continue;
    const createdAt = new Date(order.created_at).getTime();
    if (createdAt < monthStart) continue;
    const total = Number(order.total) || 0;

    month.orders += 1;
    month.revenue += total;
    if (createdAt >= weekStart) {
      week.orders += 1;
      week.revenue += total;
    }

    for (const item of Array.isArray(order.items) ? order.items : []) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      sold.set(name, (sold.get(name) || 0) + (Number(item.qty) || 0));
    }
  }

  const top = [...sold.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, TOP_COUNT)
    .map(([name, qty]) => ({ name, qty }));

  return {
    week: { orders: week.orders, revenue: roundMoney(week.revenue) },
    month: { orders: month.orders, revenue: roundMoney(month.revenue) },
    top
  };
}

module.exports = { computeStats };
