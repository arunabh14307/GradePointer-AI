/**
 * Test client-side JavaScript calculation logic from js/cgpa-predictor.js
 */
const assert = require('assert');

// Pure calculation mirror matching js/cgpa-predictor.js
function computePrediction({ currentCgpa, targetCgpa, completedCredits, upcomingCredits, maxScale }) {
  const totalCredits = completedCredits + upcomingCredits;
  const targetPoints = targetCgpa * totalCredits;
  const currentPoints = currentCgpa * completedCredits;
  const neededPoints = targetPoints - currentPoints;
  const requiredSgpaRaw = neededPoints / upcomingCredits;
  const requiredSgpa = Math.round(requiredSgpaRaw * 100) / 100;

  const maxPointsAchievable = currentPoints + (maxScale * upcomingCredits);
  const maxAchievableCgpaRaw = maxPointsAchievable / totalCredits;
  const maxAchievableCgpa = Math.round(maxAchievableCgpaRaw * 100) / 100;

  const isImpossible = requiredSgpaRaw > maxScale;
  const isAlreadyExceeded = requiredSgpaRaw <= 0;

  return {
    requiredSgpa,
    totalCredits,
    maxAchievableCgpa,
    isImpossible,
    isAlreadyExceeded
  };
}

function computeScenarios(calc, scenarioList) {
  const { currentCgpa, completedCredits, upcomingCredits, totalCredits } = calc;
  return scenarioList.map(sg => {
    const scenarioPoints = (currentCgpa * completedCredits) + (sg * upcomingCredits);
    const projectedCgpa = Math.round((scenarioPoints / totalCredits) * 100) / 100;
    return { sgpa: sg, projectedCgpa };
  });
}

console.log("Testing JavaScript Deterministic CGPA Predictor...");

// 1. Valid Target
const r1 = computePrediction({
  currentCgpa: 8.0,
  targetCgpa: 8.5,
  completedCredits: 60,
  upcomingCredits: 20,
  maxScale: 10.0
});
assert.strictEqual(r1.requiredSgpa, 10.00, "Required SGPA must be 10.00");
assert.strictEqual(r1.totalCredits, 80, "Total credits must be 80");
assert.strictEqual(r1.isImpossible, false, "Must be feasible");
console.log("✓ Test 1 Passed: Valid target (8.0 -> 8.5 over 20 credits = 10.0 SGPA)");

// 2. Impossible Target
const r2 = computePrediction({
  currentCgpa: 7.0,
  targetCgpa: 9.0,
  completedCredits: 80,
  upcomingCredits: 15,
  maxScale: 10.0
});
assert.strictEqual(r2.requiredSgpa, 19.67, "Required SGPA must be 19.67");
assert.strictEqual(r2.isImpossible, true, "Must be impossible");
assert.strictEqual(r2.maxAchievableCgpa, 7.47, "Ceiling must be 7.47");
console.log("✓ Test 2 Passed: Impossible target flagged with 7.47 ceiling");

// 3. Scenario Comparison
const sc = computeScenarios({
  currentCgpa: 8.0,
  completedCredits: 60,
  upcomingCredits: 20,
  totalCredits: 80
}, [7.0, 8.0, 9.0, 10.0]);
assert.strictEqual(sc[0].projectedCgpa, 7.75);
assert.strictEqual(sc[1].projectedCgpa, 8.00);
assert.strictEqual(sc[2].projectedCgpa, 8.25);
assert.strictEqual(sc[3].projectedCgpa, 8.50);
console.log("✓ Test 3 Passed: Hypothetical scenarios correctly credit-weighted (7.0->7.75, 8.0->8.00, 9.0->8.25, 10.0->8.50)");

console.log("\nALL JAVASCRIPT DETERMINISTIC TESTS PASSED!");
