/* ==========================================================================
   LabFlow Lite - Faculty Practical Disruption Prediction Controller
   Aligned Responsive Cards, Balanced Hierarchy & Clean Presentation
   ========================================================================== */

let currentPredictionData = null;
let pollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPredictionData();
    // Poll for live updates every 30 seconds
    pollTimer = setInterval(() => {
        const selectEl = document.getElementById('prediction-session-select');
        const selectedId = selectEl ? selectEl.value : null;
        loadPredictionData(selectedId, true);
    }, 30000);
});

// Handle bfcache restore
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        fetch('/api/auth/me').then(res => {
            if (!res.ok) window.location.replace('/login');
        }).catch(() => window.location.replace('/login'));
    }
});

// 1. Mobile Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('faculty-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
        if (overlay) overlay.classList.add('d-none');
    } else {
        sidebar.classList.add('show');
        if (overlay) overlay.classList.remove('d-none');
    }
}

// 2. Fetch Prediction Data from Backend
async function loadPredictionData(sessionId = null, isBackground = false) {
    try {
        let url = '/api/faculty/disruption-prediction';
        if (sessionId) {
            url += `?session_id=${encodeURIComponent(sessionId)}`;
        }

        const res = await fetch(url);
        if (res.status === 401) {
            window.location.replace('/login');
            return;
        }
        if (res.status === 403) {
            window.location.replace('/dashboard/student');
            return;
        }

        const json = await res.json();
        if (res.ok && json.status === 'success') {
            currentPredictionData = json.data;
            renderFacultyProfile(currentPredictionData.faculty);
            populateSessionDropdown(currentPredictionData.sessions_list, currentPredictionData.selected_session);
            renderSelectedSession(currentPredictionData.selected_session);
            renderRiskOverview(currentPredictionData);
            renderContributingFactors(currentPredictionData);
            renderAffectedEquipment(currentPredictionData.affected_equipment);
            renderRecommendation(currentPredictionData.recommendation);
            renderAlternateEquipment(currentPredictionData.alternate_equipment);
        } else {
            if (!isBackground) {
                renderErrorState(json.message || "Unable to calculate disruption prediction.");
            }
        }
    } catch (e) {
        console.error('Failed to load disruption prediction:', e);
        if (!isBackground) {
            renderErrorState("Failed to connect to the prediction engine.");
        }
    }
}

// 3. Handle Dropdown Session Selection Change
function onPredictionSessionChange() {
    const selectEl = document.getElementById('prediction-session-select');
    if (!selectEl) return;
    const selectedId = selectEl.value;
    if (selectedId) {
        loadPredictionData(selectedId);
    }
}

// 4. Render Faculty Profile in Top Nav
function renderFacultyProfile(faculty) {
    if (!faculty) return;
    const facultyName = faculty.name || 'Dr. Murugesan';
    const dept = faculty.department || 'Artificial Intelligence & Data Science';

    const navNameEl = document.getElementById('faculty-nav-name');
    if (navNameEl) navNameEl.textContent = facultyName;

    const navDeptEl = document.getElementById('faculty-nav-dept');
    if (navDeptEl) navDeptEl.textContent = getShortDept(dept);

    const parts = facultyName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim().split(' ');
    let initials = 'DM';
    if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
        initials = parts[0].substring(0, 2).toUpperCase();
    }
    const avatarEl = document.getElementById('faculty-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;
}

// 5. Populate Session Dropdown (Session name + date/time only)
function populateSessionDropdown(sessions, selectedSession) {
    const selectEl = document.getElementById('prediction-session-select');
    if (!selectEl || !sessions) return;

    const selectedId = selectedSession ? String(selectedSession.id) : '';

    if (selectEl.options.length <= 1 || selectEl.options[0].value === "") {
        selectEl.innerHTML = '';
        if (sessions.length === 0) {
            selectEl.innerHTML = '<option value="">No practical sessions available</option>';
            return;
        }

        sessions.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.practical_name} • ${s.formatted_date} (${s.time_slot})`;
            if (String(s.id) === selectedId) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        });
    } else {
        if (selectedId && selectEl.value !== selectedId) {
            selectEl.value = selectedId;
        }
    }
}

// 6. Render Selected Session Summary Card
function renderSelectedSession(s) {
    if (!s) return;

    const practicalNameEl = document.getElementById('session-practical-name');
    const labCodeEl = document.getElementById('session-lab-code');
    const labNameEl = document.getElementById('session-lab-name');
    const datetimeEl = document.getElementById('session-datetime-display');
    const academicContextEl = document.getElementById('session-academic-context');

    if (practicalNameEl) practicalNameEl.textContent = s.practical_name || 'Practical Session';
    if (labCodeEl) labCodeEl.textContent = s.lab_code || 'DL-LAB-01';
    if (labNameEl) labNameEl.textContent = `${s.lab_name || 'Laboratory'} • ${s.lab_code || 'DL-LAB-01'}`;
    if (datetimeEl) datetimeEl.innerHTML = `<i class="bi bi-clock text-purple-highlight me-1"></i>${escapeHtml(s.formatted_date || s.session_date)} • ${escapeHtml(s.time_slot || s.start_time)}`;

    const sec = s.section ? s.section.replace('Section', '').trim() : 'B';
    const yr = s.year || 'III Year';
    const sem = s.semester || 'V Semester';
    const batch = s.batch || 'Batch 1';
    const count = s.student_count || 42;
    if (academicContextEl) academicContextEl.textContent = `${yr} • ${sem} • Section ${sec} • ${batch} • ${count} Students`;
}

// 7. Render Risk Overview Card
function renderRiskOverview(data) {
    const score = data.risk_score || 0;
    const level = data.risk_level || 'LOW';
    const color = data.risk_color || '#79A88A';
    const affectedCount = data.affected_equipment ? data.affected_equipment.length : 0;
    const genAt = data.generated_at || 'Live';

    const scoreDisplay = document.getElementById('risk-score-display');
    const levelBadge = document.getElementById('risk-level-badge');
    const ratioEl = document.getElementById('risk-apparatus-ratio');
    const progressBar = document.getElementById('risk-progress-bar');
    const summaryText = document.getElementById('risk-summary-text');
    const footerMeta = document.getElementById('risk-generated-at');

    if (scoreDisplay) {
        scoreDisplay.textContent = `${score}%`;
        scoreDisplay.style.color = color;
    }

    if (levelBadge) {
        levelBadge.textContent = level;
        if (level === 'HIGH') {
            levelBadge.className = 'badge extra-small font-monospace px-2.5 py-0.5 rounded-pill badge-rose';
        } else if (level === 'MEDIUM') {
            levelBadge.className = 'badge extra-small font-monospace px-2.5 py-0.5 rounded-pill badge-amber';
        } else {
            levelBadge.className = 'badge extra-small font-monospace px-2.5 py-0.5 rounded-pill badge-emerald';
        }
    }

    // Extract operational counts from factors
    let opText = '2/3 operational';
    if (data.factors) {
        const eqFactor = data.factors.find(f => f.name.includes('Equipment') || f.name.includes('Availability'));
        if (eqFactor && eqFactor.details) {
            const m = eqFactor.details.match(/(\d+)\s+of\s+(\d+)/i);
            if (m) {
                opText = `${m[1]}/${m[2]} operational`;
            }
        }
    }

    if (ratioEl) {
        ratioEl.textContent = `${affectedCount} affected apparatus • ${opText}`;
    }

    if (progressBar) {
        progressBar.style.width = `${score}%`;
        progressBar.style.backgroundColor = color;
        progressBar.setAttribute('aria-valuenow', score);
    }

    if (summaryText) {
        if (level === 'HIGH') {
            summaryText.textContent = "Active equipment fault may affect session capacity.";
        } else if (level === 'MEDIUM') {
            summaryText.textContent = "Moderate disruption risk detected. Verify apparatus availability.";
        } else {
            summaryText.textContent = "Laboratory apparatus is operational for the scheduled practical.";
        }
    }

    if (footerMeta) {
        footerMeta.textContent = `Rule-based assessment • Updated ${genAt}`;
    }
}

// 8. Render Risk Factors (4-Column Grid)
function renderContributingFactors(data) {
    const eqVal = document.getElementById('factor-equipment-val');
    const faultsVal = document.getElementById('factor-faults-val');
    const maintVal = document.getElementById('factor-maint-val');
    const conflictsVal = document.getElementById('factor-conflicts-val');

    const affected = data.affected_equipment || [];
    const faultyCount = affected.filter(e => e.status === 'Faulty').length;
    const maintCount = affected.filter(e => e.status !== 'Faulty').length;

    // Find equipment ratio
    let eqRatio = '2 / 3 operational';
    if (data.factors) {
        const f = data.factors.find(x => x.name.includes('Equipment') || x.name.includes('Availability'));
        if (f && f.details) {
            const m = f.details.match(/(\d+)\s+of\s+(\d+)/i);
            if (m) eqRatio = `${m[1]} / ${m[2]} operational`;
        }
    }

    if (eqVal) eqVal.textContent = eqRatio;

    if (faultsVal) {
        if (faultyCount > 0) {
            faultsVal.textContent = `${faultyCount} active`;
            faultsVal.className = 'text-rose fw-bold font-monospace fs-6';
        } else {
            faultsVal.textContent = 'None';
            faultsVal.className = 'text-emerald fw-bold font-monospace fs-6';
        }
    }

    if (maintVal) {
        if (maintCount > 0) {
            maintVal.textContent = `${maintCount} active`;
            maintVal.className = 'text-amber fw-bold font-monospace fs-6';
        } else {
            maintVal.textContent = 'None';
            maintVal.className = 'text-emerald fw-bold font-monospace fs-6';
        }
    }

    if (conflictsVal) {
        const cf = data.factors ? data.factors.find(x => x.name.includes('Conflict')) : null;
        if (cf && cf.badge && !cf.badge.includes('No Conflicts')) {
            conflictsVal.textContent = cf.badge;
            conflictsVal.className = 'text-amber fw-bold font-monospace fs-6';
        } else {
            conflictsVal.textContent = 'None';
            conflictsVal.className = 'text-slate-300 fw-bold font-monospace fs-6';
        }
    }
}

// 9. Render Affected Equipment (Full-Width Items with Right-Aligned Status)
function renderAffectedEquipment(affected) {
    const container = document.getElementById('affected-equipment-container');
    const badge = document.getElementById('affected-count-badge');
    if (!container) return;

    const count = affected ? affected.length : 0;
    if (badge) {
        badge.textContent = count === 1 ? '1 apparatus' : `${count} apparatus`;
    }

    if (!affected || affected.length === 0) {
        container.innerHTML = '<div class="text-slate-400 extra-small py-1">No affected equipment.</div>';
        return;
    }

    let html = '';
    affected.forEach(eq => {
        const isFaulty = eq.status === 'Faulty';
        const badgeClass = isFaulty ? 'status-faulty' : 'status-maintenance';
        const typeColor = isFaulty ? 'text-rose' : 'text-amber';

        html += `
        <div class="p-3 rounded d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                    <span class="text-white fw-bold small">${escapeHtml(eq.name)}</span>
                    <span class="font-monospace text-purple-highlight extra-small">${escapeHtml(eq.equipment_code)}</span>
                </div>
                <div class="text-slate-400 extra-small">
                    <span class="${typeColor} fw-semibold">${escapeHtml(eq.fault_type)}</span> • ${escapeHtml(eq.fault_description)}
                </div>
            </div>
            <span class="status-pill ${badgeClass} extra-small text-uppercase align-self-start align-self-sm-center flex-shrink-0">${escapeHtml(eq.status)}</span>
        </div>
        `;
    });

    container.innerHTML = html;
}

// 10. Render Recommended Action (Vertically Centered & Concise)
function renderRecommendation(recommendation) {
    const textEl = document.getElementById('recommendation-text');
    if (textEl) {
        let cleanRec = recommendation || "Allocate alternate operational equipment before the session.";
        if (cleanRec.includes('.')) {
            const firstSentence = cleanRec.split('.')[0].trim() + '.';
            if (firstSentence.length >= 20) {
                cleanRec = firstSentence;
            }
        }
        textEl.textContent = cleanRec;
    }
}

// 11. Render Compatible Alternatives (Responsive Grid: 3 Col Desktop, 2 Col Tablet, 1 Col Mobile)
function renderAlternateEquipment(alternates) {
    const container = document.getElementById('alternate-equipment-container');
    const badge = document.getElementById('alternate-count-badge');
    if (!container) return;

    const count = alternates ? alternates.length : 0;
    if (badge) {
        badge.textContent = count > 0 ? `${count} Available` : 'Standby Available';
    }

    if (!alternates || alternates.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="text-slate-400 extra-small py-1">No compatible alternate equipment available.</div></div>';
        return;
    }

    let html = '';
    alternates.forEach(alt => {
        html += `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="p-3 rounded h-100 d-flex flex-column justify-content-between" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                <div class="mb-2">
                    <div class="text-white small fw-bold mb-1 text-wrap">${escapeHtml(alt.name)}</div>
                    <div class="font-monospace text-purple-highlight extra-small mb-1">${escapeHtml(alt.equipment_code)}</div>
                    <div class="text-slate-400 extra-small">${escapeHtml(alt.lab_name)} • <span class="font-monospace text-slate-300">${escapeHtml(alt.lab_code)}</span></div>
                </div>
                <div class="pt-2 border-top border-secondary-subtle d-flex justify-content-end">
                    <span class="status-pill status-available extra-small">Available</span>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// Helper: Short Department Name
function getShortDept(dept) {
    if (!dept) return 'AI & DS';
    if (dept.toLowerCase().includes('artificial') || dept.toLowerCase().includes('ai')) return 'AI & DS';
    if (dept.toLowerCase().includes('computer')) return 'CSE';
    if (dept.toLowerCase().includes('information')) return 'IT';
    if (dept.toLowerCase().includes('electronics') || dept.toLowerCase().includes('communication')) return 'ECE';
    if (dept.toLowerCase().includes('mechanical')) return 'MECH';
    if (dept.toLowerCase().includes('electrical')) return 'EEE';
    return dept;
}

// Helper: HTML Escaper
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Error state rendering
function renderErrorState(message) {
    const summaryText = document.getElementById('risk-summary-text');
    if (summaryText) summaryText.textContent = message;
}

// Logout Modal Handlers
// ==========================================
// FACULTY LOGOUT FUNCTIONALITY
// ==========================================
let isFacultyLoggingOut = false;

function openLogoutModal() {
    const modalEl = document.getElementById('facultyLogoutModal');
    if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        if (confirm('Are you sure you want to sign out of the Faculty Portal?')) {
            executeFacultyLogout();
        }
    }
}

async function executeFacultyLogout() {
    if (isFacultyLoggingOut) return;
    isFacultyLoggingOut = true;

    const confirmBtn = document.getElementById('btn-confirm-faculty-logout') || document.querySelector('.btn-modal-confirm-logout');
    const alertBox = document.getElementById('faculty-logout-alert');
    if (alertBox) alertBox.classList.add('d-none');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Signing Out...';
    }

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    } catch (err) {
        console.warn('Logout network notice:', err);
    } finally {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageErr) {
            console.warn('Storage cleanup notice:', storageErr);
        }
        window.location.replace('/login');
    }
}

