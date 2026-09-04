// Faculty Unified Notification Component
let facultyNotificationsData = [];

async function fetchFacultyNotifications() {
    try {
        const res = await fetch('/api/faculty/notifications');
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            facultyNotificationsData = data.notifications || [];
            const unreadCount = data.unread_count || 0;
            renderFacultyNotificationBadge(unreadCount);
            renderFacultyNotificationDropdown(facultyNotificationsData, unreadCount);
        }
    } catch (e) {
        console.error("Error fetching faculty notifications:", e);
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
            <div class="p-4 text-center text-slate-400 extra-small font-mono">
                <i class="bi bi-bell-slash fs-4 d-block mb-2 text-slate-600"></i>
                No notifications found
            </div>
        `;
        return;
    }

    listContainer.innerHTML = notifications.map(n => {
        const isUnread = !n.is_read;
        let iconClass = 'bi bi-bell-fill';
        let iconColor = '#8B6FB3';
        let iconBg = 'rgba(139, 111, 179, 0.15)';

        if (n.notification_type === 'booking') {
            iconClass = 'bi bi-calendar-check-fill';
            iconColor = '#B99AD9';
            iconBg = 'rgba(185, 154, 217, 0.15)';
        } else if (n.notification_type === 'fault') {
            iconClass = 'bi bi-tools';
            iconColor = '#B8757B';
            iconBg = 'rgba(184, 117, 123, 0.15)';
        } else if (n.notification_type === 'equipment') {
            iconClass = 'bi bi-cpu-fill';
            iconColor = '#C39A5A';
            iconBg = 'rgba(195, 154, 90, 0.15)';
        }

        return `
            <div class="p-3 border-bottom d-flex align-items-start gap-2.5 cursor-pointer ${isUnread ? 'bg-slate-900' : ''}" 
                 style="border-color: #38323F !important; transition: background 0.15s ease;"
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
                    <div class="extra-small font-mono" style="color: #817986; font-size: 0.68rem;">
                        ${formatFacultyRelativeTime(n.created_at)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function formatFacultyRelativeTime(dateStr) {
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

function toggleFacultyNotificationDropdown(e) {
    if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const dropdown = document.getElementById('faculty-notification-dropdown-panel');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('d-none') || dropdown.style.display === 'none' || !dropdown.classList.contains('show');
    if (isHidden) {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        dropdown.style.display = 'block';
        fetchFacultyNotifications();
    } else {
        dropdown.classList.remove('show');
        dropdown.classList.add('d-none');
        dropdown.style.display = 'none';
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

// Close dropdown on outside click / tap
function handleOutsideFacultyNotificationClick(e) {
    const wrapper = document.getElementById('faculty-notification-bell-wrapper');
    const dropdown = document.getElementById('faculty-notification-dropdown-panel');
    if (dropdown && (dropdown.classList.contains('show') || dropdown.style.display === 'block' || !dropdown.classList.contains('d-none'))) {
        if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            dropdown.style.display = 'none';
        }
    }
}

document.addEventListener('click', handleOutsideFacultyNotificationClick);
document.addEventListener('touchend', handleOutsideFacultyNotificationClick);

// Initial fetch on DOM load
document.addEventListener('DOMContentLoaded', () => {
    fetchFacultyNotifications();
});
