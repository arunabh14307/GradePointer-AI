/**
 * GradePilot AI - Main Application Controller & Router
 * Manages SPA section transitions, theme toggling, backend status health checks,
 * mobile drawer, settings persistence, and global events.
 */

const App = (() => {
  const SECTIONS = [
    'home',
    'dashboard',
    'grade-calculator',
    'cgpa-calculator',
    'percentage-calculator',
    'ai-advisor',
    'cgpa-predictor',
    'study-planner',
    'ai-chat',
    'settings'
  ];

  const SECTION_TITLES = {
    'home': 'Home — AI Academic Platform',
    'dashboard': 'Academic Dashboard',
    'grade-calculator': 'Grade Calculator',
    'cgpa-calculator': 'CGPA & SGPA Calculator',
    'percentage-calculator': 'Percentage & Attendance Converter',
    'ai-advisor': 'AI Academic Advisor',
    'cgpa-predictor': 'AI CGPA Predictor',
    'study-planner': 'AI Study Planner',
    'ai-chat': 'AI Chat Assistant',
    'settings': 'Settings & Student Profile'
  };

  let heroPreviewChartInstance = null;

  const init = () => {
    applyTheme();
    setupNavigation();
    setupMobileDrawer();
    setupThemeToggle();
    setupSettingsForms();
    checkBackendHealth();

    // Initialize sub-controllers
    Dashboard.init();
    GradeCalculator.init();
    CgpaCalculator.init();
    PercentageCalculator.init();
    AiAdvisor.init();
    CgpaPredictor.init();
    StudyPlanner.init();
    AiChat.init();

    // Initialize Astra AI Interactive Showcase Features
    initHeroPreviewChart();
    initQuickHomeEstimator();
    setupScrollReveal();

    // Route to initial section from hash or default to home
    const initialHash = window.location.hash.replace('#', '') || 'home';
    navigateTo(initialHash, false);

    // Periodically re-check backend health every 60s
    setInterval(checkBackendHealth, 60000);
  };

  /**
   * Theme Manager (Dark / Light)
   */
  const applyTheme = (themeName = null) => {
    const savedLocal = localStorage.getItem('theme');
    const settings = AppStorage.getSettings();
    const currentTheme = themeName || savedLocal || settings.theme || 'dark';

    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);

    const toggleIcon = document.getElementById('theme-toggle-icon');
    if (toggleIcon) {
      if (currentTheme === 'light') {
        toggleIcon.className = 'fa-solid fa-moon';
      } else {
        toggleIcon.className = 'fa-solid fa-sun';
      }
    }

    // Refresh charts for correct color palette
    if (Dashboard && Dashboard.initGpaChart) {
      Dashboard.initGpaChart();
    }
    if (heroPreviewChartInstance || document.getElementById('hero-preview-chart')) {
      initHeroPreviewChart();
    }
  };

  const setupThemeToggle = () => {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'light' ? 'dark' : 'light';
      AppStorage.saveSettings({ theme: nextTheme });
      applyTheme(nextTheme);
      Utils.showToast(`Switched to ${nextTheme} mode`, 'info');
    });
  };

  /**
   * SPA Navigation Handler
   */
  const setupNavigation = () => {
    // Listen for link clicks
    document.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.getAttribute('data-navigate');
        navigateTo(target);
      });
    });

    // Listen for browser back/forward buttons
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'grade-calculator';
      navigateTo(hash, false);
    });
  };

  const navigateTo = (sectionId, updateHash = true) => {
    const validSection = SECTIONS.includes(sectionId) ? sectionId : 'grade-calculator';

    // Update section active classes
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`section-${validSection}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update active nav links in sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-navigate') === validSection) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update active state in top header and main calculator navigation tabs
    document.querySelectorAll('.calc-nav-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-navigate') === validSection) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update breadcrumb title
    const breadcrumb = document.getElementById('header-breadcrumb-title');
    if (breadcrumb) {
      breadcrumb.textContent = SECTION_TITLES[validSection] || 'Calculators';
    }

    if (updateHash) {
      window.location.hash = validSection;
    }

    // Close mobile drawer on navigation
    closeMobileDrawer();

    // Scroll to top of content smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  /**
   * Mobile Drawer Toggle
   */
  const setupMobileDrawer = () => {
    const menuBtn = document.getElementById('mobile-menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (backdrop) backdrop.classList.toggle('active');
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileDrawer);
    }
  };

  const closeMobileDrawer = () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  };

  /**
   * Backend Health Status Check
   */
  const checkBackendHealth = async () => {
    const settings = AppStorage.getSettings();
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'https://grade-pointer-ai-backend.vercel.app';
    const pill = document.getElementById('backend-status-pill');
    const pillText = document.getElementById('backend-status-text');

    if (!pill || !pillText) return;

    try {
      const res = await fetch(`${backendUrl}/api/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        pill.className = 'backend-status-pill online';
        const aiStatus = data.gemini_configured ? 'Gemini AI Active' : 'Backend Ready (No Key)';
        pillText.textContent = aiStatus;
        pill.title = 'Flask AI Backend is connected and running';
      } else {
        throw new Error('Non-200');
      }
    } catch (e) {
      pill.className = 'backend-status-pill offline';
      pillText.textContent = 'Local AI Engine';
      pill.title = 'Backend offline or not started. Calculators & built-in AI working in Local Mode.';
    }
  };

  /**
   * Settings & Profile Forms
   */
  const setupSettingsForms = () => {
    // Populate form fields
    const profile = AppStorage.getProfile();
    const settings = AppStorage.getSettings();

    const nameIn = document.getElementById('set-name');
    const majorIn = document.getElementById('set-major');
    const instIn = document.getElementById('set-institution');
    const curGpaIn = document.getElementById('set-cur-gpa');
    const tgtGpaIn = document.getElementById('set-tgt-gpa');
    const creditsIn = document.getElementById('set-credits');
    const scaleSelect = document.getElementById('set-grading-scale');
    const backendUrlIn = document.getElementById('set-backend-url');

    if (nameIn) nameIn.value = profile.name || '';
    if (majorIn) majorIn.value = profile.major || '';
    if (instIn) instIn.value = profile.institution || '';
    if (curGpaIn) curGpaIn.value = profile.currentCgpa || '3.65';
    if (tgtGpaIn) tgtGpaIn.value = profile.targetCgpa || '3.85';
    if (creditsIn) creditsIn.value = profile.completedCredits || '64';
    if (scaleSelect) scaleSelect.value = settings.gradingScale || '4.0';
    if (backendUrlIn) backendUrlIn.value = settings.backendUrl || 'https://grade-pointer-ai-backend.vercel.app';

    // Profile form submit
    const profileForm = document.getElementById('settings-profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        AppStorage.saveProfile({
          name: nameIn.value.trim(),
          major: majorIn.value.trim(),
          institution: instIn.value.trim(),
          currentCgpa: parseFloat(curGpaIn.value) || 3.5,
          targetCgpa: parseFloat(tgtGpaIn.value) || 3.8,
          completedCredits: parseFloat(creditsIn.value) || 60
        });

        // Update sidebar initials and name
        const sideName = document.querySelector('.profile-name');
        const sideInitials = document.querySelector('.avatar-initials');
        if (sideName) sideName.textContent = nameIn.value.trim() || 'Student';
        if (sideInitials) {
          const parts = (nameIn.value.trim() || 'Student').split(' ');
          sideInitials.textContent = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
        }

        Dashboard.renderMetrics();
        Utils.showToast('Profile updated successfully!', 'success');
      });
    }

    // Theme Mode Quick Buttons in Settings
    const darkBtn = document.getElementById('btn-theme-dark');
    const lightBtn = document.getElementById('btn-theme-light');
    if (darkBtn) {
      darkBtn.addEventListener('click', () => {
        applyTheme('dark');
        AppStorage.saveSettings({ theme: 'dark' });
        Utils.showToast('Dark mode enabled.', 'info');
      });
    }
    if (lightBtn) {
      lightBtn.addEventListener('click', () => {
        applyTheme('light');
        AppStorage.saveSettings({ theme: 'light' });
        Utils.showToast('Light mode enabled.', 'info');
      });
    }

    // Test Backend Connection Button
    const testBackendBtn = document.getElementById('btn-test-backend');
    if (testBackendBtn) {
      testBackendBtn.addEventListener('click', async () => {
        const url = (backendUrlIn ? backendUrlIn.value.trim() : '') || 'https://grade-pointer-ai-backend.vercel.app';
        testBackendBtn.disabled = true;
        testBackendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
        try {
          const res = await fetch(`${url}/api/health`, { method: 'GET' });
          if (res.ok) {
            const data = await res.json();
            Utils.showToast(`Backend online! (Gemini API: ${data.gemini_configured ? 'Configured' : 'Missing Key'})`, 'success');
          } else {
            Utils.showToast(`Backend responded with error status ${res.status}`, 'warning');
          }
        } catch (e) {
          Utils.showToast(`Unable to reach backend at ${url}. Check server is running.`, 'error');
        } finally {
          testBackendBtn.disabled = false;
          testBackendBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Test';
          checkBackendHealth();
        }
      });
    }

    // App Preferences form submit
    const prefForm = document.getElementById('settings-pref-form');
    if (prefForm) {
      prefForm.addEventListener('submit', (e) => {
        e.preventDefault();
        AppStorage.saveSettings({
          gradingScale: scaleSelect ? scaleSelect.value : '10.0',
          backendUrl: backendUrlIn ? backendUrlIn.value.trim() : 'https://grade-pointer-ai-backend.vercel.app'
        });

        // Recalculate calculators with new scale
        if (typeof CgpaCalculator !== 'undefined' && CgpaCalculator.init) CgpaCalculator.init();
        if (typeof GradeCalculator !== 'undefined' && GradeCalculator.calculate) GradeCalculator.calculate();
        checkBackendHealth();
        Utils.showToast('Application preferences saved!', 'success');
      });
    }

    // Reset Preferences Button
    const resetPrefBtn = document.getElementById('settings-reset-pref-btn');
    if (resetPrefBtn) {
      resetPrefBtn.addEventListener('click', () => {
        if (confirm('Reset application preferences (theme, grading scale, backend URL) to default settings?')) {
          AppStorage.resetPreferences();
          applyTheme('dark');
          if (scaleSelect) scaleSelect.value = '10.0';
          if (backendUrlIn) backendUrlIn.value = 'https://grade-pointer-ai-backend.vercel.app';
          checkBackendHealth();
          Utils.showToast('Preferences reset to default values.', 'info');
        }
      });
    }

    // JSON Data Export
    const exportDataBtn = document.getElementById('settings-export-data-btn');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => {
        const json = AppStorage.exportAllData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gradepilot-academic-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Utils.showToast('Backup file downloaded successfully.', 'success');
      });
    }

    // Trigger Import File Dialog
    const importBtn = document.getElementById('settings-import-btn');
    const importDataInput = document.getElementById('settings-import-file-input');
    if (importBtn && importDataInput) {
      importBtn.addEventListener('click', () => {
        importDataInput.click();
      });
    }

    // JSON Data Import with Validation and Confirmation before overwrite
    if (importDataInput) {
      importDataInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          const validation = AppStorage.validateImportJson(content);

          if (!validation.valid) {
            Utils.showToast(`Import rejected: ${validation.error}`, 'error');
            importDataInput.value = '';
            return;
          }

          const confirmMsg = `Valid GradePilot backup found containing:\n• ${validation.matchedKeys.join('\n• ')}\n\nDo you want to import this data? Existing records will be updated.`;
          if (!confirm(confirmMsg)) {
            importDataInput.value = '';
            return;
          }

          const res = AppStorage.importAllData(content);
          if (res.success) {
            Utils.showToast(`Imported ${res.count} dataset(s) successfully! Reloading...`, 'success');
            setTimeout(() => window.location.reload(), 1200);
          } else {
            Utils.showToast(`Import error: ${res.error}`, 'error');
          }
          importDataInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    // Clear Local Academic Data (Non-destructive to Settings & Profile)
    const clearAcademicBtn = document.getElementById('settings-clear-academic-btn');
    if (clearAcademicBtn) {
      clearAcademicBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all stored academic data (coursework, CGPA subjects, semesters, study plans, calculation history, chat)?\n\nYour profile and application preferences will be preserved.')) {
          AppStorage.clearAcademicData();
          Dashboard.renderMetrics();
          Dashboard.renderSubjectSummary();
          Dashboard.initGpaChart();
          Dashboard.renderHistory();
          Utils.showToast('All local academic records cleared.', 'info');
        }
      });
    }

    // Factory Reset Data
    const resetDataBtn = document.getElementById('settings-reset-data-btn');
    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', () => {
        if (confirm('CAUTION: Are you sure you want to perform a complete Factory Reset?\n\nThis permanently removes ALL profile data, settings, saved courses, semesters, study plans, and chat history. This action cannot be undone.')) {
          AppStorage.resetAllData();
          Utils.showToast('Application reset to factory state. Reloading...', 'info');
          setTimeout(() => window.location.reload(), 1000);
        }
      });
    }
  };

  /**
   * Render Astra AI Animated Hero Dashboard Preview Chart
   */
  const initHeroPreviewChart = () => {
    const canvas = document.getElementById('hero-preview-chart');
    if (!canvas || !window.Chart) return;

    if (heroPreviewChartInstance) {
      heroPreviewChartInstance.destroy();
      heroPreviewChartInstance = null;
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 140);
    gradient.addColorStop(0, isDark ? 'rgba(124, 58, 237, 0.45)' : 'rgba(124, 58, 237, 0.22)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    heroPreviewChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Projected'],
        datasets: [{
          label: 'Academic Trajectory',
          data: [3.65, 3.72, 3.80, 3.84, 3.92],
          borderColor: '#8B5CF6',
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#06B6D4',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4.5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#0C1024' : '#FFFFFF',
            titleColor: isDark ? '#F8FAFC' : '#0F172A',
            bodyColor: '#38BDF8',
            borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : '#E2E8F0',
            borderWidth: 1,
            padding: 8,
            displayColors: false,
            callbacks: {
              label: (context) => `CGPA: ${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: isDark ? '#94A3B8' : '#64748B', font: { size: 10, weight: 600 } }
          },
          y: {
            min: 3.4,
            max: 4.0,
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
            ticks: { color: isDark ? '#94A3B8' : '#64748B', font: { size: 10 }, stepSize: 0.2 }
          }
        }
      }
    });
  };

  /**
   * Home Interactive Quick CGPA Estimator Widget
   */
  const initQuickHomeEstimator = () => {
    const curIn = document.getElementById('home-qc-current');
    const tgtIn = document.getElementById('home-qc-target');
    const credIn = document.getElementById('home-qc-credits');
    const compIn = document.getElementById('home-qc-completed');
    const btn = document.getElementById('home-qc-calc-btn');
    const resBox = document.getElementById('home-qc-result-box');
    const valSpan = document.getElementById('home-qc-val');
    const tagSpan = document.getElementById('home-qc-tag');
    const noteSpan = document.getElementById('home-qc-note');

    if (!btn || !curIn || !tgtIn) return;

    btn.addEventListener('click', () => {
      const cur = parseFloat(curIn.value);
      const tgt = parseFloat(tgtIn.value);
      const comp = parseFloat(compIn ? compIn.value : 60) || 60;
      const cred = parseFloat(credIn ? credIn.value : 20) || 20;

      if (isNaN(cur) || isNaN(tgt) || cur < 0 || tgt < 0) {
        Utils.showToast('Please enter valid current and target CGPA values.', 'warning');
        return;
      }

      // Formula: Required SGPA = (Target * (Completed + Upcoming) - (Current * Completed)) / Upcoming
      const req = (tgt * (comp + cred) - (cur * comp)) / cred;
      const formatted = req.toFixed(2);

      if (resBox && valSpan) {
        resBox.style.display = 'block';
        valSpan.textContent = formatted;

        if (req > 10.0 || (cur <= 4.0 && req > 4.0)) {
          tagSpan.className = 'badge badge-danger';
          tagSpan.textContent = 'Statistically Impossible in 1 Term';
          noteSpan.textContent = 'This target requires higher credits than mathematically possible. Consider aiming for this over multiple semesters.';
        } else if ((req > 3.85 && cur <= 4.0) || req > 9.2) {
          tagSpan.className = 'badge badge-warning';
          tagSpan.textContent = 'High Demand Target';
          noteSpan.textContent = 'Requires an almost perfect term (mostly A/A+ grades). Focus heavily on high-credit courses.';
        } else {
          tagSpan.className = 'badge badge-success';
          tagSpan.textContent = 'Achievable Goal';
          noteSpan.textContent = 'A solid, realistic semester trajectory. Consistent study routines will secure this score!';
        }
      }
    });
  };

  /**
   * Scroll Reveal Animation Observer
   */
  const setupScrollReveal = () => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
  };

  return {
    init,
    navigateTo,
    applyTheme,
    checkBackendHealth
  };
})();

// Bootstrap application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
