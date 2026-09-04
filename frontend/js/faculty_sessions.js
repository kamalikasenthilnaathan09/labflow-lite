/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Today's Sessions JavaScript (Refined UI/UX)
   Structured Card Layout, Academic Chips, Real-Time Status & Clean Filtering
   ========================================================================== */

let allSessionsData = [];
let academicContextData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadTodaySessions();
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

// 2. Fetch Sessions Data from API
async function loadTodaySessions() {
    const container = document.getElementById('sessions-list-container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5 text-slate-400">
                <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
                Loading today's laboratory sessions...
            </div>
        `;
    }

    try {
        const url = '/api/faculty/sessions/today?_t=' + new Date().getTime();
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
            const data = json.data;
            allSessionsData = data.sessions || [];
            academicContextData = data.academic_context;

            renderFacultyHeader(data.faculty);
            renderAcademicContext(data.academic_context);
            renderSummaryCards(data.summary);
            populateLabFilter(data.filter_options?.labs || []);
            renderSessionsList(allSessionsData);
        } else {
            renderErrorState(json.message || "Unable to load today's sessions.");
        }
    } catch (e) {
        console.error('Failed to load sessions:', e);
        renderErrorState("Unable to load today's sessions. Please check your network connection.");
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

// 4. Render Academic Context Grid & Dynamic Date
function renderAcademicContext(ctx) {
    if (!ctx) return;
    const dateEl = document.getElementById('dynamic-date-display');
    if (dateEl) {
        dateEl.textContent = ctx.date_formatted || 'Wednesday, September 2, 2026';
    }

    const deptEl = document.getElementById('ctx-dept');
    if (deptEl) deptEl.textContent = getShortDept(ctx.department || 'AI & DS');

    const yearEl = document.getElementById('ctx-year');
    if (yearEl) yearEl.textContent = ctx.year || 'III Year';

    const semEl = document.getElementById('ctx-sem');
    if (semEl) semEl.textContent = ctx.semester || 'V Semester';

    const secEl = document.getElementById('ctx-section');
    if (secEl) {
        // e.g. "Section B" or "Sections A, B & C"
        secEl.textContent = ctx.section || 'Section B';
    }
}

// 5. Render Summary Cards
function renderSummaryCards(summary) {
    if (!summary) return;
    const totalEl = document.getElementById('stat-total-sessions');
    if (totalEl) {
        const count = summary.total_sessions || 0;
        totalEl.textContent = count < 10 ? `0${count}` : count;
    }

    const upEl = document.getElementById('stat-upcoming-sessions');
    if (upEl) {
        const count = summary.upcoming || 0;
        upEl.textContent = count < 10 ? `0${count}` : count;
    }

    const inEl = document.getElementById('stat-insession-sessions');
    if (inEl) {
        const count = summary.in_session || 0;
        inEl.textContent = count < 10 ? `0${count}` : count;
    }

    const compEl = document.getElementById('stat-completed-sessions');
    if (compEl) {
        const count = summary.completed || 0;
        compEl.textContent = count < 10 ? `0${count}` : count;
    }
}

// 6. Populate Lab Dropdown Filter
function populateLabFilter(labs) {
    const select = document.getElementById('filter-lab');
    if (!select || select.options.length > 1) return;

    labs.forEach(lab => {
        const opt = document.createElement('option');
        opt.value = lab.id;
        opt.textContent = lab.name;
        select.appendChild(opt);
    });
}

// 7. Render Refined Session Cards
function renderSessionsList(sessions) {
    const container = document.getElementById('sessions-list-container');
    const countBadge = document.getElementById('active-count-badge');
    if (!container) return;

    if (countBadge) {
        countBadge.textContent = `${sessions.length} Session${sessions.length === 1 ? '' : 's'}`;
    }

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-calendar-x fs-1 text-slate-500 d-block mb-3"></i>
                <h5 class="text-white fw-bold mb-1">No laboratory sessions scheduled for today.</h5>
                <p class="text-slate-400 small mb-3">Your schedule is clear for today.</p>
                <button type="button" class="btn btn-sm btn-outline-custom rounded-pill px-4" onclick="resetFilters()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Reset Filters
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = sessions.map(s => {
        const st = (s.computed_status || 'UPCOMING').toUpperCase();
        const isLive = (st === 'IN SESSION');
        
        let statusClass = 'status-booked';
        let statusBadgeText = 'UPCOMING';
        let statusIcon = 'bi-hourglass-split';

        if (st === 'IN SESSION') {
            statusClass = 'status-insession';
            statusBadgeText = 'IN SESSION';
            statusIcon = 'bi-broadcast';
        } else if (st === 'COMPLETED') {
            statusClass = 'status-available';
            statusBadgeText = 'COMPLETED';
            statusIcon = 'bi-check2-circle';
        } else if (st === 'CANCELLED') {
            statusClass = 'status-maintenance';
            statusBadgeText = 'CANCELLED';
            statusIcon = 'bi-x-circle';
        }

        const deptShort = getShortDept(s.department || 'AI & DS');
        const labLocation = s.lab_location || (s.lab_id === 6 ? 'Block A • 1st Floor • Room 108' : 'Block A • 3rd Floor • Room 310');

        return `
            <div class="session-card-refined ${isLive ? 'session-card-live' : ''}">
                <!-- 1. Header: Time (Left), Status Badge (Right) -->
                <div class="session-card-top-row">
                    <div class="d-flex align-items-center gap-2.5">
                        <div class="session-time-pill font-monospace">
                            <i class="bi bi-clock me-1.5 text-purple-highlight"></i>${escapeHtml(s.formatted_time || '')}
                        </div>
                        ${isLive ? '<span class="live-indicator-pill"><span class="live-dot-pulse"></span> CURRENT SESSION</span>' : ''}
                    </div>
                    <div>
                        <span class="status-pill ${statusClass}">
                            <i class="bi ${statusIcon} me-1"></i>${statusBadgeText}
                        </span>
                    </div>
                </div>

                <!-- 2. Session Practical Title -->
                <div class="session-title-section my-2">
                    <h4 class="session-subject-title text-white mb-0">${escapeHtml(s.practical_name || 'Practical Session')}</h4>
                </div>

                <!-- 3. Lab Information Block -->
                <div class="session-lab-info-block mb-3">
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <i class="bi bi-building text-purple-highlight"></i>
                        <span class="session-lab-title">${escapeHtml(s.lab_name || '')}</span>
                        <span class="lab-code-pill font-monospace">${escapeHtml(s.lab_code || 'LAB')}</span>
                    </div>
                    <div class="session-location-subtext">
                        <i class="bi bi-geo-alt text-slate-500 me-1"></i>${escapeHtml(labLocation)}
                    </div>
                </div>

                <!-- 4. Academic Information Chips -->
                <div class="session-chips-row mb-3">
                    <span class="academic-chip chip-dept">${escapeHtml(deptShort)}</span>
                    <span class="academic-chip">${escapeHtml(s.year || 'III Year')}</span>
                    <span class="academic-chip">${escapeHtml(s.semester || 'V Semester')}</span>
                    <span class="academic-chip chip-section">Section ${escapeHtml(s.section || 'B')}</span>
                    <span class="academic-chip chip-batch">${escapeHtml(s.batch || 'Batch 1')}</span>
                </div>

                <!-- 5. Footer Row: Faculty & Students Blocks -->
                <div class="session-card-footer">
                    <div class="footer-meta-block">
                        <span class="footer-meta-label">FACULTY</span>
                        <div class="footer-meta-val">
                            <i class="bi bi-person-badge text-purple-highlight me-1"></i>
                            <span class="text-white">${escapeHtml(s.faculty_name || 'Dr. Murugesan')}</span>
                        </div>
                    </div>
                    <div class="footer-meta-block text-end">
                        <span class="footer-meta-label">STUDENTS</span>
                        <div class="footer-meta-val">
                            <i class="bi bi-people text-slate-400 me-1"></i>
                            <span class="text-white">${escapeHtml(s.student_count || 42)} Students</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 8. Client-side Filter Handling
function applyFilters() {
    const labVal = document.getElementById('filter-lab')?.value || 'all';
    const batchVal = document.getElementById('filter-batch')?.value || 'all';
    const statusVal = document.getElementById('filter-status')?.value || 'all';

    const filtered = allSessionsData.filter(s => {
        // Lab filter
        if (labVal !== 'all' && String(s.lab_id) !== String(labVal)) {
            return false;
        }

        // Batch filter
        if (batchVal !== 'all' && s.batch !== batchVal) {
            return false;
        }

        // Status filter
        if (statusVal !== 'all' && (s.computed_status || '').toUpperCase() !== statusVal.toUpperCase()) {
            return false;
        }

        return true;
    });

    renderSessionsList(filtered);
}

// 9. Reset Filters
function resetFilters() {
    const labSelect = document.getElementById('filter-lab');
    if (labSelect) labSelect.value = 'all';

    const batchSelect = document.getElementById('filter-batch');
    if (batchSelect) batchSelect.value = 'all';

    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) statusSelect.value = 'all';

    renderSessionsList(allSessionsData);
}

// 10. Helper: Short Department Name
function getShortDept(dept) {
    if (!dept) return 'AI & DS';
    if (dept.includes('Artificial Intelligence')) return 'AI & DS';
    if (dept.includes('Computer Science')) return 'CSE';
    if (dept.includes('Electronics')) return 'ECE';
    if (dept.includes('Electrical')) return 'EEE';
    if (dept.includes('Information Technology')) return 'IT';
    return dept;
}

// 11. Error State Renderer with Retry
function renderErrorState(errorMessage) {
    const container = document.getElementById('sessions-list-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="badge-rose d-inline-flex align-items-center justify-content-center rounded-circle p-3 mb-3" style="width: 54px; height: 54px;">
                <i class="bi bi-exclamation-triangle-fill fs-3 text-rose"></i>
            </div>
            <h5 class="text-white fw-bold mb-1">Unable to load today's sessions.</h5>
            <p class="text-slate-400 small mb-4">${escapeHtml(errorMessage)}</p>
            <button type="button" class="btn btn-sm btn-purple rounded-pill px-4 py-2" onclick="loadTodaySessions()">
                <i class="bi bi-arrow-clockwise me-1"></i> Retry
            </button>
        </div>
    `;
}

// 12. Toast and Navigation Placeholders
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

// 13. Logout Flow
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
