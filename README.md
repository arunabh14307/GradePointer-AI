# 🎓 GradePilot AI

> **Calculate Smarter. Study Better. Achieve More.**

GradePilot AI is a modern, high-performance academic productivity platform and calculator suite. It combines essential university grade calculation tools with an AI-powered academic copilot to help students optimize their GPA, plan study roadmaps, and forecast graduation honors.

---

## 🌟 Key Features

### 🧮 1. Academic Calculators
- **Course Grade Calculator:** Calculates weighted coursework grades, projects letter grades, and solves required Final Exam scores to achieve target grades.
- **Semester SGPA & Cumulative CGPA Calculator:** Real-time calculation of course quality points, multi-semester SGPA, cumulative CGPA tracking, and historical semester saving.
- **Percentage & Attendance Suite:** 
  - Marks to Percentage & Letter Grade converter.
  - Bidirectional Percentage ⟷ CGPA converter (supports CBSE 9.5 formula, standard 10 multiplier, and US 4.0 scale).
  - Attendance Requirement Solver (calculates safe classes to miss or consecutive classes required to reach 75%+).

### 🤖 2. AI Academic Copilot
- **AI Academic Advisor (`POST /api/ai/analyze`):** Analyzes your current vs. target CGPA delta, high-risk subjects, and weekly study hours to generate structured diagnostic action plans.
- **AI Study Planner (`POST /api/ai/study-plan`):** Synthesizes phased revision schedules with interactive milestones, difficulty weighting, and task checklists.
- **AI Chat Assistant (`POST /api/ai/chat`):** Conversational academic mentor for drafting professor emails, exam preparation, and study motivation.
- **AI CGPA Predictor:** Forecasts required future semester GPAs for graduation honors and identifies mathematical feasibility ceilings.

### 🎨 3. Modern Design System & Usability
- **Themes:** Sleek Dark Mode (default) and Crisp Light Mode with instant toggle and persistent theme preference.
- **Single-Page Application (SPA):** Instant, fluid section transitions without browser refreshes or heavy frameworks.
- **Local Persistence:** All student profiles, calculation logs, semesters, and study roadmaps persist securely in `LocalStorage`.
- **PDF Exporting:** Download official PDF academic transcripts, study plans, and grade breakdown reports via `jsPDF`.
- **Visual Analytics:** Interactive GPA trajectory graph powered by `Chart.js`.
- **Responsive Layout:** Optimized for mobile smartphones, tablets, laptops, and desktop screens.

---

## 🛠️ Technology Stack

GradePilot AI is built using a clean, maintainable, and reliable technology stack:

| Layer | Technology |
|---|---|
| **Structure** | Semantic HTML5 |
| **Styling** | Vanilla CSS3 (Custom Design Tokens, Responsive Grid/Flexbox) |
| **Client-Side Logic** | Vanilla JavaScript (ES6+ Modules, Zero Frameworks) |
| **Client-Side Storage**| Browser `LocalStorage` API with JSON Backup/Restore |
| **Data Visualization** | `Chart.js` (via CDN) |
| **Document Generation**| `jsPDF` (via CDN) |
| **Icons & Typography** | Font Awesome 6 & Google Fonts (Outfit, Plus Jakarta Sans) |
| **Backend Framework** | Python 3 + Flask + Flask-CORS |
| **Generative AI SDK** | Official Google GenAI SDK (`google-genai`) |
| **Configuration** | Environment variables via `python-dotenv` |

> 🔒 **Security Guarantee:** The Gemini API key is **never** exposed to frontend JavaScript or client files. The frontend works out of the box in **Local Mode** even without a backend or API key.

---

## 📂 Project Structure

```
GradePilot AI/
├── index.html                   # Core single-page application markup
├── assets/
│   └── logo.svg                 # Brand SVG logo & favicon
├── css/
│   ├── style.css                # Design system tokens, components, light/dark themes
│   └── responsive.css           # Breakpoints for tablet, mobile, and print
├── js/
│   ├── app.js                   # SPA router, theme manager, backend health checker
│   ├── storage.js               # LocalStorage data management & backup/restore
│   ├── utils.js                 # Grading scales, math helpers, toast alerts, PDF exporter
│   ├── dashboard.js             # Overview cards, GPA analytics chart, history logs
│   ├── grade-calculator.js      # Weighted grade calculator & final exam solver
│   ├── cgpa-calculator.js       # SGPA & cumulative CGPA calculator
│   ├── percentage-calculator.js # 4-in-1 marks, percentage, and attendance suite
│   ├── ai-advisor.js            # Academic diagnostics & strategy planner
│   ├── cgpa-predictor.js        # Graduation trajectory forecasting
│   ├── study-planner.js         # Phased study schedules & checklist tracker
│   └── ai-chat.js               # Academic conversational tutor & email drafter
├── backend/
│   ├── app.py                   # Flask REST API server (/api/health, /api/ai/*)
│   ├── requirements.txt         # Python backend dependencies
│   ├── .env.example             # Environment configuration template
│   └── test_backend.py          # Automated verification & testing suite
└── README.md                    # Project documentation
```

---

## 🔐 Environment Variables

The backend reads configuration directly from environment variables (or `.env` file):

| Variable | Description | Default | Example |
|---|---|---|---|
| `PORT` | Local port for Flask server | `5000` | `5000` |
| `DEBUG` | Enable Flask debug mode | `False` | `False` |
| `FRONTEND_ORIGIN` | Allowed origin for CORS security | `*` | `http://localhost:8000` |
| `GEMINI_API_KEY` | Official Google Gemini API Key | *(empty)* | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini target model identifier | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` |

Never commit `.env` or paste real credentials into source code or documentation.

---

## 📡 Backend API Routes

All endpoints receive and return JSON (`Content-Type: application/json`).

### 1. `GET /api/health`
Returns backend health status and credentials availability.
- **Response (200):**
  ```json
  {
    "status": "ok",
    "service": "GradePilot AI Backend",
    "version": "1.0.0",
    "gemini_configured": true,
    "model": "gemini-3.1-flash-lite"
  }
  ```

### 2. `POST /api/ai/analyze`
Generates structured diagnostic academic improvement strategies.
- **Request Body:**
  ```json
  {
    "currentCgpa": 3.4,
    "targetCgpa": 3.8,
    "major": "Computer Science",
    "weakSubjects": "Operating Systems",
    "weeklyStudyHours": 18,
    "additionalNotes": "Midterms in 3 weeks"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "analysis": "### Academic Action Plan...",
    "advice": "### Academic Action Plan..."
  }
  ```

### 3. `POST /api/ai/chat`
Answers academic questions, study inquiries, or drafts professional emails.
- **Request Body:**
  ```json
  {
    "message": "How do I draft a grade inquiry email to my professor?",
    "profile": {
      "name": "Alex",
      "major": "Computer Science",
      "currentCgpa": 3.4,
      "targetCgpa": 3.8
    }
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "response": "Here is an email template..."
  }
  ```

### 4. `POST /api/ai/study-plan` (AI Study Plan Generator)
Generates a constraint-respecting, personalized weekly study schedule with subject-specific blocks, deliberate practice, active revision, short breaks, weekly review, and progress checkpoints.
- **Request Body:**
  ```json
  {
    "subjects": ["Data Structures & Algorithms", "Operating Systems", "Linear Algebra"],
    "focusSubjects": ["Operating Systems"],
    "academicGoals": "Score 3.8+ GPA and master dynamic programming & memory management",
    "dailyHours": 3.5,
    "preferredDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "examDates": "Data Structures: Nov 20, OS: Dec 04",
    "sessionLength": 45,
    "revisionPreferences": "Daily Active Recall (15-20 min start/end)"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "plan": {
      "weeklySummary": {
        "totalWeeklyHours": 17.5,
        "activeStudyDays": 5,
        "restDays": 2,
        "dailyHoursBudget": 3.5,
        "subjectBreakdown": [
          { "subject": "Data Structures & Algorithms", "allocatedHours": 6.0, "isPriority": false },
          { "subject": "Operating Systems", "allocatedHours": 8.0, "isPriority": true }
        ],
        "assumptions": [
          "Stated availability of 3.5 hrs/day is strictly honored on active days.",
          "Rest days (Saturday, Sunday) have 0 study tasks scheduled.",
          "Priority subjects receive higher allocation of practice and deep study sessions.",
          "Short 10-15 min cognitive breaks are placed between intensive blocks."
        ],
        "disclaimer": "This study plan is an academic planning guide based on student-provided inputs and does not claim or guarantee improved grades or exam outcomes."
      },
      "days": [
        {
          "dayName": "Monday",
          "isStudyDay": true,
          "totalStudyHours": 3.5,
          "focusTheme": "Data Structures & Operating Systems Core Theory",
          "blocks": [
            {
              "id": "mon-1",
              "subject": "Data Structures & Algorithms",
              "type": "Deep Study",
              "durationMinutes": 45,
              "title": "Binary Search Trees & Traversal Algorithms",
              "details": "Review recursive traversal implementations and time complexities.",
              "completed": false
            },
            {
              "id": "mon-2",
              "subject": "General",
              "type": "Short Break",
              "durationMinutes": 15,
              "title": "Cognitive Rest & Hydration",
              "details": "Step away from screen",
              "completed": false
            }
          ],
          "dailyCheckpoint": "Verify ability to explain tree balance conditions without referring to notes."
        }
      ],
      "weeklyReview": {
        "day": "Friday",
        "title": "Weekly Retrospective & Gap Analysis",
        "tasks": ["Audit completed checkboxes", "Review error journal for weak subjects"]
      },
      "progressCheckpoints": [
        { "timing": "Mid-Week Checkpoint", "focus": "Problem-Solving Speed", "description": "Assess practice problem speed on priority topics" },
        { "timing": "End-of-Week Review", "focus": "Spaced Retention Audit", "description": "Review summary sheets and flashcards before rest days" }
      ]
    }
  }
  ```

### 5. `POST /api/ai/predict` (CGPA Predictor & Target Planning)
Evaluates credit-weighted target plans, contextualizes deterministic required SGPA calculations, compares hypothetical scenarios, and generates practical preparation roadmaps.
- **Deterministic Mathematical Formula (JavaScript Authority):**
  $$\text{requiredSGPA} = \frac{\text{targetCGPA} \times (\text{completedCredits} + \text{upcomingCredits}) - \text{currentCGPA} \times \text{completedCredits}}{\text{upcomingCredits}}$$
  $$\text{maxAchievableCGPA} = \frac{\text{currentCGPA} \times \text{completedCredits} + \text{maxScale} \times \text{upcomingCredits}}{\text{completedCredits} + \text{upcomingCredits}}$$
- **Request Body:**
  ```json
  {
    "currentCgpa": 8.0,
    "targetCgpa": 8.5,
    "completedCredits": 60.0,
    "upcomingCredits": 20.0,
    "maxScale": 10.0,
    "major": "Computer Science & Engineering",
    "academicNotes": "Targeting Dean's Honors List",
    "scenarios": [
      { "sgpa": 7.0, "projectedCgpa": 7.75, "difference": -0.25, "meetsTarget": false },
      { "sgpa": 8.0, "projectedCgpa": 8.00, "difference": 0.00, "meetsTarget": false },
      { "sgpa": 9.0, "projectedCgpa": 8.25, "difference": 0.25, "meetsTarget": false },
      { "sgpa": 10.0, "projectedCgpa": 8.50, "difference": 0.50, "meetsTarget": true }
    ]
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "analysis": "### 1. 🎯 Required SGPA & Mathematical Feasibility Analysis...",
    "calculation": {
      "currentCgpa": 8.0,
      "targetCgpa": 8.5,
      "completedCredits": 60.0,
      "upcomingCredits": 20.0,
      "totalCredits": 80.0,
      "maxScale": 10.0,
      "requiredSgpa": 10.0,
      "isImpossible": false,
      "maxAchievableCgpa": 8.5
    }
  }
  ```

### 6. `POST /api/ai/chat` (AI Academic Chat Assistant)
Bilingual conversational tutor and advisor (English & Hinglish) with authoritative client-side JavaScript calculator integration.
- **Key Capabilities:**
  - **Deterministic Math Authority:** Receives verified calculation outputs from client calculators (`CgpaPredictor`, `CgpaCalculator`, `PercentageCalculator`) and interprets them without hallucinating conflicting arithmetic.
  - **Selective Academic Context:** Passes only relevant context (CGPA, specific subjects, calculator result); never leaks or demands unrelated private records.
  - **Bounded History:** Transmits the last 15 conversation turns to preserve contextual continuity within safety token bounds.
  - **Bilingual Fluency:** Native support for both standard English and conversational Hinglish (Roman Hindi + English).
- **Request Body:**
  ```json
  {
    "message": "Mera CGPA 7.5 hai aur target 8.5 hai, Hinglish me batao mujhe kya karna hoga?",
    "history": [
      { "role": "user", "content": "What SGPA do I need to reach my target?" },
      { "role": "assistant", "content": "To reach 8.5 CGPA, you need an SGPA of 11.5 which is mathematically impossible in 20 credits." }
    ],
    "academicContext": {
      "currentCgpa": 7.5,
      "targetCgpa": 8.5,
      "completedCredits": 60,
      "upcomingCredits": 20,
      "calculatorResult": {
        "type": "Target SGPA Prediction (Authoritative)",
        "requiredSgpa": 11.5,
        "isImpossible": true,
        "maxAchievableCgpa": 8.13
      }
    }
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "response": "Dekho Alex, tumhara current CGPA 7.5 hai aur target 8.5..."
  }
  ```

---

## 🛡️ Security & Validation Principles

- **Zero Secret Exposure:** `GEMINI_API_KEY` resides strictly on the backend server. The client application never accesses or receives provider credentials.
- **CORS Protection:** Configurable `FRONTEND_ORIGIN` restricts cross-origin access to the approved frontend in production.
- **Request Size Limiting:** Maximum request body is capped at 1MB (`MAX_CONTENT_LENGTH = 1MB`) to guard against denial-of-service and memory exhaustion.
- **Strict Input Validation:** Rejects malformed JSON (400), enforces numeric bounds (e.g., GPA 0.0–10.0, study hours 0.5–168), and bounds string lengths to mitigate abuse.
- **No Fabricated AI:** When the AI provider is unavailable or credentials are not configured, the backend returns clean HTTP error responses (`503 Service Unavailable`, `502 Bad Gateway`, `400 Bad Request`) rather than fabricating fake AI output.

---

---

## 🚀 Complete Setup & Deployment Guide

Follow these exact instructions to run locally, configure Gemini credentials, deploy to production (Vercel & Python hosts), and test live AI requests.

### 1. Running the Frontend Locally
The frontend is built entirely with semantic HTML5, Vanilla CSS3, and vanilla ES6+ JavaScript. No build step or Node.js environment is required.

* **Option A — Instant (No dependencies):**
  Double-click `index.html` or open it directly in Google Chrome, Microsoft Edge, Firefox, or Safari.

* **Option B — Local Web Server (Recommended):**
  From the project root directory:
  ```bash
  # Python 3
  python -m http.server 8000
  ```
  Open `http://localhost:8000` in your browser.

---

### 2. Running Flask Backend Locally
The Python backend manages secure communication with the Google Gemini API, enforces payload limits (1MB), and validates academic data.

1. Open a terminal in the `backend/` directory:
   ```bash
   cd backend
   ```
2. (Recommended) Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell / Command Prompt):
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend will start at `http://127.0.0.1:5000`.

---

### 3. Configuring Gemini Credentials
1. Obtain an API key from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. In the `backend/` folder, copy `.env.example` to `.env`:
   ```bash
   # Windows:
   copy .env.example .env

   # macOS / Linux:
   cp .env.example .env
   ```
3. Open `backend/.env` in any text editor and fill in your key:
   ```env
   PORT=5000
   DEBUG=False
   FRONTEND_ORIGIN=*
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   GEMINI_MODEL=gemini-3.1-flash-lite
   ```
4. Save the file and restart the Flask server. The terminal will log:
   ```
   [INFO] GradePilotBackend: Official Google GenAI SDK initialized. Default model: gemini-3.1-flash-lite
   ```

---

### 4. Deploying the Frontend to Vercel
GradePilot AI's static frontend is pre-configured for instant zero-configuration deployment on Vercel via `vercel.json`.

* **Prerequisites:** A GitHub account and a free [Vercel account](https://vercel.com).
* **Important:** Vercel static hosting serves HTML, CSS, and JS assets. It does **not** automatically execute the Python Flask backend. The backend should be hosted separately (see Step 5).

#### Method A: Via Vercel Web Dashboard (Recommended)
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy GradePilot AI to Vercel"
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com), click **Add New...** > **Project**.
3. Import your `GradePilot-AI` repository.
4. In **Project Settings**:
   - **Framework Preset:** `Other` (or static).
   - **Root Directory:** `./` (default root, where `index.html` lives).
   - **Build Command:** Leave blank (no build step needed).
   - **Output Directory:** Leave blank (serves root files).
5. Click **Deploy**. Your site will be live at `https://your-project.vercel.app`.

#### Method B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

### 5. Deploying the Backend to Python Cloud Hosting
Deploy the Flask application to any standard Python platform (such as **Render**, **Railway**, **Fly.io**, or **Heroku**).

#### Option A: Deploy to Render (Recommended & Free Tier Available)
1. Sign up or log in at [render.com](https://render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   - **Name:** `gradepilot-ai-backend`
   - **Language / Runtime:** `Python 3`
   - **Root Directory:** `backend` (or leave blank if pointing to repo root)
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
     *(Note: A pre-configured `Procfile` is already included)*
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API Key)*
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite`
   - `FRONTEND_ORIGIN`: `https://your-project.vercel.app` *(or `*` during testing)*
   - `PYTHON_VERSION`: `3.11.9` *(matches `runtime.txt`)*
6. Click **Create Web Service**. Once built, Render will assign your backend a public URL (e.g. `https://gradepilot-ai-backend.onrender.com`).

#### Option B: Deploy to Railway
1. Go to [railway.app](https://railway.app) > **New Project** > **Deploy from GitHub repo**.
2. Select repository and set Root Directory to `backend`.
3. Add environment variable `GEMINI_API_KEY` in the Railway variables dashboard.
4. Railway will automatically detect `requirements.txt` and `Procfile` to launch with Gunicorn.

---

### 6. Connecting Frontend to the Cloud Backend
Once your backend is deployed:

1. Open your live Vercel frontend URL (e.g. `https://your-project.vercel.app`).
2. Navigate to the **Settings** section (`#settings`).
3. In the **Application Preferences** card, find the **Flask AI Backend URL** field.
4. Paste your public cloud backend URL (e.g. `https://gradepilot-ai-backend.onrender.com`).
5. Click the **Test** button.
   - If connected, a green toast notification will appear:
     `Backend online! (Gemini API: Configured)`
   - The status pill in the top header will update to:
     `● Gemini AI Active`
6. Click **Save Preferences**. The custom backend URL is securely persisted in your browser's local settings.

---

### 7. Testing a Real AI Request
To verify the end-to-end cloud pipeline:

1. **Verify Health:** In your browser or terminal, check:
   ```bash
   curl -X GET https://your-backend-url.onrender.com/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "service": "GradePilot AI Backend",
     "gemini_configured": true,
     "model": "gemini-3.1-flash-lite",
     "version": "1.0.0"
   }
   ```
2. **Test AI Advisor in the Web UI:**
   - In GradePilot AI, click **AI Academic Advisor** in the navigation.
   - Enter your current CGPA (e.g. `7.8`), target CGPA (e.g. `8.8`), and click **Generate Strategic Assessment**.
   - Within 3–6 seconds, the 5-point strategic academic diagnosis and milestone roadmap will render.
3. **Test AI Chat Assistant:**
   - Click **AI Chat Assistant** in the sidebar.
   - Ask: *"What SGPA do I need next term if my CGPA is 7.5 and I have 20 credits remaining?"* or in Hinglish: *"Bhai mera CGPA 7.5 hai, 8.5 karne ke liye kya karu?"*
   - Verify the assistant responds with mathematically grounded, empathetic advice.

---

## 📊 Phase 11: Analytics Dashboard, Data Management & Privacy

### 1. Performance Analytics Dashboard
- **Real-Data Representation:** Displays **strictly authoritative, actual available student data**. No mock or fake academic data is ever fabricated.
  - **Current CGPA:** Calculated dynamically from active coursework quality points or student profile.
  - **Target CGPA:** Configured academic milestone with clear status indicator.
  - **Total Credits:** Accurate sum of earned course credits.
  - **Total Subjects:** Aggregated count of distinct active subjects.
- **Visual Analytics with Chart.js:**
  - Dynamic line chart representing semester-wise GPA progression.
  - **Zero-Data Fallback:** When no semester records exist, the chart cleanly falls back to an informative empty state card (`#dash-chart-empty-state`) rather than fabricating fake historical terms.
- **Subject Performance Summary:** Cross-calculator table uniting coursework grades, quality points, credits, and academic standing with on-click CSV export.
- **Quick Links:** Seamless one-click routing to all 7 productivity tools and AI features.

### 2. Comprehensive Data Persistence (`LocalStorage`)
- Resilient client-side persistence for:
  - Grade Calculator coursework subjects (`gradepilot_grade_calc_subjects`)
  - CGPA Calculator subjects (`gradepilot_cgpa_calc_subjects`)
  - Historical semester records (`gradepilot_semesters`)
  - Active and archived study plans (`gradepilot_study_plans`, `gradepilot_active_study_plan`)
  - Calculation logs and audit history (`gradepilot_history`)
  - Conversational chat turns (`gradepilot_chat_history`)
  - Student profile and goals (`gradepilot_profile`)
  - System settings and grading scale preferences (`gradepilot_settings`, `theme`)
- **Graceful Error Handling:** Automatically catches, sanitizes, and falls back to safe defaults when encountering malformed or corrupted JSON in `LocalStorage`.

### 3. PDF & CSV Export Suite
- **PDF Generation via `jsPDF`:**
  - Grade Calculator coursework results and weighted average reports.
  - CGPA/TGPA transcripts with formula disclosures and academic status.
  - Executive Academic Performance Summary reports directly from the Dashboard.
  - Weekly Study Plan schedules and revision checklists.
- **CSV Data Export:**
  - Enrolled coursework and subject marks.
  - Multi-semester GPA progression records.
  - Calculation audit logs.

### 4. Settings, Backup & Restore
- **Theme Modes:** Instant switching between Dark Mode and Light Mode with persistent preference preservation.
- **Data Backup (JSON Export):** Bundles the complete client portfolio into a single portable `.json` backup file.
- **Data Restore (JSON Import):** Enforces **strict schema validation** to verify valid structure and recognized GradePilot keys before updating storage.
- **Destructive Action Confirmations:** Non-silent operations requiring explicit user confirmation before clearing academic data or executing a factory reset.

### 5. Privacy Notice & Client-Side Boundaries
- **Unencrypted LocalStorage Disclosure:** Clearly informs students that data is stored in standard, unencrypted browser `LocalStorage` scoped to their origin.
- **Minimal AI Data Flow:** Transmits only the specific inputs required for an explicit calculation to the Flask backend and Google Gemini API.
- **No Registrar Credentials:** Explicitly guarantees that GradePilot AI does not connect to, query, or store official university student portal passwords or private registrar databases.



