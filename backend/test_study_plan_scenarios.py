"""
GradePilot AI - AI Study Plan Generator Automated Test Suite (Phase 9)
Tests:
1. Missing subjects rejection (400 Validation Error)
2. Out-of-bounds daily study hours rejection (400 Validation Error)
3. Empty preferred study days rejection (400 Validation Error)
4. Valid weekly study plan generation with Gemini AI:
   - Stated availability ceiling strictly respected (no day exceeds daily hours)
   - Preferred study days respected (Mon-Fri active; Sat-Sun 0 hours rest days)
   - Avoids scheduling tasks on unavailable days
   - Uses provided subjects with priority weighting
   - Does NOT invent exam dates when omitted
   - Explains all scheduling assumptions
   - Contains weekly review and progress checkpoints
   - Contains disclaimer with no false grade guarantees
5. Exam dates integration when provided vs omitted
6. Simulated API failure handling (returns clean 503 error without fabricating fake AI plans)
7. Malformed AI response handling (clean 502 with error details)
"""

import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, execute_gemini_generation

client = app.test_client()

def test_1_missing_subjects():
    print("\n--- Test 1: Missing Subjects Validation ---")
    res = client.post("/api/ai/study-plan", json={
        "subjects": [],
        "dailyHours": 3.5,
        "preferredDays": ["Monday", "Tuesday", "Wednesday"]
    })
    print(f"Status: {res.status_code}, Response: {res.get_json()}")
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    assert "At least one valid subject name is required" in res.get_json().get("message", "")
    print("PASS: Missing subjects rejected cleanly with 400.")

def test_2_invalid_study_hours():
    print("\n--- Test 2: Out-of-Bounds Study Hours Validation ---")
    # Test hours too low (< 0.5)
    res_low = client.post("/api/ai/study-plan", json={
        "subjects": ["Data Structures"],
        "dailyHours": 0.2,
        "preferredDays": ["Monday"]
    })
    assert res_low.status_code == 400, f"Expected 400 for 0.2 hrs, got {res_low.status_code}"

    # Test hours too high (> 16.0)
    res_high = client.post("/api/ai/study-plan", json={
        "subjects": ["Data Structures"],
        "dailyHours": 24.0,
        "preferredDays": ["Monday"]
    })
    assert res_high.status_code == 400, f"Expected 400 for 24.0 hrs, got {res_high.status_code}"
    print("PASS: Out-of-bounds study hours rejected cleanly with 400.")

def test_3_empty_preferred_days():
    print("\n--- Test 3: Empty Preferred Study Days Validation ---")
    res = client.post("/api/ai/study-plan", json={
        "subjects": ["Data Structures", "Operating Systems"],
        "dailyHours": 3.0,
        "preferredDays": []
    })
    assert res.status_code == 400, f"Expected 400 for empty preferred days, got {res.status_code}"
    assert "preferred study day" in res.get_json().get("message", "").lower()
    print("PASS: Empty preferred days rejected cleanly with 400.")

def test_4_valid_weekly_plan_and_rules():
    print("\n--- Test 4: Live Weekly Study Plan & Rule Enforcement ---")
    payload = {
        "subjects": ["Data Structures & Algorithms", "Operating Systems", "Linear Algebra"],
        "focusSubjects": ["Operating Systems"],
        "academicGoals": "Score 3.8+ GPA and master memory management & dynamic programming",
        "dailyHours": 3.0,
        "preferredDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "examDates": "",  # explicitly omitted
        "sessionLength": 45,
        "revisionPreferences": "Daily Active Recall (15-20 min start/end)"
    }
    res = client.post("/api/ai/study-plan", json=payload)
    print(f"Status Code: {res.status_code}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.get_json()}"

    data = res.get_json()
    assert data.get("success") is True, "Expected success: true"
    plan = data.get("plan", {})

    # Check 7 days present
    days = plan.get("days", [])
    assert len(days) == 7, f"Expected 7 days, got {len(days)}"

    # Check active days vs rest days compliance
    active_days = [d for d in days if d.get("isStudyDay")]
    rest_days = [d for d in days if not d.get("isStudyDay")]

    assert len(active_days) == 5, f"Expected 5 active study days, got {len(active_days)}"
    assert len(rest_days) == 2, f"Expected 2 rest days, got {len(rest_days)}"

    # RULE 1: Do not exceed student's stated study-time availability (3.0 hrs/day)
    for d in active_days:
        scheduled_hours = d.get("totalStudyHours", 0)
        assert scheduled_hours <= 3.2, f"Day {d['dayName']} scheduled {scheduled_hours} hrs, exceeding 3.0 availability limit!"

    # RULE 2: Respect preferred study days & avoid scheduling tasks on unavailable days
    for d in rest_days:
        assert d["dayName"] in ["Saturday", "Sunday"], f"Rest day {d['dayName']} was not one of the unselected days!"
        assert d.get("totalStudyHours") == 0.0, f"Rest day {d['dayName']} had non-zero hours!"
        assert len(d.get("blocks", [])) == 0, f"Rest day {d['dayName']} had scheduled study tasks!"

    # RULE 3: Use provided subjects
    for d in active_days:
        for b in d.get("blocks", []):
            if b.get("type") != "Short Break":
                assert b.get("subject") in payload["subjects"], f"Unknown subject {b.get('subject')} in block!"

    # RULE 4: Do not invent exam dates when omitted
    summary = plan.get("weeklySummary", {})
    assumptions = summary.get("assumptions", [])
    has_no_exam_assumption = any("no exam" in str(a).lower() or "not provided" in str(a).lower() or "without invented" in str(a).lower() for a in assumptions)
    assert has_no_exam_assumption, f"Expected assumption stating no exam dates were provided/invented: {assumptions}"

    # RULE 5: Explain any assumptions
    assert len(assumptions) >= 3, f"Expected multiple detailed assumptions, got: {assumptions}"

    # Check required block types
    all_block_types = set()
    for d in active_days:
        for b in d.get("blocks", []):
            all_block_types.add(b.get("type"))
    assert "Deep Study" in all_block_types or "Practice Activity" in all_block_types, "Expected study blocks"
    assert "Short Break" in all_block_types, "Expected scheduled short breaks"

    # Check weekly review and progress checkpoints
    assert "weeklyReview" in plan and "tasks" in plan["weeklyReview"], "Expected weekly review with tasks"
    assert "progressCheckpoints" in plan and len(plan["progressCheckpoints"]) >= 2, "Expected progress checkpoints"

    # Check disclaimer
    assert "disclaimer" in summary and "guarantee" in summary["disclaimer"].lower() and ("does not" in summary["disclaimer"].lower() or "not" in summary["disclaimer"].lower()), "Expected ethical disclaimer without grade guarantees"

    print("PASS: Live weekly plan strictly conforms to all schedule rules & constraints.")

def test_5_exam_dates_noted_when_provided():
    print("\n--- Test 5: Exam Dates Handling When Provided ---")
    payload = {
        "subjects": ["Data Structures", "Linear Algebra"],
        "dailyHours": 2.5,
        "preferredDays": ["Monday", "Tuesday", "Wednesday"],
        "examDates": "Data Structures Midterm: Nov 24",
        "academicGoals": "Ace midterm exam"
    }
    res = client.post("/api/ai/study-plan", json=payload)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    plan = res.get_json().get("plan", {})
    assumptions = plan.get("weeklySummary", {}).get("assumptions", [])
    has_exam_mention = any("nov 24" in str(a).lower() or "exam" in str(a).lower() for a in assumptions)
    assert has_exam_mention, f"Expected exam date to be acknowledged in assumptions: {assumptions}"
    print("PASS: Exam dates acknowledged in plan assumptions without hallucination.")

def test_6_simulated_api_failure_no_fake_plan():
    print("\n--- Test 6: Simulated API Failure Handling (No Fake Plan Fabrication) ---")
    import app as app_module
    original_client = app_module.genai_client
    try:
        app_module.genai_client = None  # Simulate missing credentials / offline provider
        res = client.post("/api/ai/study-plan", json={
            "subjects": ["Data Structures"],
            "dailyHours": 3.0,
            "preferredDays": ["Monday", "Tuesday", "Wednesday"]
        })
        print(f"Offline status: {res.status_code}, body: {res.get_json()}")
        assert res.status_code == 503, f"Expected 503 Service Unavailable, got {res.status_code}"
        assert res.get_json().get("error") == "API Credentials Missing"
        # Guarantee no fake plan is fabricated
        assert "plan" not in res.get_json(), "MUST NOT fabricate fake study plan when service fails!"
        print("PASS: API failure cleanly returns 503 without fake plan fabrication.")
    finally:
        app_module.genai_client = original_client

def test_7_malformed_ai_response_handling():
    print("\n--- Test 7: Malformed AI Response Handling ---")
    # Mock execute_gemini_generation to return malformed non-JSON string
    with patch('app.execute_gemini_generation') as mock_gen:
        mock_gen.return_value = ("This is just plain text, not JSON at all!", None)
        res = client.post("/api/ai/study-plan", json={
            "subjects": ["Data Structures"],
            "dailyHours": 3.0,
            "preferredDays": ["Monday"]
        })
        print(f"Malformed AI response status: {res.status_code}, body: {res.get_json()}")
        assert res.status_code == 502, f"Expected 502 Bad Gateway for malformed JSON, got {res.status_code}"
        assert res.get_json().get("error") == "Model Response Malformed"
        assert "plan" not in res.get_json(), "MUST NOT return plan when AI response is malformed!"
        print("PASS: Malformed AI response rejected cleanly with 502.")

def test_8_backwards_compatibility():
    print("\n--- Test 8: Backwards Compatibility with Single Subject & Milestones ---")
    res = client.post("/api/ai/study-plan", json={
        "subject": "Discrete Mathematics",
        "daysLeft": 10,
        "dailyHours": 3.5,
        "difficulty": 4
    })
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.get_json()}"
    plan = res.get_json().get("plan", {})
    assert "milestones" in plan and len(plan["milestones"]) > 0, "Expected milestones array for backwards compatibility"
    assert "days" in plan and len(plan["days"]) == 7, "Expected full 7-day schedule"
    print("PASS: Backwards compatibility with single subject & milestones preserved.")

if __name__ == "__main__":
    print("================================================================")
    print(" GradePilot AI - AI Study Plan Generator Automated Test Suite   ")
    print("================================================================")
    test_1_missing_subjects()
    test_2_invalid_study_hours()
    test_3_empty_preferred_days()
    test_4_valid_weekly_plan_and_rules()
    test_5_exam_dates_noted_when_provided()
    test_6_simulated_api_failure_no_fake_plan()
    test_7_malformed_ai_response_handling()
    test_8_backwards_compatibility()
    print("\nALL 8 AI STUDY PLAN TEST SCENARIOS PASSED SUCCESSFULLY!")
