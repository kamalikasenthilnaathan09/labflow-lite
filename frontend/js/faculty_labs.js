/* ==========================================================================
   LabFlow Lite - Dedicated Faculty "Our Labs" Client JavaScript
   Synchronized Live Status, Clean Spaced Academic Chips, & Structured Session Cards
   ========================================================================== */

let myLabData = null;
let labSessionsData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadLabsData();
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

// 2. Fetch Labs Data from API
async function loadLabsData() {
    try {
        const res = await fetch('/api/faculty/labs');
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
            const data = json.data;
            myLabData = data.my_lab;
            labSessionsData = data.lab_sessions || [];

            renderFacultyHeader(data.faculty);
            renderMyLab(myLabData);
            renderLabSessions(labSessionsData);
        } else {
            renderErrorState(json.message || "Unable to load laboratory.");
        }
    } catch (e) {
        console.error('Failed to load labs:', e);
        renderErrorState("Unable to load laboratory. Please check your network connection.");
    }
}

// 3. Render Faculty Header Profile
function renderFacultyHeader(faculty) {
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

// 4. Render My Laboratory (Single Coherent Card)
function renderMyLab(lab) {
    const wrapper = document.getElementById('my-lab-card-wrapper');
    if (!wrapper) return;

    if (!lab) {
        wrapper.innerHTML = `
            <div class="faculty-card p-4 text-center text-slate-400">
                <i class="bi bi-building-x fs-3 d-block mb-2"></i>
                No laboratory currently assigned.
            </div>
        `;
        return;
    }

    const sess = lab.current_session || {};
    const isLive = (lab.status || '').toUpperCase() === 'IN SESSION';
    const statusClass = isLive ? 'status-insession' : (lab.status_class || 'status-available');
    const deptShort = getShortDept(sess.department || lab.department || 'AI & DS');
    const year = sess.year || 'III Year';
    const sem = sess.semester || 'V Semester';
    const sec = sess.section ? (sess.section.startsWith('Section') ? sess.section : `Section ${sess.section}`) : 'Section A';
    const batch = sess.batch || 'Batch 1';

    wrapper.innerHTML = `
        <div class="coherent-lab-card ${isLive ? 'coherent-lab-live' : ''}">
            <!-- 1. Top Row: Lab Code & Status Badge -->
            <div class="d-flex align-items-center justify-content-between mb-3 pb-2.5 border-bottom border-secondary-subtle">
                <div class="d-flex align-items-center gap-2">
                    <span class="lab-code-pill font-monospace fs-6">${escapeHtml(lab.code || 'DL-LAB-01')}</span>
                </div>
                <div>
                    <span class="status-pill ${statusClass}">
                        ${isLive ? '<span class="live-dot-pulse"></span>' : ''} ${escapeHtml((lab.status || 'IN SESSION').toUpperCase())}
                    </span>
                </div>
            </div>

            <!-- 2. Lab Name & Location -->
            <div class="mb-3">
                <h3 class="text-white fw-bold mb-1 fs-4">${escapeHtml(lab.name || 'Advanced Computing & AI Research Lab')}</h3>
                <div class="text-slate-400 small">
                    <i class="bi bi-geo-alt text-purple-highlight me-1.5"></i>${escapeHtml(lab.location || 'Block A, 3rd Floor, Room 310')}
                </div>
            </div>

            <!-- 3. Current Session & Time Row -->
            <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-1 mb-2.5 pt-2.5 border-top border-secondary-subtle">
                <div class="text-white fw-bold fs-6">
                    ${escapeHtml(sess.practical_name || 'Deep Learning Practical')}
                </div>
                <div class="font-monospace text-purple-highlight fw-bold small">
                    ${escapeHtml(sess.time_formatted || '02:00 PM — 04:00 PM')}
                </div>
            </div>

            <!-- 4. Academic Context Chips with Clean Spacing -->
            <div class="d-flex flex-wrap align-items-center gap-2 mb-3.5">
                <span class="academic-chip chip-dept extra-small">[ ${escapeHtml(deptShort)} ]</span>
                <span class="academic-chip extra-small">[ ${escapeHtml(year)} ]</span>
                <span class="academic-chip extra-small">[ ${escapeHtml(sem)} ]</span>
                <span class="academic-chip chip-section extra-small">[ ${escapeHtml(sec)} ]</span>
                <span class="academic-chip chip-batch extra-small">[ ${escapeHtml(batch)} ]</span>
            </div>

            <!-- 5. Footer: Faculty + Students + Action -->
            <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 pt-3 border-top border-secondary-subtle">
                <div class="d-flex align-items-center gap-4">
                    <div class="footer-meta-block">
                        <span class="footer-meta-label">FACULTY</span>
                        <div class="text-slate-100 fw-bold small">${escapeHtml(sess.faculty_name || 'Dr. Murugesan')}</div>
                    </div>
                    <div class="footer-meta-block">
                        <span class="footer-meta-label">STUDENTS</span>
                        <div class="text-slate-100 font-monospace fw-bold small">${escapeHtml(sess.student_count || 40)} Students</div>
                    </div>
                </div>

                <div>
                    <button type="button" class="btn btn-sm btn-outline-custom rounded-pill px-3.5 py-1.5 extra-small fw-semibold" onclick="openLabDetailsModal()">
                        View Lab Details <i class="bi bi-arrow-right ms-1"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 5. Render Laboratory Sessions (Clean Structured Cards)
function renderLabSessions(sessions) {
    const container = document.getElementById('lab-sessions-list');
    const pill = document.getElementById('sessions-count-pill');
    if (!container) return;

    if (pill) {
        pill.textContent = `${sessions.length} Session${sessions.length === 1 ? '' : 's'}`;
    }

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-slate-400 small">No sessions scheduled for today.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="d-flex flex-column gap-3">
            ${sessions.map(s => {
                const isLive = s.status === 'IN SESSION';
                const statusClass = s.status_class || (isLive ? 'status-insession' : 'status-completed');
                const deptShort = getShortDept(s.department || 'AI & DS');
                
                return `
                    <div class="lab-session-card-refined ${isLive ? 'session-card-live' : ''} p-3 rounded">
                        <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                            <div class="d-flex flex-column flex-sm-row align-items-sm-center gap-3 gap-md-4">
                                <!-- Time Block -->
                                <div class="session-time-col">
                                    <span class="footer-meta-label d-block mb-1">TIME</span>
                                    <span class="font-monospace text-purple-highlight fw-bold small">${escapeHtml(s.time_formatted)}</span>
                                </div>
                                
                                <!-- Session & Class Block -->
                                <div class="session-subject-col">
                                    <span class="footer-meta-label d-block mb-1">SESSION</span>
                                    <div class="text-white fw-bold small mb-1.5">${escapeHtml(s.practical_name)}</div>
                                    <div class="d-flex flex-wrap align-items-center gap-1.5">
                                        <span class="academic-chip chip-dept extra-small">${escapeHtml(deptShort)}</span>
                                        <span class="academic-chip extra-small">${escapeHtml(s.year || 'III Year')}</span>
                                        <span class="academic-chip extra-small">${escapeHtml(s.semester || 'V Semester')}</span>
                                        <span class="academic-chip chip-section extra-small">${escapeHtml(s.section || 'Section A')}</span>
                                        <span class="academic-chip chip-batch extra-small">${escapeHtml(s.batch || 'Batch 1')}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Students & Status -->
                            <div class="d-flex align-items-center justify-content-between justify-content-lg-end gap-3 gap-md-4 pt-2 pt-lg-0 border-top border-lg-0 border-secondary-subtle">
                                <div class="text-start text-lg-end">
                                    <span class="footer-meta-label d-block mb-1">STUDENTS</span>
                                    <span class="text-white font-monospace fw-bold small">${escapeHtml(s.student_count)} Students</span>
                                </div>
                                <div>
                                    <span class="status-pill ${statusClass} extra-small">
                                        ${isLive ? '<span class="live-dot-pulse"></span>' : ''} ${escapeHtml(s.status)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 6. Open Lab Details Modal
function openLabDetailsModal() {
    if (!myLabData) return;

    const modalName = document.getElementById('modal-lab-name');
    if (modalName) modalName.textContent = myLabData.name || 'Advanced Computing & AI Research Lab';

    const modalCode = document.getElementById('modal-lab-code');
    if (modalCode) modalCode.textContent = myLabData.code || 'DL-LAB-01';

    const modalBody = document.getElementById('modal-lab-body');
    if (!modalBody) return;

    const sess = myLabData.current_session || {};
    const isLive = (myLabData.status || '').toUpperCase() === 'IN SESSION';
    const statusClass = isLive ? 'status-insession' : (myLabData.status_class || 'status-available');

    modalBody.innerHTML = `
        <div class="row g-3">
            <!-- Facility Specs -->
            <div class="col-12 col-md-6">
                <div class="p-3 rounded h-100" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                    <h6 class="text-purple-highlight fw-bold extra-small tracking-wider text-uppercase mb-2.5">
                        <i class="bi bi-geo-alt me-1"></i> FACILITY LOCATION &amp; SPECS
                    </h6>
                    <div class="mb-2">
                        <span class="footer-meta-label">FACILITY NAME</span>
                        <div class="text-white fw-semibold small">${escapeHtml(myLabData.name || '')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">BUILDING &amp; ROOM</span>
                        <div class="text-white fw-semibold small">${escapeHtml(myLabData.location || '')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">HOST DEPARTMENT</span>
                        <div class="text-white fw-semibold small">${escapeHtml(myLabData.department || 'Artificial Intelligence & Data Science')}</div>
                    </div>
                    <div class="mb-0">
                        <span class="footer-meta-label">OPERATIONAL STATUS</span>
                        <div>
                            <span class="status-pill ${statusClass} extra-small mt-1">${escapeHtml((myLabData.status || 'IN SESSION').toUpperCase())}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Timetable & Faculty -->
            <div class="col-12 col-md-6">
                <div class="p-3 rounded h-100" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                    <h6 class="text-purple-highlight fw-bold extra-small tracking-wider text-uppercase mb-2.5">
                        <i class="bi bi-calendar-event me-1"></i> TEACHING ASSIGNMENT
                    </h6>
                    <div class="mb-2">
                        <span class="footer-meta-label">PRIMARY SUBJECT</span>
                        <div class="text-white fw-semibold small">${escapeHtml(sess.practical_name || 'Deep Learning Practical')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">ASSIGNED FACULTY</span>
                        <div class="text-white fw-semibold small">${escapeHtml(sess.faculty_name || 'Dr. Murugesan')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">CURRENT ACTIVE SLOT</span>
                        <div class="text-purple-highlight font-monospace fw-bold small">${escapeHtml(sess.time_formatted || '02:00 PM — 04:00 PM')}</div>
                    </div>
                    <div class="mb-0">
                        <span class="footer-meta-label">ENROLLED BATCH</span>
                        <div class="text-slate-300 extra-small">AI &amp; DS • III Year • V Semester • Section A • Batch 1 (${escapeHtml(sess.student_count || 40)} Students)</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalEl = document.getElementById('labDetailsModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// 7. Error State Renderer with Retry
function renderErrorState(errorMessage) {
    const wrapper = document.getElementById('my-lab-card-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <div class="faculty-card p-4 text-center">
            <div class="badge-rose d-inline-flex align-items-center justify-content-center rounded-circle p-3 mb-3" style="width: 50px; height: 50px;">
                <i class="bi bi-exclamation-triangle-fill fs-4 text-rose"></i>
            </div>
            <h5 class="text-white fw-bold mb-1">Unable to load laboratory.</h5>
            <p class="text-slate-400 small mb-4">${escapeHtml(errorMessage)}</p>
            <button type="button" class="btn btn-sm btn-purple rounded-pill px-4 py-2" onclick="loadLabsData()">
                <i class="bi bi-arrow-clockwise me-1"></i> Retry
            </button>
        </div>
    `;
}

// 8. Helper: Short Department Name
function getShortDept(dept) {
    if (!dept) return 'AI & DS';
    if (dept.includes('Artificial Intelligence')) return 'AI & DS';
    if (dept.includes('Computer Science')) return 'CSE';
    if (dept.includes('Electronics')) return 'ECE';
    if (dept.includes('Electrical')) return 'EEE';
    if (dept.includes('Information Technology')) return 'IT';
    return dept;
}

// 9. Toast and Navigation Placeholders
function handleNavPlaceholder(e, moduleName) {
    if (e && e.preventDefault) e.preventDefault();

    const sidebar = document.getElementById('faculty-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
        if (overlay) overlay.classList.add('d-none');
    }

    showToast(`The ${moduleName} module will be available in the upcoming release.`, 'info');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const borderClass = type === 'error' ? 'border-danger' : 'border-purple';
    const iconClass = type === 'error' ? 'bi-exclamation-triangle text-rose' : 'bi-info-circle text-purple-highlight';

    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white border ${borderClass} mb-2 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true" style="background-color: var(--bg-card); border-radius: 8px;">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2 small">
                    <i class="bi ${iconClass} fs-5"></i>
                    <div>${escapeHtml(message)}</div>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    if (toastEl) {
        const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
        bsToast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
}

// 10. Logout Flow
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


function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
