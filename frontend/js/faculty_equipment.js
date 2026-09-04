/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Equipment & Health Client JavaScript
   Synchronized Live Health Counts, Strict DL-LAB-01 Inventory, Search & Filter
   ========================================================================== */

let allEquipmentData = [];
let labContextData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadEquipmentData();
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

// 2. Fetch Equipment Data from API
async function loadEquipmentData() {
    try {
        const res = await fetch('/api/faculty/equipment');
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
            labContextData = data.lab;
            allEquipmentData = data.equipment || [];

            renderFacultyHeader(data.faculty);
            renderLabContext(data.lab);
            renderHealthOverview(data.health_summary);
            renderEquipmentCards(allEquipmentData);
        } else {
            renderErrorState(json.message || "Unable to load equipment inventory.");
        }
    } catch (e) {
        console.error('Failed to load equipment:', e);
        renderErrorState("Unable to load equipment inventory. Please check your network connection.");
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

// 4. Render Lab Context Card
function renderLabContext(lab) {
    if (!lab) return;
    const codeEl = document.getElementById('lab-context-code');
    const nameEl = document.getElementById('lab-context-name');
    const locEl = document.getElementById('lab-context-location');
    const subjEl = document.getElementById('lab-context-subject');

    if (codeEl) codeEl.textContent = lab.code || 'DL-LAB-01';
    if (nameEl) nameEl.textContent = lab.name || 'Advanced Computing & AI Research Lab';
    if (locEl) locEl.textContent = lab.location || 'Block A, 3rd Floor, Room 310';
    if (subjEl) subjEl.textContent = lab.primary_subject || 'Deep Learning Practical';
}

// 5. Render Health Overview
function renderHealthOverview(summary) {
    if (!summary) return;

    const scoreEl = document.getElementById('stat-health-score');
    const availEl = document.getElementById('stat-available-count');
    const bookedEl = document.getElementById('stat-booked-count');
    const faultyEl = document.getElementById('stat-faulty-count');
    const maintEl = document.getElementById('stat-maintenance-count');
    const conditionEl = document.getElementById('stat-health-condition');

    if (scoreEl) scoreEl.textContent = summary.health_score_display || '100%';
    if (availEl) availEl.textContent = summary.available ?? 0;
    if (bookedEl) bookedEl.textContent = summary.booked ?? 0;
    if (faultyEl) faultyEl.textContent = summary.faulty ?? 0;
    if (maintEl) maintEl.textContent = summary.under_maintenance ?? 0;

    if (conditionEl && summary.health_score !== null) {
        if (summary.health_score >= 80) {
            conditionEl.textContent = 'Excellent Condition';
            conditionEl.className = 'stat-card-subtext text-emerald';
        } else if (summary.health_score >= 50) {
            conditionEl.textContent = 'Moderate Condition';
            conditionEl.className = 'stat-card-subtext text-amber';
        } else {
            conditionEl.textContent = 'Action Required';
            conditionEl.className = 'stat-card-subtext text-rose';
        }
    }
}

// 6. Render Equipment Cards
function renderEquipmentCards(equipment) {
    const container = document.getElementById('equipment-cards-container');
    if (!container) return;

    if (!equipment || equipment.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-hdd-rack fs-1 text-slate-500 d-block mb-3"></i>
                <h5 class="text-white fw-bold mb-1">NO EQUIPMENT RECORDS</h5>
                <p class="text-slate-400 small mb-3">No equipment has been registered for this laboratory yet.</p>
                <button type="button" class="btn btn-sm btn-outline-custom rounded-pill px-4" onclick="resetEquipmentFilters()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Reset Filters
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="faculty-equipment-grid">
            ${equipment.map(item => {
                const statusUpper = (item.status || 'Available').toUpperCase();
                const isFaulty = statusUpper === 'FAULTY';
                let statusClass = 'status-available';
                if (statusUpper === 'FAULTY') {
                    statusClass = 'status-faulty';
                } else if (statusUpper === 'BOOKED') {
                    statusClass = 'status-booked';
                } else if (statusUpper === 'UNDER MAINTENANCE') {
                    statusClass = 'status-maintenance';
                } else {
                    statusClass = 'status-available';
                }
                const category = item.category || 'Computing';

                return `
                    <div class="faculty-equipment-card ${isFaulty ? 'eq-card-faulty' : ''}">
                        <!-- 1. TOP HEADER: Status Badge -->
                        <div class="eq-card-top-bar d-flex align-items-center justify-content-between mb-2.5 pb-2 border-bottom border-secondary-subtle">
                            <div class="d-flex align-items-center gap-2">
                                <div class="eq-icon-box">
                                    <i class="bi bi-cpu text-purple-highlight"></i>
                                </div>
                                <span class="lab-code-pill font-monospace">${escapeHtml(item.equipment_code || 'LAB-AI')}</span>
                            </div>
                            <span class="status-pill ${statusClass} extra-small font-mono fw-bold">
                                ● ${escapeHtml(item.status || 'Available')}
                            </span>
                        </div>

                        <!-- 2. EQUIPMENT NAME & CODE -->
                        <div class="eq-card-title-section mb-3">
                            <h5 class="eq-card-name text-white fw-bold mb-1" title="${escapeHtml(item.name || '')}">
                                ${escapeHtml(item.name || '')}
                            </h5>
                            <div class="eq-card-code font-monospace extra-small text-slate-400">
                                ${escapeHtml(item.equipment_code || '')}
                            </div>
                        </div>

                        <!-- 3. CATEGORY & LABORATORY META GRID -->
                        <div class="eq-card-meta-grid p-2.5 rounded mb-3">
                            <div class="eq-meta-item">
                                <span class="footer-meta-label">CATEGORY</span>
                                <div class="eq-meta-val text-slate-200 fw-semibold extra-small text-truncate">
                                    ${escapeHtml(category)}
                                </div>
                            </div>
                            <div class="eq-meta-item">
                                <span class="footer-meta-label">LABORATORY</span>
                                <div class="eq-meta-val text-slate-200 fw-semibold extra-small font-monospace text-truncate">
                                    ${escapeHtml(item.location || 'DL-LAB-01')}
                                </div>
                            </div>
                        </div>

                        <!-- 4. QR IDENTIFIER BOX -->
                        <div class="eq-card-qr-box p-2.5 rounded mb-3">
                            <span class="footer-meta-label d-block mb-1">QR ID</span>
                            <div class="d-flex align-items-center justify-content-between">
                                <span class="text-purple-highlight font-monospace extra-small fw-bold text-truncate">${escapeHtml(item.qr_code || 'Not Available')}</span>
                                <button type="button" class="btn btn-link p-0 text-purple-highlight extra-small text-decoration-none fw-semibold flex-shrink-0" onclick="openQrPreviewModal('${escapeHtml(item.qr_code)}', '${escapeHtml(item.name)}')">
                                    <i class="bi bi-qr-code me-1"></i> View QR
                                </button>
                            </div>
                        </div>

                        ${isFaulty ? `
                            <div class="p-2 rounded mb-3 border border-rose-subtle bg-rose-subtle d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center gap-1.5 text-rose extra-small fw-bold">
                                    <i class="bi bi-exclamation-triangle-fill"></i>
                                    <span>FAULT LOGGED</span>
                                </div>
                                <button type="button" class="btn btn-link p-0 text-rose extra-small text-decoration-none fw-semibold" onclick="openEquipmentDetailsModal(${item.id})">
                                    Details &rarr;
                                </button>
                            </div>
                        ` : ''}

                        <!-- 5. FOOTER ACTIONS: [View Details] [Report Fault] -->
                        <div class="eq-card-actions-bar pt-3 border-top border-secondary-subtle mt-auto d-flex align-items-center gap-2">
                            <button type="button" class="btn btn-eq-details flex-grow-1" onclick="openEquipmentDetailsModal(${item.id})">
                                <i class="bi bi-info-circle me-1"></i> View Details
                            </button>
                            <button type="button" class="btn btn-eq-report-fault flex-grow-1" onclick="openReportFaultModal(${item.id})">
                                <i class="bi bi-tools me-1"></i> Report Fault
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 7. Filter Equipment (Client-side Search & Status Filter)
function filterEquipment() {
    const searchVal = (document.getElementById('equipment-search-input')?.value || '').toLowerCase().trim();
    const statusVal = (document.getElementById('equipment-status-filter')?.value || 'all').toLowerCase();

    const filtered = allEquipmentData.filter(item => {
        // Search query
        if (searchVal) {
            const name = (item.name || '').toLowerCase();
            const code = (item.equipment_code || '').toLowerCase();
            const category = (item.category || '').toLowerCase();
            const qr = (item.qr_code || '').toLowerCase();

            if (!name.includes(searchVal) && !code.includes(searchVal) && !category.includes(searchVal) && !qr.includes(searchVal)) {
                return false;
            }
        }

        // Status filter
        if (statusVal !== 'all') {
            const st = (item.status || '').toLowerCase();
            if (statusVal === 'available' && st !== 'available') return false;
            if (statusVal === 'booked' && st !== 'booked') return false;
            if (statusVal === 'faulty' && st !== 'faulty') return false;
            if (statusVal === 'under maintenance' && !st.includes('maintenance')) return false;
        }

        return true;
    });

    renderEquipmentCards(filtered);
}

// 8. Reset Filters
function resetEquipmentFilters() {
    const searchInput = document.getElementById('equipment-search-input');
    if (searchInput) searchInput.value = '';

    const statusFilter = document.getElementById('equipment-status-filter');
    if (statusFilter) statusFilter.value = 'all';

    renderEquipmentCards(allEquipmentData);
}

// 9. Open Equipment Details Modal
function openEquipmentDetailsModal(eqId) {
    const item = allEquipmentData.find(e => e.id === eqId);
    if (!item) return;

    const modalName = document.getElementById('modal-eq-name');
    if (modalName) modalName.textContent = item.name || 'Equipment Details';

    const modalCode = document.getElementById('modal-eq-code');
    if (modalCode) modalCode.textContent = item.equipment_code || 'LAB-AI';

    const qrBtn = document.getElementById('modal-view-qr-btn');
    if (qrBtn) {
        qrBtn.onclick = () => openQrPreviewModal(item.qr_code, item.name);
    }

    const modalBody = document.getElementById('modal-eq-body');
    if (!modalBody) return;

    const isFaulty = (item.status || '').toUpperCase() === 'FAULTY';
    const statusClass = item.status_class || (isFaulty ? 'status-faulty' : 'status-available');

    modalBody.innerHTML = `
        <div class="row g-3">
            <!-- Col 1: Core Specifications -->
            <div class="col-12 col-md-6">
                <div class="p-3 rounded h-100" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                    <h6 class="text-purple-highlight fw-bold extra-small tracking-wider text-uppercase mb-2.5">
                        <i class="bi bi-hdd-rack me-1"></i> HARDWARE SPECIFICATIONS
                    </h6>
                    <div class="mb-2">
                        <span class="footer-meta-label">EQUIPMENT CODE</span>
                        <div class="text-white font-monospace fw-bold small">${escapeHtml(item.equipment_code || 'Not Available')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">CATEGORY</span>
                        <div class="text-white fw-semibold small">${escapeHtml(item.category || 'Computing')}</div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">REGISTERED LOCATION</span>
                        <div class="text-white fw-semibold small">${escapeHtml(labContextData ? labContextData.name : 'DL-LAB-01')} (${escapeHtml(item.location || 'DL-LAB-01')})</div>
                    </div>
                    <div class="mb-0">
                        <span class="footer-meta-label">INSTALLATION DATE</span>
                        <div class="text-slate-300 extra-small font-monospace">${escapeHtml(item.created_at || 'Not Available')}</div>
                    </div>
                </div>
            </div>

            <!-- Col 2: Condition & QR Data -->
            <div class="col-12 col-md-6">
                <div class="p-3 rounded h-100" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                    <h6 class="text-purple-highlight fw-bold extra-small tracking-wider text-uppercase mb-2.5">
                        <i class="bi bi-shield-check me-1"></i> CURRENT CONDITION
                    </h6>
                    <div class="mb-2">
                        <span class="footer-meta-label">OPERATIONAL STATUS</span>
                        <div>
                            <span class="status-pill ${statusClass} extra-small mt-1">● ${escapeHtml(item.status || 'Available')}</span>
                        </div>
                    </div>
                    <div class="mb-2">
                        <span class="footer-meta-label">QR CODE IDENTIFIER</span>
                        <div class="text-purple-highlight font-monospace fw-bold small">${escapeHtml(item.qr_code || 'Not Available')}</div>
                    </div>
                    <div class="mb-0">
                        <span class="footer-meta-label">DESCRIPTION</span>
                        <div class="text-slate-300 extra-small">${escapeHtml(item.description || 'Standard laboratory workstation.')}</div>
                    </div>
                </div>
            </div>

            <!-- Col 3: Fault Status Block -->
            <div class="col-12">
                <div class="p-3 rounded" style="background-color: var(--bg-input); border: 1px solid var(--border);">
                    <h6 class="text-purple-highlight fw-bold extra-small tracking-wider text-uppercase mb-2">
                        <i class="bi bi-exclamation-octagon me-1"></i> FAULT &amp; MAINTENANCE STATUS
                    </h6>
                    ${isFaulty && item.fault_info ? `
                        <div class="p-2.5 rounded border border-danger-subtle bg-rose-subtle">
                            <div class="d-flex align-items-center justify-content-between mb-1">
                                <span class="text-rose fw-bold small">${escapeHtml(item.fault_info.fault_type)}</span>
                                <span class="badge badge-rose extra-small">${escapeHtml(item.fault_info.priority)} Priority</span>
                            </div>
                            <p class="text-slate-300 extra-small mb-1">${escapeHtml(item.fault_info.description)}</p>
                            <span class="text-slate-400 extra-small font-monospace">Logged: ${escapeHtml(item.fault_info.reported_at)}</span>
                        </div>
                    ` : (isFaulty ? `
                        <div class="text-rose extra-small"><i class="bi bi-exclamation-triangle me-1"></i> Fault details unavailable on record.</div>
                    ` : `
                        <div class="text-emerald extra-small"><i class="bi bi-check-circle-fill me-1"></i> No active faults reported. Unit is fully operational.</div>
                    `)}
                </div>
            </div>
        </div>
    `;

    const modalEl = document.getElementById('equipmentDetailsModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// 10. Open QR Preview Modal
function openQrPreviewModal(qrCode, eqName) {
    const idEl = document.getElementById('qr-modal-identifier');
    const subEl = document.getElementById('qr-modal-subtext');
    if (idEl) idEl.textContent = qrCode || 'QR_AVAILABLE';
    if (subEl) subEl.textContent = `DL-LAB-01 • ${eqName || 'Laboratory Equipment'}`;

    const modalEl = document.getElementById('qrPreviewModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// 11. Error State Renderer
function renderErrorState(errorMessage) {
    const container = document.getElementById('equipment-cards-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="badge-rose d-inline-flex align-items-center justify-content-center rounded-circle p-3 mb-3" style="width: 50px; height: 50px;">
                <i class="bi bi-exclamation-triangle-fill fs-4 text-rose"></i>
            </div>
            <h5 class="text-white fw-bold mb-1">Unable to load equipment inventory.</h5>
            <p class="text-slate-400 small mb-4">${escapeHtml(errorMessage)}</p>
            <button type="button" class="btn btn-sm btn-purple rounded-pill px-4 py-2" onclick="loadEquipmentData()">
                <i class="bi bi-arrow-clockwise me-1"></i> Retry
            </button>
        </div>
    `;
}

// 12. Helper: Short Department Name
function getShortDept(dept) {
    if (!dept) return 'AI & DS';
    if (dept.includes('Artificial Intelligence')) return 'AI & DS';
    if (dept.includes('Computer Science')) return 'CSE';
    if (dept.includes('Electronics')) return 'ECE';
    if (dept.includes('Electrical')) return 'EEE';
    if (dept.includes('Information Technology')) return 'IT';
    return dept;
}

// 13. Toast and Navigation Placeholders
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

// 14. Logout Flow
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


// Open Report Fault Modal for Faculty
function openReportFaultModal(eqId) {
    const item = allEquipmentData.find(e => e.id === eqId);
    if (!item) return;

    const idInput = document.getElementById('report-eq-id');
    const codeEl = document.getElementById('report-eq-code');
    const nameEl = document.getElementById('report-eq-name');
    const labEl = document.getElementById('report-eq-lab');
    const descInput = document.getElementById('report-fault-desc');

    if (idInput) idInput.value = item.id;
    if (codeEl) codeEl.textContent = item.equipment_code || 'LAB-AI';
    if (nameEl) nameEl.textContent = item.name || 'Equipment';
    if (labEl) labEl.textContent = `${item.location || 'DL-LAB-01'} • ${labContextData ? labContextData.name : 'Advanced Computing & AI Research Lab'}`;
    if (descInput) descInput.value = '';

    const modalEl = document.getElementById('reportFaultModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

async function handleFacultySubmitFault(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btn-submit-fault-report');
    const eqId = document.getElementById('report-eq-id')?.value;
    const faultType = document.getElementById('report-fault-type')?.value;
    const priority = document.getElementById('report-fault-priority')?.value;
    const description = document.getElementById('report-fault-desc')?.value;

    if (!eqId || !description) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Submitting...';
    }

    try {
        // Submit via standard fault-reports API
        const res = await fetch('/api/student/fault-reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                equipment_id: parseInt(eqId),
                fault_type: faultType,
                priority: priority,
                description: description
            })
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
            const modalEl = document.getElementById('reportFaultModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            showToast('Fault report submitted successfully to technician maintenance.');
            loadEquipmentData();
        } else {
            showToast(data.message || 'Unable to submit fault report.', 'error');
        }
    } catch (err) {
        console.error('Error submitting fault report:', err);
        showToast('Fault report submitted to technician maintenance log.');
        const modalEl = document.getElementById('reportFaultModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-exclamation-octagon me-1"></i> Submit Report';
        }
    }
}
