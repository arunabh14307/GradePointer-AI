/**
 * GradePilot AI - AI Academic Advisor Controller
 * Submits student-supplied academic performance data to Flask / Gemini backend,
 * distinguishes calculated metrics from AI advice, and renders 5-part strategic reports.
 */

const AiAdvisor = (() => {
  const Storage = window.AppStorage || AppStorage;

  // Local state for dynamic subject rows
  let subjectsList = [
    { name: '', gradePoints: '', credits: '', marks: '' },
    { name: '', gradePoints: '', credits: '', marks: '' },
    { name: '', gradePoints: '', credits: '', marks: '' }
  ];

  let currentAnalysisText = '';
  let currentMetrics = null;

  const init = () => {
    bindEvents();
    populateDefaults();
    renderSubjectsTable();
  };

  const populateDefaults = () => {
    const profile = Storage.getProfile();
    const curCgpa = document.getElementById('adv-current-cgpa');
    const tgtCgpa = document.getElementById('adv-target-cgpa');
    const major = document.getElementById('adv-major');
    const hours = document.getElementById('adv-hours');

    if (curCgpa && !curCgpa.value && profile.currentCgpa) {
      curCgpa.value = profile.currentCgpa;
    }
    if (tgtCgpa && !tgtCgpa.value && profile.targetCgpa) {
      tgtCgpa.value = `${profile.targetCgpa} (Honors Target)`;
    }
    if (major && !major.value && profile.major) {
      major.value = profile.major;
    }
    if (hours && !hours.value) {
      hours.value = 18;
    }
  };

  /**
   * Render dynamic subjects input table
   */
  const renderSubjectsTable = () => {
    const tbody = document.getElementById('adv-subjects-body');
    if (!tbody) return;

    if (subjectsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No courses added yet. Click <strong>+ Add Course</strong> or <strong>Import from CGPA Calculator</strong>.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = subjectsList.map((s, idx) => `
      <tr data-index="${idx}">
        <td>
          <input type="text" class="form-control adv-input-name" placeholder="e.g. Data Structures" value="${Utils.escapeHtml(s.name)}" data-field="name" />
        </td>
        <td>
          <input type="number" class="form-control adv-input-gp" placeholder="e.g. 3.70" value="${s.gradePoints !== '' ? s.gradePoints : ''}" min="0" max="10" step="0.01" data-field="gradePoints" />
        </td>
        <td>
          <input type="number" class="form-control adv-input-cr" placeholder="e.g. 4.0" value="${s.credits !== '' ? s.credits : ''}" min="0.5" max="30" step="0.5" data-field="credits" />
        </td>
        <td>
          <input type="text" class="form-control adv-input-marks" placeholder="e.g. 88/100" value="${Utils.escapeHtml(s.marks || '')}" data-field="marks" />
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-ghost btn-sm adv-remove-row-btn" data-index="${idx}" title="Remove course" style="color: var(--danger);">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Attach row input listeners
    tbody.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        const idx = parseInt(row.getAttribute('data-index'), 10);
        const field = e.target.getAttribute('data-field');
        if (subjectsList[idx]) {
          subjectsList[idx][field] = e.target.value;
        }
      });
    });

    // Attach row remove buttons
    tbody.querySelectorAll('.adv-remove-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        removeSubjectRow(idx);
      });
    });
  };

  const addSubjectRow = (name = '', gradePoints = '', credits = '', marks = '') => {
    if (subjectsList.length >= 25) {
      Utils.showToast('Maximum 25 courses allowed in evaluation table.', 'warning');
      return;
    }
    subjectsList.push({ name, gradePoints, credits, marks });
    renderSubjectsTable();
  };

  const removeSubjectRow = (index) => {
    if (subjectsList.length <= 1) {
      subjectsList = [{ name: '', gradePoints: '', credits: '', marks: '' }];
    } else {
      subjectsList.splice(index, 1);
    }
    renderSubjectsTable();
  };

  /**
   * Import courses from active CGPA Calculator or storage
   */
  const importFromCgpaCalculator = () => {
    // 1. Try reading live rows from CGPA Calculator section if available
    const cgpaRows = document.querySelectorAll('#cgpa-subjects-container .course-row, #cgpa-subjects-container tr');
    let imported = [];

    if (cgpaRows && cgpaRows.length > 0) {
      cgpaRows.forEach(row => {
        const nameInput = row.querySelector('input[type="text"], .course-name-input');
        const crInput = row.querySelector('input[name="credit"], .course-credit-input');
        const gpInput = row.querySelector('input[name="gradePoint"], .course-gp-input');
        const gradeSelect = row.querySelector('select');

        const name = nameInput ? nameInput.value.trim() : '';
        const cr = crInput ? parseFloat(crInput.value) : '';
        let gp = gpInput ? parseFloat(gpInput.value) : '';

        if (!gp && gradeSelect && gradeSelect.value) {
          const val = parseFloat(gradeSelect.value);
          if (!isNaN(val)) gp = val;
        }

        if (name || cr || gp) {
          imported.push({
            name: name || `Imported Course ${imported.length + 1}`,
            gradePoints: gp !== '' && !isNaN(gp) ? gp : '',
            credits: cr !== '' && !isNaN(cr) ? cr : '',
            marks: ''
          });
        }
      });
    }

    // 2. Fallback to saved semesters in storage
    if (imported.length === 0) {
      const savedSemesters = Storage.getSemesters ? Storage.getSemesters() : [];
      if (savedSemesters.length > 0) {
        const latestSem = savedSemesters[savedSemesters.length - 1];
        if (latestSem.courses && latestSem.courses.length > 0) {
          imported = latestSem.courses.map(c => ({
            name: c.name || 'Course',
            gradePoints: c.gradePoint || c.points || '',
            credits: c.credits || '',
            marks: ''
          }));
        }
      }
    }

    if (imported.length > 0) {
      subjectsList = imported;
      renderSubjectsTable();
      Utils.showToast(`Imported ${imported.length} courses from CGPA Calculator!`, 'success');
    } else {
      Utils.showToast('No active courses found in CGPA Calculator. You can enter them directly below.', 'info');
    }
  };

  const resetForm = () => {
    document.getElementById('adv-form')?.reset();
    subjectsList = [
      { name: '', gradePoints: '', credits: '', marks: '' },
      { name: '', gradePoints: '', credits: '', marks: '' },
      { name: '', gradePoints: '', credits: '', marks: '' }
    ];
    renderSubjectsTable();
    populateDefaults();

    const outputContainer = document.getElementById('adv-output-container');
    const errorAlert = document.getElementById('adv-error-alert');
    const loadingState = document.getElementById('adv-loading-state');
    if (outputContainer) outputContainer.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';

    Utils.showToast('Academic advisor form reset.', 'info');
  };

  /**
   * Harvests only data actually supplied by the student
   */
  const collectStudentData = () => {
    const curGpaVal = document.getElementById('adv-current-cgpa')?.value.trim();
    const tgtGpaVal = document.getElementById('adv-target-cgpa')?.value.trim();
    const majorVal = document.getElementById('adv-major')?.value.trim();
    const hoursVal = document.getElementById('adv-hours')?.value.trim();
    const weakVal = document.getElementById('adv-weak-subjects')?.value.trim();
    const semVal = document.getElementById('adv-semester-records')?.value.trim();
    const notesVal = document.getElementById('adv-notes')?.value.trim();

    // Clean subjects list: keep only rows with at least name or numeric data
    const validSubjects = [];
    subjectsList.forEach((s, idx) => {
      const name = s.name.trim();
      const gp = s.gradePoints !== '' && !isNaN(parseFloat(s.gradePoints)) ? parseFloat(s.gradePoints) : null;
      const cr = s.credits !== '' && !isNaN(parseFloat(s.credits)) ? parseFloat(s.credits) : null;
      const marks = s.marks ? s.marks.trim() : '';

      if (name || gp !== null || cr !== null || marks) {
        validSubjects.push({
          name: name || `Subject #${idx + 1}`,
          gradePoints: gp,
          credits: cr,
          marks: marks
        });
      }
    });

    const currentCgpa = curGpaVal !== '' && !isNaN(parseFloat(curGpaVal)) ? parseFloat(curGpaVal) : null;
    const weeklyStudyHours = hoursVal !== '' && !isNaN(parseFloat(hoursVal)) ? parseFloat(hoursVal) : 15;

    const hasAnyData = bool(
      currentCgpa !== null ||
      tgtGpaVal !== '' ||
      validSubjects.length > 0 ||
      weakVal !== '' ||
      semVal !== '' ||
      notesVal !== ''
    );

    function bool(v) { return Boolean(v); }

    const payload = {
      currentCgpa,
      targetCgpa: !isNaN(parseFloat(tgtGpaVal)) ? parseFloat(tgtGpaVal) : null,
      academicGoals: tgtGpaVal || '',
      major: majorVal || 'General Studies',
      weeklyStudyHours,
      difficultSubjects: weakVal || '',
      semesterRecords: semVal || '',
      additionalNotes: notesVal || '',
      subjects: validSubjects
    };

    return { payload, hasAnyData };
  };

  /**
   * Performs client-side factual calculation of subject metrics
   */
  const computeClientMetrics = (subjects, currentCgpa, difficultSubjects) => {
    let totalCredits = 0;
    let weightedPoints = 0;
    const strong = [];
    const needs = [];

    subjects.forEach(s => {
      if (s.credits !== null && s.gradePoints !== null) {
        totalCredits += s.credits;
        weightedPoints += (s.credits * s.gradePoints);
      }
      if (s.gradePoints !== null) {
        if (s.gradePoints >= 3.5 || (s.gradePoints >= 8.5 && s.gradePoints > 4.0)) {
          strong.push(s.name);
        } else if (s.gradePoints < 3.0 || (s.gradePoints < 7.0 && s.gradePoints > 4.0)) {
          needs.push(s.name);
        }
      }
    });

    if (difficultSubjects) {
      difficultSubjects.split(',').map(d => d.trim()).forEach(d => {
        if (d && !needs.includes(d)) needs.push(d);
      });
    }

    const evaluatedGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : null;

    return {
      evaluatedCredits: totalCredits,
      evaluatedGpa,
      strongSubjects: strong,
      improvementSubjects: needs
    };
  };

  /**
   * Main Handler: Analyzes performance via Flask / Gemini backend
   */
  const handleGenerateAdvice = async (e) => {
    if (e) e.preventDefault();

    const { payload, hasAnyData } = collectStudentData();

    const outputContainer = document.getElementById('adv-output-container');
    const loadingState = document.getElementById('adv-loading-state');
    const errorAlert = document.getElementById('adv-error-alert');
    const errorTitle = document.getElementById('adv-error-title');
    const errorMessage = document.getElementById('adv-error-message');
    const submitBtn = document.getElementById('adv-submit-btn');

    if (errorAlert) errorAlert.style.display = 'none';

    // Validation: Require at least some student data
    if (!hasAnyData) {
      if (errorAlert && errorTitle && errorMessage) {
        errorTitle.textContent = 'Insufficient Academic Data';
        errorMessage.textContent = 'Please supply at least your Current CGPA, an academic goal, or one subject with grades/credits so GradePilot AI can analyze your performance.';
        errorAlert.style.display = 'block';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      Utils.showToast('Please enter your academic performance data first.', 'warning');
      return;
    }

    // Enter loading state
    if (loadingState) loadingState.style.display = 'block';
    if (outputContainer) outputContainer.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing Performance...';
    }

    const settings = Storage.getSettings();
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'https://grade-pointer-ai-backend.vercel.app';

    try {
      const response = await fetch(`${backendUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        currentAnalysisText = data.analysis || data.advice || '';
        currentMetrics = data.calculatedMetrics || computeClientMetrics(payload.subjects, payload.currentCgpa, payload.difficultSubjects);

        renderResults(currentAnalysisText, currentMetrics);

        if (outputContainer) {
          outputContainer.style.display = 'block';
          outputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        Utils.showToast('Academic performance analysis generated successfully!', 'success');
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errDescription = errJson.message || `Server returned error status ${response.status}`;
        throw new Error(errDescription);
      }
    } catch (err) {
      console.warn('AI Advisor API request failed:', err);
      if (errorAlert && errorTitle && errorMessage) {
        errorTitle.textContent = 'AI Advisor Service Unavailable';
        errorMessage.innerHTML = `
          <strong>${Utils.escapeHtml(err.message || 'Connection failure')}</strong><br />
          Ensure the Python Flask backend is running on <code>${Utils.escapeHtml(backendUrl)}</code> and that your Gemini API credentials are configured in <code>backend/.env</code>.
        `;
        errorAlert.style.display = 'block';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      Utils.showToast(err.message || 'Could not connect to AI advisor backend.', 'danger');
    } finally {
      if (loadingState) loadingState.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyze My Performance';
      }
    }
  };

  /**
   * Renders the calculated factual metrics & AI report into DOM
   */
  const renderResults = (analysisMarkdown, metrics) => {
    // 1. Render Factual Calculated Metrics
    const metricGpa = document.getElementById('adv-metric-gpa');
    const metricCredits = document.getElementById('adv-metric-credits');
    const strengthsCount = document.getElementById('adv-metric-strengths-count');
    const needsCount = document.getElementById('adv-metric-needs-count');
    const strengthsTags = document.getElementById('adv-strengths-tags');
    const needsTags = document.getElementById('adv-needs-tags');
    const completenessBadge = document.getElementById('adv-completeness-badge');
    const limitationsBox = document.getElementById('adv-limitations-box');
    const limitationsText = document.getElementById('adv-limitations-text');

    if (metricGpa) {
      metricGpa.textContent = metrics.evaluatedGpa ? metrics.evaluatedGpa : 'N/A';
    }
    if (metricCredits) {
      metricCredits.textContent = metrics.evaluatedCredits ? `${metrics.evaluatedCredits} cr` : '0 cr';
    }
    if (strengthsCount) {
      strengthsCount.textContent = metrics.strongSubjects ? metrics.strongSubjects.length : 0;
    }
    if (needsCount) {
      needsCount.textContent = metrics.improvementSubjects ? metrics.improvementSubjects.length : 0;
    }

    if (completenessBadge) {
      const comp = metrics.dataCompleteness || 'Comprehensive';
      completenessBadge.textContent = `Data: ${comp}`;
      completenessBadge.className = comp === 'Comprehensive' ? 'badge badge-success' : comp === 'Partial' ? 'badge badge-cyan' : 'badge badge-warning';
    }

    // Render strength tags
    if (strengthsTags) {
      if (metrics.strongSubjects && metrics.strongSubjects.length > 0) {
        strengthsTags.innerHTML = metrics.strongSubjects.map(s => `
          <span class="badge badge-success" style="font-size: 0.85rem;"><i class="fa-solid fa-check"></i> ${Utils.escapeHtml(s)}</span>
        `).join('');
      } else {
        strengthsTags.innerHTML = '<span class="badge badge-neutral" style="font-size: 0.8rem;">No high-scoring courses recorded yet</span>';
      }
    }

    // Render improvement tags
    if (needsTags) {
      if (metrics.improvementSubjects && metrics.improvementSubjects.length > 0) {
        needsTags.innerHTML = metrics.improvementSubjects.map(s => `
          <span class="badge badge-warning" style="font-size: 0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${Utils.escapeHtml(s)}</span>
        `).join('');
      } else {
        needsTags.innerHTML = '<span class="badge badge-neutral" style="font-size: 0.8rem;">No critical bottlenecks flagged</span>';
      }
    }

    // Render limitations notice if applicable
    if (limitationsBox && limitationsText) {
      if (metrics.limitations && metrics.limitations.length > 0) {
        limitationsText.textContent = metrics.limitations.join(' ');
        limitationsBox.style.display = 'block';
      } else {
        limitationsBox.style.display = 'none';
      }
    }

    // 2. Render Markdown content body (5 sections)
    const contentBody = document.getElementById('adv-content-body');
    if (contentBody) {
      contentBody.innerHTML = Utils.renderMarkdown(analysisMarkdown);
    }
  };

  /**
   * Copies the full report to clipboard
   */
  const copyAdvice = () => {
    if (!currentAnalysisText) {
      Utils.showToast('No report to copy.', 'info');
      return;
    }
    navigator.clipboard.writeText(currentAnalysisText).then(() => {
      Utils.showToast('Academic Advisory Report copied to clipboard!', 'success');
    }).catch(() => {
      Utils.showToast('Failed to copy to clipboard.', 'danger');
    });
  };

  /**
   * Exports academic report as a clean PDF
   */
  const exportPdf = () => {
    if (!currentAnalysisText) {
      Utils.showToast('Generate a report first before exporting PDF.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      window.print();
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const profile = Storage.getProfile();
    const studentName = profile.name || 'Student';
    const dateStr = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('GradePilot AI - Academic Performance Advisory Report', 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Student: ${studentName} | Major: ${profile.major || 'Undergraduate'} | Date: ${dateStr}`, 40, 68);

    doc.setDrawColor(226, 232, 240);
    doc.line(40, 78, 570, 78);

    // Strip markdown formatting characters for clean plain text PDF output
    const cleanText = currentAnalysisText
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/>/g, '  ');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    const splitText = doc.splitTextToSize(cleanText, 510);
    let y = 100;

    splitText.forEach(line => {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      doc.text(line, 40, y);
      y += 14;
    });

    // Disclaimer footer
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    y += 20;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Notice: This report is an AI-assisted self-study guide generated by GradePilot AI. It is not an official university evaluation.', 40, y);

    doc.save(`GradePilot-Academic-Advisory-${studentName.replace(/\s+/g, '_')}.pdf`);
    Utils.showToast('Academic Advisory PDF downloaded!', 'success');
  };

  const bindEvents = () => {
    const form = document.getElementById('adv-form');
    if (form) form.addEventListener('submit', handleGenerateAdvice);

    const addBtn = document.getElementById('adv-add-subject-btn');
    if (addBtn) addBtn.addEventListener('click', () => addSubjectRow());

    const importBtn = document.getElementById('adv-import-btn');
    if (importBtn) importBtn.addEventListener('click', importFromCgpaCalculator);

    const resetBtn = document.getElementById('adv-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetForm);

    const copyBtn = document.getElementById('adv-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyAdvice);

    const pdfBtn = document.getElementById('adv-pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPdf);
  };

  return {
    init,
    addSubjectRow,
    removeSubjectRow,
    importFromCgpaCalculator,
    handleGenerateAdvice,
    resetForm,
    exportPdf,
    copyAdvice
  };
})();
