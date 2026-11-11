const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify, cleanText, escapeLike } = require("../lib/text.cjs");
const { matchesImageSignature, parseDataUri, imageUrl, withImageUrl } = require("../lib/images.cjs");
const { STATUS_MESSAGES } = require("../lib/mailer.cjs");
const { normalizePhone, samePhone } = require("../lib/phone.cjs");

test("slugify retire accents et caractères spéciaux", () => {
  assert.equal(slugify("Panier Péyi Classique !"), "panier-peyi-classique");
  assert.equal(slugify("  --Été--  "), "ete");
});

test("cleanText tronque et normalise", () => {
  assert.equal(cleanText("  bonjour  ", 4), "bonj");
  assert.equal(cleanText(undefined, 10), "");
  assert.equal(cleanText(42, 10), "42");
});

test("escapeLike neutralise % _ et \\", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
});

test("matchesImageSignature contrôle les premiers octets", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4)]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(2)]);
  assert.ok(matchesImageSignature(jpeg, "image/jpeg"));
  assert.ok(matchesImageSignature(png, "image/png"));
  assert.ok(matchesImageSignature(webp, "image/webp"));
  assert.ok(!matchesImageSignature(Buffer.from("<script>alert(1)</script>"), "image/png"));
  assert.ok(!matchesImageSignature(jpeg, "image/png"));
});

test("parseDataUri décode un data URI image et rejette le reste", () => {
  const parsed = parseDataUri(`data:image/png;base64,${Buffer.from("abc").toString("base64")}`);
  assert.equal(parsed.mimetype, "image/png");
  assert.equal(parsed.buffer.toString(), "abc");
  assert.equal(parseDataUri("data:text/html;base64,AAAA"), null);
  assert.equal(parseDataUri("/images/x.jpg"), null);
  assert.equal(parseDataUri(null), null);
});

test("imageUrl : route versionnée pour les uploads, chemin statique sinon", () => {
  const updated = "2026-01-01T00:00:00.000Z";
  assert.equal(
    imageUrl("products", { slug: "igname", has_upload: true, image_updated_at: updated }),
    `/api/products/igname/image?v=${new Date(updated).getTime()}`
  );
  assert.equal(imageUrl("baskets", { slug: "x", has_upload: false, image: "/images/a.jpg" }), "/images/a.jpg");
  assert.equal(imageUrl("baskets", { slug: "x", has_upload: false, image: null }), null);
});

test("withImageUrl retire les colonnes techniques", () => {
  const row = withImageUrl("products", { id: 1, slug: "a", has_upload: false, image: "/i.jpg", image_updated_at: null });
  assert.deepEqual(row, { id: 1, slug: "a", image: "/i.jpg" });
});

test("un message de statut existe pour chaque statut notifié", () => {
  for (const status of ["confirmee", "prete", "livree", "annulee"]) {
    assert.ok(STATUS_MESSAGES[status].subject && STATUS_MESSAGES[status].body);
  }
  assert.equal(STATUS_MESSAGES.nouvelle, undefined);
});

test("normalizePhone / samePhone : formats français et indicatif Martinique équivalents", () => {
  assert.equal(normalizePhone("0696 12 34 56"), "0696123456");
  assert.equal(normalizePhone("+596 696 12 34 56"), "0696123456");
  assert.equal(normalizePhone("00596696123456"), "0696123456");
  assert.ok(samePhone("06.96.12.34.56", "+596696123456"));
  assert.ok(!samePhone("0696123456", "0696123457"));
  assert.ok(!samePhone("", ""), "deux numéros vides ne sont pas identiques");
  assert.ok(!samePhone("1234", "1234"), "trop court pour être un vrai téléphone");
});

const { ALPHABET, generateOrderCode, normalizeOrderCode, formatOrderCode } = require("../lib/orderCode.cjs");

test("un code de commande fait 6 caractères sans caractères ambigus", () => {
  assert.ok(!/[01OIL]/.test(ALPHABET));
  const codes = new Set();
  for (let i = 0; i < 200; i += 1) {
    const code = generateOrderCode();
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
    codes.add(code);
  }
  assert.ok(codes.size > 195);
});

test("le code se saisit avec ou sans tiret, en minuscules", () => {
  assert.equal(normalizeOrderCode(" k7m-4qh "), "K7M4QH");
  assert.equal(normalizeOrderCode(undefined), "");
  assert.equal(formatOrderCode("K7M4QH"), "K7M-4QH");
  assert.equal(formatOrderCode("A1B2C3D4"), "A1B2C3D4");
});
