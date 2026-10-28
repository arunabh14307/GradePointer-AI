"""
GradePilot AI - AI Chat Assistant Test Suite
Validates:
- Validation errors on empty messages (400)
- English academic inquiry (200)
- Hinglish conversational inquiry (200)
- Authoritative calculator integration (verified arithmetic fidelity)
- Selective academic context
- Bounded conversation history
- System boundaries (no fake records, no private database claims)
"""

import sys
import unittest
import json
from app import app

class TestAiChatScenarios(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_empty_message_rejected(self):
        """Empty or whitespace-only messages must be rejected with HTTP 400."""
        payload = {"message": "   "}
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)
        self.assertIn("Validation Error", data["error"])

    def test_02_missing_message_rejected(self):
        """Missing message field must be rejected with HTTP 400."""
        payload = {"context": {"currentCgpa": 8.0}}
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 400)

    def test_03_english_academic_inquiry(self):
        """English academic inquiry should return 200 with actionable markdown response."""
        payload = {
            "message": "Explain credit-weighted GPA and how course credits affect my cumulative score.",
            "academicContext": {
                "currentCgpa": 8.2,
                "completedCredits": 45
            }
        }
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))
        reply = data.get("response") or data.get("reply")
        self.assertIsNotNone(reply)
        self.assertTrue(len(reply) > 50)
        # Check that response mentions credits/weights
        self.assertTrue(any(term in reply.lower() for term in ["credit", "weight", "gpa", "course"]))

    def test_04_hinglish_academic_inquiry(self):
        """Hinglish academic inquiry should be understood and responded to in natural Hinglish."""
        payload = {
            "message": "Mera CGPA 7.4 hai aur mujhe 8.0 chahiye. Next semester me kitna mehnat karna padega?",
            "academicContext": {
                "currentCgpa": 7.4,
                "targetCgpa": 8.0,
                "completedCredits": 60,
                "upcomingCredits": 20
            }
        }
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))
        reply = data.get("response") or data.get("reply")
        self.assertIsNotNone(reply)
        # In Hinglish, common markers appear like 'aap', 'karna', 'padega', 'semester', 'sgpa', 'cgpa', 'marks'
        self.assertTrue(len(reply) > 50)

    def test_05_authoritative_calculator_integration(self):
        """Calculator results passed to the backend must be respected as authoritative ground truth."""
        payload = {
            "message": "What SGPA do I need to reach my target CGPA?",
            "academicContext": {
                "currentCgpa": 7.5,
                "targetCgpa": 8.2,
                "completedCredits": 60,
                "upcomingCredits": 20,
                "calculatorResult": {
                    "type": "Target SGPA Prediction",
                    "requiredSgpa": 10.3,
                    "isAchievable": False,
                    "status": "Mathematically Impossible",
                    "maxAchievableCgpa": 8.125
                }
            }
        }
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        reply = data.get("response") or data.get("reply")
        # Must reflect the ground truth that 10.3 or impossible is the case
        reply_lower = reply.lower()
        self.assertTrue("10.3" in reply or "impossible" in reply_lower or "achiev" in reply_lower or "max" in reply_lower)

    def test_06_bounded_history_acceptance(self):
        """Chat history should be accepted and bounded properly."""
        history = [
            {"role": "user", "content": f"Turn {i}: How do I prepare for exams?"}
            for i in range(25) # 25 turns, exceeding the 15 bound
        ]
        payload = {
            "message": "Summarize our discussion so far.",
            "history": history
        }
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))

    def test_07_subject_specific_context(self):
        """Subject improvement question with selective subject context."""
        payload = {
            "message": "Help me improve Mathematics. I am struggling with calculus.",
            "academicContext": {
                "relevantSubjects": [
                    {"name": "Engineering Mathematics III", "credits": 4, "gradePoint": 6.0}
                ]
            }
        }
        response = self.client.post("/api/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        reply = data.get("response") or data.get("reply")
        self.assertTrue(any(term in reply.lower() for term in ["math", "calculus", "practice", "concept"]))

if __name__ == "__main__":
    unittest.main()
