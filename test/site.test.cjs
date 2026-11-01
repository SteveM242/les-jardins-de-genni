const test = require("node:test");
const assert = require("node:assert/strict");
const { installFakeDb, startApp } = require("./helpers.cjs");
const { sanitizeSocials, SocialLinkError } = require("../lib/siteContent.cjs");
const { sanitizeSection, SettingsError } = require("../lib/siteSections.cjs");

const calls = [];
let storedSocials = null;
let storedSettings = [];
let galleryCount = 3;
const imageBase64 = Buffer.from("fake-gallery-bytes").toString("base64");
const updatedAt = "2026-01-01T00:00:00.000Z";

installFakeDb(async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ");
  calls.push({ text: sql, params });
  if (sql.includes("SELECT token_version FROM admins")) return { rows: [{ token_version: 0 }] };
  if (sql.includes("FROM site_settings WHERE key = 'socials'")) return { rows: storedSocials ? [{ value: storedSocials }] : [] };
  if (sql === "SELECT key, value FROM site_settings") {
    const rows = [...storedSettings];
    if (storedSocials) rows.push({ key: "socials", value: storedSocials });
    return { rows };
  }
  if (sql.includes("FROM gallery_images WHERE active = true")) {
    return { rows: [{ id: 2, caption: "Le vent dans les bananiers", image_updated_at: updatedAt }, { id: 5, caption: "", image_updated_at: updatedAt }] };
  }
  if (sql.includes("SELECT image FROM gallery_images")) {
    return { rows: params[0] === 2 || params[0] === "2" ? [{ image: `data:image/png;base64,${imageBase64}` }] : [] };
  }
  if (sql.includes("COUNT(*)::int AS n, COALESCE(MAX(position)")) return { rows: [{ n: galleryCount, last: 7 }] };
  if (sql.includes("INSERT INTO gallery_images")) {
    return { rows: [{ id: 9, caption: params[1], position: params[2], active: true, image_updated_at: updatedAt }] };
  }
  if (sql.includes("UPDATE gallery_images SET caption")) {
    return { rows: params[2] === "99" ? [] : [{ id: 2, caption: params[0] ?? "x", position: 1, active: params[1] ?? true, image_updated_at: updatedAt }] };
  }
  return { rows: [] };
});

const { signToken } = require("../auth.cjs");
let app;

test.before(async () => {
  app = await startApp();
});
test.after(() => app.close());
test.beforeEach(() => {
  calls.length = 0;
  storedSocials = null;
  storedSettings = [];
  galleryCount = 3;
});

const adminCookie = () => `admin_token=${signToken({ sub: 1, role: "admin", v: 0 })}`;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
function imageForm(caption, bytes = PNG, type = "image/png") {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), "photo.png");
  if (caption != null) form.append("caption", caption);
  return form;
}

test("sanitizeSocials : liens valides, vides acceptés, domaines contrôlés", () => {
  const ok = sanitizeSocials({ instagram: " https://www.instagram.com/genni ", tiktok: "https://vm.tiktok.com/abc", facebook: "" });
  assert.equal(ok.instagram, "https://www.instagram.com/genni");
  assert.equal(ok.tiktok, "https://vm.tiktok.com/abc");
  assert.equal(ok.facebook, "");
  assert.equal(ok.snapchat, "");
  for (const bad of [
    { instagram: "javascript:alert(1)" },
    { instagram: "http://instagram.com/genni" },
    { instagram: "https://evil-instagram.com/genni" },
    { instagram: "https://instagram.com.evil.io/genni" },
    { tiktok: "https://instagram.com/genni" },
    { snapchat: "pas une url" }
  ]) {
    assert.throws(() => sanitizeSocials(bad), SocialLinkError, JSON.stringify(bad));
  }
});

test("GET /api/site : réseaux complétés, photos actives avec URL versionnée, cache court", async () => {
  storedSocials = { instagram: "https://www.instagram.com/genni" };
  const res = await app.request("GET", "/api/site");
  assert.equal(res.status, 200);
  assert.equal(res.json.socials.instagram, "https://www.instagram.com/genni");
  assert.equal(res.json.socials.tiktok, "");
  assert.deepEqual(res.json.gallery.map((g) => g.id), [2, 5]);
  assert.equal(res.json.gallery[0].url, `/api/gallery/2/image?v=${new Date(updatedAt).getTime()}`);
  assert.equal(res.json.gallery[0].caption, "Le vent dans les bananiers");
  assert.match(res.headers.get("cache-control"), /max-age=60/);
});

test("photo de galerie servie avec un cache long ; inconnue -> 404", async () => {
  const ok = await app.request("GET", "/api/gallery/2/image?v=1");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/png");
  assert.match(ok.headers.get("cache-control"), /immutable/);
  assert.equal(ok.text, "fake-gallery-bytes");
  assert.equal((await app.request("GET", "/api/gallery/77/image")).status, 404);
  assert.equal((await app.request("GET", "/api/gallery/abc/image")).status, 404);
});

test("réseaux sociaux admin : session requise, liens contrôlés, enregistrement", async () => {
  const body = { socials: { instagram: "https://www.instagram.com/genni", tiktok: "https://www.tiktok.com/@genni" } };
  assert.equal((await app.request("PUT", "/api/admin/settings/socials", { body })).status, 401);

  const bad = await app.request("PUT", "/api/admin/settings/socials", {
    cookie: adminCookie(),
    body: { socials: { instagram: "javascript:alert(1)" } }
  });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Instagram/);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO site_settings")));

  const ok = await app.request("PUT", "/api/admin/settings/socials", { cookie: adminCookie(), body });
  assert.equal(ok.status, 200);
  const save = calls.find((c) => c.text.includes("INSERT INTO site_settings"));
  assert.equal(save.params[0], "socials");
  assert.equal(JSON.parse(save.params[1]).tiktok, "https://www.tiktok.com/@genni");
});

test("galerie admin : ajout d'une photo (position suivante), refus d'un faux fichier image", async () => {
  assert.equal((await app.request("POST", "/api/admin/gallery", { body: imageForm("x") })).status, 401);

  const ok = await app.request("POST", "/api/admin/gallery", { cookie: adminCookie(), body: imageForm("  Récolte du matin  ") });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.image.caption, "Récolte du matin");
  assert.equal(ok.json.image.position, 8);
  const insert = calls.find((c) => c.text.includes("INSERT INTO gallery_images"));
  assert.ok(insert.params[0].startsWith("data:image/png;base64,"));

  const fake = await app.request("POST", "/api/admin/gallery", {
    cookie: adminCookie(),
    body: imageForm("", Buffer.from("<script>alert(1)</script>"))
  });
  assert.equal(fake.status, 400);
});

test("galerie admin : limite de 24 photos", async () => {
  galleryCount = 24;
  const res = await app.request("POST", "/api/admin/gallery", { cookie: adminCookie(), body: imageForm("x") });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /24/);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO gallery_images")));
});

test("galerie admin : réordonnancement validé et appliqué dans l'ordre", async () => {
  const bad = await app.request("POST", "/api/admin/gallery/reorder", { cookie: adminCookie(), body: { ids: [1, 1] } });
  assert.equal(bad.status, 400);
  assert.equal((await app.request("POST", "/api/admin/gallery/reorder", { cookie: adminCookie(), body: { ids: ["a"] } })).status, 400);

  const ok = await app.request("POST", "/api/admin/gallery/reorder", { cookie: adminCookie(), body: { ids: [5, 2, 9] } });
  assert.equal(ok.status, 200);
  const updates = calls.filter((c) => c.text.includes("UPDATE gallery_images SET position"));
  assert.deepEqual(updates.map((u) => u.params), [[1, 5], [2, 2], [3, 9]]);
});

test("galerie admin : légende / visibilité, suppression, id invalide", async () => {
  const patch = await app.request("PATCH", "/api/admin/gallery/2", { cookie: adminCookie(), body: { caption: "Nouvelle légende", active: false } });
  assert.equal(patch.status, 200);
  assert.equal(patch.json.image.caption, "Nouvelle légende");
  assert.equal(patch.json.image.active, false);

  assert.equal((await app.request("PATCH", "/api/admin/gallery/99", { cookie: adminCookie(), body: { caption: "x" } })).status, 404);
  assert.equal((await app.request("DELETE", "/api/admin/gallery/abc", { cookie: adminCookie() })).status, 404);
  assert.equal((await app.request("DELETE", "/api/admin/gallery/2", { cookie: adminCookie() })).status, 200);
  assert.ok(calls.some((c) => c.text.includes("DELETE FROM gallery_images")));
});

test("sanitizeSection : annonce, coordonnées, légal", () => {
  assert.deepEqual(sanitizeSection("announcement", { text: "  Commandes jusqu'à jeudi  ", active: true }), {
    text: "Commandes jusqu'à jeudi",
    active: true
  });
  // Une annonce vide ne peut pas être "active".
  assert.deepEqual(sanitizeSection("announcement", { text: "  ", active: true }), { text: "", active: false });

  const contact = sanitizeSection("contact", { whatsapp: "0696 12 34 56", email: "genni@example.com", location: "Ducos", hours: "Lun-Ven" });
  assert.equal(contact.whatsapp, "596696123456");
  assert.equal(sanitizeSection("contact", { whatsapp: "+596 696 12 34 56" }).whatsapp, "596696123456");
  assert.equal(sanitizeSection("contact", { whatsapp: "" }).whatsapp, "");
  assert.throws(() => sanitizeSection("contact", { whatsapp: "12" }), SettingsError);
  assert.throws(() => sanitizeSection("contact", { email: "pas-un-email" }), SettingsError);

  assert.equal(sanitizeSection("legal", { siret: "123 456 789 00012" }).siret, "12345678900012");
  assert.throws(() => sanitizeSection("legal", { siret: "123" }), SettingsError);
  assert.throws(() => sanitizeSection("inconnue", {}), SettingsError);
  assert.equal(sanitizeSection("about", { text: "Ligne 1\r\n\r\nLigne 2" }).text, "Ligne 1\n\nLigne 2");
});

test("GET /api/site : annonce publiée seulement si active, coordonnées et textes exposés", async () => {
  storedSettings = [
    { key: "announcement", value: { text: "Retrait vendredi", active: true } },
    { key: "contact", value: { whatsapp: "596696123456", email: "genni@example.com", location: "Ducos", hours: "" } },
    { key: "about", value: { text: "Notre histoire" } },
    { key: "checkout", value: { pickupInfo: "Retrait à Ducos", deliveryInfo: "" } },
    { key: "legal", value: { companyName: "Les Jardins de Genni", siret: "12345678900012" } }
  ];
  const res = await app.request("GET", "/api/site");
  assert.deepEqual(res.json.announcement, { text: "Retrait vendredi" });
  assert.equal(res.json.contact.whatsapp, "596696123456");
  assert.equal(res.json.about.text, "Notre histoire");
  assert.equal(res.json.checkout.pickupInfo, "Retrait à Ducos");
  assert.equal(res.json.legal.companyName, "Les Jardins de Genni");
  assert.equal(res.json.legal.mediator, "", "champ non renseigné -> vide");

  storedSettings = [{ key: "announcement", value: { text: "Brouillon", active: false } }];
  const hidden = await app.request("GET", "/api/site");
  assert.equal(hidden.json.announcement, null);
  assert.equal(hidden.json.contact.whatsapp, "");
});

test("sections admin : session requise, validation, enregistrement", async () => {
  const value = { whatsapp: "0696 12 34 56", email: "genni@example.com", location: "Ducos", hours: "" };
  assert.equal((await app.request("PUT", "/api/admin/settings/sections/contact", { body: { value } })).status, 401);
  assert.equal((await app.request("PUT", "/api/admin/settings/sections/nimporte", { cookie: adminCookie(), body: { value } })).status, 404);

  const bad = await app.request("PUT", "/api/admin/settings/sections/contact", { cookie: adminCookie(), body: { value: { whatsapp: "1" } } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /WhatsApp/);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO site_settings")));

  const ok = await app.request("PUT", "/api/admin/settings/sections/contact", { cookie: adminCookie(), body: { value } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.value.whatsapp, "596696123456");
  const save = calls.find((c) => c.text.includes("INSERT INTO site_settings"));
  assert.equal(save.params[0], "contact");
  assert.equal(JSON.parse(save.params[1]).whatsapp, "596696123456");
});

test("GET /api/admin/settings/all renvoie toutes les sections complétées", async () => {
  storedSocials = { instagram: "https://www.instagram.com/genni" };
  storedSettings = [{ key: "about", value: { text: "Salut" } }];
  const res = await app.request("GET", "/api/admin/settings/all", { cookie: adminCookie() });
  assert.equal(res.status, 200);
  assert.equal(res.json.socials.instagram, "https://www.instagram.com/genni");
  assert.equal(res.json.about.text, "Salut");
  assert.deepEqual(res.json.announcement, { text: "", active: false });
  assert.equal(res.json.legal.siret, "");
});

test("sanitizeSocials : un simple pseudo ou une adresse sans https:// suffit", () => {
  const result = sanitizeSocials({
    instagram: "@genni.martinique",
    tiktok: "@genni",
    snapchat: "genni972",
    facebook: "genni.jardins",
    youtube: "www.youtube.com/@genni"
  });
  assert.equal(result.instagram, "https://www.instagram.com/genni.martinique");
  assert.equal(result.tiktok, "https://www.tiktok.com/@genni");
  assert.equal(result.snapchat, "https://www.snapchat.com/add/genni972");
  assert.equal(result.facebook, "https://www.facebook.com/genni.jardins");
  assert.equal(result.youtube, "https://www.youtube.com/@genni");
  assert.equal(sanitizeSocials({ instagram: "instagram.com/genni" }).instagram, "https://instagram.com/genni");
});

test("sanitizeSocials : les raccourcis n'ouvrent pas la porte à des liens piégés", () => {
  for (const bad of [
    { instagram: "http://instagram.com/genni" },
    { instagram: "instagram.com.evil.io/genni" },
    { tiktok: "instagram.com/genni" },
    { facebook: "javascript:alert(1)" },
    { youtube: "//evil.example/x" },
    { snapchat: "deux mots" }
  ]) {
    assert.throws(() => sanitizeSocials(bad), SocialLinkError, JSON.stringify(bad));
  }
});
