/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Smart Booking Client JavaScript
   Handles Real Availability Verification, Dynamic Student Strength Mapping,
   Editable Student Strength Input, Smart Alternates, & Booking
   ========================================================================== */

let currentCheckedSlot = null;
let bookingOptionsData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadBookingOptions();
});

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

// 2. Fetch Initial Booking Options & Populate Faculty Context
async function loadBookingOptions() {
    try {
        const res = await fetch('/api/faculty/booking/options');
        if (res.status === 401) {
            window.location.replace('/login');
            return;
        }
        if (res.status === 403) {
            window.location.replace('/dashboard/student');
            return;
        }

        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
            bookingOptionsData = json.data;
            
            // Populate Labs dropdown if needed
            populateLabsDropdown();

            // Populate Subjects dependent on initially selected laboratory
            onLaboratoryChanged();

            // Set default date to today's server date
            const dateEl = document.getElementById('booking-date');
            if (dateEl) {
                dateEl.value = bookingOptionsData.default_date || new Date().toISOString().split('T')[0];
            }
        }
    } catch (e) {
        console.warn('Failed to load booking options:', e);
    }
}

function populateLabsDropdown() {
    if (!bookingOptionsData || !bookingOptionsData.labs) return;
    const labSelect = document.getElementById('booking-lab');
    if (!labSelect) return;

    const currentVal = labSelect.value;
    labSelect.innerHTML = '';
    
    bookingOptionsData.labs.forEach(lab => {
        const opt = document.createElement('option');
        opt.value = lab.id;
        opt.textContent = `${lab.name} (${lab.code})`;
        if (lab.id === 2 || String(lab.id) === currentVal) {
            opt.selected = true;
        }
        labSelect.appendChild(opt);
    });

    if (!labSelect.value && bookingOptionsData.labs.length > 0) {
        labSelect.value = bookingOptionsData.labs[0].id;
    }
}

// Cascading Handler: When Laboratory changes
function onLaboratoryChanged() {
    if (!bookingOptionsData) return;
    const labSelect = document.getElementById('booking-lab');
    const subjSelect = document.getElementById('booking-subject');
    if (!labSelect || !subjSelect) return;

    const labId = parseInt(labSelect.value);
    const labMap = bookingOptionsData.lab_subject_faculty_map || {};
    const validSubjects = labMap[labId] || [];

    subjSelect.innerHTML = '';

    if (validSubjects.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No practical subjects mapped for this laboratory';
        subjSelect.appendChild(opt);
    } else {
        validSubjects.forEach((sub, idx) => {
            const opt = document.createElement('option');
            opt.value = sub.name;
            opt.textContent = sub.name;
            if (idx === 0) opt.selected = true;
            subjSelect.appendChild(opt);
        });
    }

    // Update Faculty In-Charge card
    updateFacultyInCharge();

    // Re-evaluate default student strength
    syncStudentStrength();

    // Hide previous check results
    hideResultCards();
}

// Cascading Handler: When Practical / Subject changes
function onSubjectChanged() {
    updateFacultyInCharge();
    syncStudentStrength();
    hideResultCards();
}

// Update Read-Only Faculty In-Charge Card based on Lab + Subject
function updateFacultyInCharge() {
    if (!bookingOptionsData) return;
    const labId = parseInt(document.getElementById('booking-lab')?.value || 2);
    const subjectName = document.getElementById('booking-subject')?.value;

    const nameEl = document.getElementById('faculty-incharge-name');
    const deptEl = document.getElementById('faculty-incharge-dept');
    const badgeEl = document.getElementById('faculty-incharge-badge');

    if (!nameEl) return;

    const labMap = bookingOptionsData.lab_subject_faculty_map || {};
    const validSubjects = labMap[labId] || [];
    const matchedSubject = validSubjects.find(s => s.name === subjectName) || validSubjects[0];

    if (matchedSubject) {
        nameEl.textContent = matchedSubject.faculty_name || 'Faculty assignment pending';
        if (deptEl) deptEl.textContent = matchedSubject.faculty_dept || 'Engineering Department';
        
        if (badgeEl) {
            if (matchedSubject.is_assigned) {
                badgeEl.textContent = 'Assigned Faculty';
                badgeEl.style.backgroundColor = 'rgba(139, 111, 179, 0.15)';
                badgeEl.style.color = '#B99AD9';
                badgeEl.style.borderColor = 'rgba(139, 111, 179, 0.3)';
            } else {
                badgeEl.textContent = 'Assignment Pending';
                badgeEl.style.backgroundColor = 'rgba(195, 154, 90, 0.15)';
                badgeEl.style.color = '#C39A5A';
                badgeEl.style.borderColor = 'rgba(195, 154, 90, 0.3)';
            }
        }
    } else {
        nameEl.textContent = 'Faculty assignment pending';
        if (deptEl) deptEl.textContent = '';
        if (badgeEl) {
            badgeEl.textContent = 'Assignment Pending';
            badgeEl.style.backgroundColor = 'rgba(195, 154, 90, 0.15)';
            badgeEl.style.color = '#C39A5A';
            badgeEl.style.borderColor = 'rgba(195, 154, 90, 0.3)';
        }
    }
}

function syncStudentStrength() {
    if (!bookingOptionsData || !bookingOptionsData.class_strengths) return;
    
    const subject = document.getElementById('booking-subject')?.value || 'Deep Learning Practical';
    const section = document.getElementById('booking-section')?.value || 'Section B';
    const batch = document.getElementById('booking-batch')?.value || 'Batch 1';
    const studentsInput = document.getElementById('booking-students');

    if (!studentsInput) return;

    const key = `${subject}|${section}|${batch}`;
    const matchedStrength = bookingOptionsData.class_strengths[key];

    if (matchedStrength !== undefined && matchedStrength !== null) {
        studentsInput.value = matchedStrength;
    } else {
        studentsInput.value = '40';
        studentsInput.placeholder = 'Enter number of students';
    }
}

function onStudentCountInput() {
    hideResultCards();
}

function onFormInputChanged() {
    syncStudentStrength();
    hideResultCards();
}

function hideResultCards() {
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    if (availCard) availCard.classList.add('d-none');
    if (confCard) confCard.classList.add('d-none');
}

// 3. Handle Availability Check
async function handleCheckAvailability(e) {
    if (e && e.preventDefault) e.preventDefault();

    const labId = document.getElementById('booking-lab')?.value;
    const subject = document.getElementById('booking-subject')?.value;
    const sessionDate = document.getElementById('booking-date')?.value;
    const startTime = document.getElementById('booking-start-time')?.value;
    const endTime = document.getElementById('booking-end-time')?.value;
    const year = document.getElementById('booking-year')?.value;
    const semester = document.getElementById('booking-semester')?.value;
    const section = document.getElementById('booking-section')?.value;
    const batch = document.getElementById('booking-batch')?.value;
    const studentsInput = document.getElementById('booking-students');
    const studentsVal = studentsInput?.value?.trim();

    // Strict Validation
    if (!sessionDate) {
        showToast('Please select a valid session date.', 'error');
        return;
    }
    if (endTime <= startTime) {
        showToast('End time must be later than start time.', 'error');
        return;
    }
    
    // Validation for student strength
    if (!studentsVal || studentsVal === '') {
        if (studentsInput) {
            studentsInput.focus();
            studentsInput.classList.add('input-highlight-pulse');
            setTimeout(() => studentsInput.classList.remove('input-highlight-pulse'), 2000);
        }
        showToast('Please enter the expected student strength.', 'error');
        return;
    }

    const parsedCount = parseInt(studentsVal, 10);
    if (isNaN(parsedCount) || parsedCount <= 0) {
        if (studentsInput) {
            studentsInput.focus();
            studentsInput.classList.add('input-highlight-pulse');
            setTimeout(() => studentsInput.classList.remove('input-highlight-pulse'), 2000);
        }
        showToast('Student strength must be greater than 0.', 'error');
        return;
    }

    const payload = {
        lab_id: labId,
        practical_name: subject,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        year: year,
        semester: semester,
        section: section,
        batch: batch,
        student_count: parsedCount
    };

    const checkBtn = document.getElementById('btn-check-availability');
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> CHECKING AVAILABILITY...';
    }

    try {
        const res = await fetch('/api/faculty/booking/check-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="bi bi-calendar-check me-2"></i> CHECK AVAILABILITY';
        }

        if (json.status === 'available') {
            currentCheckedSlot = payload;
            displayAvailableState(json.slot, payload);
        } else if (json.status === 'conflict') {
            displayConflictState(json.conflict, json.alternatives);
        } else {
            showToast(json.message || 'Error verifying slot availability.', 'error');
        }
    } catch (err) {
        console.error('Availability check error:', err);
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="bi bi-calendar-check me-2"></i> CHECK AVAILABILITY';
        }
        showToast('Network error verifying slot availability.', 'error');
    }
}

// 4. Display LAB AVAILABLE State
function displayAvailableState(slot, payload) {
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    const confirmedCard = document.getElementById('booking-confirmed-card');

    if (confCard) confCard.classList.add('d-none');
    if (confirmedCard) confirmedCard.classList.add('d-none');
    if (!availCard) return;

    document.getElementById('avail-lab-code').textContent = slot.lab_code || 'DL-LAB-01';
    document.getElementById('avail-lab-name').textContent = `${slot.lab_name} (${slot.lab_code || 'DL-LAB-01'})`;
    document.getElementById('avail-subject').textContent = payload.practical_name || 'Deep Learning Practical';
    document.getElementById('avail-date').textContent = slot.session_date;
    document.getElementById('avail-time').textContent = slot.time_formatted;
    document.getElementById('avail-year-sem').textContent = `${payload.year || 'III Year'} • ${payload.semester || 'V Semester'}`;
    document.getElementById('avail-class').textContent = `${payload.section || 'Section B'} • ${payload.batch || 'Batch 1'}`;
    document.getElementById('avail-students').textContent = `${payload.student_count} Students`;

    availCard.classList.remove('d-none');
    availCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 5. Display LAB NOT AVAILABLE & Alternatives State
function displayConflictState(conflict, alternatives) {
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    const confirmedCard = document.getElementById('booking-confirmed-card');

    if (availCard) availCard.classList.add('d-none');
    if (confirmedCard) confirmedCard.classList.add('d-none');
    if (!confCard) return;

    document.getElementById('conflict-lab-code').textContent = conflict.lab_code || 'DL-LAB-01';
    document.getElementById('conf-subject').textContent = conflict.subject;
    document.getElementById('conf-date').textContent = conflict.date;
    document.getElementById('conf-time').textContent = conflict.time_formatted;
    document.getElementById('conf-class').textContent = `${conflict.section} • ${conflict.batch}`;
    document.getElementById('conf-faculty').textContent = conflict.faculty;

    // Render Alternatives
    const altContainer = document.getElementById('alternatives-list');
    if (altContainer) {
        if (!alternatives || alternatives.length === 0) {
            altContainer.innerHTML = `
                <div class="p-3 rounded text-center" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                    <div class="text-white fw-bold extra-small text-uppercase tracking-wider mb-1">NO ALTERNATIVES AVAILABLE</div>
                    <div class="text-slate-400 extra-small">No other laboratory or time slot is currently available for the selected session.</div>
                </div>
            `;
        } else {
            altContainer.innerHTML = alternatives.map(alt => {
                const labelType = alt.type === 'same_lab_diff_time' ? 'SAME LAB • DIFFERENT TIME' : 'DIFFERENT LAB • SAME TIME';
                return `
                    <div class="p-3 rounded d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                        <div class="d-flex align-items-center gap-2.5">
                            <span class="lab-code-pill font-monospace">${escapeHtml(alt.lab_code)}</span>
                            <div>
                                <div class="extra-small text-slate-400 font-monospace">${escapeHtml(labelType)}</div>
                                <div class="text-white fw-bold small">${escapeHtml(alt.lab_name)}</div>
                                <div class="text-purple-highlight font-monospace extra-small fw-bold">${escapeHtml(alt.time_formatted)} • ${escapeHtml(alt.session_date)}</div>
                            </div>
                        </div>
                        <div class="d-flex align-items-center justify-content-between justify-content-sm-end gap-2.5">
                            <span class="badge badge-emerald-subtle extra-small fw-bold px-2 py-0.5">${escapeHtml(alt.availability)}</span>
                            <button type="button" class="btn btn-use-slot" onclick="applyAlternateSlot(${alt.lab_id}, '${alt.start_time}', '${alt.end_time}', '${alt.session_date}', '${escapeHtml(alt.lab_name)}')">
                                USE THIS SLOT
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    confCard.classList.remove('d-none');
    confCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 6. Apply Alternate Slot (PRESERVED USE THIS SLOT LOGIC)
function applyAlternateSlot(labId, st, et, dateStr, labName) {
    const labEl = document.getElementById('booking-lab');
    const stEl = document.getElementById('booking-start-time');
    const etEl = document.getElementById('booking-end-time');
    const dateEl = document.getElementById('booking-date');

    if (labEl) {
        labEl.value = labId;
        labEl.classList.add('input-highlight-pulse');
        setTimeout(() => labEl.classList.remove('input-highlight-pulse'), 1500);
    }
    if (stEl) {
        stEl.value = st;
        stEl.classList.add('input-highlight-pulse');
        setTimeout(() => stEl.classList.remove('input-highlight-pulse'), 1500);
    }
    if (etEl) {
        etEl.value = et;
        etEl.classList.add('input-highlight-pulse');
        setTimeout(() => etEl.classList.remove('input-highlight-pulse'), 1500);
    }
    if (dateEl) {
        dateEl.value = dateStr;
        dateEl.classList.add('input-highlight-pulse');
        setTimeout(() => dateEl.classList.remove('input-highlight-pulse'), 1500);
    }

    // Hide conflict card so user sees populated form
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    if (availCard) availCard.classList.add('d-none');
    if (confCard) confCard.classList.add('d-none');

    showToast(`Alternative slot selected for ${labName || 'Laboratory'}. Click CHECK AVAILABILITY to proceed.`, 'info');
    
    // Smooth scroll to form
    const formCard = document.getElementById('booking-form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 7. Execute Booking Confirmation
async function executeConfirmBooking() {
    if (!currentCheckedSlot) {
        showToast('Please check slot availability first.', 'error');
        return;
    }

    const confirmBtn = document.getElementById('btn-confirm-booking');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Confirming booking...';
    }

    try {
        const res = await fetch('/api/faculty/booking/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentCheckedSlot)
        });

        const json = await res.json();
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1.5"></i> CONFIRM BOOKING';
        }

        if (res.ok && json.status === 'success' && json.booking) {
            displayConfirmedState(json.booking);
        } else {
            showToast(json.message || 'Failed to create booking.', 'error');
        }
    } catch (err) {
        console.error('Booking confirmation error:', err);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1.5"></i> CONFIRM BOOKING';
        }
        showToast('Network error creating booking.', 'error');
    }
}

// 8. Display BOOKING CONFIRMED State
function displayConfirmedState(booking) {
    const formCard = document.getElementById('booking-form-card');
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    const confirmedCard = document.getElementById('booking-confirmed-card');

    if (formCard) formCard.classList.add('d-none');
    if (availCard) availCard.classList.add('d-none');
    if (confCard) confCard.classList.add('d-none');
    if (!confirmedCard) return;

    document.getElementById('confirmed-lab').textContent = `${booking.lab_name} (${booking.lab_code})`;
    document.getElementById('confirmed-subject').textContent = booking.practical_name;
    document.getElementById('confirmed-date').textContent = booking.session_date;
    document.getElementById('confirmed-time').textContent = booking.time_formatted;
    document.getElementById('confirmed-class').textContent = `${booking.section} • ${booking.batch} (${booking.student_count} Students)`;

    confirmedCard.classList.remove('d-none');
    confirmedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 9. Reset Booking Form (BOOK ANOTHER LAB)
function resetBookingForm() {
    currentCheckedSlot = null;
    const formCard = document.getElementById('booking-form-card');
    const availCard = document.getElementById('slot-available-card');
    const confCard = document.getElementById('slot-conflict-card');
    const confirmedCard = document.getElementById('booking-confirmed-card');

    if (formCard) formCard.classList.remove('d-none');
    if (availCard) availCard.classList.add('d-none');
    if (confCard) confCard.classList.add('d-none');
    if (!confirmedCard) return;

    const form = document.getElementById('smart-booking-form');
    if (form) {
        document.getElementById('booking-lab').value = '2';
        populateFacultySubjects();
        document.getElementById('booking-start-time').value = '14:00';
        document.getElementById('booking-end-time').value = '16:00';
        document.getElementById('booking-year').value = 'III Year';
        document.getElementById('booking-semester').value = 'V Semester';
        document.getElementById('booking-section').value = 'Section B';
        document.getElementById('booking-batch').value = 'Batch 1';
        syncStudentStrength();
    }
}

// 10. Toast & Logout
function handleNavPlaceholder(e, moduleName) {
    if (e && e.preventDefault) e.preventDefault();
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
