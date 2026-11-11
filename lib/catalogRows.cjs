const { IMAGE_COLUMNS, withImageUrl } = require("./images.cjs");

const BASKET_COLUMNS = `id, slug, name, icon, price, summary, details, origin, item_count, items, composition, active, created_at, ${IMAGE_COLUMNS}`;
const PRODUCT_COLUMNS = `id, slug, name, unit, price, category, active, created_at, ${IMAGE_COLUMNS}`;

function publicBasket(row) {
  const { image } = withImageUrl("baskets", row);
  return {
    type: "basket",
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    image,
    price: Number(row.price),
    summary: row.summary,
    details: row.details,
    origin: row.origin,
    itemCount: row.item_count,
    items: row.items,
    composition: row.composition || null
  };
}

function publicProduct(row) {
  const { image } = withImageUrl("products", row);
  return {
    type: "product",
    slug: row.slug,
    name: row.name,
    unit: row.unit,
    price: Number(row.price),
    category: row.category,
    image
  };
}

module.exports = { BASKET_COLUMNS, PRODUCT_COLUMNS, publicBasket, publicProduct };
