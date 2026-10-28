/**
 * GradePilot AI - Dashboard Controller (Phase 11)
 * Displays actual available student records, calculates authoritative metrics,
 * renders Chart.js semester trends (with empty state for zero records),
 * aggregates subject performance summaries, and coordinates CSV & PDF exports.
 * 
 * RULE: Never invent academic data.
 */

const Dashboard = (() => {
  const Storage = window.AppStorage || AppStorage;
  let gpaChartInstance = null;

  const init = () => {
    renderMetrics();
    initGpaChart();
    renderSubjectSummary();
    renderHistory();
    bindEvents();
  };

  /**
   * Aggregate active subjects from all calculator storages
   */
  const getAggregatedSubjects = () => {
    const list = [];
    const seenNames = new Set();

    // 1. CGPA Calculator subjects
    const cgpaSubjects = Storage.get(Storage.KEYS.CGPA_SUBJECTS, []);
    if (Array.isArray(cgpaSubjects)) {
      cgpaSubjects.forEach(s => {
        const name = (s.name || '').trim();
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const gp = parseFloat(s.gradePoint !== undefined ? s.gradePoint : s.point) || 0;
          const cred = parseFloat(s.credits) || 3;
          list.push({
            id: s.id || `cgpa_${name}`,
            name: name,
            credits: cred,
            gradePoint: gp,
            grade: s.grade || (gp >= 10 ? 'O' : gp >= 9 ? 'A+' : gp >= 8 ? 'A' : gp >= 7 ? 'B+' : gp >= 6 ? 'B' : gp >= 5 ? 'C' : gp >= 4 ? 'P' : 'F'),
            creditPoints: gp * cred,
            source: 'CGPA Calculator'
          });
        }
      });
    }

    // 2. Grade Calculator subjects
    const gradeSubjects = Storage.get(Storage.KEYS.GRADE_SUBJECTS, []);
    if (Array.isArray(gradeSubjects)) {
      gradeSubjects.forEach(s => {
        const name = (s.name || '').trim();
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const gp = parseFloat(s.gradePoint !== undefined ? s.gradePoint : s.point) || 0;
          const cred = parseFloat(s.credits) || 3;
          list.push({
            id: s.id || `grade_${name}`,
            name: name,
            credits: cred,
            marks: s.marks,
            maxMarks: s.maxMarks,
            gradePoint: gp,
            grade: s.grade || 'N/A',
            creditPoints: gp * cred,
            source: 'Grade Calculator'
          });
        }
      });
    }

    return list;
  };

  /**
   * Render Top Metric Summary Cards using ACTUAL available data
   */
  const renderMetrics = () => {
    const profile = Storage.getProfile ? Storage.getProfile() : {};
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const subjects = getAggregatedSubjects();
    const semesters = Storage.getSemesters ? Storage.getSemesters() : [];

    let totalCredits = 0;
    let totalPoints = 0;

    // 1. Calculate from active subjects if present
    if (subjects.length > 0) {
      subjects.forEach(s => {
        const c = parseFloat(s.credits) || 0;
        const pts = (parseFloat(s.gradePoint) || 0) * c;
        totalCredits += c;
        totalPoints += pts;
      });
    } else if (semesters.length > 0) {
      // Or from semesters
      semesters.forEach(sem => {
        if (Array.isArray(sem.courses) && sem.courses.length > 0) {
          sem.courses.forEach(c => {
            const cr = parseFloat(c.credits) || 0;
            const pts = (parseFloat(c.points) || 0) * cr;
            totalCredits += cr;
            totalPoints += pts;
          });
        } else if (sem.gpa && sem.credits) {
          const cr = parseFloat(sem.credits) || 0;
          totalCredits += cr;
          totalPoints += (parseFloat(sem.gpa) || 0) * cr;
        }
      });
    }

    // Authoritative CGPA calculation
    let calculatedCgpa = 0;
    if (totalCredits > 0) {
      calculatedCgpa = Math.round((totalPoints / totalCredits) * 100) / 100;
    } else if (profile.currentCgpa !== undefined && profile.currentCgpa !== null && profile.currentCgpa !== '') {
      calculatedCgpa = parseFloat(profile.currentCgpa) || 0;
    }

    const totalSubjectsCount = subjects.length > 0 ? subjects.length : semesters.reduce((acc, sem) => acc + (sem.courses ? sem.courses.length : 0), 0);
    const displayedCredits = totalCredits > 0 ? totalCredits : (parseFloat(profile.completedCredits) || 0);

    // Update DOM Widgets
    const elCurrentCgpa = document.getElementById('dash-current-cgpa');
    const elTargetCgpa = document.getElementById('dash-target-cgpa');
    const elCredits = document.getElementById('dash-credits');
    const elSubjectsCount = document.getElementById('dash-subjects-count');

    if (elCurrentCgpa) {
      elCurrentCgpa.textContent = calculatedCgpa > 0 ? Utils.formatNumber(calculatedCgpa, 2) : '0.00';
    }

    if (elTargetCgpa) {
      if (profile.targetCgpa !== undefined && profile.targetCgpa !== null && String(profile.targetCgpa).trim() !== '') {
        elTargetCgpa.textContent = Utils.formatNumber(profile.targetCgpa, 2);
      } else {
        elTargetCgpa.textContent = 'Not Set';
      }
    }

    if (elCredits) {
      elCredits.textContent = displayedCredits > 0 ? displayedCredits : '0';
    }

    if (elSubjectsCount) {
      elSubjectsCount.textContent = totalSubjectsCount > 0 ? totalSubjectsCount : '0';
    }
  };

  /**
   * Chart.js Semester GPA Progression with strict empty state
   * (Do not invent academic data if no semester records exist)
   */
  const initGpaChart = () => {
    const canvas = document.getElementById('dash-gpa-chart');
    const emptyState = document.getElementById('dash-chart-empty-state');
    const chartActions = document.getElementById('dash-chart-actions');

    if (!canvas) return;

    const semesters = Storage.getSemesters ? Storage.getSemesters() : [];
    const hasMeaningfulData = Array.isArray(semesters) && semesters.length > 0 && semesters.some(s => parseFloat(s.gpa) > 0 || (Array.isArray(s.courses) && s.courses.length > 0));

    // Destroy existing instance if any
    if (gpaChartInstance) {
      gpaChartInstance.destroy();
      gpaChartInstance = null;
    }

    if (!hasMeaningfulData) {
      canvas.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (chartActions) chartActions.style.display = 'none';
      return;
    }

    // Show canvas & action bar
    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (chartActions) chartActions.style.display = 'block';

    if (!window.Chart) {
      console.warn('Chart.js library is not loaded.');
      return;
    }

    const labels = semesters.map((s, idx) => s.name || `Semester ${idx + 1}`);
    const dataPoints = semesters.map(s => {
      if (s.gpa !== undefined && s.gpa !== null) return parseFloat(s.gpa) || 0;
      if (Array.isArray(s.courses) && s.courses.length > 0) {
        let cr = 0, pts = 0;
        s.courses.forEach(c => {
          const cCred = parseFloat(c.credits) || 0;
          cr += cCred;
          pts += (parseFloat(c.points) || 0) * cCred;
        });
        return cr > 0 ? Math.round((pts / cr) * 100) / 100 : 0;
      }
      return 0;
    });

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const maxScale = settings.gradingScale === '4.0' ? 4.0 : 10.0;
    const minScale = settings.gradingScale === '4.0' ? 0.0 : 0.0;

    gpaChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Semester GPA (SGPA)',
          data: dataPoints,
          borderColor: '#6366F1',
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#06B6D4',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#38BDF8',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => `SGPA: ${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          y: {
            min: minScale,
            max: maxScale,
            grid: { color: gridColor },
            ticks: { color: textColor }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor }
          }
        }
      }
    });
  };

  /**
   * Render Subject Performance Summary Table
   */
  const renderSubjectSummary = () => {
    const listEl = document.getElementById('dash-subject-summary-list');
    if (!listEl) return;

    const subjects = getAggregatedSubjects();

    if (subjects.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
            <i class="fa-solid fa-list-check" style="font-size: 2rem; margin-bottom: 0.6rem; opacity: 0.45; display: block;"></i>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem;">No Subject Records Saved Yet</div>
            <p style="font-size: 0.825rem; margin-bottom: 0.75rem;">
              Calculate or add subjects in the Course Grade Calculator or CGPA Calculator to view performance metrics here.
            </p>
            <a href="#cgpa-calculator" class="btn btn-secondary btn-sm" data-navigate="cgpa-calculator">
              <i class="fa-solid fa-plus"></i> Add Course Subjects
            </a>
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = subjects.map(s => {
      const gp = parseFloat(s.gradePoint) || 0;
      const pts = parseFloat(s.creditPoints) || (gp * (s.credits || 0));

      let badgeClass = 'badge-primary';
      let standingLabel = 'Pass';

      if (gp >= 9.0) {
        badgeClass = 'badge-success';
        standingLabel = 'Distinction';
      } else if (gp >= 7.5) {
        badgeClass = 'badge-cyan';
        standingLabel = 'Very Good';
      } else if (gp >= 6.0) {
        badgeClass = 'badge-primary';
        standingLabel = 'Good';
      } else if (gp < 4.0) {
        badgeClass = 'badge-danger';
        standingLabel = 'Review Needed';
      }

      return `
        <tr>
          <td><strong>${Utils.escapeHtml(s.name)}</strong></td>
          <td>${s.credits} Credits</td>
          <td><strong>${s.grade}</strong> <span style="color: var(--text-muted);">(${gp.toFixed(1)})</span></td>
          <td><strong style="color: var(--accent-cyan);">${pts.toFixed(1)}</strong></td>
          <td><span class="badge badge-secondary" style="font-size: 0.72rem;">${Utils.escapeHtml(s.source)}</span></td>
          <td><span class="badge ${badgeClass}">${standingLabel}</span></td>
        </tr>
      `;
    }).join('');
  };

  /**
   * Render Recent Calculations History Table
   */
  const renderHistory = () => {
    const listEl = document.getElementById('dash-history-list');
    if (!listEl) return;

    const history = Storage.getHistory ? Storage.getHistory() : [];

    if (!history || history.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <i class="fa-solid fa-calculator" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.4;"></i>
            No calculations recorded yet. Use any calculator to see history here!
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = history.slice(0, 10).map(item => {
      const dateStr = item.timestamp
        ? new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      return `
        <tr>
          <td><strong>${Utils.escapeHtml(item.title || item.type || 'Calculation')}</strong></td>
          <td><span class="badge badge-primary">${Utils.escapeHtml(item.type || 'General')}</span></td>
          <td><strong style="color: var(--primary);">${Utils.escapeHtml(item.result || '-')}</strong></td>
          <td>${dateStr}</td>
          <td style="text-align: right;">
            <button class="btn btn-ghost btn-sm" onclick="Dashboard.deleteHistoryItem('${item.id}')" title="Delete record">
              <i class="fa-solid fa-trash-can" style="color: var(--danger);"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  /**
   * Delete specific history record
   */
  const deleteHistoryItem = (id) => {
    const history = (Storage.getHistory ? Storage.getHistory() : []).filter(h => h.id !== id);
    Storage.set(Storage.KEYS.HISTORY, history);
    renderHistory();
    Utils.showToast('Calculation record removed.', 'info');
  };

  /**
   * Export Dashboard Academic Performance Summary PDF
   */
  const exportSummaryPdf = () => {
    const profile = Storage.getProfile ? Storage.getProfile() : {};
    const subjects = getAggregatedSubjects();
    const semesters = Storage.getSemesters ? Storage.getSemesters() : [];

    const elCurrentCgpa = document.getElementById('dash-current-cgpa');
    const elTargetCgpa = document.getElementById('dash-target-cgpa');
    const elCredits = document.getElementById('dash-credits');

    const metrics = {
      name: profile.name || 'Student',
      major: profile.major || 'Undergraduate',
      institution: profile.institution || 'University',
      currentCgpa: elCurrentCgpa ? elCurrentCgpa.textContent : '0.00',
      targetCgpa: elTargetCgpa ? elTargetCgpa.textContent : 'Not Set',
      totalCredits: elCredits ? elCredits.textContent : '0',
      totalSubjects: subjects.length,
      standing: 'Active Student Record'
    };

    Utils.exportPerformanceSummaryPdf(metrics, subjects, semesters);
  };

  /**
   * Export Subjects CSV
   */
  const exportSubjectsCsv = () => {
    const subjects = getAggregatedSubjects();
    if (subjects.length === 0) {
      Utils.showToast('No subjects available to export.', 'info');
      return;
    }
    Utils.exportSubjectsCsv(subjects);
  };

  /**
   * Export Semesters CSV
   */
  const exportSemestersCsv = () => {
    const semesters = Storage.getSemesters ? Storage.getSemesters() : [];
    if (!semesters || semesters.length === 0) {
      Utils.showToast('No semester records available to export.', 'info');
      return;
    }
    Utils.exportSemestersCsv(semesters);
  };

  /**
   * Bind DOM Events
   */
  const bindEvents = () => {
    const clearHistBtn = document.getElementById('dash-clear-history-btn');
    if (clearHistBtn) {
      clearHistBtn.addEventListener('click', () => {
        if (confirm('Clear all calculation history?')) {
          Storage.clearHistory();
          renderHistory();
          Utils.showToast('Calculation history cleared.', 'info');
        }
      });
    }

    const exportPdfBtn = document.getElementById('dash-export-summary-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportSummaryPdf();
      });
    }

    const exportSubCsvBtn = document.getElementById('dash-export-subjects-csv-btn');
    if (exportSubCsvBtn) {
      exportSubCsvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportSubjectsCsv();
      });
    }

    const exportSemCsvBtn = document.getElementById('dash-export-semesters-csv-btn');
    if (exportSemCsvBtn) {
      exportSemCsvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportSemestersCsv();
      });
    }
  };

  return {
    init,
    renderMetrics,
    renderHistory,
    renderSubjectSummary,
    initGpaChart,
    deleteHistoryItem,
    exportSummaryPdf,
    exportSubjectsCsv,
    exportSemestersCsv
  };
})();

// Attach globally
window.Dashboard = Dashboard;
