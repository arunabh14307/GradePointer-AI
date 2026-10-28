/**
 * GradePilot AI - CGPA / TGPA Calculator (Phase 4)
 * Computes credit-weighted Cumulative / Term Grade Point Averages:
 *   CGPA/TGPA = SUM(gradePoint * credits) / SUM(credits)
 * Supports full subject CRUD, quick grade/credit buttons, robust validation,
 * duplicate-preventing import from Grade Calculator, CSV/PDF exports via jsPDF,
 * LocalStorage persistence, and dashboard synchronization.
 */

const CgpaCalculator = (() => {
  const Storage = window.AppStorage || AppStorage;
  const STORAGE_KEY_CGPA = 'gradepilot_cgpa_calc_subjects';

  // State
  let cgpaSubjects = [];
  let editingSubjectId = null;

  /**
   * Initialize CGPA Calculator Module
   */
  const init = () => {
    loadSubjects();
    renderCGPASubjectsList();
    updateCGPAResults();
    bindEvents();
  };

  /**
   * Normalize and sanitize subject objects
   */
  const normalizeSubject = (sub, idx = 0) => {
    const gp = parseFloat(sub.gradePoint !== undefined ? sub.gradePoint : sub.point) || 0;
    const cred = (parseFloat(sub.credits) > 0) ? parseFloat(sub.credits) : 3;
    const creditPts = (typeof sub.creditPoints === 'number' && !isNaN(sub.creditPoints))
      ? sub.creditPoints
      : (gp * cred);

    return {
      id: sub.id || (Date.now() + idx),
      name: (sub.name && sub.name.trim()) ? sub.name.trim() : `Subject ${idx + 1}`,
      gradePoint: gp,
      credits: cred,
      creditPoints: creditPts
    };
  };

  /**
   * Load stored subjects from LocalStorage or seed defaults on first run
   */
  const loadSubjects = () => {
    const stored = Storage.get(STORAGE_KEY_CGPA, null);
    if (stored !== null && Array.isArray(stored)) {
      cgpaSubjects = stored.map((s, idx) => normalizeSubject(s, idx));
      saveState();
    } else {
      // Seed initial realistic subjects on first application launch
      cgpaSubjects = [
        normalizeSubject({ id: 1, name: 'Data Structures & Algorithms', gradePoint: 9.0, credits: 4 }),
        normalizeSubject({ id: 2, name: 'Database Management Systems',  gradePoint: 10.0, credits: 3 }),
        normalizeSubject({ id: 3, name: 'Computer Networks',            gradePoint: 8.0, credits: 4 }),
        normalizeSubject({ id: 4, name: 'Discrete Mathematics',         gradePoint: 8.0, credits: 3 }),
        normalizeSubject({ id: 5, name: 'Software Engineering Lab',     gradePoint: 9.0, credits: 2 })
      ];
      saveState();
    }
  };

  /**
   * Quick buttons to set Grade Point
   */
  const setGradePoint = (val) => {
    const input = document.getElementById('cgpa-grade-point');
    if (input) {
      input.value = val;
      input.focus();
      clearError();
    }
  };

  /**
   * Quick buttons to set Credits
   */
  const setCredits = (val) => {
    const input = document.getElementById('cgpa-credits');
    if (input) {
      input.value = val;
      input.focus();
      clearError();
    }
  };

  /**
   * Validate Form Inputs with readable messages
   */
  const validateInputs = (gpVal, credVal) => {
    if (gpVal === '' || gpVal === null || gpVal === undefined) {
      return 'Please enter a Grade Point (0 - 10).';
    }
    const gp = Number(gpVal);
    if (isNaN(gp)) {
      return 'Grade Point must be a valid number.';
    }
    if (gp < 0 || gp > 10) {
      return 'Grade Point must be between 0 and 10.';
    }

    if (credVal === '' || credVal === null || credVal === undefined) {
      return 'Please enter Credits.';
    }
    const cred = Number(credVal);
    if (isNaN(cred)) {
      return 'Credits must be a valid number.';
    }
    if (cred <= 0) {
      return 'Credits must be a positive number greater than 0.';
    }

    return null; // Valid
  };

  /**
   * Clear inline error box
   */
  const clearError = () => {
    const errorBox = document.getElementById('cgpa-form-error');
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  };

  /**
   * Display inline error message
   */
  const showError = (msg) => {
    const errorBox = document.getElementById('cgpa-form-error');
    if (errorBox) {
      errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right: 0.5rem; color: var(--danger);"></i> <strong>Validation Error:</strong> ${Utils.escapeHtml(msg)}`;
      errorBox.style.display = 'block';
    }
    Utils.showToast(msg, 'error');
  };

  /**
   * Add or Update Subject in CGPA calculation
   */
  const addOrUpdateCGPASubject = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('cgpa-subject-name');
    const gpInput = document.getElementById('cgpa-grade-point');
    const credInput = document.getElementById('cgpa-credits');

    const subjectName = nameInput ? nameInput.value.trim() : '';
    const gpVal = gpInput ? gpInput.value.trim() : '';
    const credVal = credInput ? credInput.value.trim() : '';

    const error = validateInputs(gpVal, credVal);
    if (error) {
      showError(error);
      return;
    }

    clearError();

    const gradePoint = parseFloat(gpVal);
    const credits = parseFloat(credVal);
    const creditPoints = gradePoint * credits;

    let savedItem = null;

    if (editingSubjectId !== null) {
      // Update existing subject
      const index = cgpaSubjects.findIndex(s => s.id === editingSubjectId);
      if (index !== -1) {
        cgpaSubjects[index] = {
          ...cgpaSubjects[index],
          name: subjectName || `Subject ${index + 1}`,
          gradePoint,
          credits,
          creditPoints
        };
        savedItem = cgpaSubjects[index];
        Utils.showToast(`Updated "${savedItem.name}": GP ${gradePoint.toFixed(1)}, Credits ${credits}`, 'success');
      }
      cancelEdit();
    } else {
      // Add new subject
      const newSubject = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: subjectName || `Subject ${cgpaSubjects.length + 1}`,
        gradePoint,
        credits,
        creditPoints
      };
      cgpaSubjects.push(newSubject);
      savedItem = newSubject;
      Utils.showToast(`Added "${newSubject.name}": GP ${gradePoint.toFixed(1)}, Credits ${credits}`, 'success');
      resetForm();
    }

    saveState();
    renderCGPASubjectsList();
    updateCGPAResults();

    // Log to calculation history
    if (savedItem && Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: savedItem.name,
        type: 'CGPA Calculator',
        result: `GP: ${savedItem.gradePoint.toFixed(1)} • ${savedItem.credits} Credits (${savedItem.creditPoints.toFixed(1)} Pts)`
      });
    }

    syncWithDashboard();
  };

  /**
   * Start Edit Mode for a CGPA subject
   */
  const startEditCGPASubject = (id) => {
    const subject = cgpaSubjects.find(s => s.id === id);
    if (!subject) return;

    editingSubjectId = id;

    const nameInput = document.getElementById('cgpa-subject-name');
    const gpInput = document.getElementById('cgpa-grade-point');
    const credInput = document.getElementById('cgpa-credits');
    const submitBtn = document.getElementById('btn-submit-cgpa');
    const cancelBtn = document.getElementById('btn-cancel-cgpa-edit');

    if (nameInput) nameInput.value = subject.name;
    if (gpInput) gpInput.value = subject.gradePoint;
    if (credInput) credInput.value = subject.credits;

    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Subject';
      submitBtn.className = 'btn btn-primary';
      submitBtn.style.background = 'var(--primary)';
    }

    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }

    // Scroll form into view
    const formCard = document.getElementById('cgpa-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Highlight row
    document.querySelectorAll('.cgpa-table-row').forEach(tr => {
      tr.classList.remove('table-row-editing');
    });
    const tr = document.getElementById(`cgpa-row-${id}`);
    if (tr) tr.classList.add('table-row-editing');

    if (gpInput) gpInput.focus();
  };

  /**
   * Cancel Edit Mode
   */
  const cancelEdit = () => {
    editingSubjectId = null;
    resetForm();

    const submitBtn = document.getElementById('btn-submit-cgpa');
    const cancelBtn = document.getElementById('btn-cancel-cgpa-edit');

    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-calculator"></i> Add to CGPA';
      submitBtn.className = 'btn btn-primary';
      submitBtn.style.background = 'var(--success)';
    }

    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    document.querySelectorAll('.cgpa-table-row').forEach(tr => {
      tr.classList.remove('table-row-editing');
    });
  };

  /**
   * Delete Subject from list
   */
  const deleteCGPASubject = (id) => {
    const subject = cgpaSubjects.find(s => s.id === id);
    const subName = subject ? subject.name : 'Subject';

    if (confirm(`Are you sure you want to delete "${subName}" from CGPA calculation?`)) {
      if (editingSubjectId === id) {
        cancelEdit();
      }
      cgpaSubjects = cgpaSubjects.filter(sub => sub.id !== id);
      saveState();
      renderCGPASubjectsList();
      updateCGPAResults();
      syncWithDashboard();
      Utils.showToast(`Deleted "${subName}".`, 'info');
    }
  };

  /**
   * Clear all CGPA subjects after confirmation
   */
  const clearAllCGPASubjects = () => {
    if (cgpaSubjects.length === 0) {
      Utils.showToast('No subjects to clear.', 'info');
      return;
    }

    if (confirm('Clear all subjects from the CGPA calculator?')) {
      cancelEdit();
      cgpaSubjects = [];
      saveState();
      renderCGPASubjectsList();
      updateCGPAResults();
      syncWithDashboard();
      Utils.showToast('All subjects cleared from CGPA Calculator.', 'info');
    }
  };

  /**
   * Reset Form fields
   */
  const resetForm = () => {
    const nameInput = document.getElementById('cgpa-subject-name');
    const gpInput = document.getElementById('cgpa-grade-point');
    const credInput = document.getElementById('cgpa-credits');

    if (nameInput) nameInput.value = '';
    if (gpInput) gpInput.value = '';
    if (credInput) credInput.value = '3';
    clearError();
  };

  /**
   * Import subjects from Grade Calculator
   * Preserves name, gradePoint, credits without overwriting existing subjects.
   * Prevents accidental duplicates.
   */
  const importFromGradeCalculator = () => {
    let sourceSubjects = [];
    if (typeof GradeCalculator !== 'undefined' && GradeCalculator.getSubjects) {
      sourceSubjects = GradeCalculator.getSubjects();
    } else {
      sourceSubjects = Storage.get('gradepilot_grade_calc_subjects', []);
    }

    if (!sourceSubjects || !Array.isArray(sourceSubjects) || sourceSubjects.length === 0) {
      Utils.showToast('No subjects found in Grade Calculator to import. Please add some first!', 'warning');
      return;
    }

    // Identify duplicates to prevent accidental duplicate imports
    const existingKeys = new Set(
      cgpaSubjects.map(s => `${(s.name || '').trim().toLowerCase()}_${parseFloat(s.gradePoint).toFixed(2)}_${parseFloat(s.credits).toFixed(2)}`)
    );

    const newCandidates = sourceSubjects.filter(sub => {
      const gp = (sub.gradePoint !== undefined ? sub.gradePoint : sub.point) || 0;
      const cred = sub.credits || 3;
      const key = `${(sub.name || '').trim().toLowerCase()}_${parseFloat(gp).toFixed(2)}_${parseFloat(cred).toFixed(2)}`;
      return !existingKeys.has(key);
    });

    if (newCandidates.length === 0) {
      Utils.showToast('All subjects from Grade Calculator are already imported into your CGPA list.', 'info');
      return;
    }

    // Do not silently overwrite existing CGPA subjects: confirm and append
    const confirmMessage = cgpaSubjects.length > 0
      ? `Import ${newCandidates.length} subject(s) from Grade Calculator?\n\nExisting ${cgpaSubjects.length} subject(s) will be preserved and not overwritten.`
      : `Import ${newCandidates.length} subject(s) from Grade Calculator?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const importedObjects = newCandidates.map(sub => {
      const gp = parseFloat(sub.gradePoint !== undefined ? sub.gradePoint : sub.point) || 0;
      const cred = parseFloat(sub.credits) || 3;
      return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        name: sub.name || `Subject ${cgpaSubjects.length + 1}`,
        gradePoint: gp,
        credits: cred,
        creditPoints: gp * cred
      };
    });

    cgpaSubjects = [...cgpaSubjects, ...importedObjects];
    saveState();
    renderCGPASubjectsList();
    updateCGPAResults();
    syncWithDashboard();

    // Log to history
    if (Storage.addHistoryItem) {
      Storage.addHistoryItem({
        title: `Imported ${importedObjects.length} Subjects`,
        type: 'CGPA Calculator',
        result: `Imported from Grade Calculator`
      });
    }

    Utils.showToast(`Imported ${importedObjects.length} subject(s) from Grade Calculator!`, 'success');
  };

  /**
   * Reset all CGPA data after confirmation
   */
  const resetCGPA = () => {
    if (cgpaSubjects.length === 0) {
      Utils.showToast('Nothing to reset.', 'info');
      return;
    }

    if (confirm('Are you sure you want to reset all CGPA calculator subjects? This action cannot be undone.')) {
      cancelEdit();
      cgpaSubjects = [];
      saveState();
      renderCGPASubjectsList();
      updateCGPAResults();
      syncWithDashboard();
      Utils.showToast('CGPA calculator reset.', 'info');
    }
  };

  /**
   * Core Calculation Formula:
   *   CGPA/TGPA = SUM(gradePoint * credits) / SUM(credits)
   * Credit-weighted average, preventing divide-by-zero.
   */
  const calculateCGPA = () => {
    if (cgpaSubjects.length === 0) {
      return {
        cgpa: 0,
        totalCredits: 0,
        totalSubjects: 0,
        totalCreditPoints: 0,
        status: '-',
        statusColor: 'muted',
        performanceMessage: 'No subjects added yet. Add your subjects to see your performance analysis.'
      };
    }

    let totalCredits = 0;
    let totalCreditPoints = 0;

    cgpaSubjects.forEach(s => {
      const cred = parseFloat(s.credits) || 0;
      const gp = parseFloat(s.gradePoint) || 0;
      totalCredits += cred;
      totalCreditPoints += (gp * cred);
    });

    // Weighted average formula (no simple average)
    const cgpa = totalCredits > 0 ? (totalCreditPoints / totalCredits) : 0;

    // Academic Status Classification
    let status = 'Passed';
    let statusColor = 'success';

    if (cgpaSubjects.some(s => s.gradePoint === 0)) {
      status = 'Reappear';
      statusColor = 'danger';
    } else if (cgpa >= 8.5) {
      status = 'First Class with Distinction';
      statusColor = 'success';
    } else if (cgpa >= 7.0) {
      status = 'First Class';
      statusColor = 'primary';
    } else if (cgpa >= 6.0) {
      status = 'Second Class';
      statusColor = 'warning';
    } else {
      status = 'Pass Class';
      statusColor = 'cyan';
    }

    // Performance Analysis Diagnosis
    let performanceMessage = '';
    if (cgpa >= 9.0) {
      performanceMessage = 'Outstanding performance! You are excelling in your academic cohort with high honors standing.';
    } else if (cgpa >= 8.0) {
      performanceMessage = 'Excellent work! Consistent performance across all coursework. Keep maintaining this trajectory.';
    } else if (cgpa >= 7.0) {
      performanceMessage = 'Good academic performance! Strategically focusing on high-credit subjects can elevate you into distinction.';
    } else if (cgpa >= 6.0) {
      performanceMessage = 'Satisfactory standing. Prioritize challenging subjects and engage in active revision to boost your CGPA.';
    } else if (cgpa > 0) {
      performanceMessage = 'Academic attention needed. Consult professors during office hours and implement focused study plans.';
    } else {
      performanceMessage = 'No subjects added yet. Add your subjects to see your performance analysis.';
    }

    return {
      cgpa,
      totalCredits,
      totalSubjects: cgpaSubjects.length,
      totalCreditPoints,
      status,
      statusColor,
      performanceMessage
    };
  };

  /**
   * Render CGPA Subjects in a responsive data table
   */
  const renderCGPASubjectsList = () => {
    const container = document.getElementById('cgpa-subjects-list');
    if (!container) return;

    if (cgpaSubjects.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 2.5rem 1.5rem; color: var(--text-muted); border-style: dashed;">
          <i class="fa-solid fa-graduation-cap" style="font-size: 2.25rem; margin-bottom: 0.75rem; opacity: 0.4;"></i>
          <h4 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.35rem;">No CGPA Subjects Enrolled</h4>
          <p style="font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
            Add subjects manually using the form above or click <strong>Import from Grade Calculator</strong> to load your coursework.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px;">#</th>
              <th>Subject Name</th>
              <th>Grade Point (GP)</th>
              <th>Credits</th>
              <th>Credit Points</th>
              <th style="text-align: right; width: 100px;">Actions</th>
            </tr>
          </thead>
          <tbody id="cgpa-table-body">
            ${cgpaSubjects.map((sub, idx) => {
              const isEditing = sub.id === editingSubjectId;
              const creditPts = (sub.gradePoint * sub.credits).toFixed(2);
              return `
                <tr id="cgpa-row-${sub.id}" class="cgpa-table-row ${isEditing ? 'table-row-editing' : ''}">
                  <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
                  <td>
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${Utils.escapeHtml(sub.name)}</div>
                  </td>
                  <td>
                    <strong style="color: var(--primary); font-size: 1rem;">${sub.gradePoint.toFixed(1)}</strong>
                  </td>
                  <td>
                    <span style="font-weight: 600; color: var(--text-secondary); font-size: 0.95rem;">${sub.credits}</span>
                  </td>
                  <td>
                    <strong style="color: var(--accent-cyan); font-size: 1rem;">${creditPts}</strong>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="CgpaCalculator.startEditCGPASubject(${sub.id})" title="Edit ${Utils.escapeHtml(sub.name)}" aria-label="Edit subject">
                      <i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i>
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="CgpaCalculator.deleteCGPASubject(${sub.id})" title="Delete ${Utils.escapeHtml(sub.name)}" aria-label="Delete subject">
                      <i class="fa-solid fa-trash-can" style="color: var(--danger);"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  /**
   * Update CGPA Results Display and Result Cards
   */
  const updateCGPAResults = () => {
    const resultsContainer = document.getElementById('cgpa-results');
    if (!resultsContainer) return;

    if (cgpaSubjects.length === 0) {
      resultsContainer.style.display = 'none';
      return;
    }

    resultsContainer.style.display = 'block';

    const result = calculateCGPA();

    const elCgpa = document.getElementById('cgpa-value');
    const elCredits = document.getElementById('total-credits');
    const elSubjects = document.getElementById('total-cgpa-subjects');
    const elCreditPoints = document.getElementById('total-credit-points');
    const elStatus = document.getElementById('status-text');
    const elPerfMsg = document.getElementById('performance-message');

    if (elCgpa) elCgpa.textContent = result.cgpa.toFixed(2);
    if (elCredits) elCredits.textContent = result.totalCredits;
    if (elSubjects) elSubjects.textContent = result.totalSubjects;
    if (elCreditPoints) elCreditPoints.textContent = result.totalCreditPoints.toFixed(2);

    if (elStatus) {
      elStatus.textContent = result.status;
      elStatus.className = `stat-value badge badge-${result.statusColor}`;
      elStatus.style.fontSize = '1.05rem';
      elStatus.style.padding = '0.35rem 0.8rem';
    }

    if (elPerfMsg) elPerfMsg.textContent = result.performanceMessage;
  };

  /**
   * Download Results as CSV (Requirement 14)
   * Valid CSV with headers, proper escaping, and summary rows.
   */
  const downloadCGPAResultCsv = () => {
    if (cgpaSubjects.length === 0) {
      Utils.showToast('No subjects available to export as CSV.', 'warning');
      return;
    }

    const result = calculateCGPA();
    let csv = 'Subject Name,Grade Point,Credits,Credit Points\r\n';

    cgpaSubjects.forEach(sub => {
      const escapedName = `"${sub.name.replace(/"/g, '""')}"`;
      const creditPts = (sub.gradePoint * sub.credits).toFixed(2);
      csv += `${escapedName},${sub.gradePoint.toFixed(1)},${sub.credits},${creditPts}\r\n`;
    });

    csv += `\r\n"Total",,"${result.totalCredits}","${result.totalCreditPoints.toFixed(2)}"\r\n`;
    csv += `"Calculated CGPA/TGPA","${result.cgpa.toFixed(2)}",,\r\n`;
    csv += `"Academic Standing","${result.status}",,\r\n`;
    csv += `"Formula","CGPA/TGPA = SUM(gradePoint * credits) / SUM(credits)",,\r\n`;
    csv += `"Export Date","${new Date().toLocaleString()}",,\r\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GradePilot_CGPA_Results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    Utils.showToast('CGPA CSV results downloaded successfully!', 'success');
  };

  /**
   * Download Results as PDF via jsPDF (Requirement 15)
   * Includes Subject Name, Grade Point, Credits, Credit Points, Total Credits, Calculated CGPA/TGPA, Export Date.
   */
  const downloadCGPAResultPdf = () => {
    if (cgpaSubjects.length === 0) {
      Utils.showToast('No subjects available to generate PDF.', 'warning');
      return;
    }

    try {
      const { jsPDF } = window.jspdf || window;
      if (!jsPDF) {
        Utils.showToast('PDF library not ready. Please try downloading CSV.', 'error');
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const result = calculateCGPA();
      const exportDate = new Date().toLocaleString();

      // Top Header Banner
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 36, 'F');

      // Accent gradient line
      doc.setFillColor(99, 102, 241); // Indigo-500
      doc.rect(0, 36, 210, 2, 'F');

      // Brand Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('GradePilot AI', 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text('ACADEMIC CGPA / TGPA PERFORMANCE TRANSCRIPT', 14, 23);
      doc.text(`Export Date: ${exportDate}`, 14, 29);

      // Academic Status badge on top right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(6, 182, 212); // Cyan
      doc.text(`Status: ${result.status}`, 196, 23, { align: 'right' });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('Formula: CGPA = Σ(GP × Credits) ÷ Σ(Credits)', 196, 29, { align: 'right' });

      // Summary Metric Boxes
      const startY = 46;
      const boxWidth = 43;
      const boxHeight = 22;
      const metrics = [
        { label: 'CGPA / TGPA', value: result.cgpa.toFixed(2), color: [99, 102, 241] },
        { label: 'TOTAL CREDITS', value: String(result.totalCredits), color: [16, 185, 129] },
        { label: 'TOTAL SUBJECTS', value: String(result.totalSubjects), color: [245, 158, 11] },
        { label: 'TOTAL CREDIT PTS', value: result.totalCreditPoints.toFixed(2), color: [168, 85, 247] }
      ];

      metrics.forEach((m, i) => {
        const x = 14 + (i * (boxWidth + 6));
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label, x + 4, startY + 7);

        doc.setFontSize(13);
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(m.value, x + 4, startY + 17);
      });

      // Subject Details Table
      let tableY = 78;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Coursework Breakdown', 14, tableY);

      tableY += 4;
      // Table Header Row
      doc.setFillColor(241, 245, 249);
      doc.rect(14, tableY, 182, 8, 'F');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      doc.text('#', 17, tableY + 5.5);
      doc.text('Subject Name', 27, tableY + 5.5);
      doc.text('Grade Point (GP)', 110, tableY + 5.5, { align: 'right' });
      doc.text('Credits', 145, tableY + 5.5, { align: 'right' });
      doc.text('Credit Points (GP × Credits)', 192, tableY + 5.5, { align: 'right' });

      tableY += 8;
      doc.setFont('helvetica', 'normal');

      cgpaSubjects.forEach((sub, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, tableY, 182, 7.5, 'F');
        }

        doc.setTextColor(100, 116, 139);
        doc.text(String(idx + 1), 17, tableY + 5);

        doc.setTextColor(15, 23, 42);
        const subName = sub.name.length > 45 ? sub.name.substring(0, 42) + '...' : sub.name;
        doc.text(subName, 27, tableY + 5);

        doc.text(sub.gradePoint.toFixed(1), 110, tableY + 5, { align: 'right' });
        doc.text(String(sub.credits), 145, tableY + 5, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 102, 241);
        doc.text((sub.gradePoint * sub.credits).toFixed(2), 192, tableY + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        tableY += 7.5;

        // Page overflow check
        if (tableY > 265) {
          doc.addPage();
          tableY = 20;
        }
      });

      // Total Summary Row
      doc.setDrawColor(203, 213, 225);
      doc.line(14, tableY, 196, tableY);
      tableY += 1;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, tableY, 182, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Total / Overall', 27, tableY + 5.5);
      doc.text('-', 110, tableY + 5.5, { align: 'right' });
      doc.text(String(result.totalCredits), 145, tableY + 5.5, { align: 'right' });
      doc.setTextColor(16, 185, 129);
      doc.text(result.totalCreditPoints.toFixed(2), 192, tableY + 5.5, { align: 'right' });

      // Performance Narrative Box
      tableY += 15;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, tableY, 182, 18, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Performance Evaluation:', 18, tableY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(result.performanceMessage, 18, tableY + 12);

      // Footer
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('GradePilot AI — Academic Calculator Suite. Grading rules vary across academic institutions.', 105, 287, { align: 'center' });

      doc.save(`GradePilot_CGPA_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      Utils.showToast('CGPA PDF report generated and downloaded!', 'success');
    } catch (err) {
      console.error('PDF generation error:', err);
      Utils.showToast('Failed to generate PDF. Please try again.', 'error');
    }
  };

  /**
   * Save State in LocalStorage
   */
  const saveState = () => {
    Storage.set(STORAGE_KEY_CGPA, cgpaSubjects);
  };

  /**
   * Synchronize with Dashboard
   */
  const syncWithDashboard = () => {
    if (typeof Dashboard !== 'undefined') {
      if (Dashboard.renderMetrics) Dashboard.renderMetrics();
      if (Dashboard.renderHistory) Dashboard.renderHistory();
      if (Dashboard.initGpaChart) Dashboard.initGpaChart();
    }
  };

  /**
   * Bind DOM Events
   */
  const bindEvents = () => {
    const addBtn = document.getElementById('btn-add-cgpa-subject');
    if (addBtn) addBtn.addEventListener('click', addOrUpdateCGPASubject);

    const submitBtn = document.getElementById('btn-submit-cgpa');
    if (submitBtn) submitBtn.addEventListener('click', addOrUpdateCGPASubject);

    const cancelBtn = document.getElementById('btn-cancel-cgpa-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    const clearBtn = document.getElementById('btn-clear-cgpa-subjects');
    if (clearBtn) clearBtn.addEventListener('click', clearAllCGPASubjects);

    const importBtn = document.getElementById('btn-import-grade-calc');
    if (importBtn) importBtn.addEventListener('click', importFromGradeCalculator);

    const resetBtn = document.getElementById('btn-reset-cgpa');
    if (resetBtn) resetBtn.addEventListener('click', resetCGPA);

    const downloadCsvBtn = document.getElementById('btn-download-csv');
    if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadCGPAResultCsv);

    const downloadPdfBtn = document.getElementById('btn-download-pdf');
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', downloadCGPAResultPdf);

    // Keyboard enter support on form inputs
    ['cgpa-subject-name', 'cgpa-grade-point', 'cgpa-credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addOrUpdateCGPASubject();
          }
        });
        el.addEventListener('input', clearError);
      }
    });
  };

  return {
    init,
    setGradePoint,
    setCredits,
    addOrUpdateCGPASubject,
    startEditCGPASubject,
    cancelEdit,
    deleteCGPASubject,
    clearAllCGPASubjects,
    importFromGradeCalculator,
    resetCGPA,
    calculateCGPA,
    downloadCGPAResultCsv,
    downloadCGPAResultPdf
  };
})();
