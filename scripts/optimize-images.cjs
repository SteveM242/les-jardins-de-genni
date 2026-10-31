// Convertit les photos de public/images en WebP redimensionné (poids divisé par 5 à 10).
// Usage : node scripts/optimize-images.cjs   (nécessite sharp, installé en devDependency)
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const dir = path.join(__dirname, "..", "public", "images");
const MAX_WIDTH = { "hero-jardin": 1600, "about-martinique": 1200 };
// Le hero est sombre (voile de couleur par-dessus) : une compression plus forte ne se voit pas.
const QUALITY = { "hero-jardin": 60 };
const DEFAULT_MAX_WIDTH = 900;

async function main() {
  for (const file of fs.readdirSync(dir).filter((name) => /\.(jpe?g|png)$/i.test(name))) {
    const base = path.parse(file).name;
    const target = path.join(dir, `${base}.webp`);
    const before = fs.statSync(path.join(dir, file)).size;
    await sharp(path.join(dir, file))
      .rotate()
      .resize({ width: MAX_WIDTH[base] || DEFAULT_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY[base] || 76 })
      .toFile(target);
    const after = fs.statSync(target).size;
    console.log(`${file}: ${Math.round(before / 1024)} Ko -> ${base}.webp ${Math.round(after / 1024)} Ko`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
