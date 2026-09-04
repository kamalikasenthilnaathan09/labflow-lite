/* ==========================================================================
   LabFlow Lite - Dedicated Faculty Dashboard Client JavaScript (Personal Workspace)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadFacultyDashboard();
    fetchFacultyNotifications();
});

// Handle bfcache restore
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        fetch('/api/auth/me').then(res => {
            if (!res.ok) {
                window.location.replace('/login');
            }
        }).catch(() => {
            window.location.replace('/login');
        });
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

// 2. Fetch & Render Dashboard Data
async function loadFacultyDashboard() {
    try {
        const res = await fetch('/api/faculty/dashboard');
        
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
            renderFacultyProfile(data.faculty);
            renderStats(data.stats);
            renderTodaySessionsCards(data.today_sessions);
            renderMyLaboratory(data.my_laboratory, data.shared_labs_summary);
            renderRecentActivity(data.recent_activity);
        } else {
            console.error('Faculty Dashboard API Error:', json.message);
        }
    } catch (e) {
        console.error('Failed to load faculty dashboard data:', e);
    }
}

// 3. Render Profile & Greeting
function renderFacultyProfile(faculty) {
    if (!faculty) return;

    const facultyName = faculty.name || 'Dr. Murugesan';
    const dept = faculty.department || 'Artificial Intelligence & Data Science';

    const hour = new Date().getHours();
    let timeGreeting = 'Good Morning';
    if (hour >= 12 && hour < 17) {
        timeGreeting = 'Good Afternoon';
    } else if (hour >= 17) {
        timeGreeting = 'Good Evening';
    }

    const greetingElements = document.querySelectorAll('.faculty-greeting-text');
    greetingElements.forEach(el => {
        el.textContent = `${timeGreeting}, ${facultyName}`;
    });

    const navNameEl = document.getElementById('faculty-nav-name');
    if (navNameEl) navNameEl.textContent = facultyName;

    const navDeptEl = document.getElementById('faculty-nav-dept');
    if (navDeptEl) navDeptEl.textContent = dept;

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

// 4. Render Overview Stat Cards
function renderStats(stats) {
    if (!stats) return;

    const sessionsEl = document.getElementById('stat-sessions-count');
    if (sessionsEl) {
        const count = stats.today_sessions_count !== undefined ? stats.today_sessions_count : 'Not Available';
        sessionsEl.textContent = count;
    }

    const labCodeEl = document.getElementById('stat-active-lab-code');
    if (labCodeEl) {
        labCodeEl.textContent = stats.active_lab_code || 'DL-LAB-01';
    }

    const labNameEl = document.getElementById('stat-active-lab-name');
    if (labNameEl) {
        labNameEl.textContent = stats.active_lab_name || 'Advanced Computing & AI Research Lab';
    }

    const healthEl = document.getElementById('stat-health-pct');
    if (healthEl) {
        const health = stats.equipment_health_display || (stats.equipment_health_pct !== undefined ? `${stats.equipment_health_pct}%` : 'Not Available');
        healthEl.textContent = health;
    }

    const faultsEl = document.getElementById('stat-faults-count');
    if (faultsEl) {
        const count = stats.open_faults_count !== undefined ? stats.open_faults_count : '0';
        faultsEl.textContent = count;
    }
}

// 5. Render Clean Horizontal Session Cards
function renderTodaySessionsCards(sessions) {
    const container = document.getElementById('sessions-cards-list');
    if (!container) return;

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="grid-col-full text-center py-5 text-slate-400 bg-sidebar rounded-3 border border-border">
                <i class="bi bi-calendar-x fs-3 d-block mb-2 text-slate-500"></i>
                <div class="fw-semibold text-white mb-1">No Practical Sessions Today</div>
                <div class="extra-small text-slate-400">You have no scheduled laboratory practicals for today.</div>
            </div>
        `;
        return;
    }

    let html = '';
    sessions.forEach(s => {
        let statusBadge = '';
        const st = (s.status_upper || s.status || '').toUpperCase();
        if (st === 'IN SESSION') {
            statusBadge = '<span class="status-pill status-insession"><span class="live-dot-pulse"></span> IN SESSION</span>';
        } else if (st === 'COMPLETED') {
            statusBadge = '<span class="status-pill status-completed">COMPLETED</span>';
        } else {
            statusBadge = '<span class="status-pill status-upcoming">UPCOMING</span>';
        }

        html += `
            <div class="faculty-dash-session-card">
                <div class="session-card-header-bar">
                    <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <span class="badge bg-purple-subtle text-purple-highlight font-mono extra-small px-2.5 py-1">
                            ${escapeHtml(s.lab_code || 'DL-LAB-01')}
                        </span>
                        <div>${statusBadge}</div>
                    </div>
                    <h3 class="session-card-title-text">${escapeHtml(s.practical_name || 'Deep Learning Practical')}</h3>
                    <div class="session-card-lab-text">
                        <i class="bi bi-building text-purple-highlight flex-shrink-0"></i>
                        <span class="text-truncate">${escapeHtml(s.lab_name || 'Advanced Computing & AI Research Lab')}</span>
                    </div>
                </div>

                <div class="session-card-info-list">
                    <div class="session-info-row">
                        <span class="session-info-label"><i class="bi bi-clock"></i> Time</span>
                        <span class="session-info-val font-mono text-purple-highlight fw-semibold">${escapeHtml(s.formatted_time || '09:00 AM — 11:00 AM')}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-info-label"><i class="bi bi-mortarboard"></i> Academic</span>
                        <span class="session-info-val text-slate-300 font-mono extra-small">${escapeHtml(s.class_details || 'III Year • V Sem • Sec A • Batch 1')}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-info-label"><i class="bi bi-people"></i> Strength</span>
                        <span class="session-info-val text-slate-300">${escapeHtml(String(s.student_count || 40))} Students</span>
                    </div>
                </div>

                <div class="session-card-bottom-bar">
                    <span class="extra-small text-slate-400 font-mono text-truncate" style="max-width: 140px;">
                        <i class="bi bi-person text-slate-500 me-1"></i>${escapeHtml(s.faculty_name || 'Dr. Murugesan')}
                    </span>
                    <a href="/dashboard/faculty/sessions" class="btn btn-sm btn-outline-purple rounded-pill px-3 py-1 extra-small fw-medium flex-shrink-0">
                        View Session
                    </a>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 6. Render My Laboratory & Shared Summary
function renderMyLaboratory(myLab, sharedSummary) {
    if (myLab) {
        const labNameEl = document.getElementById('my-lab-name');
        if (labNameEl) labNameEl.textContent = myLab.name || 'Advanced Computing & AI Research Lab';

        const labLocEl = document.getElementById('my-lab-loc');
        if (labLocEl) labLocEl.innerHTML = `<i class="bi bi-geo-alt me-1 text-slate-500"></i>${escapeHtml(myLab.location || 'Block A, 3rd Floor, Room 310')}`;

        const labSubEl = document.getElementById('my-lab-subject');
        if (labSubEl) labSubEl.textContent = myLab.subject || 'Deep Learning Practical';
    }

    if (sharedSummary) {
        const sharedEl = document.getElementById('shared-labs-text');
        if (sharedEl) sharedEl.textContent = sharedSummary.message || '5 facilities available for scheduling';
    }
}

// 7. Render Clean Full-Width Recent Activity Rows
function renderRecentActivity(activityList) {
    const container = document.getElementById('recent-activity-feed');
    if (!container) return;

    if (!activityList || activityList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-3 text-slate-400 extra-small">
                No recent activity recorded today.
            </div>
        `;
        return;
    }

    let html = '';
    activityList.forEach(item => {
        html += `
            <div class="activity-row-item py-2.5 px-3 d-flex align-items-center justify-content-between gap-3 border-bottom border-border">
                <div class="d-flex align-items-center gap-3 min-w-0">
                    <div class="activity-icon-badge ${item.badge_class || 'badge-purple'} flex-shrink-0" style="width: 32px; height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem;">
                        <i class="bi ${item.icon || 'bi-check2-circle'}"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="text-white fw-medium small text-truncate">${escapeHtml(item.title)}</div>
                        <div class="text-slate-400 extra-small text-truncate">${escapeHtml(item.desc || '')}</div>
                    </div>
                </div>
                <div class="font-mono text-slate-400 extra-small flex-shrink-0">${escapeHtml(item.time || '')}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Navigation Placeholder Handler
function handleNavPlaceholder(e, featureName) {
    if (e) e.preventDefault();
    showToast(`${featureName} module is connected.`);
}

// Toast Popup
function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast show align-items-center text-white bg-card border border-border shadow-lg mb-2';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body extra-small">
                <i class="bi bi-info-circle text-purple-highlight me-1.5"></i> ${escapeHtml(msg)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto extra-small" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3500);
}

// Sign Out Confirmation Modal
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


// Helper: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==========================================================================
   FACULTY NOTIFICATION BELL & DROPDOWN SYSTEM
   ========================================================================== */

let facultyNotifications = [];

async function fetchFacultyNotifications() {
    try {
        const res = await fetch('/api/faculty/notifications');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            facultyNotifications = data.notifications || [];
            const unreadCount = data.unread_count || 0;
            renderFacultyNotificationBadge(unreadCount);
            renderFacultyNotificationDropdown(facultyNotifications, unreadCount);
        }
    } catch (err) {
        console.error("Error fetching faculty notifications:", err);
    }
}

function renderFacultyNotificationBadge(count) {
    const badge = document.getElementById('faculty-notification-unread-badge');
    const dropdownCount = document.getElementById('faculty-dropdown-unread-count');

    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }

    if (dropdownCount) {
        dropdownCount.textContent = count > 0 ? `${count} unread` : '0 unread';
    }
}

function renderFacultyNotificationDropdown(notifications, unreadCount) {
    const listContainer = document.getElementById('faculty-notification-dropdown-list');
    if (!listContainer) return;

    if (!notifications || notifications.length === 0) {
        listContainer.innerHTML = `
            <div class="p-4 text-center text-slate-400 extra-small">
                <i class="bi bi-bell-slash fs-4 d-block mb-2 text-slate-600"></i>
                No notifications found
            </div>
        `;
        return;
    }

    listContainer.innerHTML = notifications.map(n => {
        const isUnread = !n.is_read;
        let iconClass = 'bi bi-bell-fill';
        let iconColor = '#B99AD9';
        let iconBg = 'rgba(139, 111, 179, 0.15)';

        if (n.notification_type === 'fault') {
            iconClass = 'bi bi-tools';
            iconColor = '#B8757B';
            iconBg = 'rgba(184, 117, 123, 0.15)';
        } else if (n.notification_type === 'schedule' || n.notification_type === 'session') {
            iconClass = 'bi bi-calendar-event';
            iconColor = '#79A88A';
            iconBg = 'rgba(121, 168, 138, 0.15)';
        } else if (n.notification_type === 'booking') {
            iconClass = 'bi bi-calendar-check';
            iconColor = '#C39A5A';
            iconBg = 'rgba(195, 154, 90, 0.15)';
        }

        return `
            <div class="p-3 border-bottom d-flex align-items-start gap-2.5 cursor-pointer" 
                 style="border-color: #38323F !important; background-color: ${isUnread ? 'rgba(139, 111, 179, 0.07)' : 'transparent'}; transition: background 0.15s ease;"
                 onclick="markFacultyNotificationAsRead(${n.id})">
                <div class="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0" 
                     style="width: 32px; height: 32px; background-color: ${iconBg};">
                    <i class="${iconClass}" style="color: ${iconColor}; font-size: 0.85rem;"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="d-flex align-items-center justify-content-between mb-0.5">
                        <strong class="extra-small text-white text-truncate" style="font-weight: 600; max-width: 210px;">${escapeHtml(n.title)}</strong>
                        ${isUnread ? '<span class="rounded-circle d-inline-block flex-shrink-0 ms-1" style="width: 7px; height: 7px; background-color: #8B6FB3;"></span>' : ''}
                    </div>
                    <p class="extra-small mb-1 text-slate-300" style="font-size: 0.78rem; color: #B2AAB8 !important; line-height: 1.35;">
                        ${escapeHtml(n.message)}
                    </p>
                    <div class="extra-small font-monospace" style="color: #817986; font-size: 0.68rem;">
                        ${escapeHtml(n.time || 'Recently')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleFacultyNotificationDropdown() {
    const dropdown = document.getElementById('faculty-notification-dropdown-panel');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('d-none');
    if (isHidden) {
        dropdown.classList.remove('d-none');
        fetchFacultyNotifications();
    } else {
        dropdown.classList.add('d-none');
    }
}

async function markAllFacultyNotificationsAsRead() {
    try {
        const res = await fetch('/api/faculty/notifications/read-all', { method: 'POST' });
        if (res.ok) {
            await fetchFacultyNotifications();
        }
    } catch (e) {
        console.error("Error marking faculty notifications read:", e);
    }
}

async function markFacultyNotificationAsRead(id) {
    try {
        const res = await fetch(`/api/faculty/notifications/${id}/read`, { method: 'POST' });
        if (res.ok) {
            await fetchFacultyNotifications();
        }
    } catch (e) {
        console.error("Error marking faculty notification read:", e);
    }
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('faculty-notification-bell-wrapper');
    const dropdown = document.getElementById('faculty-notification-dropdown-panel');
    if (dropdown && !dropdown.classList.contains('d-none')) {
        if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.add('d-none');
        }
    }
});
