// Liste de préparation : quantités totales à préparer, tous paniers confondus.
// orders : lignes de la table orders (items = JSON des lignes de commande).

function parseItems(order) {
  if (Array.isArray(order.items)) return order.items;
  try {
    const parsed = JSON.parse(order.items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function aggregatePrep(orders) {
  const totals = new Map();
  const baskets = new Map();

  function add(name, unit, qty, origin) {
    const label = String(name || "").trim();
    if (!label || !(qty > 0)) return;
    const key = `${label.toLowerCase()}|${String(unit || "").toLowerCase()}`;
    const row = totals.get(key) || { name: label, unit: unit || null, qty: 0, fromBaskets: 0, loose: 0 };
    row.qty += qty;
    row[origin] += qty;
    totals.set(key, row);
  }

  for (const order of orders) {
    for (const line of parseItems(order)) {
      const lineQty = Number(line.qty) || 0;
      if (line.type === "product") {
        add(line.name, line.unit, lineQty, "loose");
        continue;
      }
      baskets.set(line.name, (baskets.get(line.name) || 0) + lineQty);
      for (const entry of Array.isArray(line.contents) ? line.contents : []) {
        // Panier du catalogue sans quantité par article : 1 de chaque.
        add(entry.name, entry.unit, (entry.qty ?? 1) * lineQty, "fromBaskets");
      }
    }
  }

  return {
    orders: orders.length,
    baskets: [...baskets.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty),
    lines: [...totals.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"))
  };
}

module.exports = { aggregatePrep };
