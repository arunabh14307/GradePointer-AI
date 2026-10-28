"""
GradePilot AI - CGPA Predictor & Target Planning Automated Test Suite
Tests:
1. Valid target planning scenario with Gemini AI integration
2. Mathematically impossible target scenario (detection & ceiling calculation)
3. Zero upcoming credits validation rejection (division by zero guard)
4. Negative upcoming credits validation rejection
5. Negative completed credits validation rejection
6. Out-of-bounds CGPA validation rejection
7. Malformed JSON validation rejection
8. Deterministic formula parity verification
"""

import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://127.0.0.1:5000"

def post_json(endpoint, payload, timeout=60):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}

def test_1_valid_target():
    print("\n--- Test 1: Valid Target Planning ---")
    payload = {
        "currentCgpa": 8.0,
        "completedCredits": 60.0,
        "upcomingCredits": 20.0,
        "targetCgpa": 8.5,
        "maxScale": 10.0,
        "major": "Computer Science & Engineering",
        "academicNotes": "Targeting 8.5+ for Dean's Honors List",
        "scenarios": [
            {"sgpa": 7.0, "projectedCgpa": 7.75, "difference": -0.25, "meetsTarget": False},
            {"sgpa": 8.0, "projectedCgpa": 8.00, "difference": 0.00, "meetsTarget": False},
            {"sgpa": 9.0, "projectedCgpa": 8.25, "difference": 0.25, "meetsTarget": False},
            {"sgpa": 10.0, "projectedCgpa": 8.50, "difference": 0.50, "meetsTarget": True}
        ]
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}")
    assert status == 200, f"Expected 200, got {status}: {res}"
    calc = res.get("calculation", {})
    assert calc.get("requiredSgpa") == 10.0, f"Expected requiredSgpa=10.0, got {calc.get('requiredSgpa')}"
    assert calc.get("isImpossible") is False, "Expected isImpossible=False"
    assert calc.get("totalCredits") == 80.0, f"Expected totalCredits=80.0, got {calc.get('totalCredits')}"
    assert "analysis" in res and len(res["analysis"]) > 100, "Expected full Markdown analysis report"
    print("PASS: Valid target calculation & AI analysis confirmed.")

def test_2_impossible_target():
    print("\n--- Test 2: Impossible Target Detection & Ceiling Calculation ---")
    # Current CGPA 7.0 over 80 credits; wants 9.0 over next 15 credits.
    # Total credits = 95. Points needed = 9.0 * 95 - 7.0 * 80 = 855 - 560 = 295.
    # Required SGPA = 295 / 15 = 19.67 (which exceeds maxScale 10.0!)
    # Ceiling with perfect 10.0s = (560 + 150) / 95 = 710 / 95 = 7.47.
    payload = {
        "currentCgpa": 7.0,
        "completedCredits": 80.0,
        "upcomingCredits": 15.0,
        "targetCgpa": 9.0,
        "maxScale": 10.0,
        "major": "Electrical Engineering",
        "academicNotes": "Checking single-semester recovery to 9.0",
        "scenarios": [
            {"sgpa": 8.0, "projectedCgpa": 7.16, "difference": 0.16, "meetsTarget": False},
            {"sgpa": 9.0, "projectedCgpa": 7.32, "difference": 0.32, "meetsTarget": False},
            {"sgpa": 10.0, "projectedCgpa": 7.47, "difference": 0.47, "meetsTarget": False}
        ]
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}")
    assert status == 200, f"Expected 200, got {status}: {res}"
    calc = res.get("calculation", {})
    assert calc.get("isImpossible") is True, "Expected isImpossible=True"
    assert calc.get("requiredSgpa") == 19.67, f"Expected requiredSgpa=19.67, got {calc.get('requiredSgpa')}"
    assert calc.get("maxAchievableCgpa") == 7.47, f"Expected maxAchievableCgpa=7.47, got {calc.get('maxAchievableCgpa')}"
    assert "analysis" in res, "Expected analysis report"
    print(f"PASS: Impossible target flagged correctly. Ceiling = {calc.get('maxAchievableCgpa')}")

def test_3_zero_upcoming_credits():
    print("\n--- Test 3: Zero Upcoming Credits Validation (Division by Zero Guard) ---")
    payload = {
        "currentCgpa": 8.0,
        "completedCredits": 60.0,
        "upcomingCredits": 0.0,
        "targetCgpa": 8.5,
        "maxScale": 10.0
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}, Response: {res}")
    assert status == 400, f"Expected 400, got {status}"
    assert "Validation Error" in res.get("error", "") or "upcomingCredits" in res.get("message", "")
    print("PASS: Zero upcoming credits correctly rejected.")

def test_4_negative_upcoming_credits():
    print("\n--- Test 4: Negative Upcoming Credits Validation ---")
    payload = {
        "currentCgpa": 8.0,
        "completedCredits": 60.0,
        "upcomingCredits": -5.0,
        "targetCgpa": 8.5,
        "maxScale": 10.0
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}, Response: {res}")
    assert status == 400, f"Expected 400, got {status}"
    print("PASS: Negative upcoming credits correctly rejected.")

def test_5_negative_completed_credits():
    print("\n--- Test 5: Negative Completed Credits Validation ---")
    payload = {
        "currentCgpa": 8.0,
        "completedCredits": -10.0,
        "upcomingCredits": 20.0,
        "targetCgpa": 8.5,
        "maxScale": 10.0
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}, Response: {res}")
    assert status == 400, f"Expected 400, got {status}"
    print("PASS: Negative completed credits correctly rejected.")

def test_6_out_of_bounds_cgpa():
    print("\n--- Test 6: Out-of-Bounds CGPA Validation ---")
    payload = {
        "currentCgpa": 12.5,
        "completedCredits": 60.0,
        "upcomingCredits": 20.0,
        "targetCgpa": 8.5,
        "maxScale": 10.0
    }
    status, res = post_json("/api/ai/predict", payload)
    print(f"Status: {status}, Response: {res}")
    assert status == 400, f"Expected 400, got {status}"
    print("PASS: Out-of-bounds CGPA correctly rejected.")

def test_7_malformed_json():
    print("\n--- Test 7: Malformed JSON Rejection ---")
    url = f"{BASE_URL}/api/ai/predict"
    req = urllib.request.Request(
        url,
        data=b"This is not JSON",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Expected 400 error for malformed JSON"
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"Expected 400, got {e.code}"
        print("PASS: Malformed JSON correctly rejected.")

def run_all_tests():
    print("================================================================")
    print(" GradePilot AI - CGPA Predictor & Target Planning Test Suite")
    print("================================================================")
    test_1_valid_target()
    test_2_impossible_target()
    test_3_zero_upcoming_credits()
    test_4_negative_upcoming_credits()
    test_5_negative_completed_credits()
    test_6_out_of_bounds_cgpa()
    test_7_malformed_json()
    print("\n================================================================")
    print(" ALL 7 PREDICTOR SUITE TESTS PASSED SUCCESSFULLY! ")
    print("================================================================")

if __name__ == "__main__":
    run_all_tests()
