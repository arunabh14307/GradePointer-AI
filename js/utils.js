/**
 * GradePilot AI - General Utility Helpers
 * Formats, notifications, validations, grade scales, and PDF generation.
 */

const Utils = (() => {
  // Common Grading Scales
  const GRADING_SCALES = {
    '4.0': [
      { grade: 'A+', min: 97, max: 100, points: 4.0 },
      { grade: 'A',  min: 93, max: 96.99, points: 4.0 },
      { grade: 'A-', min: 90, max: 92.99, points: 3.7 },
      { grade: 'B+', min: 87, max: 89.99, points: 3.3 },
      { grade: 'B',  min: 83, max: 86.99, points: 3.0 },
      { grade: 'B-', min: 80, max: 82.99, points: 2.7 },
      { grade: 'C+', min: 77, max: 79.99, points: 2.3 },
      { grade: 'C',  min: 73, max: 76.99, points: 2.0 },
      { grade: 'C-', min: 70, max: 72.99, points: 1.7 },
      { grade: 'D+', min: 67, max: 69.99, points: 1.3 },
      { grade: 'D',  min: 63, max: 66.99, points: 1.0 },
      { grade: 'D-', min: 60, max: 62.99, points: 0.7 },
      { grade: 'F',  min: 0,  max: 59.99, points: 0.0 }
    ],
    '10.0': [
      { grade: 'O',  min: 90, max: 100, points: 10.0, label: 'Outstanding' },
      { grade: 'A+', min: 80, max: 89.99, points: 9.0, label: 'Excellent' },
      { grade: 'A',  min: 70, max: 79.99, points: 8.0, label: 'Very Good' },
      { grade: 'B+', min: 60, max: 69.99, points: 7.0, label: 'Good' },
      { grade: 'B',  min: 55, max: 59.99, points: 6.0, label: 'Above Average' },
      { grade: 'C',  min: 50, max: 54.99, points: 5.0, label: 'Average' },
      { grade: 'P',  min: 40, max: 49.99, points: 4.0, label: 'Pass' },
      { grade: 'F',  min: 0,  max: 39.99, points: 0.0, label: 'Fail' }
    ]
  };

  /**
   * Convert percentage score to letter grade and grade points
   */
  const scoreToGrade = (score, scale = '4.0') => {
    const list = GRADING_SCALES[scale] || GRADING_SCALES['4.0'];
    const num = parseFloat(score);
    if (isNaN(num)) return { grade: 'N/A', points: 0.0 };

    for (const item of list) {
      if (num >= item.min) {
        return item;
      }
    }
    return list[list.length - 1];
  };

  /**
   * Convert grade letter to grade points based on scale
   */
  const gradeToPoints = (gradeLetter, scale = '4.0') => {
    const list = GRADING_SCALES[scale] || GRADING_SCALES['4.0'];
    const found = list.find(item => item.grade.toUpperCase() === String(gradeLetter).toUpperCase().trim());
    return found ? found.points : 0.0;
  };

  /**
   * Safe Number Formatter
   */
  const formatNumber = (val, decimals = 2) => {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  /**
   * Toast Notification System
   * @param {string} message - Message text
   * @param {'success'|'error'|'warning'|'info'} type - Toast type
   * @param {number} duration - Display time in ms
   */
  const showToast = (message, type = 'info', duration = 3500) => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close-btn" aria-label="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeIn 0.2s ease reverse forwards';
        setTimeout(() => toast.remove(), 200);
      }
    }, duration);
  };

  /**
   * Escape HTML to prevent XSS
   */
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  /**
   * Simple Markdown parser for AI responses (headers, bold, lists, quotes)
   */
  const renderMarkdown = (text) => {
    if (!text) return '';
    let parsed = escapeHtml(text);

    // Bold: **text**
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Headers: ###, ##, #
    parsed = parsed.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    parsed = parsed.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    parsed = parsed.replace(/^# (.*$)/gim, '<h2>$1</h2>');
    // Blockquotes: > quote
    parsed = parsed.replace(/^\> (.*$)/gim, '<div class="ai-tip-box">$1</div>');
    // Unordered lists: - item or * item
    parsed = parsed.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    // Ordered lists: 1. item
    parsed = parsed.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li>$2</li>');
    
    // Wrap lists with <ul>
    parsed = parsed.replace(/(<li>.*?<\/li>)/gs, (match) => {
      return `<ul>${match}</ul>`;
    });
    // Remove adjacent <ul></ul> joins
    parsed = parsed.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraph line breaks
    parsed = parsed.replace(/\n\n+/g, '</p><p>');
    parsed = `<p>${parsed}</p>`;
    parsed = parsed.replace(/<p>\s*<\/p>/g, '');
    return parsed;
  };

  /**
   * Generic CSV Exporter
   * @param {string} filename - Target filename e.g. "records.csv"
   * @param {string[]} headers - Array of column titles
   * @param {Array<Array|Object>} rows - Array of rows
   */
  const exportCsv = (filename, headers, rows) => {
    try {
      if (!Array.isArray(headers) || headers.length === 0) {
        showToast('CSV export requires column headers.', 'warning');
        return;
      }

      const escapeCsvCell = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const csvLines = [];
      csvLines.push(headers.map(escapeCsvCell).join(','));

      (rows || []).forEach(row => {
        if (Array.isArray(row)) {
          csvLines.push(row.map(escapeCsvCell).join(','));
        } else if (typeof row === 'object' && row !== null) {
          csvLines.push(headers.map(h => escapeCsvCell(row[h] !== undefined ? row[h] : '')).join(','));
        }
      });

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported "${filename}" successfully.`, 'success');
    } catch (e) {
      console.error('CSV export error:', e);
      showToast('Failed to export CSV file.', 'error');
    }
  };

  /**
   * Export Subjects CSV
   */
  const exportSubjectsCsv = (subjects, filename = 'gradepilot-subjects.csv') => {
    const headers = ['Subject Name', 'Marks Obtained', 'Max Marks', 'Credits', 'Grade', 'Grade Point', 'Weighted Points'];
    const rows = (subjects || []).map(s => [
      s.name || 'Untitled Subject',
      s.marks !== undefined ? s.marks : 'N/A',
      s.maxMarks !== undefined ? s.maxMarks : 'N/A',
      s.credits || 3,
      s.grade || 'N/A',
      s.gradePoint !== undefined ? s.gradePoint : (s.point !== undefined ? s.point : 0),
      s.weightedPoints !== undefined ? s.weightedPoints : ((s.gradePoint || s.point || 0) * (s.credits || 3))
    ]);
    exportCsv(filename, headers, rows);
  };

  /**
   * Export Semester Records CSV
   */
  const exportSemestersCsv = (semesters, filename = 'gradepilot-semesters.csv') => {
    const headers = ['Semester ID', 'Semester Name', 'SGPA / GPA', 'Total Credits', 'Courses Count'];
    const rows = (semesters || []).map((s, idx) => [
      s.id || `sem_${idx + 1}`,
      s.name || `Semester ${idx + 1}`,
      formatNumber(s.gpa || 0, 2),
      s.credits || (s.courses ? s.courses.reduce((acc, c) => acc + (parseFloat(c.credits) || 0), 0) : 0),
      s.courses ? s.courses.length : 0
    ]);
    exportCsv(filename, headers, rows);
  };

  /**
   * Generic PDF Exporter using jsPDF
   * Generates a clean, professional, branded academic document.
   */
  const exportToPdf = (title, subtitle, lines = [], filename = 'gradepilot-report.pdf') => {
    try {
      const { jsPDF } = window.jspdf || window;
      if (!jsPDF) {
        showToast('PDF generator library not available.', 'error');
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
      doc.text(String(subtitle || 'ACADEMIC PERFORMANCE REPORT').toUpperCase(), 14, 23);
      doc.text(`Export Date: ${exportDate}`, 14, 29);

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text(title || 'Academic Evaluation', 14, 46);

      let currentY = 54;
      const maxY = 280;

      (lines || []).forEach(lineItem => {
        if (currentY > maxY) {
          doc.addPage();
          currentY = 20;
        }

        const isHeading = typeof lineItem === 'object' && lineItem.isHeading;
        const textStr = typeof lineItem === 'object' ? lineItem.text : String(lineItem);

        if (isHeading) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229); // Primary Indigo
          currentY += 3;
          doc.text(textStr, 14, currentY);
          currentY += 5;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          // Auto-wrap lines exceeding width
          const splitLines = doc.splitTextToSize(textStr, 182);
          splitLines.forEach(l => {
            if (currentY > maxY) {
              doc.addPage();
              currentY = 20;
            }
            doc.text(l, 14, currentY);
            currentY += 4.5;
          });
        }
      });

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Generated by GradePilot AI • Standardized Academic Productivity Suite', 105, 290, { align: 'center' });

      doc.save(filename);
      showToast('PDF downloaded successfully!', 'success');
    } catch (e) {
      console.error('PDF generation error:', e);
      showToast('Failed to generate PDF. Check browser permissions.', 'error');
    }
  };

  /**
   * Export Grade Results PDF
   */
  const exportGradePdf = (subjects, summary = {}, filename = 'gradepilot-grade-results.pdf') => {
    const lines = [
      { text: 'COURSEWORK GRADE BREAKDOWN REPORT', isHeading: true },
      { text: `Total Coursework Subjects: ${subjects.length}` },
      { text: `Weighted Quality Points: ${summary.totalPoints || 0}` },
      { text: `Total Coursework Credits: ${summary.totalCredits || 0}` },
      { text: `Calculated SGPA / Grade Point: ${summary.gpa || '0.00'}` },
      { text: ' ' },
      { text: 'INDIVIDUAL SUBJECT BREAKDOWN:', isHeading: true }
    ];

    (subjects || []).forEach((s, idx) => {
      const gp = s.gradePoint !== undefined ? s.gradePoint : (s.point || 0);
      lines.push({
        text: `${idx + 1}. ${s.name} | Credits: ${s.credits} | Marks: ${s.marks}/${s.maxMarks} | Grade: ${s.grade} (GP: ${gp})`
      });
    });

    exportToPdf('Course Grade Results', 'Grade Calculator Official Summary', lines, filename);
  };

  /**
   * Export CGPA / TGPA Results PDF
   */
  const exportCgpaPdf = (subjects, summary = {}, filename = 'gradepilot-cgpa-results.pdf') => {
    const lines = [
      { text: 'CUMULATIVE GRADE POINT AVERAGE (CGPA) REPORT', isHeading: true },
      { text: `Cumulative CGPA: ${summary.cgpa || '0.00'}` },
      { text: `Academic Standing: ${summary.status || 'Good Standing'}` },
      { text: `Total Evaluated Credits: ${summary.totalCredits || 0}` },
      { text: `Total Quality Points: ${summary.totalCreditPoints || 0}` },
      { text: `Total Subjects Enrolled: ${subjects.length}` },
      { text: ' ' },
      { text: 'ENROLLED SUBJECTS & CREDIT WEIGHTINGS:', isHeading: true }
    ];

    (subjects || []).forEach((s, idx) => {
      const gp = s.gradePoint !== undefined ? s.gradePoint : 0;
      const pts = s.creditPoints !== undefined ? s.creditPoints : (gp * (s.credits || 0));
      lines.push({
        text: `${idx + 1}. ${s.name} | Credits: ${s.credits} | GP: ${gp.toFixed(1)} | Quality Points: ${pts.toFixed(1)}`
      });
    });

    exportToPdf('CGPA & TGPA Academic Evaluation', 'Official Cumulative Grade Breakdown', lines, filename);
  };

  /**
   * Export Academic Performance Summary PDF (Dashboard)
   */
  const exportPerformanceSummaryPdf = (metrics, subjects, semesters, filename = 'gradepilot-performance-summary.pdf') => {
    const lines = [
      { text: 'ACADEMIC PERFORMANCE SUMMARY REPORT', isHeading: true },
      { text: `Student Name: ${metrics.name || 'Student'}` },
      { text: `Major / Degree: ${metrics.major || 'Undergraduate'}` },
      { text: `Institution: ${metrics.institution || 'University'}` },
      { text: `Current CGPA: ${metrics.currentCgpa || '0.00'}` },
      { text: `Target CGPA: ${metrics.targetCgpa || 'Not Set'}` },
      { text: `Total Credits Completed: ${metrics.totalCredits || 0}` },
      { text: `Total Subjects Tracked: ${metrics.totalSubjects || 0}` },
      { text: `Academic Standing: ${metrics.standing || 'Good Standing'}` },
      { text: ' ' },
      { text: 'SEMESTER-WISE PROGRESSION SUMMARY:', isHeading: true }
    ];

    if (semesters && semesters.length > 0) {
      semesters.forEach((sem, idx) => {
        lines.push({
          text: `• ${sem.name || `Semester ${idx + 1}`}: SGPA ${formatNumber(sem.gpa || 0, 2)} (${sem.credits || 0} Credits)`
        });
      });
    } else {
      lines.push({ text: '• No historical semester records recorded yet.' });
    }

    lines.push({ text: ' ' });
    lines.push({ text: 'ACTIVE SUBJECT PERFORMANCE RECORD:', isHeading: true });

    if (subjects && subjects.length > 0) {
      subjects.forEach((s, idx) => {
        const gp = s.gradePoint !== undefined ? s.gradePoint : (s.point || 0);
        lines.push({
          text: `• ${s.name} - ${s.credits || 3} Credits | GP: ${gp} | Grade: ${s.grade || 'N/A'}`
        });
      });
    } else {
      lines.push({ text: '• No active course subjects recorded.' });
    }

    exportToPdf('Academic Performance Summary', 'Executive Dashboard Evaluation', lines, filename);
  };

  /**
   * Export Study Plan PDF
   */
  const exportStudyPlanPdf = (plan, filename = 'gradepilot-weekly-study-plan.pdf') => {
    if (!plan || !plan.days) {
      showToast('No active study plan to export.', 'warning');
      return;
    }

    const lines = [
      { text: 'WEEKLY HIGH-YIELD STUDY PLAN', isHeading: true }
    ];

    if (plan.weeklySummary) {
      lines.push({ text: `Total Weekly Hours: ${plan.weeklySummary.totalWeeklyHours || 0} hrs` });
      lines.push({ text: `Active Study Days: ${plan.weeklySummary.activeStudyDays || 0} days` });
      lines.push({ text: `Daily Availability: ${plan.weeklySummary.dailyHoursBudget || 0} hrs/day` });
      lines.push({ text: ' ' });
    }

    (plan.days || []).forEach(day => {
      lines.push({ text: `${day.dayName.toUpperCase()} (${day.isStudyDay ? `${day.totalStudyHours} hrs` : 'Rest Day'}):`, isHeading: true });
      if (day.isStudyDay && Array.isArray(day.blocks)) {
        day.blocks.forEach(b => {
          lines.push({
            text: `  [${b.type}] ${b.subject}: ${b.title} (${b.durationMinutes} min)`
          });
        });
      } else {
        lines.push({ text: '  Scheduled Rest & Recovery Day.' });
      }
      lines.push({ text: ' ' });
    });

    if (plan.weeklyReview && Array.isArray(plan.weeklyReview.tasks)) {
      lines.push({ text: 'WEEKLY REVIEW & RETROSPECTIVE:', isHeading: true });
      plan.weeklyReview.tasks.forEach(t => {
        const text = typeof t === 'string' ? t : (t.text || t.title || '');
        lines.push({ text: `  • ${text}` });
      });
    }

    exportToPdf('Personalized Weekly Study Schedule', 'GradePilot AI Study Planner', lines, filename);
  };

  /**
   * Get sanitized backend URL with trailing slashes removed
   */
  const getBackendUrl = () => {
    try {
      const settings = (window.AppStorage && AppStorage.getSettings) ? AppStorage.getSettings() : {};
      let url = (settings.backendUrl || 'https://grade-pointer-ai-backend.vercel.app').trim();
      return url.replace(/\/+$/, '');
    } catch (e) {
      return 'https://grade-pointer-ai-backend.vercel.app';
    }
  };

  return {
    GRADING_SCALES,
    scoreToGrade,
    gradeToPoints,
    formatNumber,
    showToast,
    escapeHtml,
    renderMarkdown,
    exportToPdf,
    exportCsv,
    exportSubjectsCsv,
    exportSemestersCsv,
    exportGradePdf,
    exportCgpaPdf,
    exportPerformanceSummaryPdf,
    exportStudyPlanPdf,
    getBackendUrl
  };
})();

