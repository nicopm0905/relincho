import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInYears, horseCategory } from "../src/lib/horse-category";

const now = new Date("2026-10-13T12:00:00Z");

test("un macho joven es potro, no semental", () => {
  assert.equal(horseCategory({ sex: "MALE", birthDate: "2026-04-01" }, now), "colt");
  assert.equal(horseCategory({ sex: "MALE", birthDate: "2014-05-20" }, now), "stallion");
  assert.equal(horseCategory({ sex: "FEMALE", birthDate: "2025-03-01" }, now), "filly");
  assert.equal(horseCategory({ sex: "FEMALE", birthDate: "2019-04-22" }, now), "mare");
  assert.equal(horseCategory({ sex: "GELDING", birthDate: "2025-01-01" }, now), "gelding");
  assert.equal(horseCategory({ sex: "MALE", birthDate: null }, now), "stallion");
});

test("edad en años cumplidos", () => {
  assert.equal(ageInYears("2019-10-14", now), 6);
  assert.equal(ageInYears("2019-10-12", now), 7);
  assert.equal(ageInYears("2026-10-01", now), 0);
});
