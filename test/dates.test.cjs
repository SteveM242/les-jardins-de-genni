const test = require("node:test");
const assert = require("node:assert/strict");
const { DesiredDateError, parseDesiredDate, formatDay } = require("../lib/dates.cjs");

const NOW = new Date("2026-11-01T15:00:00Z");

test("parseDesiredDate : vide -> null, date valide conservée", () => {
  assert.equal(parseDesiredDate("", NOW), null);
  assert.equal(parseDesiredDate(undefined, NOW), null);
  assert.equal(parseDesiredDate("2026-11-04", NOW), "2026-11-04");
  assert.equal(parseDesiredDate(" 2026-12-31 ", NOW), "2026-12-31");
});

test("parseDesiredDate : tolère la veille (décalage horaire) mais pas avant", () => {
  assert.equal(parseDesiredDate("2026-11-01", NOW), "2026-11-01");
  assert.equal(parseDesiredDate("2026-10-31", NOW), "2026-10-31");
  assert.throws(() => parseDesiredDate("2026-10-30", NOW), DesiredDateError);
});

test("parseDesiredDate : limite à 60 jours", () => {
  assert.equal(parseDesiredDate("2026-12-31", NOW), "2026-12-31"); // J+60
  assert.throws(() => parseDesiredDate("2027-01-01", NOW), /60 prochains jours/);
});

test("parseDesiredDate : formats et dates impossibles refusés", () => {
  for (const bad of ["04/11/2026", "demain", "2026-13-01", "2026-02-31", "2026-11-4"]) {
    assert.throws(() => parseDesiredDate(bad, NOW), DesiredDateError, bad);
  }
});

test("formatDay : jour en toutes lettres, sans décalage de fuseau", () => {
  assert.equal(formatDay("2026-11-04"), "mercredi 4 novembre");
});
