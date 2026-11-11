const test = require("node:test");
const assert = require("node:assert/strict");
const { salesStatus, sessionKey, isReminderTime } = require("../lib/salesWindow.cjs");
const { aggregatePrep } = require("../lib/prep.cjs");
const { toCsv } = require("../lib/csv.cjs");
const { sendClosingReminders, subscribe } = require("../lib/reminders.cjs");
const { parseComposition, resolveSelection, reconcileSelection, defaultSelection } = require("../lib/composition.cjs");

// Les heures sont données en UTC ; la Martinique est à UTC-4.
const at = (iso) => new Date(iso);

test("vente : ouverte du samedi au lundi soir (heure de la Martinique), fermée sinon", () => {
  assert.equal(salesStatus("auto", at("2026-11-14T04:30:00Z")).open, true); // samedi 00:30 local
  assert.equal(salesStatus("auto", at("2026-11-13T23:30:00Z")).open, false); // vendredi 19:30 local
  assert.equal(salesStatus("auto", at("2026-11-16T20:00:00Z")).open, true); // lundi 16:00 local
  assert.equal(salesStatus("auto", at("2026-11-17T03:59:00Z")).open, true); // lundi 23:59 local
  assert.equal(salesStatus("auto", at("2026-11-17T04:00:00Z")).open, false); // mardi 00:00 local
});

test("vente : bascule manuelle et mode inconnu", () => {
  const wednesday = at("2026-11-11T15:00:00Z");
  assert.equal(salesStatus("open", wednesday).open, true);
  assert.equal(salesStatus("closed", at("2026-11-14T15:00:00Z")).open, false);
  assert.equal(salesStatus("n'importe quoi", wednesday).mode, "auto");
});

test("vente : jour de retrait = prochain mercredi, jours avant l'ouverture", () => {
  assert.equal(salesStatus("auto", at("2026-11-14T15:00:00Z")).pickupDate, "2026-11-18"); // samedi
  assert.equal(salesStatus("auto", at("2026-11-16T15:00:00Z")).pickupDate, "2026-11-18"); // lundi
  assert.equal(salesStatus("auto", at("2026-11-11T15:00:00Z")).pickupDate, "2026-11-11"); // mercredi
  assert.equal(salesStatus("auto", at("2026-11-12T15:00:00Z")).opensInDays, 2); // jeudi -> samedi
  assert.equal(salesStatus("auto", at("2026-11-14T15:00:00Z")).opensInDays, 0);
  assert.equal(sessionKey(at("2026-11-15T15:00:00Z")), "2026-11-18");
});

test("rappel : seulement le lundi à partir de midi", () => {
  assert.equal(isReminderTime(at("2026-11-16T15:59:00Z")), false); // lundi 11:59 local
  assert.equal(isReminderTime(at("2026-11-16T16:00:00Z")), true); // lundi 12:00 local
  assert.equal(isReminderTime(at("2026-11-15T20:00:00Z")), false); // dimanche
});

test("préparation : paniers (contenu exact), articles à l'unité et paniers sur mesure additionnés", () => {
  const orders = [
    {
      items: [
        { type: "basket", name: "Panier Familial", qty: 2, contents: [{ name: "Salade", qty: 1 }, { name: "Oeufs", qty: 2 }] },
        { type: "product", name: "Igname", unit: "kg", qty: 3 }
      ]
    },
    {
      items: JSON.stringify([
        { type: "basket", name: "Panier Familial", qty: 1, contents: [{ name: "salade", qty: 3 }] },
        { type: "custom", name: "Panier sur mesure", qty: 1, contents: [{ name: "Igname", unit: "kg", qty: 2 }] },
        { type: "basket", name: "Panier Découverte", qty: 1, contents: [{ name: "Mangues" }] }
      ])
    }
  ];
  const prep = aggregatePrep(orders);
  assert.equal(prep.orders, 2);
  assert.deepEqual(prep.baskets, [{ name: "Panier Familial", qty: 3 }, { name: "Panier sur mesure", qty: 1 }, { name: "Panier Découverte", qty: 1 }]);
  const byName = Object.fromEntries(prep.lines.map((line) => [line.name.toLowerCase(), line]));
  assert.equal(byName.salade.qty, 5); // 2×1 + 1×3
  assert.equal(byName.oeufs.qty, 4);
  assert.equal(byName.mangues.qty, 1);
  assert.deepEqual(
    { qty: byName.igname.qty, loose: byName.igname.loose, fromBaskets: byName.igname.fromBaskets },
    { qty: 5, loose: 3, fromBaskets: 2 }
  );
});

test("CSV : séparateur ;, guillemets doublés, formules neutralisées, BOM", () => {
  const csv = toCsv(["A", "B"], [["x;y", 'dit "oui"'], ["=SOMME(1)", null], ["ok", "ligne1\nligne2"]]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"x;y";"dit ""oui"""/);
  assert.match(csv, /'=SOMME\(1\);/);
  assert.match(csv, /"ligne1\nligne2"/);
});

function fakeRemindersDb({ claimed = true, subscribers = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text, params });
      if (text.includes("INSERT INTO site_settings")) return { rows: claimed ? [{ key: "last_reminder" }] : [] };
      if (text.includes("FROM reminder_subscribers")) return { rows: subscribers };
      return { rows: [] };
    }
  };
}

test("rappel : envoyé une fois, aux inscrits qui n'ont pas commandé, un échec n'arrête pas les autres", async () => {
  const subscribers = [{ email: "a@x.fr", name: "A", token: "t1" }, { email: "b@x.fr", name: "B", token: "t2" }, { email: "c@x.fr", name: "C", token: "t3" }];
  const db = fakeRemindersDb({ subscribers });
  const sent = [];
  const send = async (message) => {
    if (message.to === "b@x.fr") throw new Error("boîte pleine");
    sent.push(message);
  };
  const monday = at("2026-11-16T17:00:00Z");
  assert.equal(await sendClosingReminders(db, { send, now: monday }), 2);
  assert.deepEqual(sent.map((m) => m.to), ["a@x.fr", "c@x.fr"]);
  assert.equal(sent[0].pickupDate, "2026-11-18");
  assert.equal(sent[0].token, "t1");
  // Les personnes ayant déjà commandé pour ce retrait sont exclues par la requête.
  const select = db.calls.find((c) => c.text.includes("FROM reminder_subscribers"));
  assert.match(select.text, /NOT EXISTS/);
  assert.deepEqual(select.params, ["2026-11-18"]);
});

test("rappel : rien hors du lundi après-midi, vente fermée, ou déjà envoyé pour cette session", async () => {
  const never = async () => assert.fail("aucun email attendu");
  const subscribers = [{ email: "a@x.fr", name: "A", token: "t1" }];
  assert.equal(await sendClosingReminders(fakeRemindersDb({ subscribers }), { send: never, now: at("2026-11-15T17:00:00Z") }), 0); // dimanche
  assert.equal(await sendClosingReminders(fakeRemindersDb({ subscribers }), { send: never, now: at("2026-11-16T17:00:00Z"), mode: "closed" }), 0);
  assert.equal(await sendClosingReminders(fakeRemindersDb({ subscribers, claimed: false }), { send: never, now: at("2026-11-16T17:00:00Z") }), 0);
});

test("rappel : inscription refusée sans email valide", async () => {
  const db = fakeRemindersDb();
  assert.equal(await subscribe(db, { email: "pas-un-email", name: "X" }), false);
  assert.equal(await subscribe(db, { email: " Marie@Example.com ", name: "Marie" }), true);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].params[0], "marie@example.com");
});

test("rupture : un article en rupture est retiré des choix et du panier d'origine", () => {
  const comp = parseComposition({
    maxItems: 3,
    entries: [{ name: "A", qty: 2, max: 2, soldOut: true }, { name: "B", qty: 1, max: 2 }, { name: "C", kind: "replacement", max: 2 }]
  });
  assert.deepEqual(defaultSelection(comp), [{ name: "B", qty: 1 }]);
  assert.match(resolveSelection(comp, [{ name: "A", qty: 1 }]).error, /rupture/);
  assert.ok(resolveSelection(comp, [{ name: "A", qty: 0 }, { name: "B", qty: 2 }]).selection);
  const fixed = reconcileSelection(comp, [{ name: "A", qty: 2 }, { name: "B", qty: 1 }]);
  assert.deepEqual(fixed.selection, [{ name: "B", qty: 1 }]);
  assert.match(fixed.changes[0], /rupture/);
});
