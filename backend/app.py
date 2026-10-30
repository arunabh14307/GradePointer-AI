"""
GradePilot AI - Python Flask Backend Server
Implements secure AI integration via official Google GenAI SDK, input validation,
CORS security, and structured academic endpoints.
"""

import os
import json
import logging
import mimetypes
from typing import Tuple, Any, Dict
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment configuration from .env if present
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

app = Flask(__name__)

# Security: Limit maximum payload size to 1MB to prevent DOS/memory exhaustion
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB

# Configure minimal, privacy-conscious logging (no academic data or secrets logged)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("GradePilotBackend")

# Read environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*").strip()
PORT = int(os.getenv("PORT", 5000))
DEBUG = os.getenv("DEBUG", "False").strip().lower() in ("true", "1", "yes")

# Configure CORS based on environment
if FRONTEND_ORIGIN and FRONTEND_ORIGIN != "*":
    CORS(app, resources={r"/api/*": {"origins": [FRONTEND_ORIGIN]}})
    logger.info(f"CORS restricted to origin: {FRONTEND_ORIGIN}")
else:
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    logger.info("CORS enabled for development origins (*)")

# Initialize official Google GenAI client if credentials exist
genai_client = None
if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        from google import genai
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info(f"Official Google GenAI SDK initialized. Default model: {GEMINI_MODEL}")
    except Exception as e:
        logger.error(f"Failed to initialize Google GenAI SDK: {e}")
        genai_client = None
else:
    logger.warning("No valid GEMINI_API_KEY detected in backend environment.")


# ==============================================================================
# Global HTTP Error Handlers
# ==============================================================================
@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({
        "error": "Bad Request",
        "message": getattr(e, "description", "The request body is invalid or malformed.")
    }), 400


@app.errorhandler(413)
def handle_payload_too_large(e):
    return jsonify({
        "error": "Payload Too Large",
        "message": "Request entity exceeds maximum permitted size limit (1MB)."
    }), 413


@app.errorhandler(404)
def handle_not_found(e):
    return jsonify({
        "error": "Not Found",
        "message": "The requested API endpoint does not exist."
    }), 404


@app.errorhandler(405)
def handle_method_not_allowed(e):
    return jsonify({
        "error": "Method Not Allowed",
        "message": "HTTP method not supported on this endpoint."
    }), 405


@app.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Unhandled server exception: {e}")
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred while processing your request."
    }), 500


# ==============================================================================
# Validation Helpers
# ==============================================================================
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

def parse_json_body() -> Tuple[Dict[str, Any], Any]:
    """
    Safely parses JSON request body.
    Returns (data, None) if successful, or (None, error_response) on error.
    """
    if not request.is_json:
        return None, (jsonify({
            "error": "Invalid Content-Type",
            "message": "Request must have 'Content-Type: application/json'."
        }), 400)

    try:
        data = request.get_json(silent=False)
    except RequestEntityTooLarge:
        raise
    except HTTPException:
        raise
    except Exception:
        return None, (jsonify({
            "error": "Malformed JSON",
            "message": "Could not parse request body as valid JSON."
        }), 400)

    if not isinstance(data, dict):
        return None, (jsonify({
            "error": "Invalid JSON Structure",
            "message": "JSON body must be a JSON object (dictionary)."
        }), 400)

    return data, None


def validate_number(
    val: Any,
    field_name: str,
    min_val: float,
    max_val: float,
    is_int: bool = False
) -> Tuple[Any, str]:
    """Validates that a value is numerical and within allowed bounds."""
    if val is None:
        return None, f"Field '{field_name}' is required."

    try:
        num = int(val) if is_int else float(val)
    except (ValueError, TypeError):
        expected = "an integer" if is_int else "a number"
        return None, f"Field '{field_name}' must be {expected}."

    if num < min_val or num > max_val:
        return None, f"Field '{field_name}' must be between {min_val} and {max_val}."

    return num, None


def validate_string(
    val: Any,
    field_name: str,
    max_len: int,
    required: bool = False
) -> Tuple[str, str]:
    """Validates string constraints and limits length for abuse prevention."""
    if val is None:
        if required:
            return None, f"Field '{field_name}' is required."
        return "", None

    if not isinstance(val, str):
        return None, f"Field '{field_name}' must be a string."

    trimmed = val.strip()
    if required and not trimmed:
        return None, f"Field '{field_name}' cannot be empty."

    if len(trimmed) > max_len:
        return None, f"Field '{field_name}' exceeds maximum allowed length of {max_len} characters."

    return trimmed, None


# ==============================================================================
# Google Gemini SDK Invocation Helper
# ==============================================================================
def execute_gemini_generation(prompt: str, system_instruction: str = None, max_output_tokens: int = 3500) -> Tuple[str, Tuple[Dict, int]]:
    """
    Invokes official Google GenAI SDK with graceful model fallback.
    Returns (result_text, None) on success or (None, (error_dict, status_code)) on failure.
    Does NOT fabricate fake AI responses when service fails.
    """
    if not genai_client:
        return None, (jsonify({
            "error": "API Credentials Missing",
            "message": "Gemini API key is not configured on the backend server."
        }), 503)

    from google.genai import errors as genai_errors

    # Fallback model candidate sequence in case of 503 demand spikes
    fallback_models = [
        GEMINI_MODEL,
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash"
    ]
    # De-duplicate while preserving order
    seen = set()
    candidate_models = [m for m in fallback_models if not (m in seen or seen.add(m))]

    last_error_message = None
    last_status_code = 502

    for model_name in candidate_models:
        try:
            config = {
                "temperature": 0.5,
                "max_output_tokens": max_output_tokens,
            }
            if system_instruction:
                config["system_instruction"] = system_instruction

            response = genai_client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )

            if response and response.text:
                return response.text, None
            else:
                last_error_message = "AI service returned an empty generation response."
                last_status_code = 502

        except genai_errors.APIError as e:
            logger.warning(f"Gemini API model '{model_name}' returned error: {e}")
            last_error_message = str(e.message if hasattr(e, "message") else e)
            last_status_code = getattr(e, "code", 502) or 502
            # If 503 (high demand), try the next candidate model
            if last_status_code == 503:
                continue
            break

        except Exception as e:
            logger.error(f"Unexpected error calling Gemini model '{model_name}': {e}")
            last_error_message = "Unexpected failure communicating with AI service provider."
            last_status_code = 502

    return None, (jsonify({
        "error": "AI Service Unavailable",
        "message": f"Unable to generate response from AI provider. {last_error_message or ''}".strip()
    }), last_status_code if last_status_code in (500, 502, 503, 504) else 502)


# Base directory of the repository (for serving static frontend files)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _serve_file(file_path: str):
    """
    Safely reads and returns a static file with correct MIME type,
    ensuring file descriptors are closed immediately in serverless environments.
    """
    if not os.path.isfile(file_path):
        return jsonify({"error": "Not Found", "message": "The requested resource does not exist."}), 404

    mime_type, _ = mimetypes.guess_type(file_path)
    if file_path.endswith(".js"):
        mime_type = "application/javascript"
    elif file_path.endswith(".css"):
        mime_type = "text/css"
    elif file_path.endswith(".html"):
        mime_type = "text/html; charset=utf-8"
    elif file_path.endswith(".svg"):
        mime_type = "image/svg+xml"

    try:
        with open(file_path, "rb") as f:
            data = f.read()
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {e}")
        return jsonify({"error": "Read Error", "message": "Failed to read requested file."}), 500

    resp = make_response(data)
    if mime_type:
        resp.headers["Content-Type"] = mime_type
    return resp


# ==============================================================================
# Endpoint 1: Root, Frontend & Health Check
# ==============================================================================
@app.route("/", methods=["GET"])
def index():
    """
    GET /
    Serves the GradePilot AI frontend application (index.html).
    Falls back to JSON status if static files are not present.
    """
    index_file = os.path.join(ROOT_DIR, "index.html")
    if os.path.exists(index_file):
        return _serve_file(index_file)
    return jsonify({
        "status": "online",
        "service": "GradePilot AI Backend",
        "version": "1.0.0",
        "gemini_configured": bool(genai_client is not None),
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/ai/chat",
            "analyze": "/api/ai/analyze",
            "advisor": "/api/ai/advisor",
            "study_plan": "/api/ai/study-plan",
            "predict": "/api/ai/predict"
        }
    }), 200


@app.route("/api", methods=["GET"])
def api_directory():
    """
    GET /api
    Returns API service directory and endpoint links.
    """
    return jsonify({
        "status": "online",
        "service": "GradePilot AI Backend",
        "version": "1.0.0",
        "gemini_configured": bool(genai_client is not None),
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/ai/chat",
            "analyze": "/api/ai/analyze",
            "advisor": "/api/ai/advisor",
            "study_plan": "/api/ai/study-plan",
            "predict": "/api/ai/predict"
        }
    }), 200


@app.route("/css/<path:filename>", methods=["GET"])
def serve_css(filename):
    return _serve_file(os.path.join(ROOT_DIR, "css", filename))


@app.route("/js/<path:filename>", methods=["GET"])
def serve_js(filename):
    return _serve_file(os.path.join(ROOT_DIR, "js", filename))


@app.route("/assets/<path:filename>", methods=["GET"])
def serve_assets(filename):
    return _serve_file(os.path.join(ROOT_DIR, "assets", filename))


@app.route("/api/health", methods=["GET"])
def health():
    """
    GET /api/health
    Returns server status and whether Gemini API credentials are configured.
    """
    is_configured = bool(genai_client is not None)
    return jsonify({
        "status": "ok",
        "service": "GradePilot AI Backend",
        "version": "1.0.0",
        "gemini_configured": is_configured,
        "model": GEMINI_MODEL
    }), 200


# ==============================================================================
# Endpoint 2: AI Academic Analysis
# ==============================================================================
@app.route("/api/ai/analyze", methods=["POST"])
def ai_analyze():
    """
    POST /api/ai/analyze
    Accepts student-supplied academic performance data (CGPA, subjects, credits,
    grade points, marks, semester records, goals, and difficult subjects) and
    returns a 5-section strategic academic advisory report with calculated metrics.
    """
    data, err_resp = parse_json_body()
    if err_resp:
        return err_resp

    # Optional Current CGPA
    current_cgpa = None
    if data.get("currentCgpa") is not None and str(data.get("currentCgpa")).strip() != "":
        current_cgpa, err = validate_number(data.get("currentCgpa"), "currentCgpa", 0.0, 10.0)
        if err:
            return jsonify({"error": "Validation Error", "message": err}), 400

    # Optional Target CGPA
    target_cgpa = None
    if data.get("targetCgpa") is not None and str(data.get("targetCgpa")).strip() != "":
        target_cgpa, err = validate_number(data.get("targetCgpa"), "targetCgpa", 0.0, 10.0)
        if err:
            return jsonify({"error": "Validation Error", "message": err}), 400

    # Optional Weekly Study Hours
    weekly_hours = 15.0
    if data.get("weeklyStudyHours") is not None and str(data.get("weeklyStudyHours")).strip() != "":
        weekly_hours, err = validate_number(data.get("weeklyStudyHours"), "weeklyStudyHours", 0.5, 168.0)
        if err:
            return jsonify({"error": "Validation Error", "message": err}), 400

    # String fields with limits
    major, err = validate_string(data.get("major", ""), "major", 100)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    academic_goals, err = validate_string(data.get("academicGoals", ""), "academicGoals", 500)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    difficult_subjects_raw = data.get("difficultSubjects") or data.get("weakSubjects") or ""
    difficult_subjects, err = validate_string(difficult_subjects_raw, "difficultSubjects", 500)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    semester_records, err = validate_string(data.get("semesterRecords", ""), "semesterRecords", 1000)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    notes, err = validate_string(data.get("additionalNotes", ""), "additionalNotes", 1000)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    # Validate subjects array if provided
    raw_subjects = data.get("subjects") or []
    if not isinstance(raw_subjects, list):
        return jsonify({"error": "Validation Error", "message": "'subjects' must be a list."}), 400

    if len(raw_subjects) > 30:
        return jsonify({"error": "Validation Error", "message": "Maximum 30 subjects permitted."}), 400

    validated_subjects = []
    total_eval_credits = 0.0
    weighted_eval_points = 0.0
    strong_subjects = []
    improvement_subjects = []

    for idx, s in enumerate(raw_subjects):
        if not isinstance(s, dict):
            continue
        name, s_err = validate_string(s.get("name", f"Subject {idx + 1}"), "subject name", 100, required=True)
        if s_err:
            return jsonify({"error": "Validation Error", "message": f"Subject #{idx + 1}: {s_err}"}), 400

        gp = None
        if s.get("gradePoints") is not None and str(s.get("gradePoints")).strip() != "":
            gp, gp_err = validate_number(s.get("gradePoints"), f"Subject '{name}' grade points", 0.0, 10.0)
            if gp_err:
                return jsonify({"error": "Validation Error", "message": gp_err}), 400

        cr = None
        if s.get("credits") is not None and str(s.get("credits")).strip() != "":
            cr, cr_err = validate_number(s.get("credits"), f"Subject '{name}' credits", 0.5, 30.0)
            if cr_err:
                return jsonify({"error": "Validation Error", "message": cr_err}), 400

        marks_str, _ = validate_string(str(s.get("marks", "")), "marks", 50)

        subject_item = {
            "name": name,
            "gradePoints": gp,
            "credits": cr,
            "marks": marks_str
        }
        validated_subjects.append(subject_item)

        # Factual mathematical accumulation
        if gp is not None and cr is not None:
            total_eval_credits += cr
            weighted_eval_points += (gp * cr)

        # Categorize strengths vs improvement based on provided metrics
        if gp is not None:
            if gp >= 3.5 or (gp >= 8.5 and gp > 4.0):
                strong_subjects.append(name)
            elif gp < 3.0 or (gp < 7.0 and gp > 4.0):
                improvement_subjects.append(name)

    # Empty data check: student must supply at least one meaningful piece of academic data
    has_any_data = bool(
        current_cgpa is not None or
        target_cgpa is not None or
        len(validated_subjects) > 0 or
        academic_goals or
        difficult_subjects or
        semester_records
    )
    if not has_any_data:
        return jsonify({
            "error": "Validation Error",
            "message": "No academic performance data provided. Please enter at least your current CGPA, academic goals, or course/subject records."
        }), 400

    # Compute evaluated GPA if credits were supplied
    evaluated_gpa = round(weighted_eval_points / total_eval_credits, 2) if total_eval_credits > 0 else None

    # Merge difficult subjects into improvement list if not already listed
    if difficult_subjects:
        for ds in [d.strip() for d in difficult_subjects.replace(";", ",").split(",") if d.strip()]:
            if ds not in improvement_subjects:
                improvement_subjects.append(ds)

    # Evaluate data completeness level
    data_completeness = "Comprehensive"
    limitations_notes = []
    if current_cgpa is None:
        limitations_notes.append("Cumulative CGPA was not provided; analysis is scoped to supplied individual subjects.")
    if len(validated_subjects) == 0:
        limitations_notes.append("Individual course grade points and credits were not supplied; analysis relies on aggregate GPA/goals.")
    elif total_eval_credits == 0:
        limitations_notes.append("Course credits were not specified; credit-weighted leverage calculations could not be performed.")
    if not semester_records:
        limitations_notes.append("Multi-semester historical trends were not provided; analysis reflects current snapshot only.")

    if len(limitations_notes) >= 3:
        data_completeness = "Minimal"
    elif len(limitations_notes) >= 1:
        data_completeness = "Partial"

    # Construct clean student context representation for prompt
    subjects_repr = []
    for s in validated_subjects:
        s_desc = f"- {s['name']}: "
        parts = []
        if s['gradePoints'] is not None:
            parts.append(f"Grade Points = {s['gradePoints']}")
        if s['credits'] is not None:
            parts.append(f"Credits = {s['credits']}")
        if s['marks']:
            parts.append(f"Marks = {s['marks']}")
        s_desc += ", ".join(parts) if parts else "No grade or credit details provided"
        subjects_repr.append(s_desc)

    subjects_block = "\n".join(subjects_repr) if subjects_repr else "None provided"

    prompt = f"""
    You are the Senior Academic Advisor and Cognitive Learning Director for GradePilot AI.
    Analyze the following STUDENT-SUPPLIED academic data. 
    Strict Rule: Rely ONLY on the information supplied below. Do NOT invent, assume, or fabricate any courses, grades, or marks not provided.

    === STUDENT-SUPPLIED ACADEMIC RECORD ===
    - Degree Major: {major or 'Not specified'}
    - Current CGPA: {f'{current_cgpa:.2f}' if current_cgpa is not None else 'Not provided'}
    - Target CGPA / Academic Goals: {academic_goals or (f'Target CGPA: {target_cgpa:.2f}' if target_cgpa is not None else 'Not specified')}
    - Challenging / Difficult Subjects: {difficult_subjects or 'None reported'}
    - Available Weekly Study Hours: {weekly_hours} hrs/week
    - Multi-Semester Records: {semester_records or 'None provided'}
    - Student Notes: {notes or 'None'}

    Course & Subject Details:
    {subjects_block}

    === FACTUAL CALCULATED METRICS ===
    - Evaluated Subject Credits: {total_eval_credits if total_eval_credits > 0 else 'N/A'}
    - Evaluated Course GPA: {evaluated_gpa if evaluated_gpa is not None else 'N/A'}
    - Identified Strong Courses: {', '.join(strong_subjects) if strong_subjects else 'None explicitly identified from supplied numbers'}
    - Identified Courses Needing Improvement: {', '.join(improvement_subjects) if improvement_subjects else 'None explicitly identified'}
    - Data Completeness Level: {data_completeness}
    - Specific Data Limitations: {'; '.join(limitations_notes) if limitations_notes else 'Full data supplied'}

    === MANDATORY REPORT STRUCTURE ===
    Produce a professional, structured Markdown report with EXACTLY these 5 sections:

    ### 1. 📊 Academic Summary
    - Executive summary of the student's current academic standing based on supplied data.
    - Explicitly state any data limitations (e.g. missing semester history, unweighted credits, or unverified marks) and how they constrain this evaluation.

    ### 2. 🌟 Strengths
    - Highlight specific courses where the student demonstrates strong performance or positive grade trends.
    - Point out high-credit courses where strong performance provides substantial GPA stability.

    ### 3. 🎯 Improvement Areas
    - Identify bottleneck courses, difficult subjects, or lower scores that represent the highest mathematical risk to academic standing.
    - Analyze the gap between current performance and target goals.

    ### 4. 💡 Recommendations
    - Concrete, high-leverage cognitive learning strategies (Active Recall, Spaced Repetition, High-Credit course prioritization).
    - Strategic time allocation blueprint for {weekly_hours} weekly study hours.

    ### 5. 🗓️ Suggested Next Steps & Checkpoints
    - Structured chronological progress checkpoints (e.g., Weeks 1-2 Quarantine, Weeks 3-4 Midterm Ramp, Finals Simulation).
    - Specific milestone criteria the student can review before exam periods.

    End with a brief 1-sentence reminder that this report is an educational strategic study guide and not an official university transcript evaluation.
    """

    system_instruction = (
        "You are GradePilot AI's Senior Academic Advisor. "
        "Provide thorough, empathetic, highly structured academic diagnostics. "
        "Strictly adhere to the 5 requested sections and never hallucinate academic data."
    )

    analysis_text, err_resp = execute_gemini_generation(prompt, system_instruction)
    if err_resp:
        return err_resp

    return jsonify({
        "success": True,
        "analysis": analysis_text,
        "advice": analysis_text,
        "calculatedMetrics": {
            "evaluatedCredits": total_eval_credits,
            "evaluatedGpa": evaluated_gpa,
            "strongSubjects": strong_subjects,
            "improvementSubjects": improvement_subjects,
            "dataCompleteness": data_completeness,
            "limitations": limitations_notes
        }
    }), 200


# Backward compatibility alias for /api/ai/advisor
@app.route("/api/ai/advisor", methods=["POST"])
def ai_advisor_alias():
    return ai_analyze()


# ==============================================================================
# Endpoint 3: AI Academic Chat
# ==============================================================================
@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    """
    POST /api/ai/chat
    Accepts student message, bounded conversation history, and selective academic context.
    Integrates verified calculator results for authoritative mathematical fidelity.
    Fluent in English and Hinglish. Never fabricates private institutional records.
    """
    data, err_resp = parse_json_body()
    if err_resp:
        return err_resp

    # Treat student messages as untrusted input
    raw_message = data.get("message")
    message, err = validate_string(raw_message, "message", 2000, required=True)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    # Parse bounded conversation history (limit to last 15 turns)
    raw_history = data.get("history") or []
    history_turns = []
    if isinstance(raw_history, list):
        for item in raw_history[-15:]:
            if isinstance(item, dict):
                role = item.get("role") or item.get("sender") or "user"
                role_str = "Assistant" if role in ("assistant", "bot", "model") else "Student"
                content = str(item.get("content") or item.get("message") or "")[:2000].strip()
                if content:
                    history_turns.append(f"{role_str}: {content}")

    # Extract selective academic context
    raw_context = data.get("academicContext") or data.get("context") or data.get("profile") or {}
    if not isinstance(raw_context, dict):
        raw_context = {}

    current_cgpa = raw_context.get("currentCgpa")
    target_cgpa = raw_context.get("targetCgpa")
    completed_credits = raw_context.get("completedCredits")
    upcoming_credits = raw_context.get("upcomingCredits")
    relevant_subjects = raw_context.get("relevantSubjects")
    calculator_result = raw_context.get("calculatorResult")

    context_lines = []
    if current_cgpa is not None and str(current_cgpa).strip() != "":
        context_lines.append(f"- Current CGPA: {str(current_cgpa).strip()[:10]}")
    if target_cgpa is not None and str(target_cgpa).strip() != "":
        context_lines.append(f"- Target CGPA: {str(target_cgpa).strip()[:10]}")
    if completed_credits is not None and str(completed_credits).strip() != "":
        context_lines.append(f"- Completed Credits: {str(completed_credits).strip()[:10]}")
    if upcoming_credits is not None and str(upcoming_credits).strip() != "":
        context_lines.append(f"- Upcoming / Remaining Credits: {str(upcoming_credits).strip()[:10]}")

    if isinstance(relevant_subjects, list) and relevant_subjects:
        context_lines.append("- Relevant Coursework / Subjects:")
        for sub in relevant_subjects[:10]:
            if isinstance(sub, dict):
                s_name = str(sub.get("name", "Subject"))[:60]
                s_cred = sub.get("credits", "")
                s_gp = sub.get("gradePoint") or sub.get("grade") or ""
                extra = []
                if s_cred:
                    extra.append(f"{s_cred} credits")
                if s_gp:
                    extra.append(f"Grade/Points: {s_gp}")
                details = f" ({', '.join(extra)})" if extra else ""
                context_lines.append(f"  * {s_name}{details}")

    calc_lines = []
    if isinstance(calculator_result, dict) and calculator_result:
        calc_type = str(calculator_result.get("type", "General Calculation"))
        calc_lines.append(f"Calculation Type: {calc_type}")
        for k, v in calculator_result.items():
            if k != "type" and v is not None:
                calc_lines.append(f"- {k}: {v}")

    # Build prompt
    prompt_sections = []
    if context_lines:
        prompt_sections.append("=== ACADEMIC CONTEXT (Provided by Student) ===\n" + "\n".join(context_lines))

    if calc_lines:
        prompt_sections.append(
            "=== AUTHORITATIVE CALCULATOR RESULT (Ground Truth from Client Calculation Engine) ===\n"
            "NOTE: The following calculation was computed deterministically by GradePilot's verified calculator functions. "
            "Treat these numbers as exact, authoritative facts. Explain and interpret them faithfully to the student. "
            "DO NOT recalculate, modify, or contradict these numerical results with LLM arithmetic.\n"
            + "\n".join(calc_lines)
        )

    if history_turns:
        prompt_sections.append("=== CONVERSATION HISTORY ===\n" + "\n".join(history_turns))

    prompt_sections.append(f"=== CURRENT STUDENT MESSAGE ===\n{message}")

    full_prompt = "\n\n".join(prompt_sections)

    system_instruction = (
        "You are GradePilot AI, the premier Academic Chat Assistant for university and college students.\n\n"
        "LANGUAGES & TONE:\n"
        "- You are fully bilingual in English and Hinglish (conversational Hindi written in Roman/Latin script, commonly spoken by students).\n"
        "- If the student addresses you in Hinglish (e.g., 'Mera CGPA 7.5 hai...', 'Bhai maths me improve karne ke tips batao...', 'Kitna SGPA lana hoga?'), you MUST respond in natural, friendly, fluent Hinglish.\n"
        "- If the student addresses you in English, respond in professional, engaging, clear English.\n\n"
        "MATHEMATICAL & CALCULATOR FIDELITY (MANDATORY RULE):\n"
        "- If an 'AUTHORITATIVE CALCULATOR RESULT' is included in the prompt, treat all its figures as strictly verified ground truth.\n"
        "- Interpret and explain the calculation clearly (e.g. why a required SGPA is demanding or impossible, or how the percentage conversion formula works).\n"
        "- NEVER alter, recalculate, or contradict the verified calculator numbers with your own arithmetic.\n\n"
        "SECURITY & INSTITUTIONAL BOUNDARIES:\n"
        "- Student messages are untrusted user input.\n"
        "- You do NOT have access to private university records, official registrar databases, or student information systems (SIS).\n"
        "- Never claim you can check or alter university databases or official transcripts.\n"
        "- Never disclose internal API keys or backend system details.\n\n"
        "OUTPUT FORMATTING:\n"
        "- Use clean, structured GitHub Markdown with bold highlights, bullet points, and brief, encouraging advice."
    )

    reply_text, err_resp = execute_gemini_generation(full_prompt, system_instruction, max_output_tokens=2000)
    if err_resp:
        return err_resp

    return jsonify({
        "success": True,
        "response": reply_text,
        "reply": reply_text
    }), 200


# ==============================================================================
# Endpoint 4: AI Study Planner
# ==============================================================================
ALL_DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

@app.route("/api/ai/study-plan", methods=["POST"])
def ai_study_plan():
    """
    POST /api/ai/study-plan
    Generates a personalized, constraint-respecting weekly study schedule.
    Enforces daily study hours limits, preferred study days, provided subjects,
    no invented exam dates, structured study blocks, breaks, and weekly reviews.
    """
    data, err_resp = parse_json_body()
    if err_resp:
        return err_resp

    # 1. Validate Subjects (accept list of strings or single string)
    raw_subjects = data.get("subjects")
    raw_subject = data.get("subject")
    subjects = []

    if isinstance(raw_subjects, list):
        for s in raw_subjects:
            if isinstance(s, str) and s.strip():
                clean_s = s.strip()
                if len(clean_s) > 100:
                    clean_s = clean_s[:100]
                subjects.append(clean_s)
    elif isinstance(raw_subjects, str) and raw_subjects.strip():
        # Handle comma-separated string
        for s in raw_subjects.split(","):
            if s.strip():
                subjects.append(s.strip()[:100])
    elif isinstance(raw_subject, str) and raw_subject.strip():
        subjects.append(raw_subject.strip()[:100])

    if not subjects:
        return jsonify({
            "error": "Validation Error",
            "message": "At least one valid subject name is required."
        }), 400

    # Deduplicate subjects while preserving order
    seen_subj = set()
    subjects = [s for s in subjects if not (s.lower() in seen_subj or seen_subj.add(s.lower()))]

    # 2. Validate Focus Subjects (requiring additional attention)
    raw_focus = data.get("focusSubjects") or data.get("weakSubjects") or data.get("difficultSubjects") or []
    focus_subjects = []
    if isinstance(raw_focus, list):
        for f in raw_focus:
            if isinstance(f, str) and f.strip():
                focus_subjects.append(f.strip()[:100])
    elif isinstance(raw_focus, str) and raw_focus.strip():
        for f in raw_focus.split(","):
            if f.strip():
                focus_subjects.append(f.strip()[:100])

    # 3. Validate Available Study Hours per Day
    raw_daily_hours = data.get("dailyHours")
    if raw_daily_hours is None and data.get("hoursPerDay") is not None:
        raw_daily_hours = data.get("hoursPerDay")
    if raw_daily_hours is None and data.get("studyHoursPerDay") is not None:
        raw_daily_hours = data.get("studyHoursPerDay")
    if raw_daily_hours is None and data.get("hours") is not None:
        raw_daily_hours = data.get("hours")
    if raw_daily_hours is None:
        return jsonify({
            "error": "Validation Error",
            "message": "Field 'dailyHours' (available study hours per day) is required."
        }), 400

    daily_hours, err = validate_number(raw_daily_hours, "dailyHours", 0.5, 16.0)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    # 4. Validate Preferred Study Days
    raw_days = data.get("preferredDays") or data.get("studyDays")
    preferred_days = []
    if isinstance(raw_days, list):
        for d in raw_days:
            if isinstance(d, str):
                matched = next((ad for ad in ALL_DAYS_OF_WEEK if ad.lower() == d.strip().lower()), None)
                if matched and matched not in preferred_days:
                    preferred_days.append(matched)
    elif isinstance(raw_days, str) and raw_days.strip():
        for d in raw_days.split(","):
            matched = next((ad for ad in ALL_DAYS_OF_WEEK if ad.lower() == d.strip().lower()), None)
            if matched and matched not in preferred_days:
                preferred_days.append(matched)

    # Backwards compatibility: if preferredDays not supplied but legacy daysLeft is provided
    if not preferred_days:
        if data.get("daysLeft") is not None:
            # Default to all 7 days for legacy calls
            preferred_days = list(ALL_DAYS_OF_WEEK)
        else:
            return jsonify({
                "error": "Validation Error",
                "message": "At least one preferred study day must be selected (e.g. Monday, Tuesday, ...)."
            }), 400

    # 5. Validate Academic Goals (optional string)
    academic_goals, err = validate_string(data.get("academicGoals", ""), "academicGoals", 500, required=False)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    # 6. Validate Exam Dates (optional string or dict; NEVER invent dates if empty)
    raw_exam_dates = data.get("examDates") or data.get("examDate")
    exam_dates_str = ""
    if isinstance(raw_exam_dates, dict):
        exam_dates_str = "; ".join([f"{k}: {v}" for k, v in raw_exam_dates.items() if v])[:300]
    elif isinstance(raw_exam_dates, str):
        exam_dates_str = raw_exam_dates.strip()[:300]

    # 7. Validate Preferred Session Length (minutes)
    raw_session = data.get("sessionLength") or 45
    session_length, err = validate_number(raw_session, "sessionLength", 15, 180, is_int=True)
    if err:
        session_length = 45

    # 8. Validate Revision Preferences
    revision_pref, _ = validate_string(data.get("revisionPreferences") or data.get("revisionPreference") or "Daily Active Recall & Spaced Repetition", "revisionPreferences", 150)

    # Compute days and availability constraints
    unavailable_days = [d for d in ALL_DAYS_OF_WEEK if d not in preferred_days]
    total_budgeted_weekly_hours = round(daily_hours * len(preferred_days), 1)

    exam_guideline = (
        f"STUDENT EXAM DATES: {exam_dates_str}. Tailor review schedule toward these dates without fabricating any others."
        if exam_dates_str
        else "CRITICAL RULE: The student provided NO exam dates. DO NOT INVENT OR FABRICATE EXAM DATES! Structure the plan for ongoing weekly mastery and retention."
    )

    prompt = f"""
You are an expert university academic advisor and study scheduling specialist.
Synthesize a realistic, highly personalized weekly study plan strictly respecting the student's stated availability and preferences.

STUDENT PROFILE & CONSTRAINTS:
- Course Subjects: {', '.join(subjects)}
- Subjects Requiring Additional Attention (Priority): {', '.join(focus_subjects) if focus_subjects else 'None specified; distribute time evenly'}
- Academic Goals: {academic_goals if academic_goals else 'Master core syllabus concepts and build exam confidence'}
- Available Study Hours Per Day: {daily_hours} hours maximum on active days
- Preferred Study Days: {', '.join(preferred_days)}
- Unavailable / Rest Days: {', '.join(unavailable_days) if unavailable_days else 'None (student studies all 7 days)'}
- Preferred Study-Session Length: {session_length} minutes
- Revision Preferences: {revision_pref}
- {exam_guideline}

MANDATORY SCHEDULING RULES:
1. DAILY STUDY LIMIT: For each active study day, the total non-break study duration MUST NOT exceed {daily_hours} hours.
2. STUDY DAYS STRICTNESS: Schedule study blocks ONLY on preferred study days ({', '.join(preferred_days)}).
3. UNAVAILABLE DAYS: For all unavailable days ({', '.join(unavailable_days)}), set "isStudyDay": false, "totalStudyHours": 0.0, "blocks": [], and label focusTheme as "Scheduled Rest & Recovery Day".
4. SUBJECT RESTRICTION: Use ONLY the provided subjects ({', '.join(subjects)}). Allocate more frequent and longer blocks to priority subjects.
5. BALANCED BLOCK TYPES: On active days, include:
   - "Deep Study" (focused conceptual learning)
   - "Practice Activity" (problem solving, coding, worksheets)
   - "Revision Task" (active recall, flashcards, spaced repetition)
   - "Short Break" (10-15 minute rest intervals to avoid fatigue; breaks do not count toward academic study hours)
6. WEEKLY REVIEW: On the final active study day of the week, include a dedicated "Weekly Review" section.
7. PROGRESS CHECKPOINTS: Include 2 progress checkpoints (Mid-Week Checkpoint and End-of-Week Review).
8. ASSUMPTIONS: Provide an array of explicit assumptions explaining time budget allocation, break strategy, and confirming no exam dates were invented.

SCHEMA REQUIREMENT: Output ONLY a valid JSON object matching this schema exactly without markdown formatting or preamble:
{{
  "weeklySummary": {{
    "totalWeeklyHours": {total_budgeted_weekly_hours},
    "activeStudyDays": {len(preferred_days)},
    "restDays": {len(unavailable_days)},
    "dailyHoursBudget": {daily_hours},
    "subjectBreakdown": [
      {{ "subject": "Subject Name", "allocatedHours": 6.0, "isPriority": true }}
    ],
    "assumptions": [
      "Stated availability of {daily_hours} hrs/day is strictly honored with max {daily_hours} hrs scheduled per active day.",
      "Rest days ({', '.join(unavailable_days) if unavailable_days else 'None'}) have 0 study tasks scheduled.",
      "Priority subjects receive higher allocation of practice and deep study sessions.",
      "Short 10-15 min breaks are placed between intensive blocks.",
      "{'Exam dates provided: ' + exam_dates_str if exam_dates_str else 'No exam dates were provided; schedule is structured for continuous concept retention without invented exam dates.'}"
    ],
    "disclaimer": "This study plan is an academic planning guide based on student-provided inputs and does not claim or guarantee improved grades or exam outcomes."
  }},
  "days": [
    {{
      "dayName": "Monday",
      "isStudyDay": true,
      "totalStudyHours": {daily_hours},
      "focusTheme": "Day focus headline",
      "blocks": [
        {{
          "id": "mon-1",
          "subject": "{subjects[0]}",
          "type": "Deep Study",
          "durationMinutes": {session_length},
          "title": "Specific Topic Title",
          "details": "Actionable task instruction",
          "completed": false
        }},
        {{
          "id": "mon-2",
          "subject": "General",
          "type": "Short Break",
          "durationMinutes": 15,
          "title": "Cognitive Rest & Hydration",
          "details": "Step away from study area",
          "completed": false
        }}
      ],
      "dailyCheckpoint": "Daily self-quiz or verification checkpoint"
    }}
  ],
  "weeklyReview": {{
    "day": "{preferred_days[-1]}",
    "title": "Weekly Retrospective & Gap Analysis",
    "tasks": [
      "Audit all completed task checkboxes from the week",
      "Review error journal for difficult problem sets",
      "Re-calibrate study time allocations for next week"
    ]
  }},
  "progressCheckpoints": [
    {{ "timing": "Mid-Week Checkpoint", "focus": "Problem-Solving Speed", "description": "Assess practice problem speed on priority topics" }},
    {{ "timing": "End-of-Week Review", "focus": "Spaced Retention Audit", "description": "Review summary sheets and flashcards before rest days" }}
  ]
}}
"""

    system_instruction = "You are a professional university study planning specialist. Keep details concise and actionable. You only reply with strictly valid JSON matching the requested schema."
    plan_raw, err_resp = execute_gemini_generation(prompt, system_instruction, max_output_tokens=4000)
    if err_resp:
        return err_resp

    # Parse and validate the JSON returned by the model
    clean_raw = plan_raw.strip()
    if clean_raw.startswith("```json"):
        clean_raw = clean_raw[7:]
    elif clean_raw.startswith("```"):
        clean_raw = clean_raw[3:]
    if clean_raw.endswith("```"):
        clean_raw = clean_raw[:-3]
    clean_raw = clean_raw.strip()

    try:
        parsed_plan = json.loads(clean_raw)
        if not isinstance(parsed_plan, dict) or "days" not in parsed_plan:
            raise ValueError("Missing 'days' array in generated study plan.")
    except Exception as e:
        logger.error(f"Malformed JSON from AI model: {e}. Output snippet: {clean_raw[:150]}")
        return jsonify({
            "error": "Model Response Malformed",
            "message": "The AI service response could not be parsed as a structured study plan. Please retry."
        }), 502

    # Deterministic programmatic post-processing to guarantee 100% compliance with rules
    raw_days_dict = {}
    for d in parsed_plan.get("days", []):
        if isinstance(d, dict) and d.get("dayName"):
            raw_days_dict[d["dayName"].lower()] = d

    final_days = []
    total_scheduled_hours = 0.0

    for day_name in ALL_DAYS_OF_WEEK:
        is_pref = day_name in preferred_days
        existing = raw_days_dict.get(day_name.lower(), {})

        if not is_pref:
            # Strictly enforce: Unavailable day must be a rest day with 0 study tasks
            final_days.append({
                "dayName": day_name,
                "isStudyDay": False,
                "totalStudyHours": 0.0,
                "focusTheme": "Scheduled Rest & Recovery Day",
                "blocks": [],
                "dailyCheckpoint": "Rest, recharge, and avoid academic fatigue."
            })
        else:
            # Active study day: sanitize blocks and enforce availability limit
            raw_blocks = existing.get("blocks", [])
            sanitized_blocks = []
            study_minutes = 0

            for idx, b in enumerate(raw_blocks):
                if not isinstance(b, dict):
                    continue
                b_type = b.get("type", "Deep Study")
                b_dur = b.get("durationMinutes", session_length)
                try:
                    b_dur = int(b_dur)
                except Exception:
                    b_dur = session_length

                b_subj = b.get("subject", subjects[0])
                # Ensure subject is one of the student's subjects or General
                if b_type != "Short Break" and b_subj.lower() not in [s.lower() for s in subjects]:
                    b_subj = subjects[0]

                sanitized_blocks.append({
                    "id": b.get("id") or f"{day_name[:3].lower()}-b{idx+1}",
                    "subject": b_subj,
                    "type": b_type,
                    "durationMinutes": b_dur,
                    "title": b.get("title", f"Study Session {idx+1}"),
                    "details": b.get("details", "Focus on core concept review and active problem solving."),
                    "completed": False
                })

                if b_type != "Short Break":
                    study_minutes += b_dur

            # Enforce availability ceiling: study_minutes <= daily_hours * 60
            max_study_mins = int(daily_hours * 60)
            if study_minutes > max_study_mins + 10 and sanitized_blocks:
                # Scale non-break blocks down proportionally
                scale_ratio = max_study_mins / max(1, study_minutes)
                study_minutes = 0
                for b in sanitized_blocks:
                    if b["type"] != "Short Break":
                        b["durationMinutes"] = max(15, int(round((b["durationMinutes"] * scale_ratio) / 5.0) * 5))
                        study_minutes += b["durationMinutes"]

            # If the model produced 0 blocks for an active day, generate default blocks
            if not sanitized_blocks:
                subj = subjects[len(final_days) % len(subjects)]
                dur1 = min(max_study_mins, int(session_length))
                sanitized_blocks.append({
                    "id": f"{day_name[:3].lower()}-b1",
                    "subject": subj,
                    "type": "Deep Study",
                    "durationMinutes": dur1,
                    "title": f"{subj} Core Concepts & Theory",
                    "details": "Review syllabus modules, take active notes, and extract formulas.",
                    "completed": False
                })
                study_minutes = dur1
                if max_study_mins - dur1 >= 30:
                    sanitized_blocks.append({
                        "id": f"{day_name[:3].lower()}-b2",
                        "subject": "General",
                        "type": "Short Break",
                        "durationMinutes": 15,
                        "title": "Rest & Hydration",
                        "details": "Step away from screen",
                        "completed": False
                    })
                    dur2 = min(max_study_mins - dur1, int(session_length))
                    sanitized_blocks.append({
                        "id": f"{day_name[:3].lower()}-b3",
                        "subject": subj,
                        "type": "Practice Activity",
                        "durationMinutes": dur2,
                        "title": f"{subj} Problem Solving",
                        "details": "Solve deliberate practice problem sets.",
                        "completed": False
                    })
                    study_minutes += dur2

            day_hours = round(study_minutes / 60.0, 1)
            total_scheduled_hours += day_hours

            final_days.append({
                "dayName": day_name,
                "isStudyDay": True,
                "totalStudyHours": day_hours,
                "focusTheme": existing.get("focusTheme") or f"{subjects[len(final_days) % len(subjects)]} Focus",
                "blocks": sanitized_blocks,
                "dailyCheckpoint": existing.get("dailyCheckpoint") or "Self-quiz on key concepts learned today."
            })

    parsed_plan["days"] = final_days

    # Ensure weekly summary values are exact and factual
    active_days_count = len(preferred_days)
    rest_days_count = len(unavailable_days)

    summary = parsed_plan.get("weeklySummary", {})
    summary["totalWeeklyHours"] = round(total_scheduled_hours, 1)
    summary["activeStudyDays"] = active_days_count
    summary["restDays"] = rest_days_count
    summary["dailyHoursBudget"] = daily_hours
    summary["disclaimer"] = "This study plan is an academic planning guide based on student-provided inputs and does not claim or guarantee improved grades or exam outcomes."

    # Validate or initialize assumptions
    assumptions = summary.get("assumptions", [])
    if not isinstance(assumptions, list) or len(assumptions) < 2:
        assumptions = [
            f"Daily study availability ceiling of {daily_hours} hrs/day is strictly honored.",
            f"Rest days ({', '.join(unavailable_days) if unavailable_days else 'None'}) have 0 study tasks scheduled per preferred days.",
            f"Higher priority allocated to focus subjects: {', '.join(focus_subjects) if focus_subjects else 'Standard distribution across all courses'}.",
            "Short 10-15 min cognitive breaks are placed between intensive study blocks.",
            "Exam dates: " + (exam_dates_str if exam_dates_str else "No exam dates provided; plan structured for continuous mastery without invented dates.")
        ]
    else:
        # Guarantee statement about exam dates is in assumptions
        has_exam_note = any("exam" in str(a).lower() for a in assumptions)
        if not has_exam_note:
            assumptions.append("Exam dates: " + (exam_dates_str if exam_dates_str else "No exam dates provided; plan structured for continuous mastery without invented dates."))
    summary["assumptions"] = assumptions
    parsed_plan["weeklySummary"] = summary

    # Ensure weekly review exists
    if "weeklyReview" not in parsed_plan or not isinstance(parsed_plan["weeklyReview"], dict):
        parsed_plan["weeklyReview"] = {
            "day": preferred_days[-1] if preferred_days else "Sunday",
            "title": "Weekly Retrospective & Gap Analysis",
            "tasks": [
                "Audit all completed task checkboxes from the week",
                "Review error journal for difficult problem sets",
                "Summarize core flashcards for priority subjects",
                "Re-calibrate study time allocations for next week"
            ]
        }

    # Ensure progress checkpoints exist
    if "progressCheckpoints" not in parsed_plan or not isinstance(parsed_plan["progressCheckpoints"], list):
        parsed_plan["progressCheckpoints"] = [
            {"timing": "Mid-Week Checkpoint", "focus": "Problem-Solving Speed", "description": "Assess practice problem speed on priority topics and log questions for office hours."},
            {"timing": "End-of-Week Review", "focus": "Spaced Retention Audit", "description": "Review formula sheets and self-quizzing results before entering scheduled rest days."}
        ]

    # Synthesize backwards-compatible milestones for existing 3-phase consumers & test suites
    milestones = []
    active_days_list = [d for d in final_days if d.get("isStudyDay")]
    if active_days_list:
        p1 = active_days_list[:max(1, len(active_days_list) // 3)]
        p2 = active_days_list[len(p1):max(len(p1) + 1, (2 * len(active_days_list)) // 3)]
        p3 = active_days_list[len(p1) + len(p2):]
        phase_groups = [
            ("Phase 1: Syllabus Mapping & Conceptual Deep-Dive", p1),
            ("Phase 2: Deliberate Practice & Edge-Case Problem Solving", p2 or p1),
            ("Phase 3: Spaced Revision & Timed Self-Quizzing", p3 or active_days_list[-1:])
        ]
        for p_title, p_days in phase_groups:
            p_tasks = []
            for d in p_days:
                for b in d.get("blocks", []):
                    if b.get("type") != "Short Break":
                        p_tasks.append(f"{d['dayName']}: {b.get('subject')} - {b.get('title')}")
            milestones.append({
                "day": f"{p_days[0]['dayName']} - {p_days[-1]['dayName']}",
                "title": p_title,
                "timeSlot": f"{daily_hours} hrs/day",
                "tasks": p_tasks[:5] or ["Complete scheduled study blocks", "Review concept flashcards"]
            })
    parsed_plan["milestones"] = milestones

    return jsonify({
        "success": True,
        "plan": parsed_plan
    }), 200


# ==============================================================================
# Endpoint 5: AI CGPA Predictor & Target Planning
# ==============================================================================
@app.route("/api/ai/predict", methods=["POST"])
def ai_predict():
    """
    POST /api/ai/predict
    Analyzes credit-weighted CGPA trajectory calculations, explains required SGPA,
    evaluates hypothetical scenarios, and generates strategic target-planning recommendations.
    """
    data, err_resp = parse_json_body()
    if err_resp:
        return err_resp

    current_cgpa, err = validate_number(data.get("currentCgpa"), "currentCgpa", 0.0, 10.0)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    target_cgpa, err = validate_number(data.get("targetCgpa"), "targetCgpa", 0.0, 10.0)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    completed_credits, err = validate_number(data.get("completedCredits"), "completedCredits", 0.0, 300.0)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    upcoming_credits, err = validate_number(data.get("upcomingCredits"), "upcomingCredits", 0.5, 60.0)
    if err:
        return jsonify({"error": "Validation Error", "message": err}), 400

    max_scale = float(data.get("maxScale", 10.0))
    if max_scale <= 0 or max_scale > 20:
        return jsonify({"error": "Validation Error", "message": "Maximum grade-point scale must be a positive number."}), 400

    major, _ = validate_string(data.get("major", "Undergraduate Degree"), "major", 100)
    notes, _ = validate_string(data.get("academicNotes", ""), "academicNotes", 500)

    # Deterministic Server-side Mathematical Verification
    total_credits = completed_credits + upcoming_credits
    req_sgpa_raw = ((target_cgpa * total_credits) - (current_cgpa * completed_credits)) / upcoming_credits
    required_sgpa = round(req_sgpa_raw, 2)
    max_achievable = round(((current_cgpa * completed_credits) + (max_scale * upcoming_credits)) / total_credits, 2)
    is_impossible = required_sgpa > max_scale

    scenarios = data.get("scenarios") or []
    scenarios_text = ""
    if isinstance(scenarios, list) and len(scenarios) > 0:
        scenario_lines = []
        for sc in scenarios:
            if isinstance(sc, dict):
                sg = sc.get("sgpa")
                proj = sc.get("projectedCgpa")
                diff = sc.get("difference")
                meets = sc.get("meetsTarget")
                diff_str = f"{diff:+.2f}" if isinstance(diff, (int, float)) else str(diff)
                scenario_lines.append(f"- If SGPA = {sg}: Projected CGPA = {proj} (Δ {diff_str}) -> {'Target Met/Exceeded' if meets else 'Below Target'}")
        scenarios_text = "\n".join(scenario_lines)

    prompt = f"""
    You are the Senior Academic Success Analyst and Target Forecasting Advisor for GradePilot AI.
    Evaluate the following DETERMINISTIC MATHEMATICAL CALCULATION for a student's CGPA target plan.

    Strict Rule: Do NOT recalculate or modify these authoritative numerical results. Explain them, contextualize them, and provide strategic recommendations.

    === DETERMINISTIC CALCULATION RECORD ===
    - Degree Major: {major}
    - Current CGPA: {current_cgpa:.2f} (across {completed_credits:.1f} completed credits)
    - Upcoming Semester Credits: {upcoming_credits:.1f} credits
    - Total Credits After Semester: {total_credits:.1f} credits
    - Target CGPA: {target_cgpa:.2f}
    - Maximum Scale: {max_scale:.1f}
    - Mathematically Required Upcoming SGPA: {required_sgpa:.2f}
    - Mathematical Target Status: {'IMPOSSIBLE CEILING (Exceeds maximum grade scale)' if is_impossible else 'FEASIBLE'}
    - Maximum Achievable CGPA this semester (with perfect {max_scale:.1f} straight): {max_achievable:.2f}
    - Student Context: {notes or 'None'}

    Hypothetical SGPA Scenarios:
    {scenarios_text or 'Standard brackets evaluated'}

    === MANDATORY ANALYSIS SECTIONS ===
    Produce a professional, structured Markdown report with EXACTLY these sections:

    ### 1. 🎯 Required SGPA & Mathematical Feasibility Analysis
    - Clearly explain what achieving a {required_sgpa:.2f} SGPA means in terms of course letter grades.
    {'* WARNING: Explicitly explain that achieving the target CGPA of ' + str(target_cgpa) + ' in this single semester is mathematically impossible because the required SGPA (' + str(required_sgpa) + ') exceeds the university maximum scale of ' + str(max_scale) + '. Highlight that the theoretical mathematical ceiling with straight ' + str(max_scale) + 's is ' + str(max_achievable) + '. Explain multi-semester recovery options.' if is_impossible else '- Detail the mathematical safety buffer and margin for error.'}

    ### 2. ⚖️ Hypothetical Scenario Comparison
    - Compare what happens across different semester outcomes (e.g. 7.0 vs 8.0 vs 9.0 vs 10.0 or scale equivalents).
    - Contrast conservative vs. aggressive performance outcomes on the student's cumulative trajectory.

    ### 3. 🔍 Strategic Academic Priorities
    - Credit-weighted leverage: Explain why performance in high-credit courses (3 to 4 credits) will dictate the vast majority of the CGPA movement.
    - Identify grade thresholds and how to protect against high-impact lower grades (e.g. C or D).

    ### 4. 🛠️ Practical Preparation & Execution Strategies
    - Concrete study protocols (Active Recall, syllabus audit, continuous assessment pacing).
    - Midterm monitoring checkpoints.

    End with a brief 1-sentence statement that projected results are hypothetical estimates based on credit-weighted formulas rather than guaranteed outcomes.
    """

    system_instruction = (
        "You are GradePilot AI's Target Planning Copilot. "
        "Provide rigorous, objective mathematical explanations and empowering academic roadmaps. "
        "Never dispute the provided deterministic numbers."
    )

    analysis_text, err_resp = execute_gemini_generation(prompt, system_instruction)
    if err_resp:
        return err_resp

    return jsonify({
        "success": True,
        "analysis": analysis_text,
        "explanation": analysis_text,
        "calculation": {
            "currentCgpa": current_cgpa,
            "targetCgpa": target_cgpa,
            "completedCredits": completed_credits,
            "upcomingCredits": upcoming_credits,
            "totalCredits": total_credits,
            "maxScale": max_scale,
            "requiredSgpa": required_sgpa,
            "isImpossible": is_impossible,
            "maxAchievableCgpa": max_achievable
        }
    }), 200


# ==============================================================================
# Server Entrypoint
# ==============================================================================
if __name__ == "__main__":
    logger.info(f"Starting GradePilot AI Backend on port {PORT} (Debug={DEBUG})...")
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
