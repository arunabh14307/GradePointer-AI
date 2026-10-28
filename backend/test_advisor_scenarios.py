"""
Verification Script for AI Academic Advisor Scenarios
Tests:
1. Empty academic data (validates limitation/rejection handling)
2. Valid academic data (validates calculated metrics and 5 report sections)
3. Simulated API failure (validates graceful failure handling without fabrication)
"""

import sys
import json
import requests

BASE_URL = "http://127.0.0.1:5000"

def test_empty_academic_data():
    print("--- Test Scenario 1: Empty Academic Data ---")
    payload = {
        "currentCgpa": None,
        "targetCgpa": None,
        "academicGoals": "",
        "difficultSubjects": "",
        "semesterRecords": "",
        "subjects": []
    }
    res = requests.post(f"{BASE_URL}/api/ai/analyze", json=payload, headers={"Content-Type": "application/json"})
    print(f"Status Code: {res.status_code}")
    print(f"Response Body: {res.json()}")
    assert res.status_code == 400, f"Expected 400 for empty data, got {res.status_code}"
    assert "No academic performance data provided" in res.json().get("message", ""), "Expected explanatory limitation message"
    print("PASS Scenario 1: Empty academic data rejected cleanly with explanatory guidance.\n")

def test_valid_academic_data():
    print("--- Test Scenario 2: Valid Academic Data ---")
    payload = {
        "currentCgpa": 3.42,
        "targetCgpa": 3.80,
        "academicGoals": "3.80 Magna Cum Laude",
        "major": "Computer Science",
        "difficultSubjects": "Operating Systems, Automata Theory",
        "semesterRecords": "Sem 1: 3.30, Sem 2: 3.45, Sem 3: 3.50",
        "weeklyStudyHours": 18,
        "subjects": [
            {"name": "Data Structures", "gradePoints": 3.7, "credits": 4, "marks": "88/100"},
            {"name": "Operating Systems", "gradePoints": 2.7, "credits": 4, "marks": "68/100"},
            {"name": "Linear Algebra", "gradePoints": 3.3, "credits": 3, "marks": "78/100"},
            {"name": "Technical Writing", "gradePoints": 4.0, "credits": 2, "marks": "92/100"}
        ]
    }
    res = requests.post(f"{BASE_URL}/api/ai/analyze", json=payload, headers={"Content-Type": "application/json"}, timeout=60)
    print(f"Status Code: {res.status_code}")
    data = res.json()
    metrics = data.get("calculatedMetrics", {})
    print("Factual Calculated Metrics:", metrics)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert data.get("success") is True, "Expected success: True"
    assert metrics.get("evaluatedCredits") == 13.0, f"Expected 13.0 credits, got {metrics.get('evaluatedCredits')}"
    assert metrics.get("evaluatedGpa") == 3.35, f"Expected GPA 3.35, got {metrics.get('evaluatedGpa')}"
    assert "Data Structures" in metrics.get("strongSubjects", []), "Data Structures should be in strong subjects"
    assert "Operating Systems" in metrics.get("improvementSubjects", []), "Operating Systems should be in improvement subjects"

    analysis = data.get("analysis", "")
    print("\nReport Section Headers Found in AI Output:")
    for section in ["Academic Summary", "Strengths", "Improvement Areas", "Recommendations", "Next Steps"]:
        present = section.lower() in analysis.lower()
        print(f"  - Section '{section}': {'FOUND' if present else 'MISSING'}")
        assert present, f"Missing required section: {section}"

    print("\nPASS Scenario 2: Valid academic data generated factual metrics & 5-part AI advisory report.\n")

def test_simulated_api_failure():
    print("--- Test Scenario 3: Simulated API Failure (e.g. Missing Credentials / Service Down) ---")
    # Test with invalid key override or test endpoint
    from unittest.mock import patch
    from app import app
    client = app.test_client()

    with patch('app.genai_client', None):
        res = client.post('/api/ai/analyze', json={
            "currentCgpa": 3.5,
            "targetCgpa": 3.8,
            "subjects": [{"name": "Math", "gradePoints": 3.5, "credits": 4}]
        })
        print(f"Simulated Offline Status Code: {res.status_code}")
        print(f"Simulated Offline Response: {res.get_json()}")
        assert res.status_code == 503, f"Expected 503 Service Unavailable, got {res.status_code}"
        assert res.get_json().get("error") == "API Credentials Missing", "Expected API Credentials Missing error"
        assert "Gemini API key is not configured" in res.get_json().get("message", ""), "Expected clean error message"
        # Confirm NO false AI advice is fabricated
        assert "analysis" not in res.get_json(), "Must NOT fabricate AI advice when provider fails"
    print("PASS Scenario 3: Simulated failure returns clean error without fabricating false AI.\n")

if __name__ == "__main__":
    test_empty_academic_data()
    test_valid_academic_data()
    test_simulated_api_failure()
    print("ALL 3 ACADEMIC ADVISOR SCENARIOS VERIFIED SUCCESSFULLY!")
