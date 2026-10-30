/**
 * GradePilot AI - AI Chat Assistant Controller (Phase 10)
 * Bilingual conversational academic copilot (English & Hinglish)
 * Features:
 * - Direct deterministic integration with client JavaScript calculators (CGPA, SGPA, Percentage)
 * - Authoritative numerical ground truth passed to AI for explanation
 * - Selective academic context (strictly omits unrelated records)
 * - Bounded conversation history (last 15 turns)
 * - Duplicate submission & empty input prevention
 * - Resilient error handling with inline Retry action
 * - Real-time typing animation
 * - Suggested questions chip handlers
 * - Conversation clear action & LocalStorage persistence
 */

const AiChat = (() => {
  const Storage = window.AppStorage || AppStorage;

  // In-flight locking state to prevent duplicate submissions
  let isSubmitting = false;

  // Cache last failed message for the retry button
  let lastFailedAttempt = null;

  /**
   * Initialize module
   */
  const init = () => {
    renderHistory();
    bindEvents();
    updateCharCounter();
  };

  /**
   * Initial default greeting if history is empty
   */
  const getDefaultWelcomeMessage = () => {
    return {
      sender: 'bot',
      message: `Hello! I am your **GradePilot AI Academic Assistant** 🎓\n\nI can help you in **English** or **Hinglish**:\n* **Predict Required SGPA:** Target CGPA achieve karne ke liye kya scores chahiye.\n* **Explain Your CGPA:** Credit-weighted GPA kaise calculate hota hai.\n* **Convert to Percentage:** AICTE & standard formulas se exact percentage.\n* **Subject Guidance:** Mathematics aur core subjects me improve karne ke strategies.\n* **Weekly Study Planning:** Balanced, personalized study routines.\n\nAsk me any question below or click one of the suggested questions above!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWelcome: true
    };
  };

  /**
   * Intelligently analyze student query, invoke deterministic JavaScript calculators
   * when numerical questions are asked, and attach only relevant academic context.
   */
  const prepareAcademicContext = (userMessage) => {
    const q = (userMessage || '').toLowerCase();
    const profile = Storage.getProfile ? Storage.getProfile() : {};
    const context = {};

    let hasCalculatorResult = false;

    // -------------------------------------------------------------------------
    // 1. Target SGPA / Goal Planning Questions
    // -------------------------------------------------------------------------
    const isTargetQuery = (
      q.includes('target') ||
      q.includes('what sgpa') ||
      q.includes('sgpa do i need') ||
      q.includes('required sgpa') ||
      q.includes('reach my target') ||
      q.includes('kitna sgpa') ||
      q.includes('sgpa chahiye') ||
      q.includes('target cgpa')
    );

    if (isTargetQuery) {
      // Pull inputs from predictor inputs or stored profile defaults
      const curCgpa = parseFloat(document.getElementById('pred-current-cgpa')?.value) || parseFloat(profile.currentCgpa) || 7.5;
      const tgtCgpa = parseFloat(document.getElementById('pred-target-cgpa')?.value) || parseFloat(profile.targetCgpa) || 8.5;
      const compCreds = parseFloat(document.getElementById('pred-completed-credits')?.value) || parseFloat(profile.completedCredits) || 60;
      const upCreds = parseFloat(document.getElementById('pred-upcoming-credits')?.value) || 20;
      const scale = 10.0;

      // Deterministic authoritative calculation using CgpaPredictor
      let prediction = null;
      if (typeof CgpaPredictor !== 'undefined' && CgpaPredictor.computePrediction) {
        prediction = CgpaPredictor.computePrediction(curCgpa, compCreds, upCreds, tgtCgpa, scale);
      } else {
        // Fallback formula if predictor object is not in scope
        const totalCreds = compCreds + upCreds;
        const targetPts = tgtCgpa * totalCreds;
        const curPts = curCgpa * compCreds;
        const needed = (targetPts - curPts) / upCreds;
        const reqSgpa = Math.round(needed * 100) / 100;
        const maxAchievable = Math.round(((curPts + scale * upCreds) / totalCreds) * 100) / 100;
        prediction = {
          currentCgpa: curCgpa,
          targetCgpa: tgtCgpa,
          completedCredits: compCreds,
          upcomingCredits: upCreds,
          requiredSgpa: reqSgpa,
          maxAchievableCgpa: maxAchievable,
          isImpossible: reqSgpa > scale,
          status: reqSgpa > scale ? 'Mathematically Impossible' : 'Feasible'
        };
      }

      context.currentCgpa = curCgpa;
      context.targetCgpa = tgtCgpa;
      context.completedCredits = compCreds;
      context.upcomingCredits = upCreds;
      context.calculatorResult = {
        type: 'Target SGPA Prediction (Authoritative)',
        currentCgpa: prediction.currentCgpa,
        targetCgpa: prediction.targetCgpa,
        completedCredits: prediction.completedCredits,
        upcomingCredits: prediction.upcomingCredits,
        requiredSgpa: prediction.requiredSgpa,
        maxAchievableCgpa: prediction.maxAchievableCgpa,
        isImpossible: prediction.isImpossible,
        status: prediction.statusLabel || prediction.status,
        formula: 'requiredSGPA = (targetCGPA * totalCredits - currentCGPA * completedCredits) / upcomingCredits'
      };
      hasCalculatorResult = true;
      return context;
    }

    // -------------------------------------------------------------------------
    // 2. Percentage Calculation / CGPA to Percentage Questions
    // -------------------------------------------------------------------------
    const isPercentageQuery = (
      q.includes('percentage') ||
      q.includes('calculate my percentage') ||
      q.includes('cgpa to percentage') ||
      q.includes('percent') ||
      q.includes('kitna percent')
    );

    if (isPercentageQuery) {
      // Check if user specified marks in the prompt: e.g. "450/500" or "85 out of 100"
      const marksMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*(\d+(?:\.\d+)?)/);
      if (marksMatch) {
        const obtained = parseFloat(marksMatch[1]);
        const total = parseFloat(marksMatch[2]);
        if (total > 0) {
          const pct = Math.round((obtained / total) * 10000) / 100;
          context.calculatorResult = {
            type: 'Marks to Percentage Calculation',
            obtainedMarks: obtained,
            totalMarks: total,
            calculatedPercentage: pct,
            formula: '(Obtained Marks / Total Marks) × 100'
          };
          hasCalculatorResult = true;
          return context;
        }
      }

      // If no raw marks given, calculate from student CGPA
      const curCgpa = parseFloat(profile.currentCgpa) || 8.0;
      const cbsePct = Math.round(curCgpa * 9.5 * 100) / 100;
      const aictePct = Math.round((curCgpa - 0.75) * 10 * 100) / 100;
      const directPct = Math.round((curCgpa / 10) * 100 * 100) / 100;

      context.currentCgpa = curCgpa;
      context.calculatorResult = {
        type: 'CGPA to Percentage Conversion',
        cgpa: curCgpa,
        standardCbsePercentage: cbsePct,
        standardFormula: 'CGPA × 9.5',
        aictePercentage: aictePct,
        aicteFormula: '(CGPA - 0.75) × 10',
        directPercentage: directPct,
        directFormula: '(CGPA / 10) × 100'
      };
      hasCalculatorResult = true;
      return context;
    }

    // -------------------------------------------------------------------------
    // 3. Credit-Weighted GPA / Explain My CGPA Questions
    // -------------------------------------------------------------------------
    const isGpaExplanationQuery = (
      q.includes('explain my cgpa') ||
      q.includes('explain credit-weighted') ||
      q.includes('credit-weighted gpa') ||
      q.includes('credit weighted') ||
      q.includes('weighted gpa') ||
      q.includes('cgpa kaise calculate')
    );

    if (isGpaExplanationQuery) {
      let cgpaInfo = null;
      if (typeof CgpaCalculator !== 'undefined' && CgpaCalculator.calculateCGPA) {
        cgpaInfo = CgpaCalculator.calculateCGPA();
      }

      const curCgpa = (cgpaInfo && cgpaInfo.cgpa > 0) ? cgpaInfo.cgpa : (parseFloat(profile.currentCgpa) || 8.2);
      const creds = (cgpaInfo && cgpaInfo.totalCredits > 0) ? cgpaInfo.totalCredits : (parseFloat(profile.completedCredits) || 64);
      const points = (cgpaInfo && cgpaInfo.totalCreditPoints > 0) ? cgpaInfo.totalCreditPoints : Math.round(curCgpa * creds * 10) / 10;

      context.currentCgpa = curCgpa;
      context.completedCredits = creds;
      context.calculatorResult = {
        type: 'Credit-Weighted CGPA Formula',
        currentCgpa: curCgpa,
        totalCredits: creds,
        totalCreditPoints: points,
        formula: 'CGPA = SUM(Grade Points × Credits) / SUM(Credits)',
        performanceStanding: cgpaInfo ? cgpaInfo.status : 'First Class with Distinction'
      };
      hasCalculatorResult = true;
      return context;
    }

    // -------------------------------------------------------------------------
    // 4. Subject Specific Inquiries (e.g., Mathematics, Programming, etc.)
    // -------------------------------------------------------------------------
    const isSubjectQuery = (
      q.includes('mathematics') ||
      q.includes('math') ||
      q.includes('improve') ||
      q.includes('physics') ||
      q.includes('subject')
    );

    if (isSubjectQuery) {
      // Find relevant subjects in storage or provide appropriate course metadata
      const relevant = [];
      const semesters = Storage.getSemesters ? Storage.getSemesters() : [];
      semesters.forEach(sem => {
        (sem.courses || []).forEach(course => {
          const cName = (course.name || '').toLowerCase();
          if (q.includes('math') && (cName.includes('math') || cName.includes('calculus'))) {
            relevant.push({ name: course.name, credits: course.credits || 4, gradePoint: course.gradePoint || 7.0 });
          } else if (q.includes(cName) && cName.length > 2) {
            relevant.push({ name: course.name, credits: course.credits || 3, gradePoint: course.gradePoint || 7.0 });
          }
        });
      });

      if (relevant.length === 0 && q.includes('math')) {
        relevant.push({ name: 'Engineering Mathematics', credits: 4, gradePoint: 6.0 });
      }

      if (relevant.length > 0) {
        context.relevantSubjects = relevant.slice(0, 3);
        context.currentCgpa = parseFloat(profile.currentCgpa) || 7.5;
        return context;
      }
    }

    // -------------------------------------------------------------------------
    // 5. Study Plan Inquiries
    // -------------------------------------------------------------------------
    if (q.includes('study plan') || q.includes('weekly schedule') || q.includes('routine')) {
      context.currentCgpa = parseFloat(profile.currentCgpa) || 7.5;
      context.targetCgpa = parseFloat(profile.targetCgpa) || 8.5;
      return context;
    }

    // -------------------------------------------------------------------------
    // 6. General Questions: Send NO unrelated academic data
    // -------------------------------------------------------------------------
    return context;
  };

  /**
   * Render message history from LocalStorage
   */
  const renderHistory = () => {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    let history = Storage.getChatHistory ? Storage.getChatHistory() : [];
    if (!Array.isArray(history) || history.length === 0) {
      history = [getDefaultWelcomeMessage()];
    }

    container.innerHTML = history.map((item, idx) => {
      const isUser = item.sender === 'user';
      const isError = Boolean(item.isError);
      const hasCalc = Boolean(item.hasCalculatorResult);

      let calcBadgeHtml = '';
      if (hasCalc) {
        calcBadgeHtml = `
          <div class="chat-verified-calc">
            <i class="fa-solid fa-calculator"></i> Verified Calculation Applied
          </div>
        `;
      }

      let retryHtml = '';
      if (isError) {
        retryHtml = `
          <div>
            <button type="button" class="chat-retry-btn" data-retry-idx="${idx}">
              <i class="fa-solid fa-rotate-right"></i> Retry
            </button>
          </div>
        `;
      }

      const contentHtml = Utils.renderMarkdown ? Utils.renderMarkdown(item.message) : Utils.escapeHtml(item.message);

      return `
        <div class="chat-message-row ${isUser ? 'user' : 'bot'}">
          ${!isUser ? `
            <div class="chat-bot-avatar-mini">
              <i class="fa-solid fa-robot"></i>
            </div>
          ` : ''}
          <div class="chat-bubble ${isError ? 'error' : ''}">
            ${calcBadgeHtml}
            ${contentHtml}
            ${retryHtml}
            <div class="chat-bubble-meta">
              <span>${Utils.escapeHtml(item.time || '')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind retry buttons
    container.querySelectorAll('.chat-retry-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        retryLastFailed();
      });
    });

    scrollToBottom();
  };

  /**
   * Smoothly scroll messages stream to bottom
   */
  const scrollToBottom = () => {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  /**
   * Toggle visual typing indicator
   */
  const setTypingVisible = (visible) => {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) {
      indicator.style.display = visible ? 'flex' : 'none';
      if (visible) scrollToBottom();
    }
  };

  /**
   * Update character counter for input field
   */
  const updateCharCounter = () => {
    const input = document.getElementById('chat-input-field');
    const counter = document.getElementById('chat-char-counter');
    if (input && counter) {
      const len = input.value.length;
      counter.textContent = `${len} / 2000`;
      if (len >= 1900) {
        counter.classList.add('text-danger');
      } else {
        counter.classList.remove('text-danger');
      }
    }
  };

  /**
   * Format history turns bounded to last 15 messages for the backend
   */
  const getBoundedHistoryForBackend = () => {
    const rawHistory = Storage.getChatHistory ? Storage.getChatHistory() : [];
    if (!Array.isArray(rawHistory)) return [];

    // Filter out error bubbles or welcome greeting
    const valid = rawHistory.filter(m => !m.isError && !m.isWelcome);

    // Limit to last 15 turns
    return valid.slice(-15).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.message
    }));
  };

  /**
   * Send a chat message
   */
  const sendMessage = async (textOverride = null) => {
    if (isSubmitting) return;

    const input = document.getElementById('chat-input-field');
    const sendBtn = document.getElementById('chat-send-btn');
    const rawText = textOverride !== null ? textOverride : (input ? input.value : '');
    const message = (rawText || '').trim();

    // Prevent empty or whitespace-only messages
    if (!message) {
      if (input) input.focus();
      return;
    }

    // Enforce 2000 char maximum
    if (message.length > 2000) {
      Utils.showToast('Message exceeds maximum limit of 2000 characters.', 'warning');
      return;
    }

    // Set lock
    isSubmitting = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    if (input) {
      input.value = '';
      updateCharCounter();
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Append user message to history
    const userMsg = {
      sender: 'user',
      message: message,
      time: timeStr
    };
    if (Storage.addChatMessage) {
      Storage.addChatMessage(userMsg);
    }
    renderHistory();

    // 2. Prepare selective academic context & deterministic calculations
    const academicContext = prepareAcademicContext(message);
    const hasCalc = Boolean(academicContext && academicContext.calculatorResult);

    // Cache this attempt in case of failure
    lastFailedAttempt = {
      message,
      academicContext,
      hasCalc
    };

    // 3. Show typing indicator
    setTypingVisible(true);

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'https://grade-pointer-ai-backend.vercel.app';
    const boundedHistory = getBoundedHistoryForBackend();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s safety timeout

      const res = await fetch(`${backendUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: message,
          history: boundedHistory,
          academicContext: academicContext
        })
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const replyText = data.response || data.reply || 'I received your message, but the response was empty.';

        // Append assistant response
        const botMsg = {
          sender: 'bot',
          message: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hasCalculatorResult: hasCalc
        };
        if (Storage.addChatMessage) {
          Storage.addChatMessage(botMsg);
        }
        lastFailedAttempt = null; // Clear failed attempt on success
        renderHistory();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `AI service returned error status ${res.status}`);
      }
    } catch (err) {
      console.warn('AI Chat request failed:', err);

      const isAborted = err.name === 'AbortError';
      const errorMsgText = isAborted
        ? 'The AI Assistant took too long to respond. The server might be experiencing high load. Please retry.'
        : `Unable to connect to GradePilot AI service (${err.message || 'Network error'}). Please verify your backend server is running and retry.`;

      // Record error bubble (do not fabricate fake AI responses)
      const errorBubble = {
        sender: 'bot',
        message: errorMsgText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      if (Storage.addChatMessage) {
        Storage.addChatMessage(errorBubble);
      }
      renderHistory();
    } finally {
      setTypingVisible(false);
      isSubmitting = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Send</span>';
      }
      if (input) input.focus();
    }
  };

  /**
   * Retry the last failed message
   */
  const retryLastFailed = () => {
    if (!lastFailedAttempt || !lastFailedAttempt.message) {
      Utils.showToast('No failed message to retry.', 'info');
      return;
    }
    const msgToRetry = lastFailedAttempt.message;
    sendMessage(msgToRetry);
  };

  /**
   * Clear the entire conversation
   */
  const clearChat = () => {
    if (confirm('Are you sure you want to clear your entire chat conversation?')) {
      if (Storage.clearChatHistory) {
        Storage.clearChatHistory();
      }
      lastFailedAttempt = null;
      renderHistory();
      Utils.showToast('Chat conversation cleared.', 'info');
    }
  };

  /**
   * Bind DOM event listeners
   */
  const bindEvents = () => {
    const sendBtn = document.getElementById('chat-send-btn');
    const inputField = document.getElementById('chat-input-field');
    const clearBtn = document.getElementById('chat-clear-btn');

    // Send button click
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
      });
    }

    // Input keyboard events: Enter sends, Shift+Enter new line
    if (inputField) {
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      inputField.addEventListener('input', () => {
        updateCharCounter();
        // Auto resize height
        inputField.style.height = 'auto';
        inputField.style.height = `${Math.min(inputField.scrollHeight, 120)}px`;
      });
    }

    // Clear chat button
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearChat();
      });
    }

    // Suggested questions chips click
    const chips = document.querySelectorAll('.chat-suggestion-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const question = chip.getAttribute('data-question');
        if (question) {
          sendMessage(question);
        }
      });
    });
  };

  return {
    init,
    sendMessage,
    clearChat,
    retryLastFailed,
    prepareAcademicContext
  };
})();

// Attach globally
window.AiChat = AiChat;
