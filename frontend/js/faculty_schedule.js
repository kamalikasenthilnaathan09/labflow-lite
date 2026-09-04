/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Lab Schedule Controller
   Weekly Timetable, Academic Days, Time Slots, Smart Filters & Modal Inspection
   ========================================================================== */

let currentWeekOffset = 0;
let scheduleData = null;
let allSessionsFlat = [];
let activeMobileDayIdx = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadFacultySchedule(0);
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

function navigateWeek(delta) {
    if (delta === 0) currentWeekOffset = 0;
    else currentWeekOffset += delta;
    loadFacultySchedule(currentWeekOffset);
}

async function loadFacultySchedule(weekOffset = 0) {
    const tbody = document.getElementById('timetable-body');
    const mobileContainer = document.getElementById('mobile-sessions-container');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-slate-400">
                    <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
                    Loading weekly laboratory schedule...
                </td>
            </tr>
        `;
    }
    if (mobileContainer) {
        mobileContainer.innerHTML = `
            <div class="text-center py-4 text-slate-400">
                <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
                Loading schedule...
            </div>
        `;
    }
    try {
        const labVal = document.getElementById('filter-schedule-lab')?.value || 'all';
        const batchVal = document.getElementById('filter-schedule-batch')?.value || 'all';
        const secVal = document.getElementById('filter-schedule-section')?.value || 'all';
        const statusVal = document.getElementById('filter-schedule-status')?.value || 'all';
        const params = new URLSearchParams({
            week_offset: weekOffset,
            lab_id: labVal,
            batch: batchVal,
            section: secVal,
            status: statusVal,
            _t: new Date().getTime()
        });
        const res = await fetch('/api/faculty/schedule?' + params.toString());
        if (res.status === 401) { window.location.replace('/login'); return; }
        if (res.status === 403) { window.location.replace('/dashboard/student'); return; }
        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
            scheduleData = json.data;
            currentWeekOffset = scheduleData.week_offset || 0;
            renderFacultyProfile(scheduleData.faculty);
            renderWeekRange(scheduleData);
            populateFilters(scheduleData.filter_options);
            renderWeeklyTimetable(scheduleData);
            renderMobileAgenda(scheduleData);
        } else {
            showErrorState(json.message || 'Failed to load laboratory schedule.');
        }
    } catch (e) {
        console.error('Failed to load faculty schedule:', e);
        showErrorState('Network error loading laboratory schedule.');
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

function renderWeekRange(data) {
    const rangeEl = document.getElementById('schedule-week-range');
    if (rangeEl) rangeEl.textContent = data.week_range_text || 'Current Week';
    const counterEl = document.getElementById('week-sessions-counter');
    if (counterEl) {
        const count = data.total_week_sessions || 0;
        counterEl.textContent = `${count} Scheduled Session${count === 1 ? '' : 's'}`;
    }
    const todayBtn = document.getElementById('btn-current-week');
    if (todayBtn) {
        if (currentWeekOffset === 0) {
            todayBtn.classList.remove('btn-outline-custom');
            todayBtn.classList.add('btn-purple-subtle');
        } else {
            todayBtn.classList.remove('btn-purple-subtle');
            todayBtn.classList.add('btn-outline-custom');
        }
    }
}

function populateFilters(opts) {
    if (!opts) return;
    const labSel = document.getElementById('filter-schedule-lab');
    if (labSel && labSel.options.length <= 1 && opts.labs) {
        opts.labs.forEach(lab => {
            const opt = document.createElement('option');
            opt.value = lab.id;
            opt.textContent = `${lab.name} (${lab.code})`;
            labSel.appendChild(opt);
        });
    }
    const secSel = document.getElementById('filter-schedule-section');
    if (secSel && secSel.options.length <= 1 && opts.sections) {
        opts.sections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec;
            opt.textContent = sec;
            secSel.appendChild(opt);
        });
    }
    const batchSel = document.getElementById('filter-schedule-batch');
    if (batchSel && batchSel.options.length <= 1 && opts.batches) {
        opts.batches.forEach(bat => {
            const opt = document.createElement('option');
            opt.value = bat;
            opt.textContent = bat;
            batchSel.appendChild(opt);
        });
    }
}

function renderWeeklyTimetable(data) {
    const days = data.days || [];
    const tbody = document.getElementById('timetable-body');
    if (!tbody) return;

    // Update 6 Day headers
    days.forEach((day, idx) => {
        const th = document.getElementById(`th-day-${idx}`);
        if (th) {
            th.className = 'day-col-header' + (day.is_today ? ' today-header-highlight' : '');
            th.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center">
                    <div class="day-code-label font-monospace">${escapeHtml(day.day_code)}</div>
                    <div class="day-date-label text-white fw-bold">${escapeHtml(day.day_month)}</div>
                    ${day.is_today ? '<span class="today-tag-pill mt-1">TODAY</span>' : ''}
                </div>
            `;
        }
    });

    allSessionsFlat = [];
    days.forEach(d => {
        d.sessions.forEach(s => allSessionsFlat.push(s));
    });

    const coreSlots = [
        { start: '09:00', end: '11:00', label: '09:00 AM — 11:00 AM' },
        { start: '11:00', end: '13:00', label: '11:00 AM — 01:00 PM' },
        { start: '14:00', end: '16:00', label: '02:00 PM — 04:00 PM' },
        { start: '16:00', end: '18:00', label: '04:00 PM — 06:00 PM' }
    ];

    const activeSlots = [...coreSlots];
    const seenLabels = new Set(coreSlots.map(s => s.label));
    allSessionsFlat.forEach(s => {
        if (s.formatted_time && !seenLabels.has(s.formatted_time)) {
            seenLabels.add(s.formatted_time);
            activeSlots.push({ start: s.start_time, end: s.end_time, label: s.formatted_time });
        }
    });

    activeSlots.sort((a, b) => a.start.localeCompare(b.start));

    let rowsHtml = '';
    activeSlots.forEach(slot => {
        rowsHtml += `
            <tr class="timetable-slot-row">
                <td class="time-col-cell font-monospace">
                    <div class="time-slot-label">${escapeHtml(slot.label)}</div>
                </td>
        `;

        days.forEach(day => {
            const matched = day.sessions.filter(s => {
                return (s.start_time === slot.start && s.end_time === slot.end) || (s.formatted_time === slot.label);
            });

            const cellClass = 'timetable-day-cell' + (day.is_today ? ' today-cell-highlight' : '');

            if (matched.length === 0) {
                rowsHtml += `<td class="${cellClass}"><div class="empty-schedule-slot"><span class="empty-dash">—</span></div></td>`;
            } else {
                rowsHtml += `<td class="${cellClass}">`;
                matched.forEach(sess => {
                    const st = (sess.status || 'UPCOMING').toUpperCase();
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

                    rowsHtml += `
                        <div class="faculty-schedule-card mb-2" onclick="openSessionDetailModal(${sess.id})">
                            <div class="d-flex align-items-center justify-content-between mb-1.5 gap-1">
                                <span class="status-pill ${statusClass} extra-small"><i class="bi ${statusIcon} me-1"></i>${statusBadgeText}</span>
                                <span class="lab-code-pill font-monospace">${escapeHtml(sess.lab_code)}</span>
                            </div>
                            <div class="schedule-card-title" title="${escapeHtml(sess.practical_name)}">${escapeHtml(sess.practical_name)}</div>
                            <div class="schedule-card-lab text-truncate mb-1.5 text-slate-300 extra-small">
                                <i class="bi bi-building me-1 text-purple-highlight"></i><span>${escapeHtml(sess.lab_name)}</span>
                            </div>
                            <div class="schedule-card-footer d-flex align-items-center justify-content-between extra-small pt-1.5 border-top border-secondary-subtle">
                                <span class="text-purple-highlight fw-semibold">${escapeHtml(sess.section_display)} • ${escapeHtml(sess.batch)}</span>
                                <span class="text-slate-400 font-monospace">${escapeHtml(sess.student_count)} Stud.</span>
                            </div>
                        </div>
                    `;
                });
                rowsHtml += `</td>`;
            }
        });
        rowsHtml += `</tr>`;
    });
    tbody.innerHTML = rowsHtml;
}

function renderMobileAgenda(data) {
    const days = data.days || [];
    const tabsContainer = document.getElementById('mobile-day-tabs');
    const sessionsContainer = document.getElementById('mobile-sessions-container');
    if (!tabsContainer || !sessionsContainer) return;
    let todayIdx = days.findIndex(d => d.is_today);
    if (todayIdx === -1) todayIdx = 0;
    activeMobileDayIdx = todayIdx;
    tabsContainer.innerHTML = days.map((d, idx) => {
        const isActive = (idx === activeMobileDayIdx);
        return `
            <button type="button" class="mobile-day-tab-btn ${isActive ? 'active' : ''} ${d.is_today ? 'is-today-tab' : ''}" onclick="selectMobileDay(${idx})">
                <span class="day-tab-code">${escapeHtml(d.day_code)}</span>
                <span class="day-tab-date">${escapeHtml(d.day_month.split(' ')[0])}</span>
                ${d.is_today ? '<span class="day-tab-dot"></span>' : ''}
            </button>
        `;
    }).join('');
    renderMobileDaySessions(days[activeMobileDayIdx]);
}

function selectMobileDay(idx) {
    if (!scheduleData || !scheduleData.days) return;
    activeMobileDayIdx = idx;
    const btns = document.querySelectorAll('.mobile-day-tab-btn');
    btns.forEach((btn, i) => {
        if (i === idx) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderMobileDaySessions(scheduleData.days[idx]);
}

function renderMobileDaySessions(day) {
    const container = document.getElementById('mobile-sessions-container');
    if (!container || !day) return;
    const sessions = day.sessions || [];
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="faculty-card p-4 text-center">
                <i class="bi bi-calendar-x text-slate-500 fs-1 d-block mb-2"></i>
                <h6 class="text-white fw-bold mb-1">No laboratory sessions for ${escapeHtml(day.day_name)}</h6>
                <p class="text-slate-400 extra-small mb-0">No practicals are scheduled for ${escapeHtml(day.date)}.</p>
            </div>
        `;
        return;
    }
    container.innerHTML = sessions.map(sess => {
        const st = (sess.status || 'UPCOMING').toUpperCase();
        let statusClass = 'status-booked';
        let statusBadgeText = 'UPCOMING';
        let statusIcon = 'bi-hourglass-split';
        if (st === 'IN SESSION') { statusClass = 'status-insession'; statusBadgeText = 'IN SESSION'; statusIcon = 'bi-broadcast'; }
        else if (st === 'COMPLETED') { statusClass = 'status-available'; statusBadgeText = 'COMPLETED'; statusIcon = 'bi-check2-circle'; }
        else if (st === 'CANCELLED') { statusClass = 'status-maintenance'; statusBadgeText = 'CANCELLED'; statusIcon = 'bi-x-circle'; }
        return `
            <div class="faculty-card p-3 mb-3 cursor-pointer" onclick="openSessionDetailModal(${sess.id})">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="session-time-pill font-monospace"><i class="bi bi-clock me-1 text-purple-highlight"></i>${escapeHtml(sess.formatted_time)}</span>
                    <span class="status-pill ${statusClass}"><i class="bi ${statusIcon} me-1"></i>${statusBadgeText}</span>
                </div>
                <h5 class="text-white fw-bold mb-1 fs-6">${escapeHtml(sess.practical_name)}</h5>
                <div class="d-flex align-items-center gap-2 mb-2 text-slate-300 extra-small">
                    <i class="bi bi-building text-purple-highlight"></i>
                    <span>${escapeHtml(sess.lab_name)}</span>
                    <span class="lab-code-pill font-monospace">${escapeHtml(sess.lab_code)}</span>
                </div>
                <div class="session-chips-row mb-2">
                    <span class="academic-chip chip-dept">${escapeHtml(getShortDept(sess.department))}</span>
                    <span class="academic-chip">${escapeHtml(sess.year)}</span>
                    <span class="academic-chip">${escapeHtml(sess.semester)}</span>
                    <span class="academic-chip chip-section">${escapeHtml(sess.section_display)}</span>
                    <span class="academic-chip chip-batch">${escapeHtml(sess.batch)}</span>
                </div>
                <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary-subtle extra-small">
                    <span class="text-white fw-semibold"><i class="bi bi-person-badge text-purple-highlight me-1"></i>${escapeHtml(sess.faculty_name)}</span>
                    <span class="text-slate-400 font-monospace">${escapeHtml(sess.student_count)} Students</span>
                </div>
            </div>
        `;
    }).join('');
}

function openSessionDetailModal(sessionId) {
    const session = allSessionsFlat.find(s => s.id === sessionId);
    if (!session) return;
    document.getElementById('modal-subject-name').textContent = session.practical_name;
    document.getElementById('modal-lab-name').textContent = session.lab_name;
    document.getElementById('modal-lab-code').textContent = session.lab_code;
    document.getElementById('modal-date').textContent = session.session_date;
    document.getElementById('modal-time').textContent = session.formatted_time;
    document.getElementById('modal-location').textContent = session.lab_location;
    document.getElementById('modal-students').textContent = `${session.student_count} Students`;
    document.getElementById('modal-dept').textContent = getShortDept(session.department);
    document.getElementById('modal-year').textContent = session.year;
    document.getElementById('modal-sem').textContent = session.semester;
    document.getElementById('modal-section').textContent = session.section_display;
    document.getElementById('modal-batch').textContent = session.batch;
    document.getElementById('modal-faculty').textContent = session.faculty_name;
    const badgeEl = document.getElementById('modal-status-badge');
    if (badgeEl) {
        badgeEl.textContent = (session.status || 'UPCOMING').toUpperCase();
        if (session.status === 'IN SESSION') { badgeEl.className = 'status-pill status-insession extra-small'; }
        else if (session.status === 'COMPLETED') { badgeEl.className = 'status-pill status-available extra-small'; }
        else if (session.status === 'CANCELLED') { badgeEl.className = 'status-pill status-maintenance extra-small'; }
        else { badgeEl.className = 'status-pill status-booked extra-small'; }
    }
    const modalEl = document.getElementById('sessionDetailModal');
    if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function applyScheduleFilters() { loadFacultySchedule(currentWeekOffset); }

function resetScheduleFilters() {
    const labSel = document.getElementById('filter-schedule-lab');
    const batchSel = document.getElementById('filter-schedule-batch');
    const secSel = document.getElementById('filter-schedule-section');
    const statSel = document.getElementById('filter-schedule-status');
    if (labSel) labSel.value = 'all';
    if (batchSel) batchSel.value = 'all';
    if (secSel) secSel.value = 'all';
    if (statSel) statSel.value = 'all';
    loadFacultySchedule(currentWeekOffset);
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

function showErrorState(msg) {
    const tbody = document.getElementById('timetable-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-rose"><i class="bi bi-exclamation-octagon fs-2 d-block mb-2"></i>${escapeHtml(msg)}</td></tr>`;
    }
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

