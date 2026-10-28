/**
 * GradePilot AI - CGPA Predictor & Target Planning Module
 * Deterministic JavaScript implementation of target credit-weighted planning,
 * rigorous input validation, mathematical impossibility detection, scenario comparison,
 * and AI Strategic Advisory integration via Flask / Gemini backend.
 *
 * FORMULA:
 * requiredSGPA = (targetCGPA * (completedCredits + upcomingCredits) - currentCGPA * completedCredits) / upcomingCredits
 *
 * NOTE: The numerical calculation is strictly deterministic and client-verified.
 * The AI advisor model is consulted for contextual explanations and strategic planning,
 * and is NEVER permitted to overwrite authoritative numerical results.
 */

const CgpaPredictor = (() => {
  const Storage = window.AppStorage || AppStorage;

  // Default scenario comparison values for standard 10.0 scale and 4.0 scale
  const DEFAULT_SCENARIOS_10 = [7.0, 8.0, 9.0, 10.0];
  const DEFAULT_SCENARIOS_4 = [2.5, 3.0, 3.5, 4.0];

  // Current active scenarios state (can be edited/added by user)
  let activeScenarios = [...DEFAULT_SCENARIOS_10];

  // Cached deterministic calculation result
  let lastCalculation = null;

  // Cached AI report markdown and raw text
  let lastAiReport = '';

  /**
   * Initializes the predictor module
   */
  const init = () => {
    populateDefaults();
    bindEvents();
    // Run initial deterministic calculation
    calculate();
  };

  /**
   * Populates input fields from student profile or sensible defaults
   */
  const populateDefaults = () => {
    const profile = Storage.getProfile ? Storage.getProfile() : {};
    const settings = Storage.getSettings ? Storage.getSettings() : {};

    const elCurrentCgpa = document.getElementById('pred-current-cgpa');
    const elCompletedCredits = document.getElementById('pred-completed-credits');
    const elUpcomingCredits = document.getElementById('pred-upcoming-credits');
    const elTargetCgpa = document.getElementById('pred-target-cgpa');
    const elMaxScale = document.getElementById('pred-max-scale');

    const defaultScale = settings.gradingScale === '4.0' ? '4.0' : '10.0';

    if (elMaxScale && !elMaxScale.value) {
      elMaxScale.value = defaultScale;
    }

    const currentScale = parseFloat(elMaxScale ? elMaxScale.value : defaultScale) || 10.0;

    if (elCurrentCgpa && !elCurrentCgpa.value) {
      elCurrentCgpa.value = currentScale === 10.0 ? (profile.currentCgpa ? (profile.currentCgpa > 4 ? profile.currentCgpa : (profile.currentCgpa * 2.5).toFixed(2)) : '8.00') : '3.40';
    }

    if (elCompletedCredits && !elCompletedCredits.value) {
      elCompletedCredits.value = profile.completedCredits ? String(profile.completedCredits) : '60';
    }

    if (elUpcomingCredits && !elUpcomingCredits.value) {
      elUpcomingCredits.value = '20';
    }

    if (elTargetCgpa && !elTargetCgpa.value) {
      elTargetCgpa.value = currentScale === 10.0 ? (profile.targetCgpa ? (profile.targetCgpa > 4 ? profile.targetCgpa : (profile.targetCgpa * 2.5).toFixed(2)) : '8.50') : '3.75';
    }

    // Initialize scenario presets based on scale
    syncScenarioPresets(currentScale);
  };

  /**
   * Syncs scenario presets based on scale (e.g. 7, 8, 9, 10 or 2.5, 3.0, 3.5, 4.0)
   */
  const syncScenarioPresets = (scale) => {
    if (scale <= 5.0) {
      activeScenarios = [...DEFAULT_SCENARIOS_4];
    } else {
      activeScenarios = [...DEFAULT_SCENARIOS_10];
    }
  };

  /**
   * Pure deterministic calculation function:
   * Computes required SGPA, total credits, maximum achievable CGPA, and impossible target detection.
   *
   * @param {Object} params
   * @param {number} params.currentCgpa
   * @param {number} params.targetCgpa
   * @param {number} params.completedCredits
   * @param {number} params.upcomingCredits
   * @param {number} params.maxScale
   * @returns {Object} authoritative calculation record
   */
  const computePrediction = ({ currentCgpa, targetCgpa, completedCredits, upcomingCredits, maxScale }) => {
    const totalCredits = completedCredits + upcomingCredits;

    // Formula: requiredSGPA = (targetCGPA * totalCredits - currentCGPA * completedCredits) / upcomingCredits
    const targetPoints = targetCgpa * totalCredits;
    const currentPoints = currentCgpa * completedCredits;
    const neededPoints = targetPoints - currentPoints;
    const requiredSgpaRaw = neededPoints / upcomingCredits;
    const requiredSgpa = Math.round(requiredSgpaRaw * 100) / 100;

    // Maximum achievable CGPA this semester if student earns straight perfect maxScale SGPA:
    const maxPointsAchievable = currentPoints + (maxScale * upcomingCredits);
    const maxAchievableCgpaRaw = maxPointsAchievable / totalCredits;
    const maxAchievableCgpa = Math.round(maxAchievableCgpaRaw * 100) / 100;

    // Minimum achievable CGPA this semester if student earns 0.00 SGPA:
    const minAchievableCgpa = Math.round((currentPoints / totalCredits) * 100) / 100;

    // Impossibility detection:
    const isImpossible = requiredSgpaRaw > maxScale;
    const isAlreadyExceeded = requiredSgpaRaw <= 0;

    // Feasibility status classification:
    let status = 'feasible';
    let statusLabel = 'Achievable Target';
    let badgeClass = 'badge-success';

    if (isImpossible) {
      status = 'impossible';
      statusLabel = 'Mathematically Impossible';
      badgeClass = 'badge-danger';
    } else if (isAlreadyExceeded) {
      status = 'secured';
      statusLabel = 'Target Already Secured';
      badgeClass = 'badge-cyan';
    } else if (requiredSgpaRaw >= maxScale * 0.95) {
      status = 'demanding';
      statusLabel = 'Extremely Demanding';
      badgeClass = 'badge-warning';
    } else if (requiredSgpaRaw >= maxScale * 0.85) {
      status = 'focused';
      statusLabel = 'High Focus Required';
      badgeClass = 'badge-primary';
    }

    return {
      currentCgpa,
      targetCgpa,
      completedCredits,
      upcomingCredits,
      totalCredits,
      maxScale,
      requiredSgpa,
      requiredSgpaRaw,
      maxAchievableCgpa,
      minAchievableCgpa,
      isImpossible,
      isAlreadyExceeded,
      status,
      statusLabel,
      badgeClass,
      breakdown: {
        targetPoints: Math.round(targetPoints * 100) / 100,
        currentPoints: Math.round(currentPoints * 100) / 100,
        neededPoints: Math.round(neededPoints * 100) / 100
      }
    };
  };

  /**
   * Computes scenario comparison table:
   * Calculates resulting projected CGPA for each hypothetical SGPA scenario.
   *
   * Formula: projectedCGPA = (currentCGPA * completedCredits + hypotheticalSGPA * upcomingCredits) / totalCredits
   */
  const computeScenarios = (calc, scenarioList) => {
    const { currentCgpa, targetCgpa, completedCredits, upcomingCredits, totalCredits, maxScale } = calc;

    return scenarioList
      .filter(sg => typeof sg === 'number' && !isNaN(sg) && sg >= 0 && sg <= maxScale)
      .sort((a, b) => a - b)
      .map(sg => {
        const scenarioPoints = (currentCgpa * completedCredits) + (sg * upcomingCredits);
        const projectedCgpaRaw = scenarioPoints / totalCredits;
        const projectedCgpa = Math.round(projectedCgpaRaw * 100) / 100;
        const diffFromCurrent = Math.round((projectedCgpa - currentCgpa) * 100) / 100;
        const diffFromTarget = Math.round((projectedCgpa - targetCgpa) * 100) / 100;
        const meetsTarget = projectedCgpa >= targetCgpa;

        let statusText = 'Below Target';
        let badgeClass = 'badge-neutral';

        if (projectedCgpa >= targetCgpa + 0.005) {
          statusText = 'Exceeds Target';
          badgeClass = 'badge-success';
        } else if (Math.abs(projectedCgpa - targetCgpa) <= 0.02) {
          statusText = 'Meets Target Exactly';
          badgeClass = 'badge-cyan';
        }

        return {
          sgpa: sg,
          projectedCgpa,
          projectedCgpaRaw,
          diffFromCurrent,
          diffFromTarget,
          meetsTarget,
          statusText,
          badgeClass
        };
      });
  };

  /**
   * Validates all input values.
   * Returns { isValid, errors, values }
   */
  const validateInputs = () => {
    const errors = [];

    const rawCur = document.getElementById('pred-current-cgpa')?.value?.trim();
    const rawComp = document.getElementById('pred-completed-credits')?.value?.trim();
    const rawUp = document.getElementById('pred-upcoming-credits')?.value?.trim();
    const rawTgt = document.getElementById('pred-target-cgpa')?.value?.trim();
    const rawScale = document.getElementById('pred-max-scale')?.value?.trim();

    if (!rawCur || !rawComp || !rawUp || !rawTgt || !rawScale) {
      errors.push('All numeric input fields are required. Please fill in all fields.');
      return { isValid: false, errors, values: null };
    }

    const currentCgpa = parseFloat(rawCur);
    const completedCredits = parseFloat(rawComp);
    const upcomingCredits = parseFloat(rawUp);
    const targetCgpa = parseFloat(rawTgt);
    const maxScale = parseFloat(rawScale);

    if (isNaN(maxScale) || maxScale <= 0) {
      errors.push('Maximum grade-point scale must be a positive number greater than 0 (e.g. 10.0 or 4.0).');
    }

    if (isNaN(currentCgpa) || currentCgpa < 0 || (maxScale > 0 && currentCgpa > maxScale)) {
      errors.push(`Current CGPA must be a valid number between 0.00 and ${maxScale > 0 ? maxScale.toFixed(2) : 'max scale'}.`);
    }

    if (isNaN(targetCgpa) || targetCgpa < 0 || (maxScale > 0 && targetCgpa > maxScale)) {
      errors.push(`Target CGPA must be a valid number between 0.00 and ${maxScale > 0 ? maxScale.toFixed(2) : 'max scale'}.`);
    }

    if (isNaN(completedCredits) || completedCredits < 0) {
      errors.push('Completed credits cannot be negative (must be 0 or greater).');
    }

    if (isNaN(upcomingCredits) || upcomingCredits <= 0) {
      errors.push('Upcoming semester credits must be a positive number greater than 0.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      values: errors.length === 0 ? {
        currentCgpa,
        targetCgpa,
        completedCredits,
        upcomingCredits,
        maxScale
      } : null
    };
  };

  /**
   * Main calculation handler triggered by input changes or button click
   */
  const calculate = () => {
    const errorBox = document.getElementById('pred-error-alert');
    const resultBox = document.getElementById('pred-results-card');
    const scenarioBox = document.getElementById('pred-scenarios-card');

    const validation = validateInputs();

    if (!validation.isValid) {
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger); font-size: 1.15rem; margin-top: 0.15rem;"></i>
            <div>
              <strong style="color: var(--danger);">Input Validation Error:</strong>
              <ul style="margin: 0.35rem 0 0 1.2rem; padding: 0; font-size: 0.875rem; color: var(--text-secondary);">
                ${validation.errors.map(err => `<li>${Utils.escapeHtml(err)}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
      }
      if (resultBox) resultBox.style.opacity = '0.5';
      lastCalculation = null;
      return false;
    }

    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.innerHTML = '';
    }
    if (resultBox) resultBox.style.opacity = '1';

    // Perform pure deterministic calculation
    const calc = computePrediction(validation.values);
    lastCalculation = calc;

    // Render deterministic outputs
    renderResults(calc);

    // Render scenario comparison
    renderScenarios(calc);

    return true;
  };

  /**
   * Renders the deterministic calculation outputs and explanation breakdown
   */
  const renderResults = (calc) => {
    const {
      currentCgpa,
      targetCgpa,
      completedCredits,
      upcomingCredits,
      totalCredits,
      maxScale,
      requiredSgpa,
      maxAchievableCgpa,
      isImpossible,
      isAlreadyExceeded,
      statusLabel,
      badgeClass,
      breakdown
    } = calc;

    // Numerical Displays
    const elReqSgpa = document.getElementById('pred-required-sgpa-display');
    const elBadge = document.getElementById('pred-feasibility-badge');
    const elCurrentDisp = document.getElementById('pred-disp-current');
    const elTargetDisp = document.getElementById('pred-disp-target');
    const elTotalCreditsDisp = document.getElementById('pred-disp-total-credits');
    const elDeltaDisp = document.getElementById('pred-disp-delta');

    if (elReqSgpa) {
      elReqSgpa.textContent = isAlreadyExceeded ? '0.00' : requiredSgpa.toFixed(2);
      if (isImpossible) {
        elReqSgpa.style.color = 'var(--danger)';
      } else if (isAlreadyExceeded) {
        elReqSgpa.style.color = 'var(--accent-cyan)';
      } else {
        elReqSgpa.style.color = 'var(--primary)';
      }
    }

    if (elBadge) {
      elBadge.className = `badge ${badgeClass}`;
      elBadge.innerHTML = `<i class="fa-solid ${isImpossible ? 'fa-triangle-exclamation' : (isAlreadyExceeded ? 'fa-circle-check' : 'fa-bullseye')}"></i> ${statusLabel}`;
    }

    if (elCurrentDisp) elCurrentDisp.textContent = currentCgpa.toFixed(2);
    if (elTargetDisp) elTargetDisp.textContent = targetCgpa.toFixed(2);
    if (elTotalCreditsDisp) elTotalCreditsDisp.textContent = `${totalCredits.toFixed(1)} Credits`;

    const cgpaDelta = targetCgpa - currentCgpa;
    if (elDeltaDisp) {
      const sign = cgpaDelta > 0 ? '+' : '';
      elDeltaDisp.textContent = `${sign}${cgpaDelta.toFixed(2)}`;
      elDeltaDisp.style.color = cgpaDelta > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    }

    // Impossible Target Warning Banner
    const impossibleBanner = document.getElementById('pred-impossible-banner');
    if (impossibleBanner) {
      if (isImpossible) {
        impossibleBanner.style.display = 'block';
        impossibleBanner.innerHTML = `
          <div class="impossible-target-card">
            <div class="impossible-icon"><i class="fa-solid fa-ban"></i></div>
            <div class="impossible-content">
              <h4>Target CGPA Mathematically Unreachable This Semester</h4>
              <p>
                To reach your target CGPA of <strong>${targetCgpa.toFixed(2)}</strong>, you would mathematically require an SGPA of <strong>${requiredSgpa.toFixed(2)}</strong> for the upcoming ${upcomingCredits.toFixed(1)} credits.
                Because the maximum grade-point scale is <strong>${maxScale.toFixed(2)}</strong>, an SGPA of ${requiredSgpa.toFixed(2)} cannot be awarded under university grading rules.
              </p>
              <div class="impossible-ceiling-metric">
                <span>Theoretical Mathematical Ceiling with Perfect Straight ${maxScale.toFixed(1)}s:</span>
                <strong>${maxAchievableCgpa.toFixed(2)} CGPA</strong>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>Academic Recovery Path:</strong>
                To achieve a ${targetCgpa.toFixed(2)} CGPA, you will need to distribute your target over multiple upcoming semesters or take additional approved course credits.
              </p>
            </div>
          </div>
        `;
      } else {
        impossibleBanner.style.display = 'none';
        impossibleBanner.innerHTML = '';
      }
    }

    // Step-by-Step Mathematical Explanation Box
    const formulaStepBox = document.getElementById('pred-formula-explanation-box');
    if (formulaStepBox) {
      formulaStepBox.innerHTML = `
        <div class="formula-breakdown-card">
          <div class="formula-header">
            <i class="fa-solid fa-square-root-variable"></i>
            <span>Deterministic Credit-Weighted Formula & Calculation Step</span>
          </div>
          <div class="formula-math-display">
            <div class="math-line">
              <span class="var-name">requiredSGPA</span> =
              <span class="math-fraction">
                <span class="fraction-num">(targetCGPA &times; (completedCredits + upcomingCredits)) &minus; (currentCGPA &times; completedCredits)</span>
                <span class="fraction-den">upcomingCredits</span>
              </span>
            </div>
            <div class="math-step-divider"></div>
            <div class="math-line math-substitutions">
              <span><strong>Substituted Values:</strong></span>
              <span>
                = <span class="math-fraction">
                  <span class="fraction-num">(${targetCgpa.toFixed(2)} &times; (${completedCredits.toFixed(1)} + ${upcomingCredits.toFixed(1)})) &minus; (${currentCgpa.toFixed(2)} &times; ${completedCredits.toFixed(1)})</span>
                  <span class="fraction-den">${upcomingCredits.toFixed(1)}</span>
                </span>
              </span>
              <span>
                = <span class="math-fraction">
                  <span class="fraction-num">(${targetCgpa.toFixed(2)} &times; ${totalCredits.toFixed(1)}) &minus; (${currentCgpa.toFixed(2)} &times; ${completedCredits.toFixed(1)})</span>
                  <span class="fraction-den">${upcomingCredits.toFixed(1)}</span>
                </span>
              </span>
              <span>
                = <span class="math-fraction">
                  <span class="fraction-num">${breakdown.targetPoints.toFixed(2)} &minus; ${breakdown.currentPoints.toFixed(2)}</span>
                  <span class="fraction-den">${upcomingCredits.toFixed(1)}</span>
                </span>
                = <span class="math-fraction">
                  <span class="fraction-num">${breakdown.neededPoints.toFixed(2)} grade points</span>
                  <span class="fraction-den">${upcomingCredits.toFixed(1)} credits</span>
                </span>
                = <strong>${requiredSgpa.toFixed(2)} SGPA</strong>
              </span>
            </div>
          </div>
          <div class="formula-summary-note">
            <i class="fa-solid fa-circle-info"></i>
            <span>
              You currently hold <strong>${breakdown.currentPoints.toFixed(2)}</strong> cumulative quality points.
              To finish with a <strong>${targetCgpa.toFixed(2)}</strong> CGPA over <strong>${totalCredits.toFixed(1)}</strong> total credits, you need <strong>${breakdown.targetPoints.toFixed(2)}</strong> total points.
              This leaves <strong>${breakdown.neededPoints.toFixed(2)}</strong> quality points to be earned across your upcoming <strong>${upcomingCredits.toFixed(1)}</strong> credits.
            </span>
          </div>
        </div>
      `;
    }
  };

  /**
   * Renders the scenario comparison table
   */
  const renderScenarios = (calc) => {
    const tableBody = document.getElementById('pred-scenarios-body');
    if (!tableBody) return;

    const evaluatedScenarios = computeScenarios(calc, activeScenarios);

    if (evaluatedScenarios.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No scenarios active. Enter hypothetical SGPA values below.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = evaluatedScenarios.map((sc, idx) => {
      const diffSign = sc.diffFromCurrent > 0 ? '+' : '';
      const targetDiffSign = sc.diffFromTarget > 0 ? '+' : '';
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="scenario-sgpa-pill">${sc.sgpa.toFixed(1)} SGPA</span>
              ${sc.sgpa === calc.maxScale ? `<span class="badge badge-neutral" style="font-size: 0.7rem;">Max Scale</span>` : ''}
            </div>
          </td>
          <td>
            <strong style="font-size: 1.05rem; color: var(--text-main);">${sc.projectedCgpa.toFixed(2)}</strong>
          </td>
          <td>
            <span style="font-weight: 600; color: ${sc.diffFromCurrent >= 0 ? 'var(--accent-cyan)' : 'var(--danger)'};">
              ${diffSign}${sc.diffFromCurrent.toFixed(2)}
            </span>
          </td>
          <td>
            <span style="font-size: 0.85rem; color: ${sc.diffFromTarget >= 0 ? 'var(--success)' : 'var(--text-muted)'};">
              ${targetDiffSign}${sc.diffFromTarget.toFixed(2)}
            </span>
          </td>
          <td>
            <span class="badge ${sc.badgeClass}">${sc.statusText}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  /**
   * Adds a custom hypothetical scenario SGPA value
   */
  const addCustomScenario = () => {
    const input = document.getElementById('pred-custom-scenario-input');
    if (!input) return;

    const val = parseFloat(input.value);
    const maxScale = parseFloat(document.getElementById('pred-max-scale')?.value) || 10.0;

    if (isNaN(val) || val < 0 || val > maxScale) {
      Utils.showToast(`Please enter an SGPA between 0.0 and ${maxScale.toFixed(1)}`, 'warning');
      return;
    }

    if (!activeScenarios.includes(val)) {
      activeScenarios.push(val);
      activeScenarios.sort((a, b) => a - b);
      input.value = '';
      calculate();
      Utils.showToast(`Added hypothetical SGPA: ${val.toFixed(1)}`, 'info');
    } else {
      Utils.showToast(`Scenario ${val.toFixed(1)} is already in the comparison table.`, 'info');
    }
  };

  /**
   * Resets scenarios to defaults based on current scale
   */
  const resetScenarios = () => {
    const maxScale = parseFloat(document.getElementById('pred-max-scale')?.value) || 10.0;
    syncScenarioPresets(maxScale);
    calculate();
    Utils.showToast('Reset scenarios to default grade brackets.', 'info');
  };

  /**
   * Consults the AI Academic Advisor on Target Feasibility via Flask backend
   */
  const consultAiAdvisor = async () => {
    if (!lastCalculation) {
      const ok = calculate();
      if (!ok) {
        Utils.showToast('Please fix input validation errors before consulting the AI Advisor.', 'warning');
        return;
      }
    }

    const calc = lastCalculation;
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const backendUrl = (Utils.getBackendUrl ? Utils.getBackendUrl() : settings.backendUrl) || 'http://localhost:5000';

    const aiOutputContainer = document.getElementById('pred-ai-output-container');
    const loadingState = document.getElementById('pred-ai-loading-state');
    const errorAlert = document.getElementById('pred-ai-error-alert');
    const errorTitle = document.getElementById('pred-ai-error-title');
    const errorMessage = document.getElementById('pred-ai-error-message');
    const aiBtn = document.getElementById('pred-consult-ai-btn');

    if (errorAlert) errorAlert.style.display = 'none';
    if (aiOutputContainer) aiOutputContainer.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';

    if (aiBtn) {
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consulting Target Planning AI...';
    }

    // Prepare scenario rows payload for AI context
    const scenarios = computeScenarios(calc, activeScenarios).map(sc => ({
      sgpa: sc.sgpa,
      projectedCgpa: sc.projectedCgpa,
      difference: sc.diffFromCurrent,
      meetsTarget: sc.meetsTarget
    }));

    const profile = Storage.getProfile ? Storage.getProfile() : {};
    const notesEl = document.getElementById('pred-academic-notes');
    const notesVal = notesEl ? notesEl.value.trim() : '';

    const payload = {
      currentCgpa: calc.currentCgpa,
      targetCgpa: calc.targetCgpa,
      completedCredits: calc.completedCredits,
      upcomingCredits: calc.upcomingCredits,
      maxScale: calc.maxScale,
      major: profile.major || 'Undergraduate Degree',
      academicNotes: notesVal || '',
      scenarios: scenarios
    };

    try {
      const response = await fetch(`${backendUrl}/api/ai/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        lastAiReport = data.analysis || data.explanation || '';

        // Render AI report
        renderAiReport(lastAiReport, calc);

        if (aiOutputContainer) {
          aiOutputContainer.style.display = 'block';
          aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        Utils.showToast('AI Target Feasibility Plan generated successfully!', 'success');
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errDescription = errJson.message || `Backend returned status ${response.status}`;
        throw new Error(errDescription);
      }
    } catch (err) {
      console.warn('AI Predictor API call failed:', err);
      if (errorAlert && errorTitle && errorMessage) {
        errorTitle.textContent = 'AI Advisor Service Unavailable';
        errorMessage.innerHTML = `
          <strong>${Utils.escapeHtml(err.message || 'Connection failure')}</strong><br />
          Ensure the Python Flask backend is running on <code>${Utils.escapeHtml(backendUrl)}</code> and that your Gemini credentials are set up in <code>backend/.env</code>.
        `;
        errorAlert.style.display = 'block';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      Utils.showToast(err.message || 'Could not connect to AI Predictor service.', 'error');
    } finally {
      if (loadingState) loadingState.style.display = 'none';
      if (aiBtn) {
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Consult AI Advisor on Target Feasibility';
      }
    }
  };

  /**
   * Renders the AI Report markdown into DOM
   */
  const renderAiReport = (markdownText, calc) => {
    const contentBody = document.getElementById('pred-ai-content-body');
    if (!contentBody) return;

    const html = Utils.renderMarkdown(markdownText);
    contentBody.innerHTML = html;
  };

  /**
   * Copies the AI report to clipboard
   */
  const copyAiReport = () => {
    if (!lastAiReport) {
      Utils.showToast('No AI report available to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(lastAiReport)
      .then(() => Utils.showToast('AI target advisory report copied to clipboard!', 'success'))
      .catch(() => Utils.showToast('Unable to copy report.', 'error'));
  };

  /**
   * Exports the complete predictor calculation, scenario comparison, and AI advice to PDF
   */
  const exportPdf = () => {
    if (!lastCalculation) {
      calculate();
    }
    const calc = lastCalculation;
    if (!calc) return;

    const scenarios = computeScenarios(calc, activeScenarios);

    const lines = [
      { text: 'CGPA PREDICTOR & TARGET PLANNING REPORT', isHeading: true },
      { text: `Current CGPA: ${calc.currentCgpa.toFixed(2)} (across ${calc.completedCredits.toFixed(1)} completed credits)`, isHeading: false },
      { text: `Target CGPA: ${calc.targetCgpa.toFixed(2)} | Maximum Grade-Point Scale: ${calc.maxScale.toFixed(1)}`, isHeading: false },
      { text: `Upcoming Semester Load: ${calc.upcomingCredits.toFixed(1)} credits | Total Projected Credits: ${calc.totalCredits.toFixed(1)} credits`, isHeading: false },
      { text: `Mathematically Required SGPA: ${calc.requiredSgpa.toFixed(2)} (${calc.statusLabel})`, isHeading: false },
      { text: `Theoretical Ceiling with Straight ${calc.maxScale.toFixed(1)}s: ${calc.maxAchievableCgpa.toFixed(2)} CGPA`, isHeading: false },
      { text: '------------------------------------------------------------------------------------------------', isHeading: false },
      { text: 'HYPOTHETICAL SGPA SCENARIO COMPARISON (CREDIT-WEIGHTED):', isHeading: true }
    ];

    scenarios.forEach(sc => {
      const sign = sc.diffFromCurrent > 0 ? '+' : '';
      lines.push({
        text: `• SGPA ${sc.sgpa.toFixed(1)} => Projected CGPA: ${sc.projectedCgpa.toFixed(2)} (${sign}${sc.diffFromCurrent.toFixed(2)}) | Status: ${sc.statusText}`,
        isHeading: false
      });
    });

    lines.push({ text: '------------------------------------------------------------------------------------------------', isHeading: false });
    lines.push({ text: 'DISCLAIMER:', isHeading: true });
    lines.push({ text: 'Projected CGPA calculations are mathematical estimates based on credit weighting and do not represent guaranteed outcomes.', isHeading: false });

    Utils.exportToPdf('CGPA Target Planning Analysis', 'GradePilot AI Trajectory Evaluation', lines, 'gradepilot-cgpa-prediction.pdf');
  };

  /**
   * Binds event listeners
   */
  const bindEvents = () => {
    const inputIds = [
      'pred-current-cgpa',
      'pred-completed-credits',
      'pred-upcoming-credits',
      'pred-target-cgpa',
      'pred-max-scale'
    ];

    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => calculate());
      }
    });

    // Scale change listener to update presets
    const elScale = document.getElementById('pred-max-scale');
    if (elScale) {
      elScale.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 10.0;
        syncScenarioPresets(val);
        calculate();
      });
    }

    // Calculate Button
    const calcBtn = document.getElementById('pred-calc-btn');
    if (calcBtn) {
      calcBtn.addEventListener('click', (e) => {
        e.preventDefault();
        calculate();
      });
    }

    // Reset Form Button
    const resetBtn = document.getElementById('pred-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        populateDefaults();
        calculate();
        Utils.showToast('Predictor reset to default values.', 'info');
      });
    }

    // Add Custom Scenario
    const addScBtn = document.getElementById('pred-add-scenario-btn');
    if (addScBtn) {
      addScBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addCustomScenario();
      });
    }

    // Reset Scenarios
    const resetScBtn = document.getElementById('pred-reset-scenarios-btn');
    if (resetScBtn) {
      resetScBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetScenarios();
      });
    }

    // Consult AI Advisor Button
    const aiBtn = document.getElementById('pred-consult-ai-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        consultAiAdvisor();
      });
    }

    // Copy AI Report Button
    const copyBtn = document.getElementById('pred-copy-ai-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        copyAiReport();
      });
    }

    // PDF Export Button
    const exportBtn = document.getElementById('pred-export-pdf-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportPdf();
      });
    }
  };

  return {
    init,
    calculate,
    validateInputs,
    computePrediction,
    computeScenarios,
    consultAiAdvisor,
    exportPdf,
    copyAiReport,
    addCustomScenario,
    resetScenarios
  };
})();
