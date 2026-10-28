/**
 * GradePilot AI - AI Study Plan Generator Controller (Phase 9)
 * Generates personalized, constraint-respecting weekly study schedules
 * with subject blocks, deliberate practice, active revision, scheduled breaks,
 * and progress checkpoints using the Flask / Gemini backend.
 */

const StudyPlanner = (() => {
  const Storage = window.AppStorage || AppStorage;

  // Local State
  let subjectsList = ['Data Structures', 'Operating Systems', 'Linear Algebra'];
  let focusSubjects = ['Operating Systems'];
  let preferredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let activePlan = null;
  let lastPayload = null;

  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const init = () => {
    bindEvents();
    renderSubjectsChips();
    renderFocusChips();
    updateDaysSelectorUI();
    updateHoursDisplay();
    loadSavedPlan();
  };

  /**
   * Load active plan from LocalStorage
   */
  const loadSavedPlan = () => {
    const saved = Storage.getActiveStudyPlan ? Storage.getActiveStudyPlan() : null;
    if (saved && saved.days && Array.isArray(saved.days)) {
      activePlan = saved;
      renderPlan(activePlan);
    } else {
      // Check legacy plans if activePlan not set
      const plans = Storage.getStudyPlans ? Storage.getStudyPlans() : [];
      if (plans && plans.length > 0 && plans[0].days) {
        activePlan = plans[0];
        renderPlan(activePlan);
      }
    }
  };

  /**
   * Render subject chips with remove buttons
   */
  const renderSubjectsChips = () => {
    const container = document.getElementById('plan-subjects-chips');
    if (!container) return;

    if (subjectsList.length === 0) {
      container.innerHTML = `
        <span style="font-size: 0.825rem; color: var(--text-muted); font-style: italic;">
          No subjects added. Please add at least 1 course subject above.
        </span>
      `;
      renderFocusChips();
      return;
    }

    container.innerHTML = subjectsList.map((s, idx) => `
      <span class="plan-subject-chip" data-index="${idx}">
        <span>${Utils.escapeHtml(s)}</span>
        <i class="fa-solid fa-xmark plan-chip-remove" data-index="${idx}" title="Remove subject"></i>
      </span>
    `).join('');

    // Attach remove listeners
    container.querySelectorAll('.plan-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        removeSubject(idx);
      });
    });

    renderFocusChips();
  };

  /**
   * Render focus subject pills (toggleable subset)
   */
  const renderFocusChips = () => {
    const container = document.getElementById('plan-focus-chips');
    if (!container) return;

    if (subjectsList.length === 0) {
      container.innerHTML = `
        <span style="font-size: 0.825rem; color: var(--text-muted); font-style: italic;">
          Add course subjects first to choose priority subjects.
        </span>
      `;
      return;
    }

    container.innerHTML = subjectsList.map(s => {
      const isFocused = focusSubjects.includes(s);
      return `
        <button type="button" class="plan-focus-chip ${isFocused ? 'active' : ''}" data-subject="${Utils.escapeHtml(s)}">
          <i class="fa-solid ${isFocused ? 'fa-fire' : 'fa-plus'}"></i>
          <span>${Utils.escapeHtml(s)}</span>
        </button>
      `;
    }).join('');

    // Attach toggle listeners
    container.querySelectorAll('.plan-focus-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const subj = e.currentTarget.getAttribute('data-subject');
        toggleFocusSubject(subj);
      });
    });
  };

  const addSubject = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;

    // Check duplicate case-insensitively
    if (subjectsList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      Utils.showToast(`Subject "${trimmed}" is already added.`, 'info');
      return;
    }

    if (subjectsList.length >= 12) {
      Utils.showToast('Maximum 12 course subjects allowed for a weekly plan.', 'warning');
      return;
    }

    subjectsList.push(trimmed);
    renderSubjectsChips();

    const input = document.getElementById('plan-subject-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  };

  const removeSubject = (index) => {
    if (index >= 0 && index < subjectsList.length) {
      const removed = subjectsList.splice(index, 1)[0];
      // Also remove from focus list
      focusSubjects = focusSubjects.filter(f => f.toLowerCase() !== removed.toLowerCase());
      renderSubjectsChips();
    }
  };

  const toggleFocusSubject = (subject) => {
    const idx = focusSubjects.findIndex(f => f.toLowerCase() === subject.toLowerCase());
    if (idx >= 0) {
      focusSubjects.splice(idx, 1);
    } else {
      focusSubjects.push(subject);
    }
    renderFocusChips();
  };

  /**
   * Update Preferred Days UI Buttons
   */
  const updateDaysSelectorUI = () => {
    const container = document.getElementById('plan-days-selector-bar');
    const countEl = document.getElementById('plan-selected-days-count');
    if (!container) return;

    container.querySelectorAll('.plan-day-btn').forEach(btn => {
      const day = btn.getAttribute('data-day');
      if (preferredDays.includes(day)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (countEl) {
      const count = preferredDays.length;
      countEl.textContent = `${count} day${count === 1 ? '' : 's'} selected (${7 - count} rest day${7 - count === 1 ? '' : 's'})`;
    }
  };

  const togglePreferredDay = (dayName) => {
    const idx = preferredDays.indexOf(dayName);
    if (idx >= 0) {
      if (preferredDays.length <= 1) {
        Utils.showToast('You must select at least 1 study day.', 'warning');
        return;
      }
      preferredDays.splice(idx, 1);
    } else {
      preferredDays.push(dayName);
      // Sort in standard week order
      preferredDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    }
    updateDaysSelectorUI();
  };

  const setDaysPreset = (preset) => {
    if (preset === 'all') {
      preferredDays = [...ALL_DAYS];
    } else if (preset === 'weekdays') {
      preferredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    } else if (preset === 'sixdays') {
      preferredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    }
    updateDaysSelectorUI();
    Utils.showToast(`Selected ${preferredDays.length} study days`, 'info');
  };

  const updateHoursDisplay = () => {
    const slider = document.getElementById('plan-daily-hours-slider');
    const badge = document.getElementById('plan-daily-hours-val');
    if (slider && badge) {
      const val = parseFloat(slider.value) || 3.5;
      badge.textContent = `${val.toFixed(1)} hrs / day`;
    }
  };

  /**
   * Import courses from Semesters & Grade Calculator
   */
  const handleImportCourses = () => {
    const semesters = Storage.getSemesters ? Storage.getSemesters() : [];
    const imported = new Set();

    semesters.forEach(sem => {
      if (Array.isArray(sem.courses)) {
        sem.courses.forEach(c => {
          if (c.name && c.name.trim()) imported.add(c.name.trim());
        });
      }
    });

    if (imported.size === 0) {
      Utils.showToast('No saved courses found in Semesters history to import.', 'info');
      return;
    }

    let addedCount = 0;
    imported.forEach(name => {
      if (!subjectsList.some(s => s.toLowerCase() === name.toLowerCase()) && subjectsList.length < 12) {
        subjectsList.push(name);
        addedCount++;
      }
    });

    renderSubjectsChips();
    Utils.showToast(`Imported ${addedCount} courses from your academic profile!`, 'success');
  };

  /**
   * Reset form back to defaults
   */
  const handleResetForm = () => {
    subjectsList = ['Data Structures', 'Operating Systems', 'Linear Algebra'];
    focusSubjects = ['Operating Systems'];
    preferredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const goalsInput = document.getElementById('plan-academic-goals');
    if (goalsInput) goalsInput.value = '';

    const examDatesInput = document.getElementById('plan-exam-dates');
    if (examDatesInput) examDatesInput.value = '';

    const hoursSlider = document.getElementById('plan-daily-hours-slider');
    if (hoursSlider) hoursSlider.value = '3.5';

    const sessionSelect = document.getElementById('plan-session-length');
    if (sessionSelect) sessionSelect.value = '45';

    const revisionSelect = document.getElementById('plan-revision-pref');
    if (revisionSelect) revisionSelect.value = 'Daily Active Recall (15-20 min start/end)';

    renderSubjectsChips();
    updateDaysSelectorUI();
    updateHoursDisplay();

    const errorAlert = document.getElementById('plan-error-alert');
    if (errorAlert) errorAlert.style.display = 'none';

    Utils.showToast('Planner preferences reset to defaults.', 'info');
  };

  /**
   * Collect student form payload
   */
  const collectPayload = () => {
    const slider = document.getElementById('plan-daily-hours-slider');
    const dailyHours = slider ? parseFloat(slider.value) || 3.5 : 3.5;

    const sessionSelect = document.getElementById('plan-session-length');
    const sessionLength = sessionSelect ? parseInt(sessionSelect.value, 10) || 45 : 45;

    const revisionSelect = document.getElementById('plan-revision-pref');
    const revisionPreferences = revisionSelect ? revisionSelect.value : 'Daily Active Recall (15-20 min start/end)';

    const goalsInput = document.getElementById('plan-academic-goals');
    const academicGoals = goalsInput ? goalsInput.value.trim() : '';

    const examDatesInput = document.getElementById('plan-exam-dates');
    const examDates = examDatesInput ? examDatesInput.value.trim() : '';

    return {
      subjects: [...subjectsList],
      focusSubjects: [...focusSubjects],
      academicGoals,
      dailyHours,
      preferredDays: [...preferredDays],
      examDates: examDates || null,
      sessionLength,
      revisionPreferences
    };
  };

  /**
   * Validate returned plan structure
   */
  const validatePlanStructure = (plan) => {
    if (!plan || typeof plan !== 'object') {
      throw new Error('AI returned an empty or non-object study plan.');
    }
    if (!Array.isArray(plan.days) || plan.days.length !== 7) {
      throw new Error('AI study plan must contain a complete 7-day schedule array.');
    }
    for (const d of plan.days) {
      if (!d.dayName) {
        throw new Error('Each day card in the schedule must have a valid day name.');
      }
      if (d.isStudyDay && (!Array.isArray(d.blocks) || d.blocks.length === 0)) {
        throw new Error(`Scheduled study day ${d.dayName} contains no study blocks.`);
      }
    }
    return true;
  };

  /**
   * Main Generator Action
   */
  const handleGenerate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Client Validation
    if (subjectsList.length === 0) {
      Utils.showToast('Please enter at least one course subject.', 'warning');
      const input = document.getElementById('plan-subject-input');
      if (input) input.focus();
      return;
    }

    if (preferredDays.length === 0) {
      Utils.showToast('Please select at least one preferred study day.', 'warning');
      return;
    }

    const payload = collectPayload();
    lastPayload = payload;

    const loadingState = document.getElementById('plan-loading-state');
    const outputContainer = document.getElementById('plan-output-container');
    const errorAlert = document.getElementById('plan-error-alert');
    const submitBtn = document.getElementById('plan-generate-btn');

    if (errorAlert) errorAlert.style.display = 'none';
    if (outputContainer) outputContainer.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing Plan...';
    }

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'http://localhost:5000';

    try {
      const response = await fetch(`${backendUrl}/api/ai/study-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.message || `Server returned error status ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      if (!data.success || !data.plan) {
        throw new Error('AI response did not include a valid study plan object.');
      }

      // Validate returned structure strictly
      validatePlanStructure(data.plan);

      // Active plan verified
      activePlan = data.plan;

      // Persist in LocalStorage
      if (Storage.saveActiveStudyPlan) {
        Storage.saveActiveStudyPlan(activePlan);
      }
      if (Storage.addStudyPlan) {
        Storage.addStudyPlan(activePlan);
      }

      renderPlan(activePlan);

      if (outputContainer) {
        outputContainer.style.display = 'block';
        outputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      Utils.showToast('Personalized weekly study timetable generated!', 'success');
    } catch (err) {
      console.error('Study plan generation failed:', err);
      // DO NOT SILENTLY GENERATE A FAKE PLAN
      if (errorAlert) {
        const errorTitle = document.getElementById('plan-error-title');
        const errorMessage = document.getElementById('plan-error-message');
        if (errorTitle) errorTitle.textContent = 'Study Plan Generation Failed';
        if (errorMessage) {
          errorMessage.innerHTML = `
            <strong>${Utils.escapeHtml(err.message || 'Connection to AI service failed')}</strong><br />
            <span>Ensure the Flask backend is active on <code>${Utils.escapeHtml(backendUrl)}</code> with valid Gemini credentials configured in <code>backend/.env</code>.</span>
          `;
        }
        errorAlert.style.display = 'block';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      Utils.showToast(err.message || 'Failed to generate study plan from AI service.', 'danger');
    } finally {
      if (loadingState) loadingState.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Weekly Study Plan';
      }
    }
  };

  /**
   * Regenerate Plan (using cached payload)
   */
  const handleRegenerate = () => {
    if (lastPayload) {
      handleGenerate();
    } else {
      handleGenerate();
    }
  };

  /**
   * Retry Generation after error
   */
  const handleRetry = () => {
    handleGenerate();
  };

  /**
   * Clear active plan
   */
  const handleClearPlan = () => {
    if (!confirm('Are you sure you want to clear this study plan and its task progress?')) {
      return;
    }
    activePlan = null;
    if (Storage.clearActiveStudyPlan) {
      Storage.clearActiveStudyPlan();
    }
    const outputContainer = document.getElementById('plan-output-container');
    if (outputContainer) outputContainer.style.display = 'none';
    Utils.showToast('Study plan cleared.', 'info');
  };

  /**
   * Toggle task checkbox completion
   */
  const handleTaskToggle = (taskId, isChecked) => {
    if (Storage.updatePlanTaskStatus) {
      activePlan = Storage.updatePlanTaskStatus(taskId, isChecked) || activePlan;
    } else if (activePlan) {
      // Local fallback
      activePlan.days.forEach(d => {
        if (d.blocks) {
          d.blocks.forEach(b => {
            if (b.id === taskId) b.completed = isChecked;
          });
        }
      });
    }

    // Update block visual style
    const itemEl = document.querySelector(`.plan-block-item[data-task-id="${taskId}"]`);
    if (itemEl) {
      if (isChecked) {
        itemEl.classList.add('completed');
      } else {
        itemEl.classList.remove('completed');
      }
    }

    // Recalculate Day Progress
    updateAllDayProgressBars();

    // Recalculate Overall Progress
    updateOverallProgressStats();
  };

  /**
   * Update all Day Progress Bars
   */
  const updateAllDayProgressBars = () => {
    if (!activePlan || !Array.isArray(activePlan.days)) return;

    activePlan.days.forEach(d => {
      if (!d.isStudyDay) return;
      const fillEl = document.getElementById(`plan-day-fill-${d.dayName}`);
      const textEl = document.getElementById(`plan-day-pct-${d.dayName}`);
      if (!fillEl) return;

      const nonBreakBlocks = (d.blocks || []).filter(b => b.type !== 'Short Break');
      if (nonBreakBlocks.length === 0) return;

      const completedCount = nonBreakBlocks.filter(b => b.completed).length;
      const pct = Math.round((completedCount / nonBreakBlocks.length) * 100);

      fillEl.style.width = `${pct}%`;
      if (textEl) textEl.textContent = `${pct}%`;
    });
  };

  /**
   * Update Overall Progress Metric Bar
   */
  const updateOverallProgressStats = () => {
    if (!activePlan || !Array.isArray(activePlan.days)) return;

    let totalTasks = 0;
    let completedTasks = 0;

    activePlan.days.forEach(d => {
      if (d.isStudyDay && Array.isArray(d.blocks)) {
        d.blocks.forEach(b => {
          if (b.type !== 'Short Break') {
            totalTasks++;
            if (b.completed) completedTasks++;
          }
        });
      }
    });

    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const pctEl = document.getElementById('plan-metric-completion-pct');
    const countEl = document.getElementById('plan-metric-tasks-count');
    const overallFill = document.getElementById('plan-overall-progress-fill');
    const overallText = document.getElementById('plan-overall-progress-text');

    if (pctEl) pctEl.textContent = `${pct}%`;
    if (countEl) countEl.textContent = `${completedTasks} of ${totalTasks} Completed`;
    if (overallFill) overallFill.style.width = `${pct}%`;
    if (overallText) overallText.textContent = `${completedTasks} of ${totalTasks} Tasks Completed (${pct}%)`;
  };

  /**
   * Renders the complete study plan into DOM
   */
  const renderPlan = (plan) => {
    const container = document.getElementById('plan-output-container');
    if (!container) return;

    container.style.display = 'block';

    const summary = plan.weeklySummary || {};
    const days = plan.days || [];

    // 1. Meta & Metrics
    const metaHours = document.getElementById('plan-display-meta');
    if (metaHours) {
      metaHours.textContent = `${summary.totalWeeklyHours || 0} Total Weekly Hours | ${summary.activeStudyDays || 0} Study Days | ${summary.restDays || 0} Rest Days`;
    }

    const totalHoursEl = document.getElementById('plan-metric-total-hours');
    if (totalHoursEl) {
      totalHoursEl.textContent = `${summary.totalWeeklyHours || 0} hrs`;
    }

    const splitEl = document.getElementById('plan-metric-days-split');
    if (splitEl) {
      splitEl.textContent = `${summary.activeStudyDays || 0} / ${summary.restDays || 0}`;
    }

    // 2. Subject Breakdown Chips
    const subjChipsContainer = document.getElementById('plan-subject-breakdown-chips');
    if (subjChipsContainer) {
      const breakdown = summary.subjectBreakdown || [];
      if (breakdown.length > 0) {
        subjChipsContainer.innerHTML = breakdown.map(sb => `
          <span class="plan-subject-chip" style="font-size: 0.8rem; padding: 0.25rem 0.65rem;">
            ${sb.isPriority ? '<i class="fa-solid fa-fire" style="color: var(--danger);"></i>' : '<i class="fa-solid fa-book" style="color: var(--primary);"></i>'}
            <strong>${Utils.escapeHtml(sb.subject)}:</strong>
            <span>${sb.allocatedHours || 0} hrs</span>
          </span>
        `).join('');
      } else {
        subjChipsContainer.innerHTML = subjectsList.map(s => `
          <span class="plan-subject-chip" style="font-size: 0.8rem; padding: 0.25rem 0.65rem;">
            <i class="fa-solid fa-book" style="color: var(--primary);"></i>
            <span>${Utils.escapeHtml(s)}</span>
          </span>
        `).join('');
      }
    }

    // 3. Assumptions List
    const assumptionsList = document.getElementById('plan-assumptions-list');
    if (assumptionsList) {
      const assumptions = summary.assumptions || [
        `Availability ceiling of ${summary.dailyHoursBudget || 3.5} hrs/day strictly honored.`,
        'Non-preferred days are scheduled as Rest & Recovery Days with 0 study tasks.',
        'Short cognitive breaks are placed between intensive study blocks to maintain focus.',
        'No exam dates were provided; schedule structured for continuous retention without invented dates.'
      ];
      assumptionsList.innerHTML = assumptions.map(a => `
        <li>
          <i class="fa-solid fa-circle-check"></i>
          <span>${Utils.escapeHtml(a)}</span>
        </li>
      `).join('');
    }

    // 4. Render 7 Daily Task Cards
    const daysContainer = document.getElementById('plan-days-container');
    if (daysContainer) {
      daysContainer.innerHTML = days.map(d => {
        if (!d.isStudyDay) {
          // Rest Day Card
          return `
            <div class="plan-day-card rest-day">
              <div class="plan-day-header">
                <span class="plan-day-title">
                  <i class="fa-solid fa-bed" style="color: var(--text-muted);"></i>
                  <span>${Utils.escapeHtml(d.dayName)}</span>
                </span>
                <span class="badge" style="background: rgba(255, 255, 255, 0.08); color: var(--text-muted);">
                  Scheduled Rest Day
                </span>
              </div>
              <div class="plan-day-theme">${Utils.escapeHtml(d.focusTheme || 'Recovery & Cognitive Stamina')}</div>
              <div class="plan-rest-placeholder">
                <i class="fa-solid fa-mug-hot"></i>
                <h5 style="color: var(--text-main); margin-bottom: 0.35rem; font-size: 0.95rem;">Rest & Recovery Day</h5>
                <p style="font-size: 0.8rem; margin: 0; line-height: 1.4;">
                  No study sessions scheduled. Relax, get quality sleep, and recharge your cognitive focus for active study days.
                </p>
              </div>
              <div class="plan-daily-checkpoint">
                <i class="fa-solid fa-sparkles"></i>
                <span>${Utils.escapeHtml(d.dailyCheckpoint || 'Rest and recharge to maintain consistent long-term habits.')}</span>
              </div>
            </div>
          `;
        }

        // Active Study Day Card
        const nonBreakBlocks = (d.blocks || []).filter(b => b.type !== 'Short Break');
        const completedCount = nonBreakBlocks.filter(b => b.completed).length;
        const initialPct = nonBreakBlocks.length > 0 ? Math.round((completedCount / nonBreakBlocks.length) * 100) : 0;

        return `
          <div class="plan-day-card active-day">
            <div class="plan-day-header">
              <span class="plan-day-title">
                <i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i>
                <span>${Utils.escapeHtml(d.dayName)}</span>
              </span>
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <span class="badge badge-primary">
                  ${d.totalStudyHours || 0} hrs
                </span>
                <span id="plan-day-pct-${d.dayName}" style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">
                  ${initialPct}%
                </span>
              </div>
            </div>

            <div class="plan-day-theme">
              <i class="fa-solid fa-bullseye" style="color: var(--accent-cyan); font-size: 0.75rem; margin-right: 0.25rem;"></i>
              <span>${Utils.escapeHtml(d.focusTheme || 'Course Focus')}</span>
            </div>

            <div class="plan-day-progress-bar">
              <div id="plan-day-fill-${d.dayName}" class="plan-day-progress-fill" style="width: ${initialPct}%;"></div>
            </div>

            <div class="plan-block-list">
              ${(d.blocks || []).map(b => {
                const isBreak = b.type === 'Short Break';
                const isCompleted = Boolean(b.completed);
                return `
                  <div class="plan-block-item ${isBreak ? 'plan-block-break' : ''} ${isCompleted ? 'completed' : ''}" data-task-id="${Utils.escapeHtml(b.id)}">
                    ${isBreak ? `
                      <span style="color: var(--accent-cyan); font-size: 1.1rem; margin-top: 0.15rem;">
                        <i class="fa-solid fa-pause"></i>
                      </span>
                    ` : `
                      <input 
                        type="checkbox" 
                        id="check-${Utils.escapeHtml(b.id)}" 
                        class="plan-block-checkbox" 
                        data-task-id="${Utils.escapeHtml(b.id)}"
                        ${isCompleted ? 'checked' : ''} 
                      />
                    `}
                    <div class="plan-block-content">
                      <div class="plan-block-meta">
                        ${!isBreak ? `
                          <span class="plan-tag plan-tag-subject">${Utils.escapeHtml(b.subject)}</span>
                        ` : ''}
                        <span class="plan-tag plan-tag-type">${Utils.escapeHtml(b.type)}</span>
                        <span class="plan-tag plan-tag-duration"><i class="fa-regular fa-clock"></i> ${b.durationMinutes}m</span>
                      </div>
                      <div class="plan-block-title">${Utils.escapeHtml(b.title)}</div>
                      <p class="plan-block-details">${Utils.escapeHtml(b.details)}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="plan-daily-checkpoint">
              <i class="fa-solid fa-flag"></i>
              <span><strong>Checkpoint:</strong> ${Utils.escapeHtml(d.dailyCheckpoint || 'Self-quiz on key concepts.')}</span>
            </div>
          </div>
        `;
      }).join('');

      // Attach task checkbox listeners
      daysContainer.querySelectorAll('.plan-block-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const taskId = e.target.getAttribute('data-task-id');
          const isChecked = e.target.checked;
          handleTaskToggle(taskId, isChecked);
        });
      });
    }

    // 5. Weekly Review Tasks
    const reviewList = document.getElementById('plan-review-tasks-list');
    const reviewDayBadge = document.getElementById('plan-review-day-badge');
    const reviewTitle = document.getElementById('plan-review-title');
    if (reviewList && plan.weeklyReview) {
      if (reviewDayBadge) reviewDayBadge.textContent = plan.weeklyReview.day || 'Weekly Retrospective';
      if (reviewTitle && plan.weeklyReview.title) reviewTitle.textContent = plan.weeklyReview.title;

      const tasks = plan.weeklyReview.tasks || [];
      reviewList.innerHTML = tasks.map((t, idx) => {
        const text = typeof t === 'string' ? t : (t.title || t.text || 'Review');
        const isDone = typeof t === 'object' ? Boolean(t.completed) : false;
        const revId = `rev-${idx}`;
        return `
          <div class="plan-block-item ${isDone ? 'completed' : ''}" data-task-id="${revId}">
            <input 
              type="checkbox" 
              id="check-${revId}" 
              class="plan-block-checkbox" 
              data-task-id="${revId}"
              ${isDone ? 'checked' : ''} 
            />
            <div class="plan-block-content">
              <div class="plan-block-title" style="font-size: 0.85rem;">${Utils.escapeHtml(text)}</div>
            </div>
          </div>
        `;
      }).join('');

      reviewList.querySelectorAll('.plan-block-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const taskId = e.target.getAttribute('data-task-id');
          handleTaskToggle(taskId, e.target.checked);
        });
      });
    }

    // 6. Progress Checkpoints
    const checkpointsList = document.getElementById('plan-checkpoints-list');
    if (checkpointsList && Array.isArray(plan.progressCheckpoints)) {
      checkpointsList.innerHTML = plan.progressCheckpoints.map(cp => `
        <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--primary);">
              <i class="fa-solid fa-circle-dot" style="font-size: 0.7rem; margin-right: 0.3rem;"></i>
              ${Utils.escapeHtml(cp.timing || 'Checkpoint')}
            </span>
            ${cp.focus ? `<span class="badge badge-primary" style="font-size: 0.7rem;">${Utils.escapeHtml(cp.focus)}</span>` : ''}
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
            ${Utils.escapeHtml(cp.description || '')}
          </p>
        </div>
      `).join('');
    }

    // Update overall progress meters
    updateOverallProgressStats();
  };

  /**
   * PDF Export
   */
  const exportPdf = () => {
    if (!activePlan) {
      Utils.showToast('Please generate a study plan first.', 'warning');
      return;
    }

    const summary = activePlan.weeklySummary || {};
    const lines = [
      { text: 'GRADEPIOT AI - PERSONALIZED WEEKLY STUDY TIMETABLE', isHeading: true },
      { text: `Total Weekly Commitment: ${summary.totalWeeklyHours || 0} Hours | Daily Allocation: ${summary.dailyHoursBudget || 3.5} Hours/Day`, isHeading: false },
      { text: `Schedule: ${summary.activeStudyDays || 5} Study Days / ${summary.restDays || 2} Rest Days`, isHeading: false },
      { text: '------------------------------------------------------------------------------------------------', isHeading: false }
    ];

    if (Array.isArray(summary.assumptions) && summary.assumptions.length > 0) {
      lines.push({ text: '\nSCHEDULING ASSUMPTIONS & CONSTRAINTS:', isHeading: true });
      summary.assumptions.forEach(a => {
        lines.push({ text: `* ${a}`, isHeading: false });
      });
    }

    if (Array.isArray(activePlan.days)) {
      activePlan.days.forEach(d => {
        if (!d.isStudyDay) {
          lines.push({ text: `\n${d.dayName.toUpperCase()}: REST & RECOVERY DAY`, isHeading: true });
          lines.push({ text: '  [Scheduled Rest & Recharge - No study sessions]', isHeading: false });
        } else {
          lines.push({ text: `\n${d.dayName.toUpperCase()} (${d.totalStudyHours} Hours) - Focus: ${d.focusTheme || ''}`, isHeading: true });
          (d.blocks || []).forEach(b => {
            const status = b.completed ? '[x]' : '[ ]';
            lines.push({ text: `  ${status} [${b.durationMinutes}m] [${b.type}] ${b.subject}: ${b.title} - ${b.details}`, isHeading: false });
          });
          if (d.dailyCheckpoint) {
            lines.push({ text: `  -> Checkpoint: ${d.dailyCheckpoint}`, isHeading: false });
          }
        }
      });
    }

    if (activePlan.weeklyReview && Array.isArray(activePlan.weeklyReview.tasks)) {
      lines.push({ text: '\nWEEKLY REVIEW & RETROSPECTIVE:', isHeading: true });
      activePlan.weeklyReview.tasks.forEach(t => {
        const text = typeof t === 'string' ? t : (t.title || 'Review');
        lines.push({ text: `  [ ] ${text}`, isHeading: false });
      });
    }

    lines.push({ text: '\nDISCLAIMER:', isHeading: true });
    lines.push({ text: 'This study plan is an academic planning guide based on student-stated availability and does not claim or guarantee improved grades or examination scores.', isHeading: false });

    Utils.exportToPdf('GradePilot AI Study Plan', 'Weekly Timetable Roadmap', lines, 'gradepilot-weekly-study-plan.pdf');
  };

  /**
   * Bind DOM Events
   */
  const bindEvents = () => {
    // Add subject button
    const addBtn = document.getElementById('plan-add-subject-btn');
    const input = document.getElementById('plan-subject-input');
    if (addBtn && input) {
      addBtn.addEventListener('click', () => addSubject(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addSubject(input.value);
        }
      });
    }

    // Daily hours slider
    const slider = document.getElementById('plan-daily-hours-slider');
    if (slider) {
      slider.addEventListener('input', updateHoursDisplay);
    }

    // Daily hours presets
    document.querySelectorAll('.plan-hours-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hrs = e.currentTarget.getAttribute('data-hours');
        if (slider) {
          slider.value = hrs;
          updateHoursDisplay();
        }
      });
    });

    // Academic goals presets
    document.querySelectorAll('.plan-goal-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const goal = e.currentTarget.getAttribute('data-goal');
        const goalsInput = document.getElementById('plan-academic-goals');
        if (goalsInput) {
          goalsInput.value = goal;
          goalsInput.focus();
        }
      });
    });

    // Preferred days buttons
    document.querySelectorAll('.plan-day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = e.currentTarget.getAttribute('data-day');
        togglePreferredDay(day);
      });
    });

    // Preferred days presets
    document.querySelectorAll('.plan-days-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.currentTarget.getAttribute('data-preset');
        setDaysPreset(preset);
      });
    });

    // Form submit
    const form = document.getElementById('plan-form');
    if (form) form.addEventListener('submit', handleGenerate);

    // Regenerate button
    const regenBtn = document.getElementById('plan-regenerate-btn');
    if (regenBtn) regenBtn.addEventListener('click', handleRegenerate);

    // Retry button
    const retryBtn = document.getElementById('plan-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', handleRetry);

    // Import courses button
    const importBtn = document.getElementById('plan-import-courses-btn');
    if (importBtn) importBtn.addEventListener('click', handleImportCourses);

    // Reset form button
    const resetBtn = document.getElementById('plan-reset-form-btn');
    if (resetBtn) resetBtn.addEventListener('click', handleResetForm);

    // Clear plan button
    const clearBtn = document.getElementById('plan-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearPlan);

    // Export PDF
    const exportBtn = document.getElementById('plan-export-pdf-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportPdf);
  };

  return {
    init,
    handleGenerate,
    handleRegenerate,
    handleRetry,
    exportPdf,
    addSubject,
    removeSubject,
    toggleFocusSubject,
    togglePreferredDay,
    collectPayload
  };
})();

// Attach globally
window.StudyPlanner = StudyPlanner;
