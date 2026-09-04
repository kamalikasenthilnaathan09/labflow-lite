/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Profile Controller
   Loads Authenticated Faculty Data & Database Laboratory Assignments
   ========================================================================== */

let facultyProfileData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFacultyProfile();
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

async function loadFacultyProfile() {
    try {
        const res = await fetch('/api/faculty/profile?_t=' + new Date().getTime());
        if (res.status === 401) { window.location.replace('/login'); return; }
        if (res.status === 403) { window.location.replace('/dashboard/student'); return; }
        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
            facultyProfileData = json.data;
            renderProfileView(facultyProfileData);
        } else {
            console.error('Failed to load profile:', json.message);
        }
    } catch (e) {
        console.error('Error fetching faculty profile:', e);
    }
}

function renderProfileView(p) {
    if (!p) return;
    const facName = p.name || 'Dr. Murugesan';
    const initials = p.initials || 'DM';
    const dept = p.department || 'Artificial Intelligence & Data Science';
    const shortDept = p.short_department || 'AI & DS';
    const empId = p.college_id || 'FAC-AIDS-101';
    const email = p.email || 'murugesan@college.edu.in';
    const phone = p.phone || 'Not Available';
    const designation = p.designation || 'Associate Professor';
    const role = p.role || 'Faculty';
    const createdAt = p.created_at || '2026-09-02';

    // 1. Navigation & Header
    const navName = document.getElementById('faculty-nav-name');
    if (navName) navName.textContent = facName;
    const navDept = document.getElementById('faculty-nav-dept');
    if (navDept) navDept.textContent = shortDept;
    const navInitials = document.getElementById('faculty-avatar-initials');
    if (navInitials) navInitials.textContent = initials;
    const headerLabel = document.getElementById('header-faculty-label');
    if (headerLabel) headerLabel.textContent = `${facName} • ${shortDept}`;

    // 2. Left Column Profile Card
    const largeAvatar = document.getElementById('profile-avatar-large');
    if (largeAvatar) largeAvatar.textContent = initials;
    const cardName = document.getElementById('profile-name');
    if (cardName) cardName.textContent = facName;
    const cardEmpId = document.getElementById('profile-emp-id');
    if (cardEmpId) cardEmpId.textContent = empId;
    const cardDeptFull = document.getElementById('profile-dept-full');
    if (cardDeptFull) cardDeptFull.textContent = dept;
    const accRole = document.getElementById('profile-account-role');
    if (accRole) accRole.textContent = role;
    const accCreated = document.getElementById('profile-created-at');
    if (accCreated) accCreated.textContent = createdAt;

    // 3. Personal Information Card
    const dName = document.getElementById('detail-name');
    if (dName) dName.textContent = facName;
    const dId = document.getElementById('detail-id');
    if (dId) dId.textContent = empId;
    const dEmail = document.getElementById('detail-email');
    if (dEmail) dEmail.textContent = email;
    const dPhone = document.getElementById('detail-phone');
    if (dPhone) dPhone.textContent = phone;
    const dDept = document.getElementById('detail-dept');
    if (dDept) dDept.textContent = dept;
    const dDesig = document.getElementById('detail-designation');
    if (dDesig) dDesig.textContent = designation;
    const profDept = document.getElementById('prof-dept');
    if (profDept) profDept.textContent = dept;

    // 4. Assigned Laboratories
    renderAssignedLabs(p.assigned_labs || []);
}

function renderAssignedLabs(labs) {
    const container = document.getElementById('assigned-labs-list');
    const counter = document.getElementById('assigned-labs-count');
    if (!container) return;

    if (counter) {
        const count = labs.length;
        counter.textContent = `${count} Assigned Lab${count === 1 ? '' : 's'}`;
    }

    if (!labs || labs.length === 0) {
        container.innerHTML = `
            <div class="p-3 rounded text-center text-slate-400" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
                <i class="bi bi-building-slash text-slate-500 fs-3 d-block mb-1"></i>
                <span class="extra-small">No laboratory assignments currently mapped.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = labs.map(lab => `
        <div class="p-3 rounded" style="background-color: var(--bg-sidebar); border: 1px solid var(--border);">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-building text-purple-highlight fs-5"></i>
                    <div>
                        <h6 class="text-white fw-bold mb-0 small">${escapeHtml(lab.lab_name)}</h6>
                        <span class="extra-small text-slate-400">${escapeHtml(lab.location)}</span>
                    </div>
                </div>
                <span class="lab-code-pill font-monospace">${escapeHtml(lab.lab_code)}</span>
            </div>
            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary-subtle extra-small">
                <span class="text-purple-highlight fw-semibold">
                    <i class="bi bi-journal-code me-1"></i>${escapeHtml(lab.practical_name)}
                </span>
                <span class="badge badge-purple-subtle extra-small">Assigned Lead</span>
            </div>
        </div>
    `).join('');
}

function openEditPhoneModal() {
    if (!facultyProfileData) return;
    const input = document.getElementById('edit-phone-input');
    if (input) {
        input.value = (facultyProfileData.phone && facultyProfileData.phone !== 'Not Available') ? facultyProfileData.phone : '';
    }
    const feedback = document.getElementById('edit-phone-feedback');
    if (feedback) feedback.classList.add('d-none');
    const modalEl = document.getElementById('editContactModal');
    if (modalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

async function saveContactPhone() {
    const input = document.getElementById('edit-phone-input');
    const feedback = document.getElementById('edit-phone-feedback');
    const val = input ? input.value.trim() : '';
    if (!val) {
        if (feedback) { feedback.textContent = 'Please enter a valid phone number.'; feedback.classList.remove('d-none'); }
        return;
    }
    try {
        const res = await fetch('/api/faculty/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: val })
        });
        const json = await res.json();
        if (res.ok && json.status === 'success') {
            facultyProfileData = json.data;
            renderProfileView(facultyProfileData);
            const modalEl = document.getElementById('editContactModal');
            if (modalEl && window.bootstrap) {
                bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            }
        } else {
            if (feedback) { feedback.textContent = json.message || 'Failed to update phone.'; feedback.classList.remove('d-none'); }
        }
    } catch (e) {
        if (feedback) { feedback.textContent = 'Network error saving phone.'; feedback.classList.remove('d-none'); }
    }
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

