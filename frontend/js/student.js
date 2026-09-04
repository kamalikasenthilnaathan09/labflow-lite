/* ==========================================================================
   LabFlow Lite - Dedicated Student Workspace Architecture JavaScript
   Handles Client View Routing (/student/*), Browser Navigation, & API Data
   ========================================================================== */

const ROUTE_MAP = {
    '/dashboard/student': { viewId: 'view-dashboard', label: 'Dashboard' },
    '/student/labs': { viewId: 'view-labs', label: 'Our Labs' },
    '/student/equipment': { viewId: 'view-equipment', label: 'Equipment' },
    '/student/scan-qr': { viewId: 'view-scan-qr', label: 'Scan QR' },
    '/student/bookings': { viewId: 'view-bookings', label: 'My Equipment' },
    '/student/schedule': { viewId: 'view-schedule', label: 'Lab Schedule' },
    '/student/usage': { viewId: 'view-usage', label: 'Usage History' },
    '/student/fault-reports': { viewId: 'view-fault-reports', label: 'My Fault Reports' },
    '/student/profile': { viewId: 'view-profile', label: 'My Profile' },
    '/student/notifications': { viewId: 'view-notifications', label: 'Notifications' }
};

// Global 401 Interceptor: If any API returns 401 Unauthorized, redirect to /login
const _nativeFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await _nativeFetch.apply(this, args);
    if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        if (url.includes('/api/')) {
            localStorage.removeItem('labflow_user');
            sessionStorage.removeItem('labflow_active_tab');
            window.location.replace('/login');
        }
    }
    return response;
};

// Handle Back/Forward Cache (bfcache) - verify session on restore
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        _nativeFetch('/api/auth/me').then(res => {
            if (!res.ok) {
                window.location.replace('/login');
            }
        }).catch(() => {
            window.location.replace('/login');
        });
    }
});

let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initRouter();
    initSidebarToggle();
    initLabsSearch();
    loadStudentProfile();
    loadStudentStats();
    fetchNotifications();
    initBookingForm();
    initFaultForm();
    initQrScannerView();
});

// 1. Client View Router & History State Management
function initRouter() {
    document.querySelectorAll('[data-route]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.getAttribute('data-route');
            if (route) {
                navigateTo(route);
            }
        });
    });

    window.addEventListener('popstate', () => {
        renderViewFromLocation();
    });

    renderViewFromLocation();
}

function navigateTo(path) {
    if (window.location.pathname + window.location.search !== path) {
        window.history.pushState({}, '', path);
    }
    renderViewFromLocation();
}

function renderViewFromLocation() {
    let currentPath = window.location.pathname;

    if (currentPath !== '/student/scan-qr') {
        stopQrScanner(false);
    }

    // Check dynamic lab details route: /student/labs/<lab_id>
    const labDetailMatch = currentPath.match(/^\/student\/labs\/(\d+)$/);

    // Hide all view panels
    document.querySelectorAll('.student-view-panel').forEach(panel => {
        panel.classList.add('d-none');
    });

    if (labDetailMatch) {
        const labId = labDetailMatch[1];
        const activePanel = document.getElementById('view-lab-details');
        if (activePanel) activePanel.classList.remove('d-none');

        highlightSidebar('/student/labs');
        loadLabDetails(labId);
    } else {
        if (!ROUTE_MAP[currentPath]) {
            if (currentPath === '/student' || currentPath === '/dashboard') {
                currentPath = '/dashboard/student';
                window.history.replaceState({}, '', currentPath);
            } else {
                currentPath = '/dashboard/student';
            }
        }

        const currentRoute = ROUTE_MAP[currentPath] || ROUTE_MAP['/dashboard/student'];
        const activePanel = document.getElementById(currentRoute.viewId);
        if (activePanel) activePanel.classList.remove('d-none');

        highlightSidebar(currentPath);
        fetchViewData(currentPath);
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('student-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
        if (overlay) overlay.classList.add('d-none');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function highlightSidebar(activeRoute) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        const linkRoute = link.getAttribute('data-route');
        if (linkRoute === activeRoute) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function fetchViewData(path) {
    switch (path) {
        case '/dashboard/student':
            loadStudentStats();
            loadDashboardSummary();
            break;
        case '/student/labs':
            loadCollegeLabs(true);
            break;
        case '/student/equipment':
            const urlParams = new URLSearchParams(window.location.search);
            const labIdParam = urlParams.get('lab_id') || urlParams.get('lab');
            loadEquipment(labIdParam || '');
            break;
        case '/student/bookings':
            loadStudentBookings();
            break;
        case '/student/fault-reports':
            loadStudentFaultReports();
            break;
        case '/student/usage':
            loadUsageHistory();
            break;
        case '/student/schedule':
            loadStudentSchedule();
            break;
        case '/student/notifications':
            loadNotifications();
            break;
        case '/student/profile':
            loadStudentProfile();
            break;
        default:
            break;
    }
}

// 2. Sidebar Toggle for Mobile Drawer
function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const sidebar = document.getElementById('student-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.add('show');
            if (overlay) overlay.classList.remove('d-none');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('show');
            if (overlay) overlay.classList.add('d-none');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('show');
            overlay.classList.add('d-none');
        });
    }
}

// 3. Search Input Handler & Live Filtering Setup
function initLabsSearch() {
    const searchInput = document.getElementById('labs-search-input');
    const clearBtn = document.getElementById('labs-search-clear-btn');

    if (searchInput) {
        searchInput.disabled = false;
        searchInput.readOnly = false;

        searchInput.addEventListener('input', () => {
            const query = searchInput.value;

            if (clearBtn) {
                if (query.trim().length > 0) {
                    clearBtn.classList.remove('d-none');
                } else {
                    clearBtn.classList.add('d-none');
                }
            }

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadCollegeLabs(false);
            }, 150);
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            clearLabsSearch();
        });
    }
}

function clearLabsSearch() {
    const searchInput = document.getElementById('labs-search-input');
    const clearBtn = document.getElementById('labs-search-clear-btn');
    if (searchInput) {
        searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('d-none');
        searchInput.focus();
    }
    loadCollegeLabs(false);
}

// 4. API Data Loaders

let currentStudentProfile = null;

// Student Session Profile
async function loadStudentProfile() {
    try {
        const res = await fetch('/api/student/profile');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const s = data.student;
            currentStudentProfile = s;

            // Global display updates
            document.querySelectorAll('.student-name-display').forEach(el => el.textContent = s.name);
            document.querySelectorAll('.student-id-display').forEach(el => el.textContent = s.college_id);
            document.querySelectorAll('.student-dept-display').forEach(el => el.textContent = s.department || 'Artificial Intelligence & Data Science');
            document.querySelectorAll('.student-email-display').forEach(el => el.textContent = s.email);
            document.querySelectorAll('.student-created-display').forEach(el => el.textContent = s.created_at || '2026-08-01');

            // Profile View Panel Element Updates
            const pName = document.getElementById('profile-card-name');
            const pId = document.getElementById('profile-card-id');
            const valName = document.getElementById('profile-val-name');
            const valEmail = document.getElementById('profile-val-email');
            const valPhone = document.getElementById('profile-val-phone');
            const valId = document.getElementById('profile-val-id');
            const valDept = document.getElementById('profile-val-dept');
            const valYear = document.getElementById('profile-val-year');
            const valSem = document.getElementById('profile-val-semester');
            const valSec = document.getElementById('profile-val-section');
            const valCreated = document.getElementById('profile-val-created');

            if (pName) pName.textContent = s.name;
            if (pId) pId.textContent = s.college_id;
            if (valName) valName.textContent = s.name;
            if (valEmail) valEmail.textContent = s.email;
            if (valPhone) valPhone.textContent = s.phone || '+91 98765 43210';
            if (valId) valId.textContent = s.college_id;
            if (valDept) valDept.textContent = s.department || 'Artificial Intelligence & Data Science';
            if (valYear) valYear.textContent = s.year || 'III Year';
            if (valSem) valSem.textContent = s.semester || 'V Semester';
            if (valSec) valSec.textContent = s.section || 'B Section';
            if (valCreated) valCreated.textContent = s.created_at || '2026-08-01';
        }
    } catch (e) {
        console.error("Error loading profile:", e);
    }
}

function toggleProfileEditMode(isEditing) {
    clearProfileAlert();
    const viewContainer = document.getElementById('profile-view-container');
    const editForm = document.getElementById('profile-edit-form');
    const actionControls = document.getElementById('profile-action-controls');

    if (!viewContainer || !editForm) return;

    if (isEditing) {
        const s = currentStudentProfile || {};
        document.getElementById('edit-profile-name').value = s.name || '';
        document.getElementById('edit-profile-email').value = s.email || '';
        document.getElementById('edit-profile-phone').value = s.phone || '+91 98765 43210';
        document.getElementById('edit-profile-id').value = s.college_id || '';
        document.getElementById('edit-profile-dept').value = s.department || 'Artificial Intelligence & Data Science';
        document.getElementById('edit-profile-year').value = s.year || 'III Year';
        document.getElementById('edit-profile-semester').value = s.semester || 'V Semester';
        document.getElementById('edit-profile-section').value = s.section || 'B Section';

        viewContainer.classList.add('d-none');
        editForm.classList.remove('d-none');
        if (actionControls) actionControls.classList.add('d-none');
    } else {
        editForm.classList.add('d-none');
        viewContainer.classList.remove('d-none');
        if (actionControls) actionControls.classList.remove('d-none');
    }
}

async function saveStudentProfile() {
    clearProfileAlert();

    const name = document.getElementById('edit-profile-name').value.trim();
    const email = document.getElementById('edit-profile-email').value.trim();
    const phone = document.getElementById('edit-profile-phone').value.trim();
    const department = document.getElementById('edit-profile-dept').value.trim();
    const year = document.getElementById('edit-profile-year').value.trim();
    const semester = document.getElementById('edit-profile-semester').value.trim();
    const section = document.getElementById('edit-profile-section').value.trim();

    if (!name) {
        showProfileAlert('Please enter your full name.', 'danger');
        return;
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
        showProfileAlert('Please enter a valid college email address.', 'danger');
        return;
    }

    const saveBtn = document.getElementById('btn-save-profile');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Saving...`;
    }

    try {
        const res = await fetch('/api/student/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                email: email,
                phone: phone,
                department: department,
                year: year,
                semester: semester,
                section: section
            })
        });

        const data = await res.json();

        if (res.ok && data.status === 'success') {
            showProfileAlert(data.message || 'Profile updated successfully.', 'success');
            await loadStudentProfile();

            setTimeout(() => {
                toggleProfileEditMode(false);
            }, 1000);
        } else {
            showProfileAlert(data.message || 'Failed to update profile.', 'danger');
        }
    } catch (err) {
        console.error("Save profile error:", err);
        showProfileAlert('Unable to save profile changes. Please try again.', 'danger');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="bi bi-check-lg me-1"></i>Save Changes`;
        }
    }
}

function showProfileAlert(message, type = 'success') {
    const alertBox = document.getElementById('profile-status-alert');
    if (!alertBox) return;

    alertBox.className = `alert alert-${type} extra-small mb-4`;
    alertBox.innerHTML = type === 'success' 
        ? `<i class="bi bi-check-circle-fill me-1.5"></i>${escapeHtml(message)}`
        : `<i class="bi bi-exclamation-triangle-fill me-1.5"></i>${escapeHtml(message)}`;
    alertBox.classList.remove('d-none');
}

function clearProfileAlert() {
    const alertBox = document.getElementById('profile-status-alert');
    if (alertBox) {
        alertBox.innerHTML = '';
        alertBox.classList.add('d-none');
    }
}

// ==========================================================================
// NOTIFICATION SYSTEM & BELL DROPDOWN
// ==========================================================================

let studentNotifications = [];

async function fetchNotifications() {
    try {
        const res = await fetch('/api/student/notifications');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            studentNotifications = data.notifications || [];
            const unreadCount = data.unread_count || 0;
            renderNotificationBellBadge(unreadCount);
            renderNotificationDropdown(studentNotifications, unreadCount);
            
            // If on notifications page, also update page view
            const pageBadge = document.getElementById('page-unread-count-badge');
            if (pageBadge) {
                pageBadge.textContent = unreadCount > 0 ? `${unreadCount} unread` : 'All read';
            }
        }
    } catch (err) {
        console.error("Error fetching notifications:", err);
    }
}

function renderNotificationBellBadge(count) {
    const badge = document.getElementById('notification-unread-badge');
    const dropdownCount = document.getElementById('dropdown-unread-count');

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

function renderNotificationDropdown(notifications, unreadCount) {
    const listContainer = document.getElementById('notification-dropdown-list');
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
        const iconInfo = getNotificationIcon(n.notification_type);

        return `
            <div class="p-3 border-bottom d-flex align-items-start gap-2.5 cursor-pointer ${isUnread ? 'bg-slate-900' : ''}" 
                 style="border-color: #38323F !important; transition: background 0.15s ease;"
                 onclick="handleNotificationClick(${n.id}, ${!n.is_read}, '${n.notification_type}')">
                <div class="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0" 
                     style="width: 32px; height: 32px; background-color: ${iconInfo.bgColor};">
                    <i class="${iconInfo.iconClass}" style="color: ${iconInfo.color}; font-size: 0.85rem;"></i>
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
                        ${formatRelativeTime(n.created_at)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getNotificationIcon(type) {
    switch (type) {
        case 'booking':
            return { iconClass: 'bi bi-calendar-check-fill', color: '#B99AD9', bgColor: 'rgba(139, 111, 179, 0.15)' };
        case 'fault':
            return { iconClass: 'bi bi-tools', color: '#B8757B', bgColor: 'rgba(184, 117, 123, 0.15)' };
        case 'equipment':
            return { iconClass: 'bi bi-cpu-fill', color: '#C39A5A', bgColor: 'rgba(195, 154, 90, 0.15)' };
        case 'schedule':
            return { iconClass: 'bi bi-clock-history', color: '#79A88A', bgColor: 'rgba(121, 168, 138, 0.15)' };
        default:
            return { iconClass: 'bi bi-bell-fill', color: '#B99AD9', bgColor: 'rgba(139, 111, 179, 0.15)' };
    }
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Recently';
    try {
        const date = new Date(dateStr.replace(' ', 'T'));
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);

        if (isNaN(diffSec) || diffSec < 60) return 'Just now';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
        return `${Math.floor(diffSec / 86400)}d ago`;
    } catch (e) {
        return 'Recently';
    }
}

function toggleNotificationDropdown(e) {
    if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const dropdown = document.getElementById('notification-dropdown-panel');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('d-none') || dropdown.style.display === 'none' || !dropdown.classList.contains('show');
    if (isHidden) {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        dropdown.style.display = 'block';
        fetchNotifications();
    } else {
        dropdown.classList.remove('show');
        dropdown.classList.add('d-none');
        dropdown.style.display = 'none';
    }
}

async function markAllNotificationsAsRead() {
    try {
        const res = await fetch('/api/student/notifications/read-all', { method: 'POST' });
        if (res.ok) {
            await fetchNotifications();
            const pageContainer = document.getElementById('notifications-list-container');
            if (pageContainer) {
                await loadNotifications();
            }
        }
    } catch (e) {
        console.error("Error marking all read:", e);
    }
}

async function markNotificationAsRead(id) {
    try {
        const res = await fetch(`/api/student/notifications/${id}/read`, { method: 'POST' });
        if (res.ok) {
            await fetchNotifications();
        }
    } catch (e) {
        console.error("Error marking notification read:", e);
    }
}

async function handleNotificationClick(id, isUnread, notifType) {
    if (isUnread) {
        await markNotificationAsRead(id);
    }
    const dropdown = document.getElementById('notification-dropdown-panel');
    if (dropdown) dropdown.classList.add('d-none');

    if (notifType === 'booking') {
        navigateTo('/student/bookings');
    } else if (notifType === 'fault') {
        navigateTo('/student/fault-reports');
    } else if (notifType === 'schedule') {
        navigateTo('/student/schedule');
    }
}

// Full Notifications Page View (/student/notifications)
async function loadNotifications() {
    const container = document.getElementById('notifications-list-container');
    const pageUnreadBadge = document.getElementById('page-unread-count-badge');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5 text-slate-400">
            <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
            Loading notifications...
        </div>
    `;

    try {
        const res = await fetch('/api/student/notifications');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const notifications = data.notifications || [];
            const unreadCount = data.unread_count || 0;

            if (pageUnreadBadge) {
                pageUnreadBadge.textContent = unreadCount > 0 ? `${unreadCount} unread` : 'All read';
            }
            renderNotificationBellBadge(unreadCount);

            if (notifications.length > 0) {
                container.innerHTML = notifications.map(n => {
                    const isUnread = !n.is_read;
                    const iconInfo = getNotificationIcon(n.notification_type);

                    return `
                        <div class="p-3.5 rounded-3 d-flex align-items-start gap-3 cursor-pointer notification-card-item"
                             style="background-color: ${isUnread ? '#1C1824' : '#19171F'}; border: 1px solid ${isUnread ? '#8B6FB3' : '#38323F'}; transition: all 0.2s ease;"
                             onclick="handleNotificationClick(${n.id}, ${isUnread})">
                            <div class="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5" 
                                 style="width: 38px; height: 38px; background-color: ${iconInfo.bgColor};">
                                <i class="${iconInfo.iconClass}" style="color: ${iconInfo.color}; font-size: 1rem;"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center justify-content-between mb-1">
                                    <div class="d-flex align-items-center gap-2">
                                        <h6 class="text-white fw-bold mb-0" style="font-size: 0.95rem;">${escapeHtml(n.title)}</h6>
                                        ${isUnread ? '<span class="badge rounded-pill extra-small font-mono px-2 py-0.5" style="background-color: rgba(139, 111, 179, 0.25); color: #B99AD9; font-size: 0.65rem;">NEW</span>' : ''}
                                    </div>
                                    <span class="text-slate-400 font-monospace extra-small">${formatRelativeTime(n.created_at)}</span>
                                </div>
                                <p class="extra-small mb-1 text-slate-300" style="line-height: 1.45; color: #B2AAB8 !important;">
                                    ${escapeHtml(n.message)}
                                </p>
                                <div class="d-flex align-items-center justify-content-between extra-small mt-2 pt-1.5" style="border-top: 1px solid rgba(56, 50, 63, 0.5);">
                                    <span class="font-monospace text-slate-400" style="font-size: 0.72rem;">${escapeHtml(n.time)}</span>
                                    ${isUnread ? `
                                        <button type="button" class="btn btn-sm btn-link p-0 text-decoration-none extra-small fw-semibold" style="color: #B99AD9;" onclick="event.stopPropagation(); markNotificationAsRead(${n.id})">
                                            Mark as read
                                        </button>
                                    ` : `
                                        <span class="text-slate-500 extra-small"><i class="bi bi-check2 me-1"></i>Read</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = `
                    <div class="text-center py-5 px-3 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                        <div class="brand-logo-badge bg-purple-subtle text-purple mx-auto mb-3" style="width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            <i class="bi bi-bell-slash"></i>
                        </div>
                        <h5 class="text-white fw-bold mb-1" style="font-size: 1.1rem;">No Notifications</h5>
                        <p class="text-slate-400 extra-small mb-0">You don't have any notifications at the moment.</p>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `<div class="p-4 text-center text-rose extra-small">${escapeHtml(data.message || 'Unable to load notifications.')}</div>`;
        }
    } catch (e) {
        console.error("Error loading notifications:", e);
        container.innerHTML = `<div class="p-4 text-center text-rose extra-small">Failed to load notifications. Please check your connection.</div>`;
    }
}

function showNotificationToast(title, message, notificationType = 'general') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconInfo = getNotificationIcon(notificationType);
    const toastId = 'toast-' + Date.now();

    const toastEl = document.createElement('div');
    toastEl.id = toastId;
    toastEl.className = 'toast-popup-card shadow-lg p-3 rounded-3 mb-2';
    toastEl.style.cssText = 'background-color: #211E27; border: 1px solid #38323F; border-left: 4px solid #8B6FB3; pointer-events: auto; font-family: var(--font-main); transition: opacity 0.3s ease, transform 0.3s ease;';

    toastEl.innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="d-flex align-items-center gap-2">
                <i class="${iconInfo.iconClass}" style="color: ${iconInfo.color}; font-size: 0.95rem;"></i>
                <strong class="text-white extra-small font-monospace uppercase" style="letter-spacing: 0.04em;">${escapeHtml(title)}</strong>
            </div>
            <button type="button" class="btn-close btn-close-white extra-small ms-auto" onclick="document.getElementById('${toastId}').remove()"></button>
        </div>
        <p class="extra-small mb-0 mt-1.5" style="color: #B2AAB8; font-size: 0.82rem; line-height: 1.35;">${escapeHtml(message)}</p>
    `;

    container.appendChild(toastEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toastEl && toastEl.parentNode) {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (toastEl && toastEl.parentNode) toastEl.remove();
            }, 300);
        }
    }, 5000);

    // Refresh notifications list & badge count
    fetchNotifications();
}

// Close notification dropdown when clicking/tapping outside
function handleOutsideStudentNotificationClick(e) {
    const wrapper = document.getElementById('notification-bell-wrapper');
    const dropdown = document.getElementById('notification-dropdown-panel');
    if (dropdown && (dropdown.classList.contains('show') || dropdown.style.display === 'block' || !dropdown.classList.contains('d-none'))) {
        if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            dropdown.style.display = 'none';
        }
    }
}
document.addEventListener('click', handleOutsideStudentNotificationClick);
document.addEventListener('touchend', handleOutsideStudentNotificationClick);

// Student Stats
async function loadStudentStats() {
    try {
        const res = await fetch('/api/student/stats');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const s = data.stats;
            document.getElementById('stat-active-bookings').textContent = s.active_bookings || 0;
            document.getElementById('stat-upcoming-sessions').textContent = s.upcoming_sessions || 0;
            document.getElementById('stat-equipment-used').textContent = s.equipment_used || 0;
            document.getElementById('stat-open-faults').textContent = s.open_faults || 0;
        }
    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

// Dashboard Quick Summary Tables
async function loadDashboardSummary() {
    const summaryContainer = document.getElementById('dash-recent-bookings-summary');
    if (!summaryContainer) return;

    try {
        const res = await fetch('/api/student/bookings');
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.bookings.length > 0) {
            summaryContainer.innerHTML = data.bookings.slice(0, 3).map(b => `
                <div class="p-3 bg-slate-900 rounded-3 border border-slate-800 d-flex align-items-center justify-content-between">
                    <div>
                        <div class="text-white fw-bold small">${b.equipment_name}</div>
                        <div class="text-slate-300 extra-small">${b.lab_name} &bull; ${b.session_date}</div>
                    </div>
                    <span class="badge bg-cyan-subtle text-cyan extra-small">${b.status}</span>
                </div>
            `).join('');
        } else {
            summaryContainer.innerHTML = `<div class="text-slate-300 extra-small">No upcoming bookings.</div>`;
        }
    } catch (e) {
        console.error("Error loading dashboard summary:", e);
    }
}

// Our College Laboratories View (/student/labs)
async function loadCollegeLabs(showSkeleton = true) {
    const container = document.getElementById('college-labs-grid');
    const badge = document.getElementById('labs-count-badge');
    const deptSelect = document.getElementById('labs-dept-select');
    const searchInput = document.getElementById('labs-search-input');

    if (!container) return;

    if (showSkeleton) {
        container.innerHTML = `
            <div class="col-md-6 col-lg-4">
                <div class="skeleton-card">
                    <div class="skeleton-box w-50 h-20 mb-3"></div>
                    <div class="skeleton-box w-75 h-20 mb-2"></div>
                    <div class="skeleton-box w-100 h-15 mb-3"></div>
                    <div class="skeleton-box w-40 h-30 mt-auto"></div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="skeleton-card">
                    <div class="skeleton-box w-50 h-20 mb-3"></div>
                    <div class="skeleton-box w-75 h-20 mb-2"></div>
                    <div class="skeleton-box w-100 h-15 mb-3"></div>
                    <div class="skeleton-box w-40 h-30 mt-auto"></div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="skeleton-card">
                    <div class="skeleton-box w-50 h-20 mb-3"></div>
                    <div class="skeleton-box w-75 h-20 mb-2"></div>
                    <div class="skeleton-box w-100 h-15 mb-3"></div>
                    <div class="skeleton-box w-40 h-30 mt-auto"></div>
                </div>
            </div>
        `;
    }

    try {
        const searchVal = searchInput ? searchInput.value.trim() : '';
        const deptVal = deptSelect ? deptSelect.value : '';

        let url = `/api/student/labs?search=${encodeURIComponent(searchVal)}&department=${encodeURIComponent(deptVal)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            if (badge) {
                badge.textContent = `${data.total_count || 0} Laboratories`;
            }

            if (deptSelect && data.departments && deptSelect.options.length <= 1) {
                data.departments.forEach(dept => {
                    const opt = document.createElement('option');
                    opt.value = dept;
                    opt.textContent = dept;
                    deptSelect.appendChild(opt);
                });
            }

            if (data.labs && data.labs.length > 0) {
                container.innerHTML = data.labs.map(lab => `
                    <div class="col-md-6 col-lg-4">
                        <div class="lab-card-item">
                            <div>
                                <div class="d-flex align-items-center justify-content-between mb-3">
                                    <div class="metric-icon">
                                        <i class="bi bi-building fs-5"></i>
                                    </div>
                                    <span class="badge bg-emerald-subtle text-emerald rounded-pill px-3 py-1 extra-small fw-bold">
                                        🟢 ${lab.status || 'Active'}
                                    </span>
                                </div>

                                <h5 class="text-white fw-bold mb-2">${lab.name}</h5>
                                <p class="text-slate-300 small mb-3">
                                    <i class="bi bi-geo-alt text-cyan-light me-1.5"></i>${lab.location}
                                </p>

                                <div class="d-flex flex-wrap gap-2 mb-4">
                                    <span class="badge bg-slate-950 text-slate-300 border border-slate-800 extra-small">
                                        <i class="bi bi-diagram-3 me-1 text-cyan-light"></i>${lab.department || 'Department info unavailable'}
                                    </span>
                                    <span class="badge bg-cyan-subtle text-cyan-light extra-small">
                                        <i class="bi bi-hdd-stack me-1"></i>${lab.equipment_count || 0} Items
                                    </span>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 pt-3 border-top border-slate-800 mt-auto">
                                <button class="btn btn-sm btn-cyan flex-grow-1 rounded-pill py-2 extra-small" onclick="navigateTo('/student/labs/${lab.id}')">
                                    View Lab
                                </button>
                                <button class="btn btn-sm btn-outline-cyan rounded-pill py-2 extra-small px-3" onclick="navigateTo('/student/equipment?lab_id=${lab.id}')">
                                    Browse Equipment &rarr;
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                // Empty Search Result State (Requirement 6)
                container.innerHTML = `
                    <div class="col-12 text-center p-5 card-dash">
                        <div class="brand-logo-badge bg-cyan-subtle text-cyan mx-auto mb-3" style="width:56px; height:56px; border-radius:14px;">
                            <i class="bi bi-search fs-3"></i>
                        </div>
                        <h5 class="text-white fw-bold mb-2">No laboratories found</h5>
                        <p class="text-slate-300 extra-small mb-3">Try a different laboratory name, department, or location.</p>
                        <button class="btn btn-sm btn-outline-cyan rounded-pill px-4" onclick="clearLabsSearch()">
                            <i class="bi bi-x-circle me-1"></i> Clear Search
                        </button>
                    </div>
                `;
            }
        } else {
            throw new Error(data.message || "Failed to load labs");
        }
    } catch (e) {
        console.error("Error loading labs:", e);
        container.innerHTML = `
            <div class="col-12 text-center p-5 card-dash border-rose-subtle">
                <div class="brand-logo-badge bg-rose-subtle text-rose mx-auto mb-3" style="width:56px; height:56px; border-radius:14px;">
                    <i class="bi bi-exclamation-triangle fs-3"></i>
                </div>
                <h5 class="text-white fw-bold mb-2">Unable to load laboratories</h5>
                <p class="text-slate-300 extra-small mb-3">We couldn't retrieve the college laboratory information. Please try again.</p>
                <button class="btn btn-sm btn-cyan rounded-pill px-4" onclick="loadCollegeLabs(true)">
                    <i class="bi bi-arrow-clockwise me-1"></i> Retry
                </button>
            </div>
        `;
    }
}

// Dedicated Lab Details View (/student/labs/<lab_id>)
async function loadLabDetails(labId) {
    const container = document.getElementById('view-lab-details-container');
    if (!container) return;

    container.innerHTML = `<div class="p-5 text-center text-slate-300"><div class="spinner-border text-cyan me-2"></div>Loading laboratory details...</div>`;

    try {
        const res = await fetch(`/api/student/labs/${labId}`);
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const lab = data.lab;
            const equipment = data.equipment || [];
            const faculty = data.faculty || [];

            container.innerHTML = `
                <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom border-slate-800">
                    <div class="d-flex align-items-center gap-3">
                        <button class="btn btn-sm btn-dark-card border-slate-700 text-slate-300 rounded-pill px-3" onclick="navigateTo('/student/labs')">
                            <i class="bi bi-arrow-left me-1"></i> Back to Our Labs
                        </button>
                        <div>
                            <span class="badge bg-cyan-subtle text-cyan extra-small px-3 py-1 rounded-pill mb-1">${lab.department}</span>
                            <h3 class="text-white fw-bold mb-0">${lab.name}</h3>
                        </div>
                    </div>
                    <span class="badge bg-emerald-subtle text-emerald rounded-pill px-3.5 py-1.5 extra-small fw-bold">
                        🟢 ${lab.status || 'Active'}
                    </span>
                </div>

                <div class="card-dash p-4 mb-4">
                    <div class="row g-3 align-items-center">
                        <div class="col-lg-8">
                            <div class="text-slate-300 mb-2"><i class="bi bi-geo-alt text-cyan-light me-1.5"></i><strong>Location:</strong> ${lab.location}</div>
                            <p class="text-slate-300 extra-small mb-0">${lab.description}</p>
                        </div>
                        <div class="col-lg-4 text-lg-end">
                            <button class="btn btn-cyan rounded-pill px-4 shadow-cyan" onclick="navigateTo('/student/equipment?lab_id=${lab.id}')">
                                Browse Equipment (${lab.equipment_count || 0}) &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="metric-card">
                            <div class="text-slate-400 extra-small font-monospace uppercase mb-1">TOTAL EQUIPMENT</div>
                            <div class="h3 text-white fw-bold mb-0">${lab.equipment_count || 0}</div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="metric-card">
                            <div class="text-slate-400 extra-small font-monospace uppercase mb-1">AVAILABLE APPARATUS</div>
                            <div class="h3 text-emerald fw-bold mb-0">${lab.available_count || 0}</div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="metric-card">
                            <div class="text-slate-400 extra-small font-monospace uppercase mb-1">UNDER MAINTENANCE</div>
                            <div class="h3 text-amber fw-bold mb-0">${lab.maintenance_count || 0}</div>
                        </div>
                    </div>
                </div>

                <div class="card-dash mb-4">
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom border-slate-800">
                        <h6 class="text-white fw-bold mb-0"><i class="bi bi-hdd-stack text-cyan me-2"></i>Laboratory Apparatus List</h6>
                        <span class="badge bg-slate-950 text-slate-300 extra-small">${equipment.length} Items Listed</span>
                    </div>

                    ${equipment.length > 0 ? `
                        <div class="table-responsive">
                            <table class="table table-dark-custom align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>CODE</th>
                                        <th>NAME</th>
                                        <th>CATEGORY</th>
                                        <th>STATUS</th>
                                        <th class="text-end">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody class="font-monospace extra-small">
                                    ${equipment.map(eq => `
                                        <tr>
                                            <td class="text-cyan fw-bold">${eq.equipment_code}</td>
                                            <td class="font-sans-serif text-white fw-semibold">${eq.name}</td>
                                            <td class="text-slate-300 font-sans-serif">${eq.category}</td>
                                            <td><span class="badge-status ${getStatusBadgeClass(eq.status)}">${eq.status}</span></td>
                                            <td class="text-end font-sans-serif">
                                                ${eq.status === 'Available' ? `
                                                    <button class="btn btn-sm btn-cyan rounded-pill px-3 py-1 extra-small" onclick="openBookingModal(${eq.id}, '${eq.name.replace(/'/g, "\\'")}')">
                                                        Book Apparatus
                                                    </button>
                                                ` : `
                                                    <span class="text-slate-400 extra-small">Unavailable</span>
                                                `}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="text-slate-300 extra-small p-3 text-center">No equipment assigned to this laboratory yet.</div>
                    `}
                </div>

                ${faculty.length > 0 ? `
                    <div class="card-dash">
                        <h6 class="text-white fw-bold mb-3 pb-3 border-bottom border-slate-800"><i class="bi bi-person-badge text-cyan me-2"></i>Faculty &amp; Lab Staff Responsible</h6>
                        <div class="row g-3">
                            ${faculty.map(f => `
                                <div class="col-md-6">
                                    <div class="p-3 bg-slate-900 rounded-3 border border-slate-800 d-flex align-items-center gap-3">
                                        <div class="brand-logo-badge bg-cyan-subtle text-cyan rounded-circle" style="width:40px; height:40px;">
                                            <i class="bi bi-person-fill fs-5"></i>
                                        </div>
                                        <div>
                                            <div class="text-white fw-bold small">${f.name}</div>
                                            <div class="text-slate-300 extra-small"><span class="badge bg-slate-950 text-cyan extra-small me-1">${f.role}</span> &bull; ${f.department}</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        } else {
            container.innerHTML = `<div class="p-5 text-center text-rose">Unable to load laboratory details.</div>`;
        }
    } catch (e) {
        console.error("Error loading lab details:", e);
        container.innerHTML = `<div class="p-5 text-center text-rose">Unable to load laboratory details.</div>`;
    }
}

// Laboratory Equipment View (/student/equipment)
async function loadEquipment(labId = '', search = '', statusFilter = '') {
    const container = document.getElementById('equipment-table-container');
    const selectEl = document.getElementById('eq-lab-select');
    const countLabel = document.getElementById('eq-count-label');
    if (!container) return;

    container.innerHTML = `
        <div class="p-5 text-center text-slate-300">
            <div class="spinner-border spinner-border-sm text-cyan me-2"></div>Loading laboratory equipment...
        </div>
    `;

    try {
        let url = '/api/student/equipment?';
        if (labId) url += `lab_id=${labId}&`;
        if (search) url += `search=${encodeURIComponent(search)}`;

        const res = await fetch(url);
        const data = await res.json();

        if (selectEl && selectEl.options.length <= 1) {
            const labsRes = await fetch('/api/student/labs');
            const labsData = await labsRes.json();
            if (labsRes.ok && labsData.labs) {
                labsData.labs.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = l.name;
                    selectEl.appendChild(opt);
                });
            }
        }
        if (selectEl && labId) {
            selectEl.value = labId;
        }

        if (res.ok && data.status === 'success' && data.equipment.length > 0) {
            let eqList = data.equipment;
            if (statusFilter) {
                eqList = eqList.filter(e => e.status === statusFilter);
            }

            if (countLabel) {
                countLabel.textContent = `${eqList.length} EQUIPMENT ITEM${eqList.length === 1 ? '' : 'S'}`;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table equipment-registry-table align-middle mb-0">
                        <thead>
                            <tr>
                                <th style="width: 14%;">CODE</th>
                                <th style="width: 32%;">EQUIPMENT</th>
                                <th style="width: 14%;">CATEGORY</th>
                                <th style="width: 22%;">LABORATORY</th>
                                <th style="width: 10%;">STATUS</th>
                                <th style="width: 8%;" class="text-end">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eqList.map(eq => {
                                const statusClass = getStatusBadgeClass(eq.status);
                                const isAvailable = eq.status === 'Available';
                                const isFaulty = eq.status === 'Faulty';
                                const isBooked = eq.status === 'Booked';

                                let actionButtonHtml = '';
                                if (isAvailable) {
                                    actionButtonHtml = `
                                        <button class="btn btn-sm btn-cyan px-3 py-1.5 font-sans-serif fw-semibold" onclick="openBookingModal(${eq.id}, '${escapeJsString(eq.name)}')">
                                            Book
                                        </button>
                                    `;
                                } else if (isFaulty) {
                                    actionButtonHtml = `
                                        <button class="btn btn-sm btn-outline-danger text-rose border-rose px-3 py-1.5 font-sans-serif fw-semibold" onclick="openFaultModal(${eq.id}, '${escapeJsString(eq.name)}')">
                                            Report
                                        </button>
                                    `;
                                } else if (isBooked) {
                                    actionButtonHtml = `
                                        <button class="btn btn-sm btn-dark-card border-slate-700 text-slate-300 px-3 py-1.5 font-sans-serif" onclick="openBookingModal(${eq.id}, '${escapeJsString(eq.name)}')">
                                            View
                                        </button>
                                    `;
                                } else {
                                    actionButtonHtml = `
                                        <button class="btn btn-sm btn-dark-card border-slate-700 text-slate-300 px-3 py-1.5 font-sans-serif" onclick="openFaultModal(${eq.id}, '${escapeJsString(eq.name)}')">
                                            View
                                        </button>
                                    `;
                                }

                                return `
                                    <tr>
                                        <td>
                                            <span class="eq-code-tag">${escapeHtml(eq.equipment_code)}</span>
                                        </td>
                                        <td>
                                            <div class="eq-title">${escapeHtml(eq.name)}</div>
                                        </td>
                                        <td>
                                            <span class="eq-category-text">${escapeHtml(eq.category)}</span>
                                        </td>
                                        <td>
                                            <div class="eq-lab-text">${escapeHtml(eq.lab_name)}</div>
                                        </td>
                                        <td>
                                            <span class="badge-status ${statusClass}">${escapeHtml(eq.status)}</span>
                                        </td>
                                        <td class="text-end">
                                            ${actionButtonHtml}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            if (countLabel) countLabel.textContent = `0 EQUIPMENT ITEMS`;
            container.innerHTML = `<div class="p-5 text-center text-slate-400">No equipment items found for this laboratory.</div>`;
        }
    } catch (e) {
        console.error("Error loading equipment:", e);
        if (countLabel) countLabel.textContent = `-- EQUIPMENT ITEMS`;
        container.innerHTML = `<div class="p-5 text-center text-rose">Unable to load equipment list.</div>`;
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Available': return 'badge-available';
        case 'Booked': return 'badge-booked';
        case 'Faulty': return 'badge-faulty';
        case 'Under Maintenance': return 'badge-maintenance';
        default: return 'badge-available';
    }
}

// My Equipment Allocations View (/student/bookings)
async function loadStudentBookings() {
    const container = document.getElementById('bookings-cards-container') || document.getElementById('bookings-table-container');
    const badgeCount = document.getElementById('bookings-count-badge');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5 text-slate-400">
            <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
            Loading assigned equipment...
        </div>
    `;

    try {
        const res = await fetch('/api/student/bookings');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const bookings = data.bookings || [];
            
            if (badgeCount) {
                badgeCount.textContent = `${bookings.length} ALLOCATION${bookings.length === 1 ? '' : 'S'}`;
            }

            if (bookings.length > 0) {
                container.innerHTML = `
                    <div class="allocation-card-grid">
                        ${bookings.map(b => `
                            <div class="equipment-allocation-card" data-booking-id="${b.id}">
                                <div>
                                    <!-- Equipment Name & Tag Code -->
                                    <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                                        <div>
                                            <h4 class="allocation-eq-name mb-0.5">${escapeHtml(b.equipment_name)}</h4>
                                            <span class="allocation-eq-code">${escapeHtml(b.equipment_code)}</span>
                                        </div>
                                        <span class="badge ${b.status_badge_class}">${escapeHtml(b.status_upper)}</span>
                                    </div>

                                    <!-- Laboratory & Code Pill -->
                                    <div class="mb-3 pb-2.5 border-bottom border-slate-800">
                                        <div class="allocation-lab-name">${escapeHtml(b.lab_name)}</div>
                                        <span class="badge bg-purple-subtle text-purple-highlight font-mono extra-small px-2 py-0.5">${escapeHtml(b.lab_code)}</span>
                                    </div>

                                    <!-- Practical Name & Academic Context -->
                                    <div class="mb-3">
                                        <div class="allocation-practical-title">${escapeHtml(b.practical_name)}</div>
                                        <div class="allocation-academic-meta">${escapeHtml(b.academic_context)}</div>
                                    </div>
                                </div>

                                <!-- Date & Time Slot Footer -->
                                <div class="pt-3 border-top border-slate-800 d-flex align-items-center justify-content-between extra-small">
                                    <div class="allocation-time-date font-mono">
                                        <i class="bi bi-clock text-purple-highlight me-1"></i>${escapeHtml(b.time_formatted)}
                                    </div>
                                    <div class="text-slate-400 font-mono">
                                        <i class="bi bi-calendar3 me-1"></i>${escapeHtml(b.date_formatted)}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                // Empty State
                container.innerHTML = `
                    <div class="text-center py-5 px-3 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                        <div class="brand-logo-badge bg-purple-subtle text-purple mx-auto mb-3" style="width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            <i class="bi bi-hdd-stack"></i>
                        </div>
                        <h5 class="text-white fw-bold mb-1" style="font-size: 1.1rem; letter-spacing: 0.02em;">NO EQUIPMENT ASSIGNED</h5>
                        <p class="text-slate-400 extra-small mb-3" style="max-width: 380px; margin: 0 auto; line-height: 1.5;">
                            You don't have any equipment assigned to an upcoming practical session.
                        </p>
                        <button class="btn btn-sm btn-outline-purple rounded-pill px-4 py-1.5 extra-small fw-medium" onclick="navigateTo('/student/schedule')">
                            View Lab Schedule
                        </button>
                    </div>
                `;
            }
        } else {
            throw new Error(data.message || 'Unable to load equipment allocations.');
        }
    } catch (e) {
        console.error("Error loading student bookings:", e);
        container.innerHTML = `<div class="p-4 text-center text-rose extra-small">Unable to load assigned equipment.</div>`;
    }
}

async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this equipment booking?")) return;
    try {
        const res = await fetch(`/api/student/bookings/${bookingId}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            loadStudentBookings();
            loadStudentStats();
        } else {
            alert(data.message || 'Unable to cancel booking.');
        }
    } catch (e) {
        console.error("Cancel booking error:", e);
    }
}

// My Fault Reports View (/student/fault-reports)
async function loadStudentFaultReports() {
    const container = document.getElementById('faults-table-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5 text-slate-400">
            <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
            Loading your fault reports...
        </div>
    `;

    try {
        const res = await fetch('/api/student/fault-reports');
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.fault_reports && data.fault_reports.length > 0) {
            container.innerHTML = `
                <div class="student-activity-cards-grid">
                    ${data.fault_reports.map(f => {
                        let statusClass = 'badge-status-reported';
                        const stLower = (f.status || '').toLowerCase();
                        if (stLower === 'resolved' || stLower === 'closed') {
                            statusClass = 'badge-status-resolved';
                        } else if (stLower === 'open') {
                            statusClass = 'badge-status-open';
                        } else if (stLower === 'under review') {
                            statusClass = 'badge-status-review';
                        } else if (stLower === 'reported') {
                            statusClass = 'badge-status-reported';
                        }

                        let prioClass = 'badge-priority-medium';
                        const pLower = (f.priority || '').toLowerCase();
                        if (pLower === 'high') {
                            prioClass = 'badge-priority-high';
                        } else if (pLower === 'low') {
                            prioClass = 'badge-priority-low';
                        }

                        return `
                            <div class="student-activity-card">
                                <div class="student-activity-card-header">
                                    <h5 class="student-card-title">${escapeHtml(f.equipment_name)}</h5>
                                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                        <div class="d-flex align-items-center gap-1.5">
                                            <span class="badge extra-small font-mono px-2.5 py-1" style="background-color: rgba(139, 111, 179, 0.14); color: #B99AD9; border: 1px solid rgba(139, 111, 179, 0.25);">
                                                ${escapeHtml(f.equipment_code)}
                                            </span>
                                            <span class="badge rounded-pill extra-small font-mono px-2.5 py-0.5 fw-semibold ${prioClass}">
                                                ${escapeHtml(f.priority)} Priority
                                            </span>
                                        </div>
                                        <span class="badge rounded-pill font-mono px-2.5 py-1 fw-bold ${statusClass}">
                                            ● ${escapeHtml((f.status || 'Reported').toUpperCase())}
                                        </span>
                                    </div>
                                </div>

                                <div class="student-card-field-group">
                                    <div class="student-card-label">
                                        <i class="bi bi-building text-purple-highlight"></i> Laboratory
                                    </div>
                                    <div class="student-card-value text-slate-200">
                                        ${escapeHtml(f.lab_name)}
                                    </div>
                                </div>

                                <div class="student-card-field-group">
                                    <div class="student-card-label">
                                        <i class="bi bi-exclamation-triangle text-rose"></i> Fault Reported
                                    </div>
                                    <div class="student-card-value text-slate-300" style="background-color: rgba(17, 16, 20, 0.35); padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #2B2632;">
                                        ${escapeHtml(f.description)}
                                    </div>
                                </div>

                                <div class="student-card-meta-grid" style="grid-template-columns: 1fr;">
                                    <div class="student-card-meta-item d-flex align-items-center justify-content-between">
                                        <div class="student-card-label mb-0">
                                            <i class="bi bi-clock-history"></i> Reported Date
                                        </div>
                                        <div class="student-card-value">
                                            ${escapeHtml(f.reported_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="p-5 text-center text-slate-400 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                    <i class="bi bi-tools fs-2 text-slate-500 d-block mb-3 opacity-75"></i>
                    <h6 class="text-white fw-bold mb-1">No fault reports submitted yet.</h6>
                    <p class="extra-small text-slate-400 mb-0">Hardware or apparatus issues reported by you will be tracked here.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error("Error loading fault reports:", e);
        container.innerHTML = `
            <div class="p-4 text-center text-rose rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                Unable to load fault reports. Please try again.
            </div>
        `;
    }
}

// Usage History View (/student/usage)
async function loadUsageHistory() {
    const container = document.getElementById('usage-table-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5 text-slate-400">
            <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
            Loading equipment usage history...
        </div>
    `;

    try {
        const res = await fetch('/api/student/usage');
        const data = await res.json();
        const countBadge = document.getElementById('usage-records-count-badge');

        if (res.ok && data.status === 'success' && data.usage && data.usage.length > 0) {
            const cnt = data.usage.length;
            if (countBadge) {
                countBadge.textContent = `${cnt} USAGE RECORD${cnt === 1 ? '' : 'S'}`;
                countBadge.classList.remove('d-none');
            }
            container.innerHTML = `
                <div class="student-activity-cards-grid">
                    ${data.usage.map(u => `
                        <div class="student-activity-card">
                            <div class="student-activity-card-header">
                                <h5 class="student-card-title">${escapeHtml(u.equipment_name)}</h5>
                                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                    <span class="badge extra-small font-mono px-2.5 py-1" style="background-color: rgba(139, 111, 179, 0.14); color: #B99AD9; border: 1px solid rgba(139, 111, 179, 0.25);">
                                        ${escapeHtml(u.equipment_code)}
                                    </span>
                                    <span class="badge rounded-pill badge-status-completed font-mono px-2.5 py-1 fw-bold">
                                        ● ${escapeHtml((u.status || 'Completed').toUpperCase())}
                                    </span>
                                </div>
                            </div>

                            <div class="student-card-field-group">
                                <div class="student-card-label">
                                    <i class="bi bi-building text-purple-highlight"></i> Laboratory
                                </div>
                                <div class="student-card-value text-slate-200">
                                    ${escapeHtml(u.lab_name)}
                                </div>
                            </div>

                            <div class="student-card-field-group">
                                <div class="student-card-label">
                                    <i class="bi bi-journal-code text-purple-highlight"></i> Practical / Subject
                                </div>
                                <div class="student-card-value text-slate-300">
                                    ${escapeHtml(u.practical_name)}
                                </div>
                            </div>

                            <div class="student-card-meta-grid">
                                <div class="student-card-meta-item">
                                    <div class="student-card-label">
                                        <i class="bi bi-calendar3"></i> Date
                                    </div>
                                    <div class="student-card-value">
                                        ${escapeHtml(u.formatted_date)}
                                    </div>
                                </div>
                                <div class="student-card-meta-item">
                                    <div class="student-card-label">
                                        <i class="bi bi-clock"></i> Time
                                    </div>
                                    <div class="student-card-value">
                                        ${escapeHtml(u.time_slot)}
                                    </div>
                                </div>
                                <div class="student-card-meta-item">
                                    <div class="student-card-label">
                                        <i class="bi bi-hourglass-split"></i> Duration
                                    </div>
                                    <div class="student-card-value">
                                        ${escapeHtml(u.duration_display)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            if (countBadge) {
                countBadge.classList.add('d-none');
            }
            container.innerHTML = `
                <div class="p-5 text-center text-slate-400 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                    <i class="bi bi-clock-history fs-2 text-slate-500 d-block mb-3 opacity-75"></i>
                    <h6 class="text-white fw-bold mb-1">No equipment usage recorded yet.</h6>
                    <p class="extra-small text-slate-400 mb-0">Apparatus checkouts and completed practical sessions will appear here.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error("Error loading usage history:", e);
        container.innerHTML = `
            <div class="p-4 text-center text-rose rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                Unable to load usage history. Please try again.
            </div>
        `;
    }
}

// Notifications View handled above in NOTIFICATION SYSTEM section

// Dedicated QR Scanner Interface View (/student/scan-qr)
let html5QrCodeInstance = null;
let isScannerActive = false;

function initQrScannerView() {
    const startBtn = document.getElementById('btn-start-scanner');
    const stopBtn = document.getElementById('btn-stop-scanner');
    const qrInput = document.getElementById('page-qr-input');
    const searchBtn = document.getElementById('page-qr-btn');

    if (startBtn) {
        startBtn.addEventListener('click', startQrScanner);
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => stopQrScanner(true));
    }

    if (searchBtn && qrInput) {
        searchBtn.addEventListener('click', () => {
            const code = qrInput.value.trim();
            if (code) {
                processEquipmentLookup(code);
            }
        });

        qrInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = qrInput.value.trim();
                if (code) {
                    processEquipmentLookup(code);
                }
            }
        });
    }
}

async function startQrScanner() {
    clearScannerAlert();
    if (isScannerActive) return;

    const qrWrapper = document.getElementById('qr-reader-wrapper');
    const placeholder = document.getElementById('qr-camera-placeholder');

    if (typeof Html5Qrcode === 'undefined') {
        showScannerAlert('QR scanner library is loading. Please ensure internet connectivity and try again.', 'danger');
        return;
    }

    try {
        if (!html5QrCodeInstance) {
            html5QrCodeInstance = new Html5Qrcode("qr-reader");
        }

        if (placeholder) placeholder.classList.add('d-none');
        if (qrWrapper) qrWrapper.classList.remove('d-none');

        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        // Attempt facingMode "environment" first, fallback to "user"
        try {
            await html5QrCodeInstance.start({ facingMode: "environment" }, config, onQrCodeScanned, onQrScanError);
        } catch (e1) {
            await html5QrCodeInstance.start({ facingMode: "user" }, config, onQrCodeScanned, onQrScanError);
        }

        isScannerActive = true;
        updateScannerButtons(true);
    } catch (err) {
        console.error("Camera Error:", err);
        isScannerActive = false;
        if (qrWrapper) qrWrapper.classList.add('d-none');
        if (placeholder) placeholder.classList.remove('d-none');
        updateScannerButtons(false);

        let errorMsg = "Camera access was denied. You can enter the equipment tag manually.";
        if (err && (err.name === 'NotFoundError' || (err.message && err.message.toLowerCase().includes('not found')))) {
            errorMsg = "No camera detected on this device. You can enter the equipment tag manually below.";
        } else if (err && err.name === 'NotAllowedError') {
            errorMsg = "Camera access was denied. You can enter the equipment tag manually below.";
        }
        showScannerAlert(errorMsg, 'warning');
    }
}

async function stopQrScanner(manualClick = true) {
    if (html5QrCodeInstance && isScannerActive) {
        try {
            await html5QrCodeInstance.stop();
            html5QrCodeInstance.clear();
        } catch (e) {
            console.error("Error stopping scanner:", e);
        }
    }

    isScannerActive = false;
    const qrWrapper = document.getElementById('qr-reader-wrapper');
    const placeholder = document.getElementById('qr-camera-placeholder');

    if (qrWrapper) qrWrapper.classList.add('d-none');
    if (placeholder) placeholder.classList.remove('d-none');

    updateScannerButtons(false);
    if (manualClick) {
        clearScannerAlert();
    }
}

function updateScannerButtons(active) {
    const startBtn = document.getElementById('btn-start-scanner');
    const stopBtn = document.getElementById('btn-stop-scanner');

    if (active) {
        if (startBtn) startBtn.classList.add('d-none');
        if (stopBtn) stopBtn.classList.remove('d-none');
    } else {
        if (startBtn) startBtn.classList.remove('d-none');
        if (stopBtn) stopBtn.classList.add('d-none');
    }
}

function onQrCodeScanned(decodedText, decodedResult) {
    stopQrScanner(false);
    processEquipmentLookup(decodedText);
}

function onQrScanError(errorMessage) {
    // Silent frame scan errors
}

function showScannerAlert(message, type = 'danger') {
    const alertBox = document.getElementById('scanner-status-alert');
    if (!alertBox) return;

    alertBox.className = `alert alert-${type} extra-small mt-3 mb-0 text-start`;
    alertBox.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1.5"></i>${escapeHtml(message)}`;
    alertBox.classList.remove('d-none');
}

function clearScannerAlert() {
    const alertBox = document.getElementById('scanner-status-alert');
    if (alertBox) {
        alertBox.innerHTML = '';
        alertBox.classList.add('d-none');
    }
}

async function processEquipmentLookup(rawCode) {
    const resultBox = document.getElementById('page-qr-result');
    if (!resultBox) return;

    const cleanCode = (rawCode || '').trim();

    if (!cleanCode) {
        resultBox.innerHTML = `
            <div class="p-3 bg-slate-900 rounded-3 border border-slate-800 text-rose extra-small text-start">
                <i class="bi bi-exclamation-circle me-1.5"></i>Please enter or scan an equipment code.
            </div>
        `;
        return;
    }

    // Security Check: Block external URLs & executable scripts
    const isUrl = /^https?:\/\//i.test(cleanCode) || /^www\./i.test(cleanCode) || cleanCode.includes('://');
    const isScript = /<[^>]*>/g.test(cleanCode) || /javascript:/i.test(cleanCode);

    if (isUrl || isScript) {
        resultBox.innerHTML = `
            <div class="p-4 bg-slate-900 rounded-3 border border-slate-800 text-start">
                <div class="d-flex align-items-center gap-2 text-rose fw-bold mb-1">
                    <i class="bi bi-shield-x fs-5"></i> Invalid LabFlow equipment QR.
                </div>
                <div class="text-slate-300 extra-small">
                    Please scan a QR code assigned to college laboratory equipment.
                </div>
            </div>
        `;
        return;
    }

    resultBox.innerHTML = `
        <div class="p-4 bg-slate-900 rounded-3 border border-slate-800 text-center text-slate-300">
            <div class="spinner-border spinner-border-sm text-cyan me-2"></div>Looking up equipment tag details...
        </div>
    `;

    try {
        const res = await fetch(`/api/student/qr-lookup/${encodeURIComponent(cleanCode)}`);
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.equipment) {
            const eq = data.equipment;
            const statusClass = getStatusBadgeClass(eq.status);
            const isAvailable = eq.status === 'Available';
            const isFaulty = eq.status === 'Faulty';
            const isBooked = eq.status === 'Booked';
            const isMaintenance = eq.status === 'Under Maintenance';

            let actionHtml = '';
            if (isAvailable) {
                actionHtml = `
                    <button class="btn btn-cyan rounded-pill px-4 py-2 fw-bold extra-small" onclick="openBookingModal(${eq.id}, '${escapeJsString(eq.name)}')">
                        <i class="bi bi-calendar-check me-1.5"></i>Book Equipment
                    </button>
                `;
            } else if (isFaulty) {
                actionHtml = `
                    <button class="btn btn-outline-danger text-rose border-rose rounded-pill px-4 py-2 fw-bold extra-small" onclick="openFaultModal(${eq.id}, '${escapeJsString(eq.name)}')">
                        <i class="bi bi-tools me-1.5"></i>Report Fault
                    </button>
                `;
            } else if (isBooked) {
                actionHtml = `
                    <span class="badge bg-amber-subtle text-amber rounded-pill px-3 py-2 extra-small fw-bold">
                        <i class="bi bi-lock me-1"></i>Currently Booked
                    </span>
                `;
            } else if (isMaintenance) {
                actionHtml = `
                    <span class="badge bg-amber-subtle text-amber rounded-pill px-3 py-2 extra-small fw-bold">
                        <i class="bi bi-wrench me-1"></i>Under Maintenance
                    </span>
                `;
            } else {
                actionHtml = `
                    <button class="btn btn-outline-secondary rounded-pill px-3 py-1.5 extra-small text-slate-400" disabled>
                        Unavailable
                    </button>
                `;
            }

            resultBox.innerHTML = `
                <div class="card-dash text-start border-cyan-subtle p-4">
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom border-slate-800">
                        <div>
                            <span class="badge bg-cyan-subtle text-cyan extra-small font-monospace mb-1">EQUIPMENT IDENTIFIED</span>
                            <h4 class="text-white fw-bold mb-0">${escapeHtml(eq.name)}</h4>
                        </div>
                        <span class="badge-status ${statusClass} fs-7 px-3 py-1.5">${escapeHtml(eq.status)}</span>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-md-6 col-lg-3">
                            <div class="p-3 bg-slate-950 rounded-3 border border-slate-800">
                                <div class="text-slate-400 font-monospace extra-small uppercase mb-1">EQUIPMENT CODE</div>
                                <div class="text-cyan font-monospace fw-bold">${escapeHtml(eq.equipment_code)}</div>
                            </div>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <div class="p-3 bg-slate-950 rounded-3 border border-slate-800">
                                <div class="text-slate-400 font-monospace extra-small uppercase mb-1">LABORATORY</div>
                                <div class="text-white fw-semibold small">${escapeHtml(eq.lab_name || 'College Lab')}</div>
                            </div>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <div class="p-3 bg-slate-950 rounded-3 border border-slate-800">
                                <div class="text-slate-400 font-monospace extra-small uppercase mb-1">LOCATION</div>
                                <div class="text-slate-300 small"><i class="bi bi-geo-alt text-cyan-light me-1"></i>${escapeHtml(eq.lab_location || 'Campus Lab')}</div>
                            </div>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <div class="p-3 bg-slate-950 rounded-3 border border-slate-800">
                                <div class="text-slate-400 font-monospace extra-small uppercase mb-1">STATUS</div>
                                <div class="text-slate-300 small fw-bold">${escapeHtml(eq.status)}</div>
                            </div>
                        </div>
                    </div>

                    ${eq.description ? `
                        <div class="text-slate-300 extra-small mb-3">
                            <strong>Description:</strong> ${escapeHtml(eq.description)}
                        </div>
                    ` : ''}

                    <div class="d-flex align-items-center justify-content-between pt-3 border-top border-slate-800">
                        <div class="text-slate-400 extra-small">
                            Status: <strong class="text-white">${escapeHtml(eq.status)}</strong>
                        </div>
                        <div>
                            ${actionHtml}
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultBox.innerHTML = `
                <div class="p-4 bg-slate-900 rounded-3 border border-slate-800 text-start">
                    <div class="d-flex align-items-center gap-2 text-rose fw-bold mb-1">
                        <i class="bi bi-search fs-5"></i> Equipment not found.
                    </div>
                    <div class="text-slate-300 extra-small">
                        Please check the equipment tag and try again.
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error("QR Lookup Error:", e);
        resultBox.innerHTML = `
            <div class="p-3 bg-slate-900 rounded-3 border border-slate-800 text-rose extra-small text-start">
                <i class="bi bi-exclamation-triangle me-1.5"></i>Unable to lookup equipment details. Please try again.
            </div>
        `;
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

function escapeJsString(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Modal Trigger Helpers
function openBookingModal(equipmentId, equipmentName) {
    document.getElementById('booking-eq-id').value = equipmentId;
    document.getElementById('booking-eq-name').textContent = equipmentName;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('booking-date').value = tomorrow.toISOString().split('T')[0];

    const modal = new bootstrap.Modal(document.getElementById('bookingModal'));
    modal.show();
}

function openFaultModal(equipmentId, equipmentName) {
    document.getElementById('fault-eq-id').value = equipmentId;
    document.getElementById('fault-eq-name').textContent = equipmentName;

    const modal = new bootstrap.Modal(document.getElementById('faultModal'));
    modal.show();
}

// Forms Submission Handlers
function initBookingForm() {
    const form = document.getElementById('booking-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const equipmentId = document.getElementById('booking-eq-id').value;
        const batchName = document.getElementById('booking-batch').value.trim();
        const sessionDate = document.getElementById('booking-date').value;
        const startTime = document.getElementById('booking-start-time').value;
        const endTime = document.getElementById('booking-end-time').value;
        const alertBox = document.getElementById('booking-modal-alert');

        try {
            const res = await fetch('/api/student/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipment_id: equipmentId,
                    batch_name: batchName,
                    session_date: sessionDate,
                    start_time: startTime,
                    end_time: endTime
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                alertBox.className = 'alert alert-success extra-small mb-3';
                alertBox.textContent = result.message;
                alertBox.classList.remove('d-none');

                const eqName = document.getElementById('booking-eq-name').textContent || 'Apparatus';
                showNotificationToast("Booking Confirmed", `Your booking for ${eqName} on ${sessionDate} has been confirmed.`, "booking");

                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
                    alertBox.classList.add('d-none');
                    loadStudentStats();
                    navigateTo('/student/bookings');
                }, 1000);
            } else {
                alertBox.className = 'alert alert-danger extra-small mb-3';
                alertBox.textContent = result.message || 'Failed to book equipment.';
                alertBox.classList.remove('d-none');
            }
        } catch (err) {
            console.error("Booking error:", err);
        }
    });
}

function initFaultForm() {
    const form = document.getElementById('fault-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const equipmentId = document.getElementById('fault-eq-id').value;
        const faultType = document.getElementById('fault-type').value;
        const priority = document.getElementById('fault-priority').value;
        const description = document.getElementById('fault-desc').value.trim();
        const alertBox = document.getElementById('fault-modal-alert');

        try {
            const res = await fetch('/api/student/fault-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipment_id: equipmentId,
                    fault_type: faultType,
                    priority: priority,
                    description: description
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                alertBox.className = 'alert alert-success extra-small mb-3';
                alertBox.textContent = result.message;
                alertBox.classList.remove('d-none');

                const eqName = document.getElementById('fault-eq-name').textContent || 'Apparatus';
                showNotificationToast("Fault Report Submitted", `Your fault report for ${eqName} has been logged for technician maintenance.`, "fault");

                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById('faultModal')).hide();
                    alertBox.classList.add('d-none');
                    loadStudentStats();
                    navigateTo('/student/fault-reports');
                }, 1000);
            } else {
                alertBox.className = 'alert alert-danger extra-small mb-3';
                alertBox.textContent = result.message || 'Failed to submit report.';
                alertBox.classList.remove('d-none');
            }
        } catch (err) {
            console.error("Fault error:", err);
        }
    });
}

// Logout Handlers & Confirmation
function openLogoutConfirmation() {
    // Close mobile sidebar drawer if open
    const sidebar = document.getElementById('student-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
        if (overlay) overlay.classList.add('d-none');
    }

    const modalEl = document.getElementById('logoutModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        if (confirm("Are you sure you want to log out of LabFlow Lite?")) {
            executeLogout();
        }
    }
}

async function executeLogout() {
    const alertBox = document.getElementById('logout-modal-alert');
    const confirmBtn = document.getElementById('confirm-logout-btn');
    if (alertBox) alertBox.classList.add('d-none');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Logging out...';
    }

    try {
        const res = await _nativeFetch('/api/auth/logout', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            // Clear only client-side authentication/session state
            sessionStorage.removeItem('labflow_active_tab');
            localStorage.removeItem('labflow_user');

            const modalEl = document.getElementById('logoutModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }

            // Redirect using replace to prevent back-button restoring session
            window.location.replace(data.redirect || '/login');
        } else {
            throw new Error(data.message || "Unable to log out. Please try again.");
        }
    } catch (e) {
        console.error("Logout Error:", e);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Logout';
        }
        if (alertBox) {
            alertBox.textContent = e.message || "Unable to log out. Please try again.";
            alertBox.classList.remove('d-none');
        } else {
            alert(e.message || "Unable to log out. Please try again.");
        }
    }
}

function handleLogout() {
    openLogoutConfirmation();
}



// ==========================================================================
// STUDENT PRACTICAL LABORATORY SCHEDULE & COLLEGE WEEKLY TIMETABLE
// ==========================================================================

let currentScheduleWeekOffset = 0;
let cachedStudentScheduleData = null;
let currentScheduleFilter = 'all';
let currentSubjectFilter = '';
let currentLabFilter = '';

let currentSessionBookingContext = null;
let currentSelectedEquipment = null;

// Navigate Weeks
function navigateScheduleWeek(offsetDelta) {
    if (offsetDelta === 0) {
        currentScheduleWeekOffset = 0;
    } else {
        currentScheduleWeekOffset += offsetDelta;
    }
    loadStudentSchedule();
}

// Load Student Practical Schedule & Weekly Timetable
async function loadStudentSchedule() {
    const gridBody = document.getElementById('timetable-grid-body');
    const mobileView = document.getElementById('timetable-mobile-view');
    const emptyState = document.getElementById('timetable-empty-state');
    const todayList = document.getElementById('today-practicals-list');
    
    const deptHeader = document.getElementById('sched-dept-name');
    const academicMeta = document.getElementById('sched-academic-meta');
    const weekLabel = document.getElementById('sched-week-label');
    const thisWeekBtn = document.getElementById('sched-btn-this-week');

    if (gridBody) {
        gridBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-slate-400">
                    <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
                    Loading practical laboratory timetable...
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch(`/api/student/schedule?week_offset=${currentScheduleWeekOffset}`);
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.data) {
            const schedData = data.data;
            cachedStudentScheduleData = schedData;

            // 1. Populate Academic Context Bar
            if (deptHeader && schedData.student_academic_header) {
                deptHeader.textContent = schedData.student_academic_header;
            }
            if (academicMeta && schedData.academic_meta) {
                academicMeta.textContent = schedData.academic_meta;
            }

            // 2. Populate Week Navigation Bar
            if (weekLabel && schedData.week_range_display) {
                weekLabel.textContent = schedData.week_range_display;
            }
            if (thisWeekBtn) {
                if (currentScheduleWeekOffset === 0) {
                    thisWeekBtn.classList.add('btn-purple');
                    thisWeekBtn.classList.remove('btn-outline-purple');
                } else {
                    thisWeekBtn.classList.remove('btn-purple');
                    thisWeekBtn.classList.add('btn-outline-purple');
                }
            }

            // 3. Populate Filter Dropdowns (only once or update)
            populateScheduleFilterDropdowns(schedData.schedule || []);

            // 4. Render Summary Metrics
            renderWeekSummary(schedData);

            // 5. Render Weekly Timetable Grid
            renderWeeklyTimetableGrid(schedData);

            // 6. Render Today's Practicals List
            renderTodayPracticals(schedData);

        } else {
            showScheduleError();
        }
    } catch (e) {
        console.error("Error loading student schedule:", e);
        showScheduleError();
    }
}

// Populate Filter Dropdowns (Subject & Lab)
function populateScheduleFilterDropdowns(sessions) {
    const subjSelect = document.getElementById('sched-filter-subject');
    const labSelect = document.getElementById('sched-filter-lab');
    if (!subjSelect || !labSelect) return;

    const currentSubj = subjSelect.value;
    const currentLab = labSelect.value;

    const subjects = Array.from(new Set(sessions.map(s => s.practical_name))).filter(Boolean);
    const labs = Array.from(new Set(sessions.map(s => s.lab_name))).filter(Boolean);

    subjSelect.innerHTML = '<option value="">All Subjects</option>' + subjects.map(s => `
        <option value="${escapeHtml(s)}" ${s === currentSubj ? 'selected' : ''}>${escapeHtml(s)}</option>
    `).join('');

    labSelect.innerHTML = '<option value="">All Laboratories</option>' + labs.map(l => `
        <option value="${escapeHtml(l)}" ${l === currentLab ? 'selected' : ''}>${escapeHtml(l)}</option>
    `).join('');
}

function applyScheduleDropdownFilters() {
    const subjSelect = document.getElementById('sched-filter-subject');
    const labSelect = document.getElementById('sched-filter-lab');
    currentSubjectFilter = subjSelect ? subjSelect.value : '';
    currentLabFilter = labSelect ? labSelect.value : '';

    if (cachedStudentScheduleData) {
        renderWeeklyTimetableGrid(cachedStudentScheduleData);
    }
}

function filterStudentSchedule(filterKey) {
    currentScheduleFilter = filterKey;

    document.querySelectorAll('.sched-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filterKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (cachedStudentScheduleData) {
        renderWeeklyTimetableGrid(cachedStudentScheduleData);
    }
}

// Render Summary Metrics (Practical Sessions, Laboratories, Next Practical)
function renderWeekSummary(schedData) {
    const sessCountEl = document.getElementById('summary-sessions-count');
    const labsCountEl = document.getElementById('summary-labs-count');
    const nextSubjEl = document.getElementById('summary-next-subject');
    const nextMetaEl = document.getElementById('summary-next-meta');

    const allSessions = schedData.schedule || [];
    const mon = schedData.target_monday;
    const sun = schedData.target_sunday;

    // Filter sessions belonging to the active week
    const weekSessions = allSessions.filter(s => s.session_date >= mon && s.session_date <= sun);
    
    if (sessCountEl) sessCountEl.textContent = weekSessions.length;

    const uniqueLabs = new Set(weekSessions.map(s => s.lab_id));
    if (labsCountEl) labsCountEl.textContent = uniqueLabs.size;

    // Find next upcoming practical (from today onwards in chronological order)
    const todayStr = schedData.current_date;
    const upcomingSessions = weekSessions.filter(s => s.session_date >= todayStr);
    const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : (weekSessions.length > 0 ? weekSessions[0] : null);

    if (nextSubjEl && nextMetaEl) {
        if (nextSession) {
            nextSubjEl.textContent = nextSession.practical_name;
            nextMetaEl.textContent = `${nextSession.day_name} • ${nextSession.time_slot_compact} (${nextSession.lab_code})`;
        } else {
            nextSubjEl.textContent = "No Upcoming Sessions";
            nextMetaEl.textContent = "No practicals scheduled";
        }
    }
}

// Render Desktop Weekly Table Grid & Mobile Grouped View
// Render Desktop Weekly Table Grid & Mobile Grouped View
function renderWeeklyTimetableGrid(schedData) {
    const gridBody = document.getElementById('timetable-grid-body');
    const mobileView = document.getElementById('timetable-mobile-view');
    const emptyState = document.getElementById('timetable-empty-state');
    if (!gridBody) return;

    const allSessions = schedData.schedule || [];
    const targetMondayStr = schedData.target_monday; // e.g. "2026-08-31"
    const todayStr = schedData.current_date;

    // Generate dates for Monday to Saturday
    const targetMonday = new Date(targetMondayStr + 'T00:00:00');
    const daysMeta = [];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < 6; i++) {
        const d = new Date(targetMonday);
        d.setDate(targetMonday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const isToday = (dateStr === todayStr);

        daysMeta.push({
            index: i,
            dayShort: dayNames[i],
            dateStr: dateStr,
            dateDisplay: `${dd} ${d.toLocaleString('default', { month: 'short' })}`,
            isToday: isToday
        });
    }

    // Update table header days cleanly (date and TODAY badge inside the single day header)
    daysMeta.forEach(dMeta => {
        const thId = `th-day-${dMeta.dayShort.toLowerCase()}`;
        const th = document.getElementById(thId);
        if (th) {
            if (dMeta.isToday) {
                th.className = 'day-col-header today-col-header text-center';
                th.innerHTML = `
                    <div class="day-name font-mono fw-bold">${escapeHtml(dMeta.dayShort)}</div>
                    <div class="day-date font-mono mt-0.5">${escapeHtml(dMeta.dateDisplay.toUpperCase())}</div>
                    <span class="badge rounded-pill today-badge font-mono mt-1">TODAY</span>
                `;
            } else {
                th.className = 'day-col-header text-center';
                th.innerHTML = `
                    <div class="day-name font-mono fw-bold">${escapeHtml(dMeta.dayShort)}</div>
                    <div class="day-date font-mono mt-0.5">${escapeHtml(dMeta.dateDisplay.toUpperCase())}</div>
                `;
            }
        }
    });

    // Filter active sessions by filter buttons and dropdowns
    let activeSessions = allSessions.filter(s => {
        // Dropdown filters
        if (currentSubjectFilter && s.practical_name !== currentSubjectFilter) return false;
        if (currentLabFilter && s.lab_name !== currentLabFilter) return false;

        // Button filters
        if (currentScheduleFilter === 'today' && s.session_date !== todayStr) return false;
        if (currentScheduleFilter === 'upcoming' && s.session_date < todayStr) return false;

        return true;
    });

    // Check if any sessions exist in the entire week
    const hasAnyInWeek = allSessions.some(s => s.session_date >= daysMeta[0].dateStr && s.session_date <= daysMeta[5].dateStr);

    if (!hasAnyInWeek && activeSessions.length === 0) {
        gridBody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('d-none');
        if (mobileView) mobileView.innerHTML = '';
        return;
    } else {
        if (emptyState) emptyState.classList.add('d-none');
    }

    // Standard Academic Lab Time Slot Rows (AM/PM Formatted)
    const timeSlots = [
        { label: '09:00 AM – 11:00 AM', start: '09:00', end: '11:00', isLunch: false },
        { label: '11:00 AM – 01:00 PM', start: '11:00', end: '13:00', isLunch: false },
        { label: '01:00 PM – 02:00 PM', start: '13:00', end: '14:00', isLunch: true, labelDisplay: 'LUNCH INTERVAL' },
        { label: '02:00 PM – 04:00 PM', start: '14:00', end: '16:00', isLunch: false },
        { label: '04:00 PM – 06:00 PM', start: '16:00', end: '18:00', isLunch: false }
    ];

    // Build Desktop Table Rows
    let tableHtml = '';

    timeSlots.forEach(slot => {
        if (slot.isLunch) {
            tableHtml += `
                <tr class="lunch-interval-row">
                    <td class="cell-time font-mono">${slot.label}</td>
                    <td colspan="6" class="cell-lunch font-mono text-center">
                        <i class="bi bi-cup-hot me-1.5 opacity-75"></i>${slot.labelDisplay}
                    </td>
                </tr>
            `;
            return;
        }

        tableHtml += `<tr>`;
        tableHtml += `<td class="cell-time font-mono">${slot.label}</td>`;

        daysMeta.forEach(dMeta => {
            const cellTodayClass = dMeta.isToday ? 'cell-today' : '';

            // Find matching session for this date & overlapping time slot
            const session = activeSessions.find(s => {
                if (s.session_date !== dMeta.dateStr) return false;
                const sStart = s.start_time.substring(0, 5);
                const sEnd = s.end_time.substring(0, 5);
                return (sStart < slot.end && sEnd > slot.start);
            });

            if (session) {
                tableHtml += `
                    <td class="${cellTodayClass}">
                        <div class="timetable-card-compact ${session.is_booked_by_student ? 'is-booked' : ''}" onclick="openSessionDetailsModal(${session.id})" title="Click to view details & equipment">
                            <div class="d-flex align-items-start justify-content-between gap-1 mb-1">
                                <div class="card-subj text-truncate" title="${escapeHtml(session.practical_name)}">${escapeHtml(session.practical_name)}</div>
                                <span class="card-lab-badge flex-shrink-0 font-mono">${escapeHtml(session.lab_code)}</span>
                            </div>
                            <div class="card-meta-line d-flex align-items-center justify-content-between extra-small">
                                <span class="font-mono text-slate-300"><i class="bi bi-clock me-1 text-purple-highlight"></i>${escapeHtml(session.time_slot_compact)}</span>
                                <span class="badge badge-batch-pill font-mono">${escapeHtml(session.batch)}</span>
                            </div>
                            ${session.is_booked_by_student ? `
                                <div class="extra-small text-emerald font-mono mt-1">
                                    <i class="bi bi-check-circle-fill me-1"></i>Allocated
                                </div>
                            ` : ''}
                        </div>
                    </td>
                `;
            } else {
                tableHtml += `
                    <td class="${cellTodayClass} text-center">
                        <span class="empty-dash font-mono">—</span>
                    </td>
                `;
            }
        });

        tableHtml += `</tr>`;
    });

    gridBody.innerHTML = tableHtml;

    // Build Mobile Day-Grouped View
    if (mobileView) {
        mobileView.innerHTML = daysMeta.map(dMeta => {
            const daySessions = activeSessions.filter(s => s.session_date === dMeta.dateStr);
            return `
                <div class="p-3 rounded-3 mb-3" style="background-color: ${dMeta.isToday ? 'rgba(139, 111, 179, 0.08)' : '#19171F'}; border: 1px solid ${dMeta.isToday ? '#8B6FB3' : '#38323F'};">
                    <div class="d-flex align-items-center justify-content-between mb-2.5 pb-2" style="border-bottom: 1px solid #38323F;">
                        <div class="d-flex align-items-center gap-2">
                            <strong class="text-white font-mono">${dMeta.dayShort}</strong>
                            <span class="extra-small text-slate-400">${dMeta.dateDisplay}</span>
                        </div>
                        ${dMeta.isToday ? `<span class="badge rounded-pill bg-purple extra-small font-mono">TODAY</span>` : ''}
                    </div>
                    ${daySessions.length > 0 ? `
                        <div class="d-flex flex-column gap-2">
                            ${daySessions.map(s => `
                                <div class="timetable-card-compact ${s.is_booked_by_student ? 'is-booked' : ''}" onclick="openSessionDetailsModal(${s.id})">
                                    <div class="d-flex align-items-start justify-content-between gap-1 mb-1">
                                        <div class="card-subj">${escapeHtml(s.practical_name)}</div>
                                        <span class="card-lab-badge">${escapeHtml(s.lab_code)}</span>
                                    </div>
                                    <div class="card-meta-line">
                                        <span><i class="bi bi-clock me-1"></i>${escapeHtml(s.time_slot_compact)}</span>
                                        <span>${escapeHtml(s.batch)} • ${escapeHtml(s.faculty_name)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center py-2 extra-small text-slate-500 font-mono">No practicals scheduled</div>
                    `}
                </div>
            `;
        }).join('');
    }
}

function renderTodayPracticals(schedData) {
    const container = document.getElementById('today-practicals-list');
    const badge = document.getElementById('today-count-badge');
    const subtitle = document.getElementById('today-practicals-subtitle');
    if (!container) return;

    const allSessions = schedData.schedule || [];
    const todayStr = schedData.current_date;

    if (subtitle) {
        subtitle.textContent = `Scheduled sessions for today (${schedData.current_day}, ${schedData.current_date})`;
    }

    const todaySessions = allSessions.filter(s => s.session_date === todayStr);

    if (badge) {
        badge.textContent = `${todaySessions.length} SESSIONS`;
    }

    if (todaySessions && todaySessions.length > 0) {
        container.innerHTML = todaySessions.map(item => `
            <div class="today-practical-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="text-center p-2.5 rounded-2 flex-shrink-0" style="background-color: #141219; border: 1px solid #38323F; min-width: 105px;">
                        <div class="extra-small font-mono fw-bold text-white mb-0.5">${escapeHtml(item.time_slot_compact)}</div>
                        <span class="badge extra-small font-monospace px-2 py-0.5" style="background-color: rgba(139, 111, 179, 0.15); color: #B99AD9; border: 1px solid rgba(139, 111, 179, 0.25);">
                            ${escapeHtml(item.lab_code)}
                        </span>
                    </div>

                    <div>
                        <h6 class="text-white fw-bold mb-1" style="font-size: 1.05rem;">${escapeHtml(item.practical_name)}</h6>
                        <div class="extra-small text-slate-300 mb-1">
                            <i class="bi bi-building me-1 text-purple-highlight"></i>${escapeHtml(item.lab_name)}
                        </div>
                        <div class="extra-small text-slate-400 font-mono">
                            ${escapeHtml(item.batch)} • Faculty: <strong class="text-white">${escapeHtml(item.faculty_name)}</strong>
                        </div>
                    </div>
                </div>

                <div class="flex-shrink-0">
                    ${item.is_booked_by_student ? `
                        <div class="d-flex align-items-center gap-2 p-2 rounded-2" style="background-color: rgba(121, 168, 138, 0.1); border: 1px solid rgba(121, 168, 138, 0.25);">
                            <div class="extra-small text-truncate" style="color: #79A88A;">
                                <i class="bi bi-check-circle-fill me-1"></i><strong>Allocated:</strong> ${escapeHtml(item.booked_equipment_name)}
                            </div>
                            <button class="btn btn-sm btn-outline-purple rounded-pill px-3 py-1 extra-small fw-semibold text-nowrap" onclick="navigateTo('/student/bookings')">
                                View Allocation
                            </button>
                        </div>
                    ` : `
                        <button class="btn btn-purple rounded-pill px-4 py-2 extra-small fw-bold d-flex align-items-center justify-content-center gap-1.5" onclick="openSessionEquipmentModal(${item.id})">
                            <i class="bi bi-hdd-network"></i> View Equipment
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `
            <div class="p-4 rounded-3 text-center text-slate-400 extra-small" style="background-color: #19171F; border: 1px dashed #38323F;">
                <i class="bi bi-calendar-check fs-4 text-slate-500 d-block mb-2"></i>
                No practical sessions scheduled for today.
            </div>
        `;
    }
}

// Open Session Details Modal Popup
function openSessionDetailsModal(sessionId) {
    if (!cachedStudentScheduleData || !cachedStudentScheduleData.schedule) return;
    const session = cachedStudentScheduleData.schedule.find(s => s.id === sessionId);
    if (!session) return;

    const labCodeEl = document.getElementById('modal-sess-lab-code');
    const titleEl = document.getElementById('modal-sess-title');
    const labNameEl = document.getElementById('modal-sess-lab-name');
    const labLocEl = document.getElementById('modal-sess-lab-loc');
    const dateEl = document.getElementById('modal-sess-date');
    const timeEl = document.getElementById('modal-sess-time');
    const academicEl = document.getElementById('modal-sess-academic');
    const facultyEl = document.getElementById('modal-sess-faculty');
    const allocBox = document.getElementById('modal-sess-allocated-box');
    const allocNameEl = document.getElementById('modal-sess-allocated-name');
    const allocCodeEl = document.getElementById('modal-sess-allocated-code');
    const actionBtn = document.getElementById('modal-sess-action-btn');

    if (labCodeEl) labCodeEl.textContent = session.lab_code;
    if (titleEl) titleEl.textContent = session.practical_name;
    if (labNameEl) labNameEl.textContent = session.lab_name;
    if (labLocEl) labLocEl.textContent = session.lab_location;
    if (dateEl) dateEl.textContent = session.full_date_display || session.formatted_date;
    if (timeEl) timeEl.textContent = session.time_slot;
    if (academicEl) academicEl.textContent = session.academic_context;
    if (facultyEl) facultyEl.textContent = session.faculty_name;

    // Show allocated equipment strictly if actually allocated in DB
    if (session.is_booked_by_student && session.booked_equipment_name) {
        if (allocBox) allocBox.classList.remove('d-none');
        if (allocNameEl) allocNameEl.textContent = session.booked_equipment_name;
        if (allocCodeEl) allocCodeEl.textContent = session.booked_equipment_code;
        if (actionBtn) {
            actionBtn.innerHTML = '<i class="bi bi-hdd-network me-1"></i> View My Allocation';
            actionBtn.onclick = () => {
                const modalEl = document.getElementById('sessionDetailsModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                navigateTo('/student/bookings');
            };
        }
    } else {
        if (allocBox) allocBox.classList.add('d-none');
        if (actionBtn) {
            actionBtn.innerHTML = '<i class="bi bi-hdd-network me-1"></i> View Equipment &amp; Book';
            actionBtn.onclick = () => {
                const modalEl = document.getElementById('sessionDetailsModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                openSessionEquipmentModal(session.id);
            };
        }
    }

    const modalEl = document.getElementById('sessionDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function showScheduleError() {
    const gridBody = document.getElementById('timetable-grid-body');
    if (!gridBody) return;
    gridBody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-5 text-rose">
                <div class="mb-2"><i class="bi bi-exclamation-triangle fs-3 text-rose"></i></div>
                <h6 class="text-white fw-bold mb-1">Unable to load your timetable.</h6>
                <p class="extra-small text-slate-400 mb-3">Please check your connection and try again.</p>
                <button class="btn btn-sm btn-outline-purple rounded-pill px-4 py-1.5 extra-small fw-semibold" onclick="loadStudentSchedule()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Retry
                </button>
            </td>
        </tr>
    `;
}


// Open Session Equipment Selection Modal
async function openSessionEquipmentModal(sessionId) {
    currentSessionBookingContext = null;
    const modalEl = document.getElementById('sessionEquipmentModal');
    if (!modalEl) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    const listContainer = document.getElementById('modal-session-equipment-list');
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="text-center py-4 text-slate-400">
                <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
                Loading session apparatus...
            </div>
        `;
    }

    try {
        const res = await fetch(`/api/student/sessions/${sessionId}/equipment`);
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.data) {
            const session = data.data.session;
            const equipment = data.data.equipment || [];
            currentSessionBookingContext = session;

            // Populate Session Header Card
            const subjEl = document.getElementById('m-session-subject');
            const codeEl = document.getElementById('m-session-lab-code');
            const labEl = document.getElementById('m-session-lab-name');
            const dtEl = document.getElementById('m-session-datetime');
            const facEl = document.getElementById('m-session-faculty');
            const acadEl = document.getElementById('m-session-academic');

            if (subjEl) subjEl.textContent = session.practical_name;
            if (codeEl) codeEl.textContent = session.lab_code;
            if (labEl) labEl.textContent = session.lab_name;
            if (dtEl) dtEl.textContent = `${session.formatted_date} • ${session.time_slot}`;
            if (facEl) facEl.textContent = session.faculty_name || 'Faculty in Charge';
            if (acadEl) acadEl.textContent = session.academic_context;

            if (equipment.length > 0) {
                listContainer.innerHTML = equipment.map(eq => `
                    <div class="p-3 rounded-3 mb-2.5 d-flex align-items-center justify-content-between gap-3" style="background-color: #19171F; border: 1px solid #38323F;">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="text-white fw-bold mb-0" style="font-size: 0.95rem;">${escapeHtml(eq.name)}</h6>
                                <span class="badge font-mono extra-small" style="background-color: rgba(139, 111, 179, 0.15); color: #B99AD9;">${escapeHtml(eq.equipment_code)}</span>
                            </div>
                            <div class="extra-small text-slate-400">
                                <span class="text-slate-300 me-2">${escapeHtml(eq.category)}</span>
                                <span class="badge ${eq.badge_class}">${escapeHtml(eq.status_display)}</span>
                            </div>
                        </div>
                        <div>
                            ${eq.is_bookable ? `
                                <button class="btn btn-sm btn-cyan rounded-pill px-3 py-1.5 extra-small fw-bold" onclick="initiateEquipmentBooking(${sessionId}, ${eq.id}, '${escapeHtml(eq.name)}', '${escapeHtml(eq.equipment_code)}')">
                                    <i class="bi bi-plus-circle me-1"></i> Book
                                </button>
                            ` : (eq.is_my_booking ? `
                                <span class="badge bg-purple-subtle text-purple font-mono extra-small px-3 py-1.5">Allocated to You</span>
                            ` : `
                                <span class="badge bg-slate-800 text-slate-400 font-mono extra-small px-3 py-1.5">${escapeHtml(eq.status_display)}</span>
                            `)}
                        </div>
                    </div>
                `).join('');
            } else {
                listContainer.innerHTML = `
                    <div class="text-center py-4 px-3 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                        <p class="text-slate-400 extra-small mb-0">No equipment is currently available for this practical session.</p>
                    </div>
                `;
            }
        } else {
            listContainer.innerHTML = `<div class="p-3 text-center text-rose extra-small">${escapeHtml(data.message || 'Unable to load session equipment.')}</div>`;
        }
    } catch (e) {
        console.error("Error opening session equipment:", e);
        listContainer.innerHTML = `<div class="p-3 text-center text-rose extra-small">Failed to load equipment. Please try again.</div>`;
    }
}

// Initiate Booking Confirmation Modal
function initiateEquipmentBooking(sessionId, eqId, eqName, eqCode) {
    if (!currentSessionBookingContext) return;
    currentSelectedEquipment = { id: eqId, name: eqName, code: eqCode };

    // Hide Session Equipment Modal
    const sessionModalEl = document.getElementById('sessionEquipmentModal');
    if (sessionModalEl) {
        const sm = bootstrap.Modal.getInstance(sessionModalEl);
        if (sm) sm.hide();
    }

    // Populate Confirmation Modal
    const confModalEl = document.getElementById('bookingConfirmModal');
    if (!confModalEl) return;

    document.getElementById('confirm-eq-name').textContent = eqName;
    document.getElementById('confirm-eq-code').textContent = eqCode;
    document.getElementById('confirm-lab-name').textContent = currentSessionBookingContext.lab_name;
    document.getElementById('confirm-lab-code').textContent = currentSessionBookingContext.lab_code;
    document.getElementById('confirm-practical-name').textContent = currentSessionBookingContext.practical_name;
    document.getElementById('confirm-academic-context').textContent = currentSessionBookingContext.academic_context;
    document.getElementById('confirm-date').textContent = currentSessionBookingContext.formatted_date;
    document.getElementById('confirm-time').textContent = currentSessionBookingContext.time_slot;

    const alertEl = document.getElementById('confirm-modal-alert');
    if (alertEl) {
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
    }

    const confModal = bootstrap.Modal.getOrCreateInstance(confModalEl);
    confModal.show();
}

// Execute Confirmed Booking
async function executeConfirmBooking() {
    if (!currentSessionBookingContext || !currentSelectedEquipment) return;

    const btn = document.getElementById('btn-execute-booking');
    const alertEl = document.getElementById('confirm-modal-alert');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Confirming...';
    }

    try {
        const res = await fetch('/api/student/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionBookingContext.id,
                equipment_id: currentSelectedEquipment.id
            })
        });

        const data = await res.json();

        if (res.ok && data.status === 'success') {
            // Close Confirm Modal
            const confModalEl = document.getElementById('bookingConfirmModal');
            if (confModalEl) {
                const cm = bootstrap.Modal.getInstance(confModalEl);
                if (cm) cm.hide();
            }

            // Show Success Modal
            const successModalEl = document.getElementById('bookingSuccessModal');
            if (successModalEl) {
                const sMsg = document.getElementById('success-modal-msg');
                if (sMsg) {
                    sMsg.textContent = `You have successfully booked ${currentSelectedEquipment.name} (${currentSelectedEquipment.code}) for ${currentSessionBookingContext.practical_name} on ${currentSessionBookingContext.formatted_date}.`;
                }
                const successModal = bootstrap.Modal.getOrCreateInstance(successModalEl);
                successModal.show();
            } else {
                showToast("Equipment booked successfully", "success");
                navigateTo('/student/bookings');
            }

            // Refresh schedule and stats in background
            loadStudentSchedule();
            loadStudentStats();
        } else {
            if (alertEl) {
                alertEl.classList.remove('d-none');
                alertEl.textContent = data.message || "Failed to confirm equipment booking.";
            }
        }
    } catch (e) {
        console.error("Error executing booking:", e);
        if (alertEl) {
            alertEl.classList.remove('d-none');
            alertEl.textContent = "A network error occurred. Please try again.";
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Confirm Booking';
        }
    }
}

// Navigation from Success Modal to My Equipment
function navigateToBookingsFromSuccess() {
    const successModalEl = document.getElementById('bookingSuccessModal');
    if (successModalEl) {
        const sm = bootstrap.Modal.getInstance(successModalEl);
        if (sm) sm.hide();
    }
    navigateTo('/student/bookings');
}

// My Equipment Allocations View (/student/bookings)
async function loadStudentBookings() {
    const container = document.getElementById('bookings-cards-container') || document.getElementById('bookings-table-container');
    const badgeCount = document.getElementById('bookings-count-badge');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5 text-slate-400">
            <div class="spinner-border spinner-border-sm text-purple me-2" role="status"></div>
            Loading assigned equipment...
        </div>
    `;

    try {
        const res = await fetch('/api/student/bookings');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const bookings = data.bookings || [];
            
            if (badgeCount) {
                badgeCount.textContent = `${bookings.length} ALLOCATION${bookings.length === 1 ? '' : 'S'}`;
            }

            if (bookings.length > 0) {
                container.innerHTML = `
                    <div class="allocation-card-grid">
                        ${bookings.map(b => `
                            <div class="equipment-allocation-card" data-booking-id="${b.id}">
                                <div>
                                    <!-- Equipment Name & Tag Code -->
                                    <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                                        <div>
                                            <h4 class="allocation-eq-name mb-0.5">${escapeHtml(b.equipment_name)}</h4>
                                            <span class="allocation-eq-code">${escapeHtml(b.equipment_code)}</span>
                                        </div>
                                        <span class="badge ${b.status_badge_class}">${escapeHtml(b.status_upper)}</span>
                                    </div>

                                    <!-- Laboratory & Code Pill -->
                                    <div class="mb-3 pb-2.5 border-bottom border-slate-800">
                                        <div class="allocation-lab-name">${escapeHtml(b.lab_name)}</div>
                                        <span class="badge bg-purple-subtle text-purple-highlight font-mono extra-small px-2 py-0.5">${escapeHtml(b.lab_code)}</span>
                                    </div>

                                    <!-- Practical Name & Academic Context -->
                                    <div class="mb-3">
                                        <div class="allocation-practical-title">${escapeHtml(b.practical_name)}</div>
                                        <div class="allocation-academic-meta">${escapeHtml(b.academic_context)}</div>
                                    </div>
                                </div>

                                <!-- Date, Time & Report Fault Action Footer -->
                                <div class="pt-3 border-top border-slate-800 d-flex align-items-center justify-content-between extra-small">
                                    <div>
                                        <div class="allocation-time-date font-mono mb-0.5">
                                            <i class="bi bi-clock text-purple-highlight me-1"></i>${escapeHtml(b.time_formatted)}
                                        </div>
                                        <div class="text-slate-400 font-mono">
                                            <i class="bi bi-calendar3 me-1"></i>${escapeHtml(b.date_formatted)}
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-danger text-rose border-rose rounded-pill px-3 py-1 extra-small fw-semibold" onclick="openFaultModalForEquipment(${b.equipment_id}, '${escapeHtml(b.equipment_name)}', '${escapeHtml(b.equipment_code)}')">
                                        <i class="bi bi-tools me-1"></i>Report Fault
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                // Empty State
                container.innerHTML = `
                    <div class="text-center py-5 px-3 rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                        <div class="brand-logo-badge bg-purple-subtle text-purple mx-auto mb-3" style="width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            <i class="bi bi-hdd-stack"></i>
                        </div>
                        <h5 class="text-white fw-bold mb-1" style="font-size: 1.1rem; letter-spacing: 0.02em;">NO EQUIPMENT ASSIGNED</h5>
                        <p class="text-slate-400 extra-small mb-3" style="max-width: 380px; margin: 0 auto; line-height: 1.5;">
                            You don't have any equipment assigned to an upcoming practical session.
                        </p>
                        <button class="btn btn-sm btn-outline-purple rounded-pill px-4 py-1.5 extra-small fw-medium" onclick="navigateTo('/student/schedule')">
                            View Lab Schedule
                        </button>
                    </div>
                `;
            }
        } else {
            throw new Error(data.message || 'Unable to load equipment allocations.');
        }
    } catch (e) {
        console.error("Error loading student bookings:", e);
        container.innerHTML = `<div class="p-4 text-center text-rose extra-small">Unable to load assigned equipment.</div>`;
    }
}

// Open Fault Modal for specific booked apparatus
function openFaultModalForEquipment(equipmentId, equipmentName, equipmentCode) {
    const modalEl = document.getElementById('faultModal');
    if (!modalEl) return;

    const idInput = document.getElementById('fault-eq-id');
    const nameDisplay = document.getElementById('fault-eq-name');
    const alertEl = document.getElementById('fault-modal-alert');

    if (idInput) idInput.value = equipmentId;
    if (nameDisplay) nameDisplay.textContent = `${equipmentName} (${equipmentCode})`;
    if (alertEl) {
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}


