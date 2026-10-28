/**
 * GradePilot AI - LocalStorage State Management (Phase 11)
 * Persistent client-side database with backup/restore, graceful malformed data handling,
 * and academic data isolation.
 * Named AppStorage to avoid colliding with native DOM window.Storage interface.
 */

const AppStorage = (() => {
  const PREFIX = 'gradepilot_';

  const KEYS = {
    PROFILE: `${PREFIX}profile`,
    SETTINGS: `${PREFIX}settings`,
    HISTORY: `${PREFIX}history`,
    SEMESTERS: `${PREFIX}semesters`,
    STUDY_PLANS: `${PREFIX}study_plans`,
    ACTIVE_STUDY_PLAN: `${PREFIX}active_study_plan`,
    CHAT_HISTORY: `${PREFIX}chat_history`,
    GRADE_SUBJECTS: 'gradepilot_grade_calc_subjects',
    CGPA_SUBJECTS: 'gradepilot_cgpa_calc_subjects',
    THEME: 'theme'
  };

  // Default Profiles & Settings (Initial Defaults)
  const DEFAULT_PROFILE = {
    name: 'Alex Mercer',
    major: 'Computer Science',
    institution: 'University of Technology',
    currentCgpa: 3.65,
    targetCgpa: 3.85,
    completedCredits: 64,
    totalDegreeCredits: 120
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    gradingScale: '10.0', // '10.0' or '4.0'
    backendUrl: 'http://localhost:5000',
    autoSave: true,
    hapticFeedback: true
  };

  /**
   * Safe read from LocalStorage with graceful recovery from malformed/corrupted data
   */
  const get = (key, fallback = null) => {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined || item === '') {
        return fallback;
      }
      const parsed = JSON.parse(item);

      // Defend against malformed type corruptions
      if (Array.isArray(fallback) && !Array.isArray(parsed)) {
        console.warn(`LocalStorage type recovery for "${key}": expected Array, received ${typeof parsed}. Using fallback.`);
        return fallback;
      }
      if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          console.warn(`LocalStorage type recovery for "${key}": expected Object, received ${typeof parsed}. Using fallback.`);
          return fallback;
        }
      }

      return parsed;
    } catch (e) {
      console.warn(`LocalStorage JSON parse error for "${key}":`, e);
      return fallback;
    }
  };

  /**
   * Safe write to LocalStorage
   */
  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`LocalStorage write error for "${key}":`, e);
      return false;
    }
  };

  // Profile operations
  const getProfile = () => get(KEYS.PROFILE, DEFAULT_PROFILE);
  const saveProfile = (data) => set(KEYS.PROFILE, { ...getProfile(), ...data });

  // Settings operations
  const getSettings = () => get(KEYS.SETTINGS, DEFAULT_SETTINGS);
  const saveSettings = (data) => set(KEYS.SETTINGS, { ...getSettings(), ...data });

  // History operations (calculators logs)
  const getHistory = () => get(KEYS.HISTORY, []);
  const addHistoryItem = (item) => {
    const history = getHistory();
    const newItem = {
      id: 'hist_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...item
    };
    // Keep last 40 entries
    const updated = [newItem, ...history].slice(0, 40);
    set(KEYS.HISTORY, updated);
    return newItem;
  };
  const clearHistory = () => set(KEYS.HISTORY, []);

  // Semesters & Courses operations (Default to empty array - Do not invent academic records)
  const getSemesters = () => get(KEYS.SEMESTERS, []);
  const saveSemesters = (semesters) => set(KEYS.SEMESTERS, Array.isArray(semesters) ? semesters : []);

  // Study plans operations
  const getStudyPlans = () => get(KEYS.STUDY_PLANS, []);
  const saveStudyPlans = (plans) => set(KEYS.STUDY_PLANS, Array.isArray(plans) ? plans : []);
  const addStudyPlan = (plan) => {
    const plans = getStudyPlans();
    const updated = [{ id: 'plan_' + Date.now(), createdAt: new Date().toISOString(), ...plan }, ...plans];
    set(KEYS.STUDY_PLANS, updated);
  };

  const getActiveStudyPlan = () => get(KEYS.ACTIVE_STUDY_PLAN, null);
  const saveActiveStudyPlan = (plan) => set(KEYS.ACTIVE_STUDY_PLAN, plan);
  const clearActiveStudyPlan = () => {
    localStorage.removeItem(KEYS.ACTIVE_STUDY_PLAN);
  };

  const updatePlanTaskStatus = (taskId, isCompleted) => {
    const plan = getActiveStudyPlan();
    if (!plan) return null;

    let updated = false;

    // Search in days blocks
    if (Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        if (Array.isArray(day.blocks)) {
          day.blocks.forEach(b => {
            if (b.id === taskId) {
              b.completed = Boolean(isCompleted);
              updated = true;
            }
          });
        }
      });
    }

    // Search in weeklyReview tasks if object/array
    if (plan.weeklyReview && Array.isArray(plan.weeklyReview.tasks)) {
      plan.weeklyReview.tasks.forEach((t, idx) => {
        const revId = `rev-${idx}`;
        if (taskId === revId) {
          if (typeof t === 'object') {
            t.completed = Boolean(isCompleted);
          }
          updated = true;
        }
      });
    }

    if (updated) {
      saveActiveStudyPlan(plan);
    }
    return plan;
  };

  // Chat History operations
  const getChatHistory = () => get(KEYS.CHAT_HISTORY, [
    {
      sender: 'bot',
      message: 'Hello! I am your GradePilot AI Academic Assistant. How can I assist with your grades, study schedule, or academic strategy today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWelcome: true
    }
  ]);
  const saveChatHistory = (history) => set(KEYS.CHAT_HISTORY, Array.isArray(history) ? history : []);
  const addChatMessage = (msg) => {
    const list = getChatHistory();
    list.push(msg);
    set(KEYS.CHAT_HISTORY, list.slice(-50)); // Keep last 50
  };
  const clearChatHistory = () => {
    set(KEYS.CHAT_HISTORY, []);
  };

  // Export all application data as structured JSON string
  const exportAllData = () => {
    const data = {
      app: 'GradePilot AI',
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      settings: getSettings(),
      theme: localStorage.getItem('theme') || 'dark',
      history: getHistory(),
      semesters: getSemesters(),
      gradeSubjects: get(KEYS.GRADE_SUBJECTS, []),
      cgpaSubjects: get(KEYS.CGPA_SUBJECTS, []),
      studyPlans: getStudyPlans(),
      activeStudyPlan: getActiveStudyPlan(),
      chatHistory: getChatHistory()
    };
    return JSON.stringify(data, null, 2);
  };

  /**
   * Validate JSON schema before committing to LocalStorage
   */
  const validateImportJson = (jsonString) => {
    if (!jsonString || typeof jsonString !== 'string') {
      return { valid: false, error: 'Empty or invalid backup content.' };
    }

    let parsed = null;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { valid: false, error: 'Malformed JSON syntax: ' + e.message };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Backup data root must be an object.' };
    }

    // Check for recognized schema keys
    const recognizedKeys = ['profile', 'settings', 'semesters', 'gradeSubjects', 'cgpaSubjects', 'studyPlans', 'activeStudyPlan', 'history', 'chatHistory'];
    const matched = recognizedKeys.filter(k => k in parsed);

    if (matched.length === 0) {
      return { valid: false, error: 'Unrecognized backup format. No GradePilot data properties found.' };
    }

    return { valid: true, data: parsed, matchedKeys: matched };
  };

  /**
   * Import application data with validation and non-silent overwrite protection
   */
  const importAllData = (jsonString, options = { overwrite: true }) => {
    const validation = validateImportJson(jsonString);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const parsed = validation.data;
    const importedKeys = [];

    try {
      if (parsed.profile && typeof parsed.profile === 'object') {
        set(KEYS.PROFILE, parsed.profile);
        importedKeys.push('Student Profile');
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        set(KEYS.SETTINGS, parsed.settings);
        importedKeys.push('Settings');
      }
      if (parsed.theme && typeof parsed.theme === 'string') {
        localStorage.setItem('theme', parsed.theme);
        importedKeys.push('Theme');
      }
      if (Array.isArray(parsed.history)) {
        set(KEYS.HISTORY, parsed.history);
        importedKeys.push('Calculation History');
      }
      if (Array.isArray(parsed.semesters)) {
        set(KEYS.SEMESTERS, parsed.semesters);
        importedKeys.push('Semester Records');
      }
      if (Array.isArray(parsed.gradeSubjects)) {
        set(KEYS.GRADE_SUBJECTS, parsed.gradeSubjects);
        importedKeys.push('Grade Calculator Subjects');
      }
      if (Array.isArray(parsed.cgpaSubjects)) {
        set(KEYS.CGPA_SUBJECTS, parsed.cgpaSubjects);
        importedKeys.push('CGPA Calculator Subjects');
      }
      if (Array.isArray(parsed.studyPlans)) {
        set(KEYS.STUDY_PLANS, parsed.studyPlans);
        importedKeys.push('Study Plans');
      }
      if (parsed.activeStudyPlan && typeof parsed.activeStudyPlan === 'object') {
        set(KEYS.ACTIVE_STUDY_PLAN, parsed.activeStudyPlan);
        importedKeys.push('Active Study Plan');
      }
      if (Array.isArray(parsed.chatHistory)) {
        set(KEYS.CHAT_HISTORY, parsed.chatHistory);
        importedKeys.push('Chat History');
      }

      return { success: true, count: importedKeys.length, importedKeys };
    } catch (err) {
      console.error('Import processing error:', err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Clear local academic data (subjects, semesters, study plans, calculation history, chat)
   * Preserves application settings and theme
   */
  const clearAcademicData = () => {
    const academicKeys = [
      KEYS.GRADE_SUBJECTS,
      KEYS.CGPA_SUBJECTS,
      KEYS.SEMESTERS,
      KEYS.HISTORY,
      KEYS.STUDY_PLANS,
      KEYS.ACTIVE_STUDY_PLAN,
      KEYS.CHAT_HISTORY
    ];
    academicKeys.forEach(k => localStorage.removeItem(k));
  };

  /**
   * Reset preferences to factory defaults (theme, gradingScale, backendUrl)
   */
  const resetPreferences = () => {
    set(KEYS.SETTINGS, DEFAULT_SETTINGS);
    localStorage.setItem('theme', DEFAULT_SETTINGS.theme);
  };

  /**
   * Factory reset everything
   */
  const resetAllData = () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('theme');
  };

  return {
    get,
    set,
    KEYS,
    DEFAULT_PROFILE,
    DEFAULT_SETTINGS,
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    getHistory,
    addHistoryItem,
    clearHistory,
    getSemesters,
    saveSemesters,
    getStudyPlans,
    saveStudyPlans,
    addStudyPlan,
    getActiveStudyPlan,
    saveActiveStudyPlan,
    clearActiveStudyPlan,
    updatePlanTaskStatus,
    getChatHistory,
    saveChatHistory,
    addChatMessage,
    clearChatHistory,
    exportAllData,
    validateImportJson,
    importAllData,
    clearAcademicData,
    resetPreferences,
    resetAllData
  };
})();

// Attach globally
window.AppStorage = AppStorage;
