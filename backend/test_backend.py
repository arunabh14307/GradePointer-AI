"""
Automated Test Suite for GradePilot AI Flask Backend
Validates health checks, payload limits, schema validation, error handling,
and official Google GenAI SDK integration.
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

def run_tests():
    print(f"Starting GradePilot AI Backend Verification at {BASE_URL}...\n")
    
    # 1. Health Endpoint
    try:
        res = requests.get(f"{BASE_URL}/api/health", timeout=5)
        data = res.json()
        log_test("GET /api/health", res.status_code == 200 and data.get("status") == "ok", f"data={data}")
    except Exception as e:
        log_test("GET /api/health", False, f"Connection failed: {e}")

    # 2. Malformed JSON Handling
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            data="not-a-json-string",
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        log_test("POST /api/ai/analyze (Malformed JSON)", res.status_code == 400, f"status={res.status_code}")
    except Exception as e:
        log_test("POST /api/ai/analyze (Malformed JSON)", False, str(e))

    # 3. Missing Required Fields
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            json={"major": "Computer Science"},  # missing currentCgpa & targetCgpa
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        data = res.json()
        log_test("POST /api/ai/analyze (Missing Fields)", res.status_code == 400 and "Validation Error" in data.get("error", ""), f"status={res.status_code}")
    except Exception as e:
        log_test("POST /api/ai/analyze (Missing Fields)", False, str(e))

    # 4. Out-of-Range Numerical Values
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            json={"currentCgpa": 14.5, "targetCgpa": 3.8},  # 14.5 > 10.0
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        log_test("POST /api/ai/analyze (Invalid CGPA Range)", res.status_code == 400, f"status={res.status_code}")
    except Exception as e:
        log_test("POST /api/ai/analyze (Invalid CGPA Range)", False, str(e))

    # 5. Missing Chat Message
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": ""},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        log_test("POST /api/ai/chat (Empty Message)", res.status_code == 400, f"status={res.status_code}")
    except Exception as e:
        log_test("POST /api/ai/chat (Empty Message)", False, str(e))

    # 6. Request Size Limit (1MB)
    try:
        large_payload = {"message": "A" * (1024 * 1024 + 100)}  # >1MB
        res = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json=large_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        log_test("POST /api/ai/chat (Payload > 1MB Limit)", res.status_code == 413, f"status={res.status_code}")
    except Exception as e:
        log_test("POST /api/ai/chat (Payload > 1MB Limit)", False, str(e))

    # 7. Live AI Academic Analysis
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            json={
                "currentCgpa": 3.4,
                "targetCgpa": 3.8,
                "major": "Computer Science",
                "weakSubjects": "Operating Systems",
                "weeklyStudyHours": 15
            },
            headers={"Content-Type": "application/json"},
            timeout=45
        )
        data = res.json()
        passed = res.status_code == 200 and data.get("success") is True and len(data.get("analysis", "")) > 50
        log_test("POST /api/ai/analyze (Live Gemini SDK)", passed, f"status={res.status_code}, snippet={data.get('analysis', '')[:60]}...")
    except Exception as e:
        log_test("POST /api/ai/analyze (Live Gemini SDK)", False, str(e))

    # 8. Live AI Chat
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={
                "message": "Give me a quick 1-sentence tip on study habits.",
                "profile": {"major": "Software Engineering", "currentCgpa": 3.5}
            },
            headers={"Content-Type": "application/json"},
            timeout=45
        )
        data = res.json()
        passed = res.status_code == 200 and data.get("success") is True and len(data.get("response", "")) > 10
        log_test("POST /api/ai/chat (Live Gemini SDK)", passed, f"status={res.status_code}, snippet={data.get('response', '')[:60]}...")
    except Exception as e:
        log_test("POST /api/ai/chat (Live Gemini SDK)", False, str(e))

    # 9. Live AI Study Plan (Structured JSON)
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/study-plan",
            json={
                "subject": "Discrete Mathematics",
                "daysLeft": 10,
                "dailyHours": 3.5,
                "difficulty": 4
            },
            headers={"Content-Type": "application/json"},
            timeout=45
        )
        data = res.json()
        plan = data.get("plan", {})
        passed = res.status_code == 200 and data.get("success") is True and "milestones" in plan and len(plan["milestones"]) > 0
        log_test("POST /api/ai/study-plan (Structured JSON)", passed, f"status={res.status_code}, milestones_count={len(plan.get('milestones', []))}")
    except Exception as e:
        log_test("POST /api/ai/study-plan (Structured JSON)", False, str(e))

    # 10. Live Academic Advisor with Courses, Credits, Marks & Metrics
    try:
        res = requests.post(
            f"{BASE_URL}/api/ai/analyze",
            json={
                "currentCgpa": 3.42,
                "targetCgpa": 3.80,
                "major": "Computer Science",
                "academicGoals": "Dean's Honor List & 3.8+ Graduation Standing",
                "difficultSubjects": "Operating Systems, Computer Networks",
                "semesterRecords": "Sem 1: 3.30, Sem 2: 3.45, Sem 3: 3.50",
                "weeklyStudyHours": 18,
                "subjects": [
                    {"name": "Data Structures", "gradePoints": 3.7, "credits": 4, "marks": "88/100"},
                    {"name": "Operating Systems", "gradePoints": 2.7, "credits": 4, "marks": "68/100"},
                    {"name": "Linear Algebra", "gradePoints": 3.3, "credits": 3, "marks": "78/100"},
                    {"name": "Technical Writing", "gradePoints": 4.0, "credits": 2, "marks": "92/100"}
                ]
            },
            headers={"Content-Type": "application/json"},
            timeout=25
        )
        data = res.json()
        metrics = data.get("calculatedMetrics", {})
        analysis_text = data.get("analysis", "")
        has_metrics = metrics.get("evaluatedCredits") == 13.0 and metrics.get("evaluatedGpa") is not None
        has_sections = "Academic Summary" in analysis_text and "Strengths" in analysis_text and "Recommendations" in analysis_text
        passed = res.status_code == 200 and data.get("success") is True and has_metrics and has_sections
        log_test("POST /api/ai/analyze (Full Subject & Metrics Analysis)", passed, f"evaluatedCredits={metrics.get('evaluatedCredits')}, GPA={metrics.get('evaluatedGpa')}")
    except Exception as e:
        log_test("POST /api/ai/analyze (Full Subject & Metrics Analysis)", False, str(e))

    print("\nAll 10 backend verification tests completed successfully!")

if __name__ == "__main__":
    run_tests()
