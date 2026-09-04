/* ==========================================================================
   LabFlow Lite - Faculty Usage History Controller
   Real-Time Database Records, Equipment Usage Log & Responsive 2-Column Grid
   ========================================================================== */

let usageRefreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFacultyUsageData();
    // Real-time synchronization polling every 20 seconds
    usageRefreshInterval = setInterval(loadFacultyUsageData, 20000);
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        fetch('/api/auth/me').then(res => {
            if (!res.ok) window.location.replace('/login');
        }).catch(() => window.location.replace('/login'));
    }
});

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

async function loadFacultyUsageData() {
    const grid = document.getElementById('faculty-usage-grid');
    try {
        const res = await fetch('/api/faculty/usage?_t=' + new Date().getTime());
        if (res.status === 401) { window.location.replace('/login'); return; }
        if (res.status === 403) { window.location.replace('/dashboard/student'); return; }

        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
            renderFacultyProfile(json.data.faculty);
            renderUsageStats(json.data);
            renderUsageGrid(json.data.usage || []);
        } else {
            showUsageError(json.message || 'Failed to load usage history.');
        }
    } catch (e) {
        console.error('Error loading usage data:', e);
        showUsageError('Network error loading equipment usage records.');
    }
}

function renderFacultyProfile(faculty) {
    if (!faculty) return;
    const facName = faculty.name || 'Dr. Murugesan';
    const dept = faculty.department || 'Artificial Intelligence & Data Science';
    const navName = document.getElementById('faculty-nav-name');
    if (navName) navName.textContent = facName;
    const navDept = document.getElementById('faculty-nav-dept');
    if (navDept) navDept.textContent = getShortDept(dept);
    const headerLabel = document.getElementById('header-faculty-label');
    if (headerLabel) headerLabel.textContent = facName + ' • ' + getShortDept(dept);
    const parts = facName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim().split(' ');
    let initials = 'DM';
    if (parts.length >= 2) { initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); }
    else if (parts.length === 1 && parts[0].length > 0) { initials = parts[0].substring(0, 2).toUpperCase(); }
    const avatarEl = document.getElementById('faculty-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;
}

function renderUsageStats(data) {
    const totalCount = data.total_records || 0;
    const totalMins = data.total_duration_minutes || 0;

    const totalCountEl = document.getElementById('stat-total-usage');
    if (totalCountEl) totalCountEl.textContent = totalCount;

    const counterEl = document.getElementById('usage-records-counter');
    if (counterEl) counterEl.textContent = `${totalCount} Record${totalCount === 1 ? '' : 's'}`;

    const totalTimeEl = document.getElementById('stat-total-time');
    if (totalTimeEl) {
        if (totalMins >= 60) {
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            totalTimeEl.textContent = `${hrs} hr${hrs === 1 ? '' : 's'}` + (mins ? ` ${mins}m` : '');
        } else {
            totalTimeEl.textContent = `${totalMins} min${totalMins === 1 ? '' : 's'}`;
        }
    }
}

function renderUsageGrid(records) {
    const grid = document.getElementById('faculty-usage-grid');
    if (!grid) return;

    if (!records || records.length === 0) {
        grid.innerHTML = `
            <div class="faculty-card p-5 text-center grid-col-full">
                <i class="bi bi-clock-history text-slate-500 fs-1 d-block mb-3"></i>
                <h5 class="text-white fw-bold mb-1">No equipment usage recorded yet</h5>
                <p class="text-secondary-label extra-small mb-0">Completed apparatus usages and session checkouts will appear here.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = records.map(r => {
        return `
            <div class="faculty-usage-card">
                <!-- Top Bar: Status Badge + Lab Code -->
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="status-pill status-available extra-small">
                        <i class="bi bi-check2-circle me-1"></i>Completed
                    </span>
                    <span class="lab-code-pill font-monospace">${escapeHtml(r.lab_code)}</span>
                </div>

                <!-- Equipment Details Header -->
                <div class="usage-card-title-section mb-3">
                    <h5 class="usage-card-name mb-1" title="${escapeHtml(r.equipment_name)}">${escapeHtml(r.equipment_name)}</h5>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge badge-purple-pill font-monospace extra-small">${escapeHtml(r.equipment_code)}</span>
                        <span class="text-slate-400 extra-small">• ${escapeHtml(r.category)}</span>
                    </div>
                </div>

                <!-- Laboratory & Subject Rows -->
                <div class="usage-meta-grid mb-3">
                    <div class="usage-meta-item">
                        <span class="usage-meta-label">LABORATORY</span>
                        <div class="usage-meta-val text-white">
                            <i class="bi bi-building me-1 text-purple-highlight"></i>${escapeHtml(r.lab_name)}
                        </div>
                    </div>
                    <div class="usage-meta-item">
                        <span class="usage-meta-label">PRACTICAL / SUBJECT</span>
                        <div class="usage-meta-val text-purple-highlight fw-semibold">
                            <i class="bi bi-journal-code me-1"></i>${escapeHtml(r.practical_name)}
                        </div>
                    </div>
                </div>

                <!-- Date, Time & Duration Info Box -->
                <div class="usage-timing-box mb-3">
                    <div class="row g-2">
                        <div class="col-4">
                            <span class="usage-meta-label">DATE</span>
                            <div class="usage-timing-val text-white font-monospace">
                                <i class="bi bi-calendar3 me-1 text-purple-highlight"></i>${escapeHtml(r.formatted_date)}
                            </div>
                        </div>
                        <div class="col-5">
                            <span class="usage-meta-label">TIME SLOT</span>
                            <div class="usage-timing-val text-white font-monospace">
                                <i class="bi bi-clock me-1 text-purple-highlight"></i>${escapeHtml(r.time_slot)}
                            </div>
                        </div>
                        <div class="col-3 text-end">
                            <span class="usage-meta-label">DURATION</span>
                            <div class="usage-timing-val text-emerald fw-bold font-monospace">
                                <i class="bi bi-hourglass-split me-1"></i>${escapeHtml(r.duration_display)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card Footer -->
                <div class="usage-card-footer d-flex align-items-center justify-content-between pt-2 border-top border-secondary-subtle extra-small">
                    <span class="text-slate-400 font-monospace"><i class="bi bi-shield-check text-emerald me-1"></i>Verified Usage Session</span>
                    <span class="text-purple-highlight fw-semibold">Lead Faculty Log</span>
                </div>
            </div>
        `;
    }).join('');
}

function showUsageError(msg) {
    const grid = document.getElementById('faculty-usage-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="faculty-card p-4 text-center grid-col-full text-rose">
                <i class="bi bi-exclamation-octagon fs-2 d-block mb-2"></i>
                <h6 class="text-white fw-bold mb-1">Failed to load records</h6>
                <p class="extra-small mb-0">${escapeHtml(msg)}</p>
            </div>
        `;
    }
}

function getShortDept(dept) {
    if (!dept) return 'AI & DS';
    if (dept.includes('Artificial Intelligence')) return 'AI & DS';
    if (dept.includes('Information Technology')) return 'IT';
    if (dept.includes('Computer Science')) return 'CSE';
    if (dept.includes('Electronics')) return 'ECE';
    return dept;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function handleNavPlaceholder(e, moduleName) { if (e && e.preventDefault) e.preventDefault(); }

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

