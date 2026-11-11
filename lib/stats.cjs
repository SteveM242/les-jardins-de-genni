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

// Indicateurs sur 90 jours : fidélité, retrait effectif, sessions de vente et paniers les plus vendus.
// orders : [{ total, status, created_at, desired_date, email, phone, items }]
function customerKey(order) {
  const email = String(order.email || "").trim().toLowerCase();
  if (email) return `e:${email}`;
  const phone = String(order.phone || "").replace(/\D/g, "").slice(-9);
  return phone ? `p:${phone}` : null;
}

function computeInsights(orders, now = new Date()) {
  const from = now.getTime() - 90 * DAY;
  const monthStart = now.getTime() - 30 * DAY;
  const perCustomer = new Map();
  const sessions = new Map();
  const baskets = new Map();
  let delivered = 0;
  let missed = 0;

  for (const order of orders) {
    if (order.status === "annulee") continue;
    if (new Date(order.created_at).getTime() < from) continue;
    const key = customerKey(order);
    if (key) perCustomer.set(key, (perCustomer.get(key) || 0) + 1);
    if (order.status === "livree") delivered += 1;
    if (order.status === "non_retiree") missed += 1;

    const day = order.desired_date ? String(order.desired_date).slice(0, 10) : null;
    if (day) {
      const session = sessions.get(day) || { day, orders: 0, revenue: 0 };
      session.orders += 1;
      session.revenue += Number(order.total) || 0;
      sessions.set(day, session);
    }

    if (new Date(order.created_at).getTime() >= monthStart) {
      for (const item of Array.isArray(order.items) ? order.items : []) {
        if (item?.type === "product") continue;
        const name = String(item?.name || "").trim();
        if (name) baskets.set(name, (baskets.get(name) || 0) + (Number(item.qty) || 0));
      }
    }
  }

  const customers = perCustomer.size;
  const returning = [...perCustomer.values()].filter((n) => n >= 2).length;
  const finished = delivered + missed;
  return {
    customers,
    returningCustomers: returning,
    returningRate: customers ? Math.round((returning / customers) * 100) : null,
    pickupRate: finished ? Math.round((delivered / finished) * 100) : null,
    sessions: [...sessions.values()]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 8)
      .map((s) => ({ ...s, revenue: roundMoney(s.revenue) })),
    topBaskets: [...baskets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }))
  };
}

module.exports = { computeStats, computeInsights };
