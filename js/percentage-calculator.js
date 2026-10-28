/**
 * GradePilot AI - Percentage Calculator Suite (Phase 5)
 * Comprehensive 3-Tab Academic Percentage Suite:
 *
 * TAB 1: MARKS TO PERCENTAGE
 *   Formula: percentage = (obtainedMarks / totalMarks) * 100
 *
 * TAB 2: PERCENTAGE TO REQUIRED MARKS
 *   Formula: requiredMarks = (targetPercentage / 100) * totalMarks
 *   Rounds upward to minimum sufficient integer (Math.ceil) when whole marks are needed.
 *
 * TAB 3: ADDITIONAL MARKS REQUIRED
 *   Formula:
 *     requiredTotalMarks = totalPossibleMarks * desiredPercentage / 100
 *     additionalMarks = requiredTotalMarks - currentMarks
 *   If target is already achieved, displays success message and zero additional marks required.
 *
 * PERCENTAGE GRADING REFERENCE (Separate from Grade Calculator GPA mapping):
 *   90–100%: A+
 *   80–89%: A
 *   70–79%: B+
 *   60–69%: B
 *   50–59%: C+
 *   40–49%: C
 *   0–39%: F
 */

const PercentageCalculator = (() => {
  const Storage = window.AppStorage || AppStorage;

  // Percentage Grading Reference (independent of university GPA scale)
  const PERCENTAGE_GRADE_SCALE = [
    { min: 90, grade: 'A+', label: '90 – 100%', description: 'Outstanding Performance', color: 'green' },
    { min: 80, grade: 'A',  label: '80 – 89%',  description: 'Excellent Standing',      color: 'blue' },
    { min: 70, grade: 'B+', label: '70 – 79%',  description: 'Very Good Progress',      color: 'indigo' },
    { min: 60, grade: 'B',  label: '60 – 69%',  description: 'Good Standing',           color: 'purple' },
    { min: 50, grade: 'C+', label: '50 – 59%',  description: 'Above Average',           color: 'yellow' },
    { min: 40, grade: 'C',  label: '40 – 49%',  description: 'Average / Pass Standing', color: 'orange' },
    { min: 0,  grade: 'F',  label: '0 – 39%',   description: 'Needs Academic Review',   color: 'red' }
  ];

  /**
   * Determine letter grade based on percentage
   */
  const getPercentageGrade = (percentage) => {
    const pct = parseFloat(percentage);
    for (const item of PERCENTAGE_GRADE_SCALE) {
      if (pct >= item.min) {
        return item;
      }
    }
    return PERCENTAGE_GRADE_SCALE[PERCENTAGE_GRADE_SCALE.length - 1];
  };

  /**
   * Initialize Percentage Calculator Suite
   */
  const init = () => {
    bindTabs();
    bindEvents();

    // Run initial preview calculations on startup with default inputs
    calculatePercentage(false);
    calculateRequiredMarks(false);
    calculateAdditionalMarks(false);
  };

  /**
   * Tab Navigation Switcher
   */
  const bindTabs = () => {
    const tabButtons = document.querySelectorAll('.pct-subtab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        switchPercentageTab(targetId);
      });
    });
  };

  const switchPercentageTab = (targetId) => {
    document.querySelectorAll('.pct-subtab-btn').forEach(b => {
      if (b.getAttribute('data-target') === targetId) {
        b.classList.add('active');
        b.setAttribute('aria-selected', 'true');
      } else {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      }
    });

    document.querySelectorAll('.pct-subtab-pane').forEach(pane => {
      if (pane.id === targetId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  };

  /**
   * Validation Helper: Show / Clear Error Banners
   */
  const showTabError = (errorBoxId, inputElement, message) => {
    const errorBox = document.getElementById(errorBoxId);
    if (errorBox) {
      errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right: 0.4rem; color: var(--danger);"></i> <strong>Validation Error:</strong> ${Utils.escapeHtml(message)}`;
      errorBox.style.display = 'block';
    }
    if (inputElement) {
      inputElement.classList.add('input-error');
      inputElement.focus();
    }
    Utils.showToast(message, 'error');
  };

  const clearTabError = (errorBoxId, inputElements = []) => {
    const errorBox = document.getElementById(errorBoxId);
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
    inputElements.forEach(el => {
      if (el) el.classList.remove('input-error');
    });
  };

  // =========================================================================
  // TAB 1: MARKS TO PERCENTAGE
  // Formula: percentage = (obtainedMarks / totalMarks) * 100
  // =========================================================================

  const calculatePercentage = (logHistory = true) => {
    const obtainedEl = document.getElementById('marks-obtained');
    const totalEl = document.getElementById('total-marks');
    const resultBox = document.getElementById('percentage-result');
    const displayVal = document.getElementById('calculated-percentage');
    const displayGrade = document.getElementById('percentage-grade');
    const displayDetails = document.getElementById('percentage-details');
    const formulaStep = document.getElementById('percentage-formula-step');

    if (!obtainedEl || !totalEl || !resultBox) return null;

    clearTabError('pct-tab1-error', [obtainedEl, totalEl]);

    const obtainedRaw = obtainedEl.value.trim();
    const totalRaw = totalEl.value.trim();

    // Check empty fields
    if (obtainedRaw === '' || totalRaw === '') {
      showTabError('pct-tab1-error', obtainedRaw === '' ? obtainedEl : totalEl, 'Please enter both obtained marks and total marks.');
      resultBox.style.display = 'none';
      return null;
    }

    const obtained = parseFloat(obtainedRaw);
    const total = parseFloat(totalRaw);

    if (isNaN(obtained)) {
      showTabError('pct-tab1-error', obtainedEl, 'Obtained marks must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    if (isNaN(total)) {
      showTabError('pct-tab1-error', totalEl, 'Total marks must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Total marks must be greater than zero
    if (total <= 0) {
      showTabError('pct-tab1-error', totalEl, 'Total marks must be greater than zero.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Obtained marks cannot be negative
    if (obtained < 0) {
      showTabError('pct-tab1-error', obtainedEl, 'Obtained marks cannot be negative.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Obtained marks cannot exceed total marks
    if (obtained > total) {
      showTabError('pct-tab1-error', obtainedEl, 'Obtained marks cannot exceed total marks.');
      resultBox.style.display = 'none';
      return null;
    }

    // Core Formula
    const percentage = (obtained / total) * 100;
    const gradeInfo = getPercentageGrade(percentage);

    // Format percentage nicely: e.g. "84%" or "84.00%"
    const formattedPct = (percentage % 1 === 0) ? `${percentage}%` : `${percentage.toFixed(2)}%`;

    if (displayVal) {
      displayVal.textContent = formattedPct;
    }

    if (displayGrade) {
      displayGrade.innerHTML = `Grade: <span class="badge badge-grade badge-grade-${gradeInfo.color}">${gradeInfo.grade}</span> <span style="font-size: 0.85rem; font-weight: 500; opacity: 0.85; margin-left: 0.35rem;">(${gradeInfo.description})</span>`;
    }

    if (displayDetails) {
      displayDetails.textContent = `${obtained} out of ${total} marks (${(total - obtained).toFixed(1)} marks away from maximum score)`;
    }

    if (formulaStep) {
      formulaStep.innerHTML = `
        <strong><i class="fa-solid fa-circle-info"></i> Step-by-Step Calculation:</strong><br />
        <span>percentage = (${obtained} ÷ ${total}) × 100 = ${(obtained / total).toFixed(4)} × 100 = <strong>${percentage.toFixed(2)}%</strong></span>
      `;
    }

    resultBox.style.display = 'block';

    if (logHistory && Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: `${obtained} / ${total} Marks`,
        type: 'Percentage Calculator',
        result: `${formattedPct} • Grade ${gradeInfo.grade}`
      });
    }

    return { percentage, grade: gradeInfo.grade, obtained, total };
  };

  const resetTab1 = () => {
    const obtainedEl = document.getElementById('marks-obtained');
    const totalEl = document.getElementById('total-marks');
    if (obtainedEl) obtainedEl.value = '';
    if (totalEl) totalEl.value = '100';
    clearTabError('pct-tab1-error', [obtainedEl, totalEl]);
    const resultBox = document.getElementById('percentage-result');
    if (resultBox) resultBox.style.display = 'none';
  };

  const prefillTab1 = (obtained, total) => {
    const obtainedEl = document.getElementById('marks-obtained');
    const totalEl = document.getElementById('total-marks');
    if (obtainedEl) obtainedEl.value = obtained;
    if (totalEl) totalEl.value = total;
    calculatePercentage(true);
    Utils.showToast(`Test case loaded: ${obtained} / ${total} marks!`, 'success');
  };

  // =========================================================================
  // TAB 2: PERCENTAGE TO REQUIRED MARKS
  // Formula: requiredMarks = (targetPercentage / 100) * totalMarks
  // Round upward to minimum sufficient integer (Math.ceil) when whole marks required.
  // =========================================================================

  const calculateRequiredMarks = (logHistory = true) => {
    const targetPctEl = document.getElementById('target-percentage');
    const maxMarksEl = document.getElementById('max-marks');
    const resultBox = document.getElementById('required-marks-result');
    const displayVal = document.getElementById('calculated-required-marks');
    const displayDetails = document.getElementById('required-marks-details');
    const wholeNote = document.getElementById('required-marks-whole-note');
    const formulaStep = document.getElementById('required-marks-formula-step');

    if (!targetPctEl || !maxMarksEl || !resultBox) return null;

    clearTabError('pct-tab2-error', [targetPctEl, maxMarksEl]);

    const targetPctRaw = targetPctEl.value.trim();
    const maxMarksRaw = maxMarksEl.value.trim();

    // Check empty fields
    if (targetPctRaw === '' || maxMarksRaw === '') {
      showTabError('pct-tab2-error', targetPctRaw === '' ? targetPctEl : maxMarksEl, 'Please enter both target percentage and total marks.');
      resultBox.style.display = 'none';
      return null;
    }

    const percentage = parseFloat(targetPctRaw);
    const total = parseFloat(maxMarksRaw);

    if (isNaN(percentage)) {
      showTabError('pct-tab2-error', targetPctEl, 'Target percentage must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    if (isNaN(total)) {
      showTabError('pct-tab2-error', maxMarksEl, 'Total marks must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Total marks must be greater than zero
    if (total <= 0) {
      showTabError('pct-tab2-error', maxMarksEl, 'Total marks must be greater than zero.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Target percentage must be between 0 and 100
    if (percentage < 0 || percentage > 100) {
      showTabError('pct-tab2-error', targetPctEl, 'Target percentage must be between 0 and 100.');
      resultBox.style.display = 'none';
      return null;
    }

    // Core Formula
    const requiredMarks = (percentage / 100) * total;
    const isWhole = (requiredMarks % 1 === 0);
    const ceilMarks = Math.ceil(requiredMarks);

    if (displayVal) {
      displayVal.textContent = isWhole ? `${requiredMarks} marks` : `${requiredMarks.toFixed(2)} marks`;
    }

    if (wholeNote) {
      if (!isWhole) {
        wholeNote.className = 'pct-whole-marks-note';
        wholeNote.innerHTML = `<i class="fa-solid fa-arrow-up-right-dots"></i> Minimum sufficient whole integer: <strong>${ceilMarks} marks</strong> (achieves ${((ceilMarks / total) * 100).toFixed(2)}%)`;
        wholeNote.style.display = 'inline-flex';
      } else {
        wholeNote.style.display = 'none';
      }
    }

    if (displayDetails) {
      displayDetails.textContent = `Required to achieve ${percentage}% out of ${total} total marks`;
    }

    if (formulaStep) {
      formulaStep.innerHTML = `
        <strong><i class="fa-solid fa-circle-info"></i> Step-by-Step Calculation:</strong><br />
        <span>requiredMarks = (${percentage} ÷ 100) × ${total} = ${(percentage / 100).toFixed(4)} × ${total} = <strong>${isWhole ? requiredMarks : requiredMarks.toFixed(2)} marks</strong></span>
        ${!isWhole ? `<br /><span style="color: var(--warning);"><i class="fa-solid fa-circle-check"></i> Rounded upward to minimum sufficient integer: <strong>${ceilMarks} marks</strong>.</span>` : ''}
      `;
    }

    resultBox.style.display = 'block';

    if (logHistory && Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: `${percentage}% of ${total} Marks`,
        type: 'Percentage Calculator',
        result: `Required: ${isWhole ? requiredMarks : requiredMarks.toFixed(2)} marks`
      });
    }

    return { requiredMarks, ceilMarks, percentage, total };
  };

  const resetTab2 = () => {
    const targetPctEl = document.getElementById('target-percentage');
    const maxMarksEl = document.getElementById('max-marks');
    if (targetPctEl) targetPctEl.value = '';
    if (maxMarksEl) maxMarksEl.value = '100';
    clearTabError('pct-tab2-error', [targetPctEl, maxMarksEl]);
    const resultBox = document.getElementById('required-marks-result');
    if (resultBox) resultBox.style.display = 'none';
  };

  const prefillTab2 = (percentage, total) => {
    const targetPctEl = document.getElementById('target-percentage');
    const maxMarksEl = document.getElementById('max-marks');
    if (targetPctEl) targetPctEl.value = percentage;
    if (maxMarksEl) maxMarksEl.value = total;
    calculateRequiredMarks(true);
    Utils.showToast(`Test case loaded: ${percentage}% of ${total} marks!`, 'success');
  };

  // =========================================================================
  // TAB 3: ADDITIONAL MARKS REQUIRED
  // Formula:
  //   requiredTotalMarks = totalPossibleMarks * desiredPercentage / 100
  //   additionalMarks = requiredTotalMarks - currentMarks
  // If target achieved: show success message and 0 additional marks required.
  // =========================================================================

  const calculateAdditionalMarks = (logHistory = true) => {
    const currentEl = document.getElementById('current-marks');
    const totalEl = document.getElementById('total-possible');
    const desiredEl = document.getElementById('desired-percentage');
    const resultBox = document.getElementById('additional-marks-result');
    const displayVal = document.getElementById('calculated-additional-marks');
    const displayDetails = document.getElementById('additional-marks-details');
    const wholeNote = document.getElementById('additional-marks-whole-note');
    const successBanner = document.getElementById('pct-tab3-success');
    const successText = document.getElementById('pct-tab3-success-text');
    const formulaStep = document.getElementById('additional-marks-formula-step');

    if (!currentEl || !totalEl || !desiredEl || !resultBox) return null;

    clearTabError('pct-tab3-error', [currentEl, totalEl, desiredEl]);

    const currentRaw = currentEl.value.trim();
    const totalRaw = totalEl.value.trim();
    const desiredRaw = desiredEl.value.trim();

    // Check empty fields
    if (currentRaw === '' || totalRaw === '' || desiredRaw === '') {
      const errTarget = currentRaw === '' ? currentEl : (totalRaw === '' ? totalEl : desiredEl);
      showTabError('pct-tab3-error', errTarget, 'Please enter current marks, total possible marks, and desired target percentage.');
      resultBox.style.display = 'none';
      return null;
    }

    const current = parseFloat(currentRaw);
    const total = parseFloat(totalRaw);
    const desired = parseFloat(desiredRaw);

    if (isNaN(current)) {
      showTabError('pct-tab3-error', currentEl, 'Current marks must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    if (isNaN(total)) {
      showTabError('pct-tab3-error', totalEl, 'Total possible marks must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    if (isNaN(desired)) {
      showTabError('pct-tab3-error', desiredEl, 'Desired percentage must be a valid number.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Total possible marks must be greater than zero
    if (total <= 0) {
      showTabError('pct-tab3-error', totalEl, 'Total possible marks must be greater than zero.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Current marks cannot be negative
    if (current < 0) {
      showTabError('pct-tab3-error', currentEl, 'Current marks cannot be negative.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Current marks cannot exceed total possible marks
    if (current > total) {
      showTabError('pct-tab3-error', currentEl, 'Current marks cannot exceed total possible marks.');
      resultBox.style.display = 'none';
      return null;
    }

    // Validation: Desired percentage must be between 0 and 100
    if (desired < 0 || desired > 100) {
      showTabError('pct-tab3-error', desiredEl, 'Desired percentage must be between 0 and 100.');
      resultBox.style.display = 'none';
      return null;
    }

    // Core Formula
    const requiredTotalMarks = total * (desired / 100);
    const rawAdditionalMarks = requiredTotalMarks - current;
    const currentPct = (current / total) * 100;

    // Check if Target is already achieved
    if (rawAdditionalMarks <= 0) {
      // Show zero additional marks required and a prominent success message
      if (displayVal) {
        displayVal.textContent = '0 additional marks required';
        displayVal.style.color = 'var(--success)';
      }

      if (wholeNote) {
        wholeNote.style.display = 'none';
      }

      if (displayDetails) {
        displayDetails.textContent = `Current standing: ${current} / ${total} marks (${currentPct.toFixed(2)}%) exceeds desired ${desired}% target (${requiredTotalMarks.toFixed(1)} marks).`;
      }

      if (successBanner) {
        successBanner.style.display = 'block';
        if (successText) {
          successText.innerHTML = `<strong>Congratulations!</strong> Your current score of <strong>${current} / ${total}</strong> (${currentPct.toFixed(2)}%) already meets or exceeds your desired target of <strong>${desired}%</strong> (which required ${requiredTotalMarks.toFixed(1)} marks). No additional marks needed!`;
        }
      }

      if (formulaStep) {
        formulaStep.innerHTML = `
          <strong><i class="fa-solid fa-circle-info"></i> Step-by-Step Calculation:</strong><br />
          <span>requiredTotalMarks = ${total} × (${desired} ÷ 100) = <strong>${requiredTotalMarks.toFixed(2)} marks</strong></span><br />
          <span>additionalMarks = ${requiredTotalMarks.toFixed(2)} - ${current} = <strong>${rawAdditionalMarks.toFixed(2)}</strong> (≤ 0 → <strong>Target already achieved!</strong>)</span>
        `;
      }

      resultBox.style.display = 'block';

      if (logHistory && Storage.addHistoryItem) {
        Storage.addHistoryItem({
          title: `${current} / ${total} (Target: ${desired}%)`,
          type: 'Percentage Calculator',
          result: `Target Achieved! (0 marks needed)`
        });
      }

      return {
        targetAchieved: true,
        additionalMarks: 0,
        requiredTotalMarks,
        current,
        total,
        desired
      };
    }

    // Target not yet achieved: additional marks needed
    const isWhole = (rawAdditionalMarks % 1 === 0);
    const ceilAdditional = Math.ceil(rawAdditionalMarks);

    if (displayVal) {
      displayVal.textContent = isWhole ? `${rawAdditionalMarks} additional marks` : `${rawAdditionalMarks.toFixed(2)} additional marks`;
      displayVal.style.color = 'var(--accent-cyan)';
    }

    if (wholeNote) {
      if (!isWhole) {
        wholeNote.className = 'pct-whole-marks-note';
        wholeNote.innerHTML = `<i class="fa-solid fa-arrow-up-right-dots"></i> Minimum whole integer: <strong>${ceilAdditional} marks</strong> (achieves ${(((current + ceilAdditional) / total) * 100).toFixed(2)}%)`;
        wholeNote.style.display = 'inline-flex';
      } else {
        wholeNote.style.display = 'none';
      }
    }

    if (displayDetails) {
      displayDetails.textContent = `needed to achieve ${desired}% out of ${total} marks (Target score: ${requiredTotalMarks.toFixed(2)} marks)`;
    }

    if (successBanner) {
      successBanner.style.display = 'none';
    }

    if (formulaStep) {
      formulaStep.innerHTML = `
        <strong><i class="fa-solid fa-circle-info"></i> Step-by-Step Calculation:</strong><br />
        <span>requiredTotalMarks = ${total} × (${desired} ÷ 100) = <strong>${requiredTotalMarks.toFixed(2)} marks</strong></span><br />
        <span>additionalMarks = ${requiredTotalMarks.toFixed(2)} - ${current} = <strong>${isWhole ? rawAdditionalMarks : rawAdditionalMarks.toFixed(2)} additional marks</strong></span>
        ${!isWhole ? `<br /><span style="color: var(--warning);"><i class="fa-solid fa-circle-check"></i> Minimum sufficient integer: <strong>${ceilAdditional} marks</strong>.</span>` : ''}
      `;
    }

    resultBox.style.display = 'block';

    if (logHistory && Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: `${current} / ${total} (Target: ${desired}%)`,
        type: 'Percentage Calculator',
        result: `Need: ${isWhole ? rawAdditionalMarks : rawAdditionalMarks.toFixed(2)} more marks`
      });
    }

    return {
      targetAchieved: false,
      additionalMarks: rawAdditionalMarks,
      ceilAdditional,
      requiredTotalMarks,
      current,
      total,
      desired
    };
  };

  const resetTab3 = () => {
    const currentEl = document.getElementById('current-marks');
    const totalEl = document.getElementById('total-possible');
    const desiredEl = document.getElementById('desired-percentage');
    if (currentEl) currentEl.value = '';
    if (totalEl) totalEl.value = '100';
    if (desiredEl) desiredEl.value = '75';
    clearTabError('pct-tab3-error', [currentEl, totalEl, desiredEl]);
    const resultBox = document.getElementById('additional-marks-result');
    if (resultBox) resultBox.style.display = 'none';
  };

  const prefillTab3 = (current, total, desired) => {
    const currentEl = document.getElementById('current-marks');
    const totalEl = document.getElementById('total-possible');
    const desiredEl = document.getElementById('desired-percentage');
    if (currentEl) currentEl.value = current;
    if (totalEl) totalEl.value = total;
    if (desiredEl) desiredEl.value = desired;
    calculateAdditionalMarks(true);
    Utils.showToast(`Test case loaded: ${current}/${total} with ${desired}% target!`, 'info');
  };

  // =========================================================================
  // BIND DOM EVENT LISTENERS
  // =========================================================================

  const bindEvents = () => {
    // Tab 1: Marks to Percentage
    const btnMarks = document.getElementById('btn-calc-marks-to-pct');
    if (btnMarks) {
      btnMarks.addEventListener('click', () => {
        const res = calculatePercentage(true);
        if (res) Utils.showToast(`Calculated: ${res.percentage.toFixed(2)}% (Grade ${res.grade})`, 'success');
      });
    }

    ['marks-obtained', 'total-marks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearTabError('pct-tab1-error', [el]);
        });
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            calculatePercentage(true);
          }
        });
      }
    });

    // Tab 2: Percentage to Marks
    const btnReq = document.getElementById('btn-calc-pct-to-marks');
    if (btnReq) {
      btnReq.addEventListener('click', () => {
        const res = calculateRequiredMarks(true);
        if (res) Utils.showToast(`Required: ${res.requiredMarks % 1 === 0 ? res.requiredMarks : res.requiredMarks.toFixed(2)} marks`, 'success');
      });
    }

    ['target-percentage', 'max-marks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearTabError('pct-tab2-error', [el]);
        });
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            calculateRequiredMarks(true);
          }
        });
      }
    });

    // Tab 3: Additional Marks Required
    const btnAddl = document.getElementById('btn-calc-additional-marks');
    if (btnAddl) {
      btnAddl.addEventListener('click', () => {
        const res = calculateAdditionalMarks(true);
        if (res) {
          if (res.targetAchieved) {
            Utils.showToast('Target already achieved! No additional marks required.', 'success');
          } else {
            Utils.showToast(`Needed: ${res.additionalMarks % 1 === 0 ? res.additionalMarks : res.additionalMarks.toFixed(2)} additional marks`, 'info');
          }
        }
      });
    }

    ['current-marks', 'total-possible', 'desired-percentage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearTabError('pct-tab3-error', [el]);
        });
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            calculateAdditionalMarks(true);
          }
        });
      }
    });
  };

  return {
    init,
    switchPercentageTab,
    getPercentageGrade,
    calculatePercentage,
    resetTab1,
    prefillTab1,
    calculateRequiredMarks,
    resetTab2,
    prefillTab2,
    calculateAdditionalMarks,
    resetTab3,
    prefillTab3,
    PERCENTAGE_GRADE_SCALE
  };
})();
