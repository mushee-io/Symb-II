import { test } from "node:test";
import assert from "node:assert/strict";
import { tydroRiskState, nadoRiskState } from "../lib/risk/status.ts";

test("Tydro risk categories respect protocol liquidation threshold", () => {
  assert.equal(tydroRiskState(null), "no-exposure");
  assert.equal(tydroRiskState("0"), "urgent");
  assert.equal(tydroRiskState("0.99999"), "urgent");
  assert.equal(tydroRiskState("1"), "caution");
  assert.equal(tydroRiskState("1.49999"), "caution");
  assert.equal(tydroRiskState("1.5"), "above-warning-level");
  assert.equal(tydroRiskState("2.7"), "above-warning-level");
});

test("Malformed Tydro health inputs are unknown, not safe", () => {
  for (const input of ["", "NaN", "Infinity", "-1", "not-a-number"]) {
    assert.equal(tydroRiskState(input), "unknown");
  }
});

test("Nado health uses signed maintenance buffer, not Tydro HF cutoffs", () => {
  assert.equal(nadoRiskState(null), "unknown");
  assert.equal(nadoRiskState("-0.0001"), "urgent");
  assert.equal(nadoRiskState("0"), "caution");
  assert.equal(nadoRiskState("0.01"), "above-warning-level");
  assert.equal(nadoRiskState("1.0"), "above-warning-level");
  assert.equal(nadoRiskState("NaN"), "unknown");
  assert.equal(nadoRiskState("0", false), "no-exposure");
});
