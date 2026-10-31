// Liste les articles/paniers dont l'image pointe encore vers l'ancien dossier
// /uploads (plus servi depuis le passage au base64) : ils sont à ré-uploader.
// Usage : DATABASE_URL=... node check-legacy-images.cjs
const { pool, query } = require("./db.cjs");

async function main() {
  let total = 0;
  for (const table of ["products", "baskets"]) {
    const { rows } = await query(`SELECT id, name, image FROM ${table} WHERE image LIKE '/uploads/%' ORDER BY name`);
    for (const row of rows) console.log(`[${table}] #${row.id} ${row.name} -> ${row.image}`);
    total += rows.length;
  }
  console.log(total ? `${total} image(s) à ré-uploader.` : "Aucune image legacy.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
