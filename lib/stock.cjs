// Stock par article : products.stock = quantité disponible cette semaine (NULL = illimité).
// Les paniers du catalogue et leurs articles (texte libre) ne sont pas suivis ici : seuls les articles à la carte
// et le contenu des paniers sur mesure, qui s'appuient sur la table products.

class StockError extends Error {}

// Quantités demandées par article : lignes « product » et contenu des paniers « custom ».
function demandFromLines(lines) {
  const demand = new Map();
  const add = (slug, qty) => {
    if (!slug || !(qty > 0)) return;
    demand.set(slug, (demand.get(slug) || 0) + qty);
  };
  for (const line of Array.isArray(lines) ? lines : []) {
    const lineQty = Number(line.qty) || 0;
    if (line.type === "product") add(line.slug, lineQty);
    else if (line.type === "custom") for (const entry of line.contents || []) add(entry.slug, (Number(entry.qty) || 0) * lineQty);
  }
  return demand;
}

// Dans la transaction de la commande : verrouille chaque article, refuse si le stock est insuffisant, puis le décrémente.
async function reserveStock(client, demand) {
  for (const [slug, qty] of [...demand.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const res = await client.query("SELECT name, stock FROM products WHERE slug = $1 FOR UPDATE", [slug]);
    const row = res?.rows?.[0];
    if (!row || row.stock == null) continue;
    if (row.stock < qty) {
      throw new StockError(
        row.stock <= 0 ? `« ${row.name} » est en rupture.` : `« ${row.name} » : plus que ${row.stock} disponible${row.stock > 1 ? "s" : ""}.`
      );
    }
    await client.query("UPDATE products SET stock = stock - $1 WHERE slug = $2", [qty, slug]);
  }
}

// Commande annulée : les quantités reviennent en stock (articles suivis uniquement).
async function releaseStock(db, items) {
  for (const [slug, qty] of demandFromLines(typeof items === "string" ? JSON.parse(items) : items)) {
    await db.query("UPDATE products SET stock = stock + $1 WHERE slug = $2 AND stock IS NOT NULL", [qty, slug]);
  }
}

// Ce que voit le public : « en rupture » si le drapeau est posé ou le stock épuisé, et le reste seulement quand il devient faible.
const LOW_STOCK = 5;
function publicStock(row) {
  const soldOut = Boolean(row.sold_out) || (row.stock != null && row.stock <= 0);
  const left = row.stock != null && row.stock > 0 && row.stock <= LOW_STOCK ? row.stock : null;
  return { soldOut, left };
}

module.exports = { StockError, demandFromLines, reserveStock, releaseStock, publicStock, LOW_STOCK };
