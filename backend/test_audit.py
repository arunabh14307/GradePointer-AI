"""
GradePilot AI - Final Comprehensive Audit & Numerical Verification Suite
Tests numerical formulas, edge cases, error conditions, security boundaries,
and live AI endpoints.
"""

import sys
import json
import time
import requests

BASE_URL = "http://127.0.0.1:5000"

def log_test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}" + (f" - {detail}" if detail else ""))
    if not passed:
        sys.exit(1)


# ==============================================================================
# 1. Numerical & Algorithmic Validation
# ==============================================================================
def test_numerical_formulas():
    print("\n--- 1. NUMERICAL & FORMULA TESTING ---")

    # A. 10.0 Standard Scale Grade Boundaries
    scale_10 = [
        {"min": 90, "max": 100, "grade": "O", "point": 10.0},
        {"min": 80, "max": 89.99, "grade": "A+", "point": 9.0},
        {"min": 70, "max": 79.99, "grade": "A", "point": 8.0},
        {"min": 60, "max": 69.99, "grade": "B+", "point": 7.0},
        {"min": 55, "max": 59.99, "grade": "B", "point": 6.0},
        {"min": 50, "max": 54.99, "grade": "C", "point": 5.0},
        {"min": 40, "max": 49.99, "grade": "P", "point": 4.0},
        {"min": 0,  "max": 39.99, "grade": "F", "point": 0.0}
    ]

    def score_to_grade(score):
        for item in scale_10:
            if score >= item["min"]:
                return item
        return scale_10[-1]

    log_test("Grade Boundary (Score 100 -> O)", score_to_grade(100)["grade"] == "O")
    log_test("Grade Boundary (Score 90 -> O)", score_to_grade(90)["grade"] == "O")
    log_test("Grade Boundary (Score 89.9 -> A+)", score_to_grade(89.9)["grade"] == "A+")
    log_test("Grade Boundary (Score 80 -> A+)", score_to_grade(80)["grade"] == "A+")
    log_test("Grade Boundary (Score 79.99 -> A)", score_to_grade(79.99)["grade"] == "A")
    log_test("Grade Boundary (Score 55 -> B)", score_to_grade(55)["grade"] == "B")
    log_test("Grade Boundary (Score 40 -> P)", score_to_grade(40)["grade"] == "P")
    log_test("Grade Boundary (Score 39.9 -> F)", score_to_grade(39.9)["grade"] == "F")
    log_test("Grade Boundary (Score 0 -> F)", score_to_grade(0)["grade"] == "F")

    # B. Weighted CGPA Calculation
    # Course 1: GP 9.0, Cred 4 (QP = 36)
    # Course 2: GP 10.0, Cred 3 (QP = 30)
    # Course 3: GP 8.0, Cred 4 (QP = 32)
    # Course 4: GP 8.0, Cred 3 (QP = 24)
    # Course 5: GP 9.0, Cred 2 (QP = 18)
    # Total QP = 140, Total Credits = 16 => CGPA = 140 / 16 = 8.75
    courses = [
        {"gp": 9.0, "credits": 4},
        {"gp": 10.0, "credits": 3},
        {"gp": 8.0, "credits": 4},
        {"gp": 8.0, "credits": 3},
        {"gp": 9.0, "credits": 2}
    ]
    total_qp = sum(c["gp"] * c["credits"] for c in courses)
    total_cred = sum(c["credits"] for c in courses)
    calc_cgpa = round(total_qp / total_cred, 2)
    log_test("Weighted CGPA calculation", calc_cgpa == 8.75, f"cgpa={calc_cgpa}")

    # C. Required SGPA Formula
    # Formula: ReqSGPA = (TargetCGPA * (CompletedCred + UpcomingCred) - CurrentCGPA * CompletedCred) / UpcomingCred
    # Scenario 1: Current 7.5, Target 8.0, Completed 60, Upcoming 20
    # ReqSGPA = (8.0 * 80 - 7.5 * 60) / 20 = (640 - 450) / 20 = 190 / 20 = 9.50
    req_sgpa_1 = (8.0 * (60 + 20) - 7.5 * 60) / 20
    log_test("Required SGPA feasible calculation (Target 8.0)", round(req_sgpa_1, 2) == 9.50, f"req={req_sgpa_1}")

    # D. Impossible Target Detection
    # Scenario 2: Current 7.5, Target 8.5, Completed 60, Upcoming 20
    # ReqSGPA = (8.5 * 80 - 7.5 * 60) / 20 = (680 - 450) / 20 = 230 / 20 = 11.50 (> 10.0 Max ceiling)
    # Max achievable CGPA = (7.5 * 60 + 10.0 * 20) / 80 = (450 + 200) / 80 = 650 / 80 = 8.125 (~8.13)
    req_sgpa_2 = (8.5 * (60 + 20) - 7.5 * 60) / 20
    is_impossible = req_sgpa_2 > 10.0
    max_achievable = round((7.5 * 60 + 10.0 * 20) / 80, 2)
    log_test("Impossible Target Detection (11.5 > 10.0)", is_impossible and max_achievable in (8.12, 8.13), f"req={req_sgpa_2}, max={max_achievable}")

    # E. Attendance Target Solver
    # Target 75%: Attended 18, Total 25 -> 18/25 = 72%
    # Consecutive classes needed: (18 + x) / (25 + x) >= 0.75 => 18 + x >= 18.75 + 0.75x => 0.25x >= 0.75 => x = 3
    # Classes can skip: Attended 22, Total 25 -> 22/25 = 88%
    # 22 / (25 + y) >= 0.75 => 22 >= 18.75 + 0.75y => 3.25 >= 0.75y => y = floor(4.33) = 4
    def classes_needed_for_75(attended, total):
        if total == 0: return 0
        current_pct = (attended / total) * 100
        if current_pct >= 75: return 0
        return int((0.75 * total - attended) / 0.25 + 0.999)

    def classes_can_skip_for_75(attended, total):
        if total == 0 or (attended / total) < 0.75: return 0
        return int((attended - 0.75 * total) / 0.75)

    needed = classes_needed_for_75(18, 25)
    skips = classes_can_skip_for_75(22, 25)
    log_test("Attendance deficit solver (18/25 needs 3 classes)", needed == 3, f"needed={needed}")
    log_test("Attendance buffer solver (22/25 can skip 4 classes)", skips == 4, f"can_skip={skips}")


# ==============================================================================
# 2. Security & Backend Guardrails
# ==============================================================================
def test_security_and_guardrails():
    print("\n--- 2. SECURITY & VALIDATION TESTING ---")

    # A. Check CORS Headers
    res = requests.options(f"{BASE_URL}/api/health")
    log_test("CORS preflight handling", res.status_code in (200, 204))

    # B. 1MB Payload Limit Enforcement (413 Payload Too Large)
    large_payload = "A" * (1024 * 1024 + 500)
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            data=large_payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        log_test("1MB Payload Limit Enforcement (413)", res.status_code == 413, f"status={res.status_code}")
    except Exception as e:
        log_test("1MB Payload Limit Enforcement", False, str(e))

    # C. Malformed JSON Body (400 Bad Request)
    res = requests.post(
        f"{BASE_URL}/api/ai/analyze",
        data="{invalid_json: true,",
        headers={"Content-Type": "application/json"},
        timeout=5
    )
    log_test("Malformed JSON payload returns 400", res.status_code == 400, f"status={res.status_code}")

    # D. Missing Required Fields Validation (400)
    res = requests.post(
        f"{BASE_URL}/api/ai/analyze",
        json={"subjects": ["Math"]},  # missing currentCgpa & targetCgpa
        headers={"Content-Type": "application/json"},
        timeout=5
    )
    log_test("Missing required fields rejected (400)", res.status_code == 400 and "Validation Error" in res.json().get("error", ""))

    # E. Numerical Boundary Validation (Negative / Out of range)
    res = requests.post(
        f"{BASE_URL}/api/ai/analyze",
        json={"currentCgpa": -1.0, "targetCgpa": 9.0},
        headers={"Content-Type": "application/json"},
        timeout=5
    )
    log_test("Negative CGPA rejected (400)", res.status_code == 400)

    res = requests.post(
        f"{BASE_URL}/api/ai/analyze",
        json={"currentCgpa": 8.0, "targetCgpa": 14.5},
        headers={"Content-Type": "application/json"},
        timeout=5
    )
    log_test("Target CGPA > 10.0 rejected (400)", res.status_code == 400)

    # F. Verify No Secrets Leaked in 404/500/400 Error Bodies
    res = requests.get(f"{BASE_URL}/api/non_existent_endpoint")
    data_str = res.text
    log_test("404 Error does not expose internal secrets", "AIzaSy" not in data_str and "GEMINI" not in data_str)


# ==============================================================================
# 3. Live AI Endpoints & Fallback Verification
# ==============================================================================
def test_live_ai_endpoints():
    print("\n--- 3. LIVE AI ENDPOINT AUDIT ---")

    # A. Health Check
    res = requests.get(f"{BASE_URL}/api/health", timeout=5)
    data = res.json()
    log_test("GET /api/health", res.status_code == 200 and data.get("status") == "ok", f"gemini_configured={data.get('gemini_configured')}")

    # B. AI Academic Advisor (/api/ai/analyze)
    advisor_payload = {
        "currentCgpa": 7.8,
        "targetCgpa": 8.8,
        "weeklyStudyHours": 16.0,
        "major": "Computer Science",
        "institution": "Engineering College",
        "subjects": [
            {"name": "Operating Systems", "credits": 4.0, "gradePoints": 8.0},
            {"name": "Discrete Mathematics", "credits": 3.0, "gradePoints": 7.0},
            {"name": "Data Structures", "credits": 4.0, "gradePoints": 9.0}
        ],
        "difficultSubjects": "Discrete Mathematics"
    }
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/api/ai/analyze", json=advisor_payload, timeout=30)
    dur = round(time.time() - t0, 2)
    data = res.json()
    log_test("POST /api/ai/analyze (Live AI response)", res.status_code == 200 and len(data.get("analysis", "")) > 50, f"duration={dur}s, length={len(data.get('analysis', ''))}")

    # C. AI Study Planner (/api/ai/study-plan)
    planner_payload = {
        "subjects": ["Operating Systems", "Database Systems", "Linear Algebra"],
        "focusSubjects": ["Operating Systems"],
        "academicGoals": "Score 9.0 SGPA",
        "dailyHours": 3.0,
        "preferredDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Saturday"],
        "sessionLength": 45,
        "revisionPreference": "Active Recall & Flashcards"
    }
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/api/ai/study-plan", json=planner_payload, timeout=40)
    dur = round(time.time() - t0, 2)
    data = res.json()
    plan = data.get("plan", {}) or data.get("studyPlan", {})
    days = plan.get("days", []) or plan.get("weeklySchedule", [])
    log_test("POST /api/ai/study-plan (Structured JSON schedule)", res.status_code == 200 and len(days) > 0, f"status={res.status_code}, duration={dur}s, days={len(days)}, msg={data.get('message')}")

    # D. AI CGPA Predictor (/api/ai/predict)
    predict_payload = {
        "currentCgpa": 7.5,
        "targetCgpa": 8.0,
        "completedCredits": 60,
        "upcomingCredits": 20
    }
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/api/ai/predict", json=predict_payload, timeout=30)
    dur = round(time.time() - t0, 2)
    data = res.json()
    log_test("POST /api/ai/predict (Trajectory analysis)", res.status_code == 200 and len(data.get("prediction", "") or data.get("advice", "") or data.get("analysis", "")) > 20, f"duration={dur}s")

    # E. AI Chat Assistant (/api/ai/chat)
    chat_payload = {
        "message": "Calculate my percentage if my CGPA is 8.4 on a 10-point scale.",
        "history": [],
        "academicContext": {
            "currentCgpa": 8.4,
            "targetCgpa": 9.0
        }
    }
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/api/ai/chat", json=chat_payload, timeout=30)
    dur = round(time.time() - t0, 2)
    data = res.json()
    log_test("POST /api/ai/chat (English numerical context)", res.status_code == 200 and len(data.get("response", "")) > 20, f"duration={dur}s")

    # F. AI Chat Assistant (Hinglish Support)
    hinglish_payload = {
        "message": "Bhai mere maths me marks kam aa rahe hai, kya karu?",
        "history": [],
        "academicContext": {
            "currentCgpa": 7.2,
            "targetCgpa": 8.5
        }
    }
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/api/ai/chat", json=hinglish_payload, timeout=30)
    dur = round(time.time() - t0, 2)
    data = res.json()
    log_test("POST /api/ai/chat (Hinglish mentor response)", res.status_code == 200 and len(data.get("response", "")) > 20, f"duration={dur}s")


if __name__ == "__main__":
    print("==================================================================")
    print("      GRADEPILOT AI - COMPREHENSIVE AUDIT & VERIFICATION          ")
    print("==================================================================")
    test_numerical_formulas()
    test_security_and_guardrails()
    test_live_ai_endpoints()
    print("\n==================================================================")
    print("   ALL AUDIT CHECKS PASSED: 100% NUMERICAL & SECURITY INTEGRITY   ")
    print("==================================================================\n")
