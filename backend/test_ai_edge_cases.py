"""
Unit Tests for AI Error Handling & Edge Cases (GradePilot AI Backend)
Tests:
1. Missing API Key handling (503 Service Unavailable)
2. Invalid input handling (400 Bad Request)
3. Provider APIError / timeout handling (502 / 503 status)
4. Malformed AI response handling
5. Failed study plan generation error formatting
6. Chat assistant error handling
"""

import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, execute_gemini_generation

class TestAiEdgeCases(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    # 1. Missing API Key
    def test_missing_api_key_returns_503(self):
        with patch("app.genai_client", None):
            res = self.client.post("/api/ai/analyze", json={
                "currentCgpa": 7.5,
                "targetCgpa": 8.5
            })
            self.assertEqual(res.status_code, 503)
            data = res.get_json()
            self.assertIn("API Credentials Missing", data.get("error", ""))

    # 2. Invalid Input (Missing required field)
    def test_invalid_input_returns_400(self):
        res = self.client.post("/api/ai/chat", json={
            "history": []
            # 'message' is missing
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Validation Error", data.get("error", ""))

    # 3. Provider Timeout / APIError Simulation
    def test_provider_error_handling(self):
        with patch("app.genai_client") as mock_client:
            mock_client.models.generate_content.side_effect = Exception("API connection timeout to Gemini endpoint")
            res = self.client.post("/api/ai/analyze", json={
                "currentCgpa": 8.0,
                "targetCgpa": 9.0
            })
            self.assertEqual(res.status_code, 502)
            data = res.get_json()
            self.assertIn("AI Service", data.get("error", ""))
            # Ensure no credentials leaked
            self.assertNotIn("AIzaSy", res.get_data(as_text=True))

    # 4. Malformed / Empty AI Response
    def test_empty_ai_response_handling(self):
        with patch("app.genai_client") as mock_client:
            mock_resp = MagicMock()
            mock_resp.text = None
            mock_client.models.generate_content.return_value = mock_resp
            res = self.client.post("/api/ai/analyze", json={
                "currentCgpa": 8.0,
                "targetCgpa": 9.0
            })
            self.assertEqual(res.status_code, 502)

    # 5. Study Plan Failed Generation
    def test_study_plan_invalid_days_returns_400(self):
        res = self.client.post("/api/ai/study-plan", json={
            "subjects": ["Mathematics"],
            "dailyHours": 3.0,
            "preferredDays": ["InvalidDayName"]
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Validation Error", data.get("error", ""))

    # 6. Chat Bounded Input & Sanitization
    def test_chat_message_length_limit(self):
        excessive_message = "A" * 3000
        res = self.client.post("/api/ai/chat", json={
            "message": excessive_message
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("exceeds maximum allowed length", data.get("message", ""))

if __name__ == "__main__":
    unittest.main()
