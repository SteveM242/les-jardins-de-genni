const multer = require("multer");

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Les photos sont stockées en base64 directement dans Postgres (pas de volume
// de fichiers séparé) : Railway n'a jamais réussi à attacher un volume fiable
// à ce service sur ce compte, alors que Postgres a déjà le sien qui fonctionne.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_TYPES.has(file.mimetype));
  }
});

// Le type MIME envoyé par le navigateur est déclaratif : on vérifie aussi les premiers octets.
function matchesImageSignature(buffer, mimetype) {
  if (mimetype === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/webp") {
    return buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function fileToDataUri(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function parseDataUri(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(value || "");
  if (!match) return null;
  return { mimetype: match[1], buffer: Buffer.from(match[2], "base64") };
}

// URL publique d'une image : les photos uploadées sont servies par une route
// dédiée (cache HTTP long, versionnée) au lieu d'être embarquées en base64 dans les listes JSON.
function imageUrl(kind, row) {
  if (!row.has_upload) return row.image || null;
  const version = row.image_updated_at ? new Date(row.image_updated_at).getTime() : 0;
  return `/api/${kind}/${encodeURIComponent(row.slug)}/image?v=${version}`;
}

// Colonnes à sélectionner à la place de `image` : n'extrait jamais le base64 dans les listes.
const IMAGE_COLUMNS = `(image LIKE 'data:%') AS has_upload, CASE WHEN image LIKE 'data:%' THEN NULL ELSE image END AS image, image_updated_at`;

function withImageUrl(kind, row) {
  const { has_upload: _hasUpload, image_updated_at: _updatedAt, ...rest } = row;
  return { ...rest, image: imageUrl(kind, row) };
}

module.exports = {
  upload,
  matchesImageSignature,
  fileToDataUri,
  parseDataUri,
  imageUrl,
  withImageUrl,
  IMAGE_COLUMNS
};
