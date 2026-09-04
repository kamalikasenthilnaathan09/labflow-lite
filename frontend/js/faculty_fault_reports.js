/* ==========================================================================
   LabFlow Lite - Faculty Fault Reports Controller
   Real-Time Database Records, Equipment Status Synchronization & 2-Column Grid
   ========================================================================== */

let faultsRefreshInterval = null;
let equipmentOptionsList = [];

document.addEventListener('DOMContentLoaded', () => {
    loadFacultyFaultsData();
    // Real-time synchronization polling every 20 seconds
    faultsRefreshInterval = setInterval(loadFacultyFaultsData, 20000);
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

async function loadFacultyFaultsData() {
    try {
        const res = await fetch('/api/faculty/fault-reports?_t=' + new Date().getTime());
        if (res.status === 401) { window.location.replace('/login'); return; }
        if (res.status === 403) { window.location.replace('/dashboard/student'); return; }

        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
            renderFacultyProfile(json.data.faculty);
            equipmentOptionsList = json.data.equipment_options || [];
            populateEquipmentDropdown(equipmentOptionsList);
            renderFaultStats(json.data.fault_reports || []);
            renderFaultGrid(json.data.fault_reports || []);
        } else {
            showFaultError(json.message || 'Failed to load fault reports.');
        }
    } catch (e) {
        console.error('Error loading fault reports:', e);
        showFaultError('Network error loading equipment fault reports.');
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
    const parts = facName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim().split(' ');
    let initials = 'DM';
    if (parts.length >= 2) { initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); }
    else if (parts.length === 1 && parts[0].length > 0) { initials = parts[0].substring(0, 2).toUpperCase(); }
    const avatarEl = document.getElementById('faculty-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;
}

function populateEquipmentDropdown(options) {
    const select = document.getElementById('fault-equipment-select');
    if (!select) return;

    if (!options || options.length === 0) {
        select.innerHTML = '<option value="">No equipment available in database</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Choose apparatus from laboratory --</option>' +
        options.map(eq => {
            return `<option value="${eq.id}">${escapeHtml(eq.name)} (${escapeHtml(eq.equipment_code)}) — ${escapeHtml(eq.lab_code)} [${escapeHtml(eq.status)}]</option>`;
        }).join('');
}

function renderFaultStats(reports) {
    const totalCount = reports.length;
    let activeCount = 0;
    let reviewCount = 0;
    let resolvedCount = 0;

    reports.forEach(r => {
        const st = (r.status || 'Reported').toUpperCase();
        if (st === 'RESOLVED' || st === 'COMPLETED' || st === 'CLOSED') {
            resolvedCount++;
        } else if (st === 'UNDER REVIEW' || st === 'INVESTIGATING' || st === 'UNDER MAINTENANCE') {
            reviewCount++;
        } else {
            activeCount++;
        }
    });

    const statTotal = document.getElementById('stat-total-faults');
    if (statTotal) statTotal.textContent = totalCount;

    const statActive = document.getElementById('stat-active-faults');
    if (statActive) statActive.textContent = activeCount;

    const statReview = document.getElementById('stat-under-review');
    if (statReview) statReview.textContent = reviewCount;

    const statResolved = document.getElementById('stat-resolved-faults');
    if (statResolved) statResolved.textContent = resolvedCount;

    const counter = document.getElementById('fault-records-counter');
    if (counter) counter.textContent = `${totalCount} Ticket${totalCount === 1 ? '' : 's'}`;
}

function renderFaultGrid(reports) {
    const grid = document.getElementById('faculty-faults-grid');
    if (!grid) return;

    if (!reports || reports.length === 0) {
        grid.innerHTML = `
            <div class="faculty-card p-5 text-center grid-col-full">
                <i class="bi bi-shield-check text-emerald fs-1 d-block mb-3"></i>
                <h5 class="text-white fw-bold mb-1">No fault reports submitted yet</h5>
                <p class="text-secondary-label extra-small mb-0">All laboratory apparatus are operational. Click "Log New Fault" if any apparatus malfunctions.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = reports.map(r => {
        const st = (r.status || 'Reported').toUpperCase();
        let statusClass = 'status-faulty';
        let statusIcon = 'bi-exclamation-octagon';
        let statusLabel = 'REPORTED';

        if (st === 'RESOLVED' || st === 'COMPLETED' || st === 'CLOSED') {
            statusClass = 'status-available';
            statusIcon = 'bi-check2-circle';
            statusLabel = 'RESOLVED';
        } else if (st === 'UNDER REVIEW' || st === 'INVESTIGATING' || st === 'UNDER MAINTENANCE') {
            statusClass = 'status-insession';
            statusIcon = 'bi-tools';
            statusLabel = 'UNDER REVIEW';
        }

        const pri = (r.priority || 'High').toUpperCase();
        let priClass = 'badge-rose';
        if (pri === 'MEDIUM') priClass = 'badge-amber';
        if (pri === 'LOW') priClass = 'badge-cyan';

        return `
            <div class="faculty-fault-card ${r.equipment_status === 'Faulty' ? 'fault-card-active' : ''}">
                <!-- Top Row: Status Badge + Priority + Lab Code -->
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-1.5">
                        <span class="status-pill ${statusClass} extra-small">
                            <i class="bi ${statusIcon} me-1"></i>${statusLabel}
                        </span>
                        <span class="badge ${priClass} extra-small font-monospace">${escapeHtml(r.priority)} Priority</span>
                    </div>
                    <span class="lab-code-pill font-monospace">${escapeHtml(r.lab_code)}</span>
                </div>

                <!-- Equipment Details -->
                <div class="fault-card-title-section mb-2.5">
                    <h5 class="fault-card-name mb-1" title="${escapeHtml(r.equipment_name)}">${escapeHtml(r.equipment_name)}</h5>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge badge-purple-pill font-monospace extra-small">${escapeHtml(r.equipment_code)}</span>
                        <span class="text-slate-400 extra-small">• ${escapeHtml(r.category)}</span>
                        <span class="text-rose extra-small fw-bold ms-auto"><i class="bi bi-circle-fill me-1" style="font-size: 8px;"></i>Status: ${escapeHtml(r.equipment_status)}</span>
                    </div>
                </div>

                <!-- Laboratory -->
                <div class="d-flex align-items-center gap-1.5 mb-2.5 text-slate-300 extra-small">
                    <i class="bi bi-building text-purple-highlight"></i>
                    <span>${escapeHtml(r.lab_name)}</span>
                </div>

                <!-- Fault Description Callout Box -->
                <div class="fault-description-box mb-3">
                    <div class="fault-desc-header d-flex align-items-center justify-content-between mb-1">
                        <span class="extra-small fw-bold text-rose font-monospace"><i class="bi bi-bug me-1"></i>${escapeHtml(r.fault_type)}</span>
                    </div>
                    <p class="fault-desc-text text-white mb-0">"${escapeHtml(r.description)}"</p>
                </div>

                <!-- Reporter & Timestamp Footer -->
                <div class="fault-card-footer d-flex align-items-center justify-content-between pt-2 border-top border-secondary-subtle extra-small">
                    <span class="text-white fw-semibold"><i class="bi bi-person-badge text-purple-highlight me-1"></i>${escapeHtml(r.reported_by_name)} (${escapeHtml(r.reported_by_role)})</span>
                    <span class="text-slate-400 font-monospace"><i class="bi bi-clock me-1"></i>${escapeHtml(r.reported_at)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function openReportFaultModal() {
    const alertBox = document.getElementById('modal-fault-alert');
    if (alertBox) alertBox.classList.add('d-none');
    const form = document.getElementById('facultyReportFaultForm');
    if (form) form.reset();

    const modalEl = document.getElementById('reportFaultModal');
    if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

async function submitFacultyFaultReport(event) {
    if (event && event.preventDefault) event.preventDefault();

    const equipmentId = document.getElementById('fault-equipment-select')?.value;
    const faultType = document.getElementById('fault-type-select')?.value;
    const priority = document.getElementById('fault-priority-select')?.value;
    const description = document.getElementById('fault-description-input')?.value;
    const alertBox = document.getElementById('modal-fault-alert');
    const submitBtn = document.getElementById('btn-submit-fault');

    if (!equipmentId) {
        if (alertBox) {
            alertBox.textContent = 'Please select the malfunctioning apparatus.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    if (!description || description.trim().length === 0) {
        if (alertBox) {
            alertBox.textContent = 'Please provide a description of the fault.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Submitting...';
        }

        const res = await fetch('/api/faculty/fault-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                equipment_id: parseInt(equipmentId),
                fault_type: faultType,
                priority: priority,
                description: description.trim()
            })
        });

        const json = await res.json();
        if (res.ok && json.status === 'success') {
            const modalEl = document.getElementById('reportFaultModal');
            if (modalEl && window.bootstrap) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            // Real-time immediate refresh
            await loadFacultyFaultsData();
        } else {
            if (alertBox) {
                alertBox.textContent = json.message || 'Failed to submit fault report.';
                alertBox.classList.remove('d-none');
            }
        }
    } catch (e) {
        console.error('Error submitting fault report:', e);
        if (alertBox) {
            alertBox.textContent = 'Network error submitting fault report.';
            alertBox.classList.remove('d-none');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-send me-1"></i> Submit Fault Report';
        }
    }
}

function showFaultError(msg) {
    const grid = document.getElementById('faculty-faults-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="faculty-card p-4 text-center grid-col-full text-rose">
                <i class="bi bi-exclamation-octagon fs-2 d-block mb-2"></i>
                <h6 class="text-white fw-bold mb-1">Failed to load tickets</h6>
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

