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
    'study-planner',
    'ai-chat',
    'settings'
  ];

  const SECTION_TITLES = {
    'home': 'Home',
    'dashboard': 'Dashboard',
    'grade-calculator': 'Grade Calculator',
    'cgpa-calculator': 'CGPA Calculator',
    'study-planner': 'Study Planner',
    'ai-chat': 'Ask GradePilot',
    'settings': 'Settings'
  };

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
    StudyPlanner.init();
    AiChat.init();

    // Initialize scroll reveal and restrained homepage card tilt
    setupScrollReveal();
    setupCardTilt();

    // Route to initial section from hash or default to home
    const initialHash = window.location.hash.replace('#', '') || 'home';
    navigateTo(initialHash, false);

    // Periodically re-check backend health every 60s
    setInterval(checkBackendHealth, 60000);
  };

  /**
   * Theme Manager (Dark / Light)
   */
  const getPreferredTheme = () => {
    const savedLocal = localStorage.getItem('theme');
    if (savedLocal === 'light' || savedLocal === 'dark') return savedLocal;

    const settings = AppStorage.getSettings ? AppStorage.getSettings() : {};
    if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  };

  const applyTheme = (themeName = null) => {
    const currentTheme = (themeName === 'light' || themeName === 'dark') ? themeName : getPreferredTheme();

    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    const toggleIcon = document.getElementById('theme-toggle-icon');
    const toggleLabel = document.getElementById('theme-toggle-label');
    const isDark = currentTheme === 'dark';

    if (toggleIcon) {
      toggleIcon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    if (toggleLabel) {
      toggleLabel.textContent = isDark ? 'Dark' : 'Light';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(isDark));
      toggleBtn.setAttribute(
        'aria-label',
        isDark ? 'Dark mode active, switch to light mode' : 'Light mode active, switch to dark mode'
      );
      toggleBtn.title = isDark
        ? 'Dark mode active — switch to Light mode'
        : 'Light mode active — switch to Dark mode';
    }

    const darkBtn = document.getElementById('btn-theme-dark');
    const lightBtn = document.getElementById('btn-theme-light');
    if (darkBtn) {
      darkBtn.classList.toggle('active', isDark);
      darkBtn.setAttribute('aria-pressed', String(isDark));
    }
    if (lightBtn) {
      lightBtn.classList.toggle('active', !isDark);
      lightBtn.setAttribute('aria-pressed', String(!isDark));
    }

    // Refresh charts for correct color palette
    if (Dashboard && Dashboard.initGpaChart) {
      Dashboard.initGpaChart();
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
      const hash = window.location.hash.replace('#', '') || 'home';
      navigateTo(hash, false);
    });
  };

  const navigateTo = (sectionId, updateHash = true) => {
    const validSection = SECTIONS.includes(sectionId) ? sectionId : 'home';

    // Update section active classes
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`section-${validSection}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update active nav links in mobile drawer and desktop top navbar
    document.querySelectorAll('.nav-link, .astra-nav-item a').forEach(link => {
      if (link.getAttribute('data-navigate') === validSection) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
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
    } else if (!SECTIONS.includes(sectionId) && window.location.hash) {
      try {
        history.replaceState(null, '', `#${validSection}`);
      } catch (e) {
        window.location.hash = validSection;
      }
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
    const closeBtn = document.getElementById('mobile-menu-close-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('mobile-open');
        if (backdrop) backdrop.classList.toggle('active', isOpen);
        menuBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileDrawer);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileDrawer);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
        closeMobileDrawer();
      }
    });
  };

  const closeMobileDrawer = () => {
    const menuBtn = document.getElementById('mobile-menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  };

  /**
   * Backend Health Status Check
   */
  const checkBackendHealth = async () => {
    const settings = AppStorage.getSettings();
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'https://grade-pointer-ai-backend.vercel.app';
    const pill = document.getElementById('backend-status-pill');
    const pillText = document.getElementById('backend-status-text');
    const chatBadge = document.getElementById('chat-backend-status-badge');

    const syncToolBadges = (badgeClass, label) => {
      if (chatBadge) {
        chatBadge.className = `badge ${badgeClass}`;
        chatBadge.innerHTML = `<span class="status-dot"></span> ${Utils.escapeHtml(label)}`;
      }
    };

    try {
      const res = await fetch(`${backendUrl}/api/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        const isReady = Boolean(data.gemini_configured);
        if (pill && pillText) {
          pill.className = 'backend-status-pill online';
          pillText.textContent = isReady ? 'Gemini AI Active' : 'API Key Missing';
          pill.title = isReady
            ? 'Flask AI Backend is connected and Gemini API is configured'
            : 'Backend is reachable, but GEMINI_API_KEY is not configured';
        }
        syncToolBadges(isReady ? 'badge-success' : 'badge-warning', isReady ? 'Gemini AI Ready' : 'API Key Missing');
      } else {
        throw new Error('Non-200');
      }
    } catch (e) {
      if (pill && pillText) {
        pill.className = 'backend-status-pill offline';
        pillText.textContent = 'Backend Offline';
        pill.title = 'Backend unreachable. Calculators work offline; AI tools require the backend.';
      }
      syncToolBadges('badge-danger', 'Backend Offline');
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
   * Restrained 3D Tilt on Homepage Tool Cards Only (desktop fine pointer, respects reduced motion)
   */
  const setupCardTilt = () => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (prefersReduced || !finePointer) return;

    const cards = document.querySelectorAll('#section-home .astra-feature-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const rotateX = (-y * 3).toFixed(2);
        const rotateY = (x * 3).toFixed(2);
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
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
