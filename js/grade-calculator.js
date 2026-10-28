/**
 * GradePilot AI - Complete Grade Calculator (Phase 3)
 * Full subject management (add, edit, delete), dynamic tabular display,
 * configurable grading scale, rigorous validation, LocalStorage persistence,
 * and seamless dashboard synchronization.
 */

const GradeCalculator = (() => {
  const Storage = window.AppStorage || AppStorage;

  // Default Standard 10-Point Academic Grading Scale (Configurable)
  const DEFAULT_GRADE_SCALE = [
    { min: 90, max: 100, grade: 'O',  point: 10, label: 'Outstanding', color: 'green' },
    { min: 80, max: 89,  grade: 'A+', point: 9,  label: 'Excellent',   color: 'blue' },
    { min: 70, max: 79,  grade: 'A',  point: 8,  label: 'Very Good',   color: 'indigo' },
    { min: 60, max: 69,  grade: 'B+', point: 7,  label: 'Good',        color: 'purple' },
    { min: 50, max: 59,  grade: 'B',  point: 6,  label: 'Above Avg',   color: 'yellow' },
    { min: 40, max: 49,  grade: 'C',  point: 5,  label: 'Average',     color: 'orange' },
    { min: 0,  max: 39,  grade: 'F',  point: 0,  label: 'Fail',        color: 'red' }
  ];

  const STORAGE_KEY_SUBJECTS = 'gradepilot_grade_calc_subjects';
  const STORAGE_KEY_SCALE = 'gradepilot_grade_scale_config';

  // State
  let gradeSubjects = [];
  let editingSubjectId = null;

  /**
   * Initialize Grade Calculator Module
   */
  const init = () => {
    loadSubjects();
    renderScaleReference();
    renderSubjectsTable();
    updateGradeSummary();
    bindEvents();
  };

  /**
   * Helper to normalize and sanitize subject records
   */
  const normalizeSubject = (sub, idx = 0) => {
    const marks = parseFloat(sub.marks) || 0;
    const maxMarks = (parseFloat(sub.maxMarks) > 0) ? parseFloat(sub.maxMarks) : 100;
    const credits = (parseFloat(sub.credits) > 0) ? parseFloat(sub.credits) : 3;
    const gradeInfo = calculateGrade(marks, maxMarks);
    const point = (typeof sub.point === 'number' && !isNaN(sub.point)) ? sub.point : gradeInfo.point;
    const pct = (typeof sub.percentage === 'number' && !isNaN(sub.percentage)) ? sub.percentage : gradeInfo.percentage;
    const weightedPoints = (typeof sub.weightedPoints === 'number' && !isNaN(sub.weightedPoints)) ? sub.weightedPoints : (point * credits);

    return {
      id: sub.id || (Date.now() + idx),
      name: (sub.name && sub.name.trim()) ? sub.name.trim() : `Subject ${idx + 1}`,
      marks,
      maxMarks,
      percentage: pct,
      grade: sub.grade || gradeInfo.grade,
      point,
      gradePoint: point,
      credits,
      weightedPoints,
      color: sub.color || gradeInfo.color
    };
  };

  /**
   * Load subjects from LocalStorage
   */
  const loadSubjects = () => {
    const saved = Storage.get(STORAGE_KEY_SUBJECTS, null);
    if (saved !== null && Array.isArray(saved)) {
      gradeSubjects = saved.map((s, i) => normalizeSubject(s, i));
      saveState();
    } else {
      // Seed initial subjects on first application launch if storage has never been initialized
      gradeSubjects = [
        createSubjectData('Data Structures & Algorithms', 88, 100, 4),
        createSubjectData('Database Management Systems', 92, 100, 3),
        createSubjectData('Operating Systems', 76, 100, 4)
      ];
      saveState();
    }
  };

  /**
   * Reusable calculation: Percentage calculation
   * Formula: (marksObtained / maximumMarks) * 100
   */
  const calculatePercentage = (marksObtained, maximumMarks) => {
    const marks = parseFloat(marksObtained);
    const max = parseFloat(maximumMarks);
    if (isNaN(marks) || isNaN(max) || max <= 0) return 0;
    return (marks / max) * 100;
  };

  /**
   * Reusable calculation: Get active scale (configurable via LocalStorage)
   */
  const getActiveScale = () => {
    return Storage.get(STORAGE_KEY_SCALE, DEFAULT_GRADE_SCALE);
  };

  /**
   * Save customized grading scale
   */
  const setCustomScale = (newScale) => {
    if (Array.isArray(newScale) && newScale.length > 0) {
      Storage.set(STORAGE_KEY_SCALE, newScale);
      // Recalculate all existing subjects with the new scale
      gradeSubjects = gradeSubjects.map(sub => {
        const gradeInfo = calculateGrade(sub.marks, sub.maxMarks, newScale);
        return {
          ...sub,
          percentage: gradeInfo.percentage,
          grade: gradeInfo.grade,
          point: gradeInfo.point,
          gradePoint: gradeInfo.point,
          weightedPoints: gradeInfo.point * sub.credits,
          color: gradeInfo.color
        };
      });
      saveState();
      renderScaleReference();
      renderSubjectsTable();
      updateGradeSummary();
      syncWithDashboard();
      Utils.showToast('Grading scale updated successfully!', 'success');
    }
  };

  /**
   * Reset grading scale to standard default
   */
  const resetScaleToDefault = () => {
    Storage.set(STORAGE_KEY_SCALE, DEFAULT_GRADE_SCALE);
    setCustomScale(DEFAULT_GRADE_SCALE);
    const editor = document.getElementById('scale-editor-panel');
    if (editor && editor.style.display !== 'none') {
      renderScaleEditor();
    }
    Utils.showToast('Grading scale restored to standard default.', 'info');
  };

  /**
   * Reusable calculation: Determine Grade and Grade Point from Percentage
   */
  const percentageToGrade = (percentage, scale = null) => {
    const activeScale = scale || getActiveScale();
    const pct = parseFloat(percentage);
    if (isNaN(pct)) {
      return { grade: 'F', point: 0, label: 'Fail', color: 'red' };
    }

    // Sort descending by min cutoff to evaluate highest threshold first
    const sortedScale = [...activeScale].sort((a, b) => b.min - a.min);

    for (const tier of sortedScale) {
      if (pct >= tier.min) {
        return {
          grade: tier.grade,
          point: tier.point,
          label: tier.label || tier.grade,
          color: tier.color || 'blue'
        };
      }
    }

    // Fallback to lowest tier if below minimum
    const lowestTier = sortedScale[sortedScale.length - 1];
    return {
      grade: lowestTier.grade,
      point: lowestTier.point,
      label: lowestTier.label,
      color: lowestTier.color
    };
  };

  /**
   * Reusable calculation: Complete grade evaluation from marks & maxMarks
   */
  const calculateGrade = (marksObtained, maximumMarks, scale = null) => {
    const pct = calculatePercentage(marksObtained, maximumMarks);
    const tier = percentageToGrade(pct, scale);
    return {
      percentage: pct,
      grade: tier.grade,
      point: tier.point,
      gradePoint: tier.point, // Full compatibility with Phase 4 CGPA calculator
      label: tier.label,
      color: tier.color
    };
  };

  /**
   * Helper to construct compatible subject data object
   */
  const createSubjectData = (name, marks, maxMarks, credits) => {
    const gradeInfo = calculateGrade(marks, maxMarks);
    const cred = parseFloat(credits) || 3;
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: (name && name.trim()) ? name.trim() : `Subject ${gradeSubjects.length + 1}`,
      marks: parseFloat(marks),
      maxMarks: parseFloat(maxMarks),
      percentage: gradeInfo.percentage,
      grade: gradeInfo.grade,
      point: gradeInfo.point,
      gradePoint: gradeInfo.point, // standard Phase 4 compatible property
      credits: cred,
      weightedPoints: gradeInfo.point * cred,
      color: gradeInfo.color
    };
  };

  /**
   * Form validation with readable error messages
   */
  const validateFormInputs = (marksVal, maxMarksVal, creditsVal) => {
    // Check for empty/missing numeric values
    if (marksVal === '' || marksVal === null || marksVal === undefined) {
      return 'Please enter marks obtained.';
    }
    const marks = Number(marksVal);
    if (isNaN(marks)) {
      return 'Marks obtained must be a valid number.';
    }
    if (marks < 0) {
      return 'Marks obtained cannot be negative.';
    }

    if (maxMarksVal === '' || maxMarksVal === null || maxMarksVal === undefined) {
      return 'Please enter maximum marks.';
    }
    const maxMarks = Number(maxMarksVal);
    if (isNaN(maxMarks)) {
      return 'Maximum marks must be a valid number.';
    }
    if (maxMarks <= 0) {
      return 'Maximum marks must be greater than zero.';
    }

    if (marks > maxMarks) {
      return `Marks obtained (${marks}) cannot exceed maximum marks (${maxMarks}).`;
    }

    if (creditsVal === '' || creditsVal === null || creditsVal === undefined) {
      return 'Please enter credits.';
    }
    const credits = Number(creditsVal);
    if (isNaN(credits)) {
      return 'Credits must be a valid number.';
    }
    if (credits <= 0) {
      return 'Credits must be a positive number greater than 0.';
    }

    return null; // Valid
  };

  /**
   * Add or Update Subject Handler
   */
  const addOrUpdateSubject = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('grade-subject-name');
    const marksInput = document.getElementById('grade-marks');
    const maxMarksInput = document.getElementById('grade-max-marks');
    const creditsInput = document.getElementById('grade-credits');
    const errorBox = document.getElementById('grade-form-error');

    const nameVal = nameInput ? nameInput.value.trim() : '';
    const marksVal = marksInput ? marksInput.value.trim() : '';
    const maxMarksVal = maxMarksInput ? maxMarksInput.value.trim() : '100';
    const creditsVal = creditsInput ? creditsInput.value.trim() : '3';

    // Validate inputs
    const error = validateFormInputs(marksVal, maxMarksVal, creditsVal);
    if (error) {
      if (errorBox) {
        errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right: 0.5rem; color: var(--danger);"></i> <strong>Validation Error:</strong> ${Utils.escapeHtml(error)}`;
        errorBox.style.display = 'block';
      }
      Utils.showToast(error, 'error');
      return;
    }

    // Clear error
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }

    const marks = parseFloat(marksVal);
    const maxMarks = parseFloat(maxMarksVal);
    const credits = parseFloat(creditsVal);

    let savedSubject = null;

    if (editingSubjectId !== null) {
      // Update existing subject
      const index = gradeSubjects.findIndex(s => s.id === editingSubjectId);
      if (index !== -1) {
        const gradeInfo = calculateGrade(marks, maxMarks);
        const updatedName = nameVal || `Subject ${index + 1}`;
        gradeSubjects[index] = {
          ...gradeSubjects[index],
          name: updatedName,
          marks,
          maxMarks,
          percentage: gradeInfo.percentage,
          grade: gradeInfo.grade,
          point: gradeInfo.point,
          gradePoint: gradeInfo.point,
          credits,
          weightedPoints: gradeInfo.point * credits,
          color: gradeInfo.color
        };
        savedSubject = gradeSubjects[index];
        Utils.showToast(`Updated "${savedSubject.name}": Grade ${gradeInfo.grade} (${gradeInfo.point} GP)`, 'success');
      }
      cancelEdit();
    } else {
      // Add new subject
      const subject = createSubjectData(nameVal, marks, maxMarks, credits);
      gradeSubjects.push(subject);
      savedSubject = subject;
      Utils.showToast(`Added "${subject.name}": Grade ${subject.grade} (${subject.point} GP)`, 'success');
      resetForm();
    }

    saveState();
    renderSubjectsTable();
    updateGradeSummary();

    // Log to calculation history
    if (savedSubject && Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: savedSubject.name,
        type: 'Grade Calculator',
        result: `Grade ${savedSubject.grade} (${savedSubject.point} GP) • ${savedSubject.percentage.toFixed(1)}%`
      });
    }

    syncWithDashboard();
  };

  /**
   * Start Edit Mode for a subject
   */
  const startEditSubject = (id) => {
    const subject = gradeSubjects.find(s => s.id === id);
    if (!subject) return;

    editingSubjectId = id;

    const nameInput = document.getElementById('grade-subject-name');
    const marksInput = document.getElementById('grade-marks');
    const maxMarksInput = document.getElementById('grade-max-marks');
    const creditsInput = document.getElementById('grade-credits');
    const addBtn = document.getElementById('btn-add-grade-subject');
    const cancelBtn = document.getElementById('btn-cancel-grade-edit');

    if (nameInput) nameInput.value = subject.name;
    if (marksInput) marksInput.value = subject.marks;
    if (maxMarksInput) maxMarksInput.value = subject.maxMarks;
    if (creditsInput) creditsInput.value = subject.credits;

    if (addBtn) {
      addBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Subject';
      addBtn.className = 'btn btn-primary btn-sm';
    }

    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }

    // Scroll form into view
    const formCard = document.getElementById('grade-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Highlight row in table
    document.querySelectorAll('.grade-table-row').forEach(tr => {
      tr.classList.remove('table-row-editing');
    });
    const tr = document.getElementById(`grade-row-${id}`);
    if (tr) tr.classList.add('table-row-editing');

    if (marksInput) marksInput.focus();
  };

  /**
   * Cancel Edit Mode
   */
  const cancelEdit = () => {
    editingSubjectId = null;
    resetForm();

    const addBtn = document.getElementById('btn-add-grade-subject');
    const cancelBtn = document.getElementById('btn-cancel-grade-edit');

    if (addBtn) {
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Subject';
      addBtn.className = 'btn btn-primary btn-sm';
    }

    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    document.querySelectorAll('.grade-table-row').forEach(tr => {
      tr.classList.remove('table-row-editing');
    });
  };

  /**
   * Delete Subject
   */
  const deleteSubject = (id) => {
    const subject = gradeSubjects.find(s => s.id === id);
    const subName = subject ? subject.name : 'Subject';

    if (confirm(`Are you sure you want to delete "${subName}"?`)) {
      if (editingSubjectId === id) {
        cancelEdit();
      }
      gradeSubjects = gradeSubjects.filter(s => s.id !== id);
      saveState();
      renderSubjectsTable();
      updateGradeSummary();
      syncWithDashboard();
      Utils.showToast(`Deleted "${subName}".`, 'info');
    }
  };

  /**
   * Clear all subjects
   */
  const clearAllSubjects = () => {
    if (gradeSubjects.length === 0) {
      Utils.showToast('No subjects to clear.', 'info');
      return;
    }

    if (confirm('Clear all subjects from the Grade Calculator?')) {
      cancelEdit();
      gradeSubjects = [];
      saveState();
      renderSubjectsTable();
      updateGradeSummary();
      syncWithDashboard();
      Utils.showToast('All subjects cleared from Grade Calculator.', 'info');
    }
  };

  /**
   * Reset form fields to defaults
   */
  const resetForm = () => {
    const nameInput = document.getElementById('grade-subject-name');
    const marksInput = document.getElementById('grade-marks');
    const maxMarksInput = document.getElementById('grade-max-marks');
    const creditsInput = document.getElementById('grade-credits');
    const errorBox = document.getElementById('grade-form-error');

    if (nameInput) nameInput.value = '';
    if (marksInput) marksInput.value = '';
    if (maxMarksInput) maxMarksInput.value = '100';
    if (creditsInput) creditsInput.value = '3';
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  };

  /**
   * Render subjects in a responsive data table (Requirement 3 & 5)
   */
  const renderSubjectsTable = () => {
    const container = document.getElementById('grade-subjects-table-container');
    const emptyState = document.getElementById('grade-table-empty');
    const tbody = document.getElementById('grade-table-body');

    if (!container || !tbody) return;

    if (gradeSubjects.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.style.display = 'block';

    tbody.innerHTML = gradeSubjects.map((subject, idx) => {
      const isEditing = subject.id === editingSubjectId;
      const marks = typeof subject.marks === 'number' ? subject.marks : (parseFloat(subject.marks) || 0);
      const maxMarks = typeof subject.maxMarks === 'number' ? subject.maxMarks : (parseFloat(subject.maxMarks) || 100);
      const pct = typeof subject.percentage === 'number' ? subject.percentage : calculatePercentage(marks, maxMarks);
      const pt = typeof subject.point === 'number' ? subject.point : (typeof subject.gradePoint === 'number' ? subject.gradePoint : 0);
      const cred = typeof subject.credits === 'number' ? subject.credits : (parseFloat(subject.credits) || 3);
      const wp = typeof subject.weightedPoints === 'number' ? subject.weightedPoints : (pt * cred);
      const grade = subject.grade || percentageToGrade(pct).grade;
      const color = subject.color || percentageToGrade(pct).color;

      return `
        <tr id="grade-row-${subject.id}" class="grade-table-row ${isEditing ? 'table-row-editing' : ''}">
          <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${Utils.escapeHtml(subject.name || `Subject ${idx + 1}`)}</div>
          </td>
          <td>
            <span style="font-weight: 700; color: var(--text-main);">${marks}</span>
            <span style="color: var(--text-muted); font-size: 0.8rem;"> / ${maxMarks}</span>
          </td>
          <td>
            <strong style="color: var(--primary);">${pct.toFixed(2)}%</strong>
          </td>
          <td>
            <span class="badge badge-grade badge-grade-${color}">
              ${grade}
            </span>
          </td>
          <td>
            <strong style="font-size: 1rem; color: var(--text-main);">${pt.toFixed(1)}</strong>
          </td>
          <td>
            <span style="font-weight: 600; color: var(--text-secondary);">${cred}</span>
          </td>
          <td>
            <strong style="color: var(--accent-cyan); font-size: 0.95rem;">${wp.toFixed(2)}</strong>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="GradeCalculator.startEditSubject(${subject.id})" title="Edit ${Utils.escapeHtml(subject.name || 'Subject')}" aria-label="Edit subject">
              <i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i>
            </button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="GradeCalculator.deleteSubject(${subject.id})" title="Delete ${Utils.escapeHtml(subject.name || 'Subject')}" aria-label="Delete subject">
              <i class="fa-solid fa-trash-can" style="color: var(--danger);"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  /**
   * Update Grade Summary statistics (Requirement 6 & 7)
   */
  const updateGradeSummary = () => {
    const summaryCard = document.getElementById('grade-summary');
    if (!summaryCard) return;

    if (gradeSubjects.length === 0) {
      summaryCard.style.display = 'none';
      return;
    }

    summaryCard.style.display = 'block';

    const totalSubjects = gradeSubjects.length;
    let totalCredits = 0;
    let totalWeightedPoints = 0;
    let totalPercentage = 0;

    gradeSubjects.forEach(s => {
      const cred = parseFloat(s.credits) || 3;
      const pt = (typeof s.point === 'number') ? s.point : (parseFloat(s.gradePoint) || 0);
      const pct = (typeof s.percentage === 'number') ? s.percentage : calculatePercentage(s.marks, s.maxMarks);
      totalCredits += cred;
      totalWeightedPoints += (pt * cred);
      totalPercentage += pct;
    });

    const averageGP = totalCredits > 0 ? (totalWeightedPoints / totalCredits) : 0;
    const averagePct = totalSubjects > 0 ? (totalPercentage / totalSubjects) : 0;
    const averageGrade = percentageToGrade(averagePct).grade;

    // Update DOM counters
    const elTotal = document.getElementById('total-subjects');
    const elAvgGrade = document.getElementById('average-grade');
    const elAvgGP = document.getElementById('average-gp');
    const elAvgPct = document.getElementById('average-percentage');
    const elTotalCred = document.getElementById('total-grade-credits');

    if (elTotal) elTotal.textContent = totalSubjects;
    if (elAvgGrade) elAvgGrade.textContent = averageGrade;
    if (elAvgGP) elAvgGP.textContent = averageGP.toFixed(2);
    if (elAvgPct) elAvgPct.textContent = `${averagePct.toFixed(2)}%`;
    if (elTotalCred) elTotalCred.textContent = totalCredits;
  };

  /**
   * Render Grading Scale Reference Table & Grid (Requirement 8)
   */
  const renderScaleReference = () => {
    const gridContainer = document.getElementById('grade-scale-grid');
    if (!gridContainer) return;

    const scale = getActiveScale();

    gridContainer.innerHTML = scale.map(tier => `
      <div class="scale-card scale-card-${tier.color}">
        <div class="scale-grade">${tier.grade} (${tier.min}–${tier.max}%)</div>
        <div class="scale-meta">Grade Point: ${tier.point} • ${tier.label}</div>
      </div>
    `).join('');
  };

  /**
   * Toggle Configurable Scale Editor Panel
   */
  const toggleScaleEditor = () => {
    const panel = document.getElementById('scale-editor-panel');
    if (!panel) return;

    const isVisible = panel.style.display !== 'none';
    if (isVisible) {
      panel.style.display = 'none';
    } else {
      panel.style.display = 'block';
      renderScaleEditor();
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  /**
   * Render Configurable Scale Inputs in Editor Panel
   */
  const renderScaleEditor = () => {
    const container = document.getElementById('scale-editor-form-grid');
    if (!container) return;

    const scale = getActiveScale();
    container.innerHTML = scale.map((tier, idx) => `
      <div style="background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.85rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
          <span class="badge badge-grade badge-grade-${tier.color}">${tier.grade}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${tier.label}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.35rem;">
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Min %</label>
            <input type="number" id="scale-min-${idx}" class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.85rem;" value="${tier.min}" min="0" max="100" />
          </div>
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Max %</label>
            <input type="number" id="scale-max-${idx}" class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.85rem;" value="${tier.max}" min="0" max="100" />
          </div>
        </div>
        <div>
          <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Grade Point (GP)</label>
          <input type="number" id="scale-point-${idx}" class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.85rem;" value="${tier.point}" min="0" max="10" step="0.5" />
        </div>
      </div>
    `).join('');
  };

  /**
   * Save customized scale from editor
   */
  const saveScaleFromEditor = () => {
    const scale = getActiveScale();
    const newScale = [];

    for (let i = 0; i < scale.length; i++) {
      const minEl = document.getElementById(`scale-min-${i}`);
      const maxEl = document.getElementById(`scale-max-${i}`);
      const pointEl = document.getElementById(`scale-point-${i}`);

      if (!minEl || !maxEl || !pointEl) continue;

      const minVal = parseFloat(minEl.value);
      const maxVal = parseFloat(maxEl.value);
      const pointVal = parseFloat(pointEl.value);

      if (isNaN(minVal) || isNaN(maxVal) || isNaN(pointVal)) {
        Utils.showToast('Please enter valid numeric cutoffs for all grades.', 'error');
        return;
      }

      if (minVal < 0 || maxVal > 100 || minVal > maxVal) {
        Utils.showToast(`Invalid percentage range for grade ${scale[i].grade}.`, 'error');
        return;
      }

      newScale.push({
        ...scale[i],
        min: minVal,
        max: maxVal,
        point: pointVal
      });
    }

    setCustomScale(newScale);
    toggleScaleEditor();
  };

  /**
   * Persist state in LocalStorage (Requirement 9)
   */
  const saveState = () => {
    Storage.set(STORAGE_KEY_SUBJECTS, gradeSubjects);
  };

  /**
   * Synchronize with Dashboard (Requirement 10)
   */
  const syncWithDashboard = () => {
    if (typeof Dashboard !== 'undefined') {
      if (Dashboard.renderMetrics) Dashboard.renderMetrics();
      if (Dashboard.renderHistory) Dashboard.renderHistory();
      if (Dashboard.initGpaChart) Dashboard.initGpaChart();
    }
  };

  /**
   * Expose compatible subjects array for Phase 4 CGPA Calculator
   */
  const getSubjects = () => [...gradeSubjects];

  /**
   * Export Grade Calculator results as PDF
   */
  const exportPdf = () => {
    if (!gradeSubjects || gradeSubjects.length === 0) {
      Utils.showToast('No enrolled subjects to export as PDF.', 'warning');
      return;
    }
    const elAvgGP = document.getElementById('average-gp');
    const elAvgPct = document.getElementById('average-percentage');
    const elTotalCred = document.getElementById('total-grade-credits');
    const summary = {
      gpa: elAvgGP ? elAvgGP.textContent : '0.00',
      totalCredits: elTotalCred ? elTotalCred.textContent : '0',
      averagePct: elAvgPct ? elAvgPct.textContent : '0.00%'
    };
    Utils.exportGradePdf(gradeSubjects, summary);
  };

  /**
   * Export Grade Calculator subjects as CSV
   */
  const exportCsv = () => {
    if (!gradeSubjects || gradeSubjects.length === 0) {
      Utils.showToast('No enrolled subjects to export as CSV.', 'warning');
      return;
    }
    Utils.exportSubjectsCsv(gradeSubjects, 'gradepilot-grade-results.csv');
  };

  /**
   * Attach Form & Action Listeners
   */
  const bindEvents = () => {
    const addBtn = document.getElementById('btn-add-grade-subject');
    if (addBtn) {
      addBtn.addEventListener('click', addOrUpdateSubject);
    }

    const cancelBtn = document.getElementById('btn-cancel-grade-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEdit);
    }

    const clearBtn = document.getElementById('btn-clear-grade-subjects');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllSubjects);
    }

    const exportCsvBtn = document.getElementById('btn-export-grade-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportCsv();
      });
    }

    const exportPdfBtn = document.getElementById('btn-export-grade-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportPdf();
      });
    }

    // Keyboard enter support on form inputs
    ['grade-subject-name', 'grade-marks', 'grade-max-marks', 'grade-credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addOrUpdateSubject();
          }
        });
      }
    });

    // Real-time error clearance on input
    ['grade-marks', 'grade-max-marks', 'grade-credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const errorBox = document.getElementById('grade-form-error');
          if (errorBox) {
            errorBox.textContent = '';
            errorBox.style.display = 'none';
          }
        });
      }
    });
  };

  return {
    init,
    calculatePercentage,
    percentageToGrade,
    calculateGrade,
    getActiveScale,
    setCustomScale,
    resetScaleToDefault,
    toggleScaleEditor,
    renderScaleEditor,
    saveScaleFromEditor,
    addOrUpdateSubject,
    startEditSubject,
    cancelEdit,
    deleteSubject,
    clearAllSubjects,
    getSubjects,
    exportPdf,
    exportCsv,
    DEFAULT_GRADE_SCALE
  };
})();
