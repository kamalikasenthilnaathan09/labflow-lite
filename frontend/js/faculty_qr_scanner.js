/* ==========================================================================
   LabFlow Lite - Dedicated Faculty QR Scanner Client JavaScript
   Real Camera API Integration with jsQR Decoder, Immediate Detection Feedback, & Session Scans
   ========================================================================== */

let videoStream = null;
let animationFrameId = null;
const RECENT_SCANS_KEY = 'labflow_faculty_recent_scans';
let currentScannedEquipment = null;
let isProcessingScan = false;
let successBannerTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFacultyProfile();
    renderRecentScans();
});

// Clean up video stream on page navigation / unload
window.addEventListener('beforeunload', () => {
    stopCameraScan();
});

window.addEventListener('pagehide', () => {
    stopCameraScan();
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

// 2. Fetch Profile Info
async function loadFacultyProfile() {
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
        if (res.ok && json.status === 'success' && json.data.faculty) {
            const faculty = json.data.faculty;
            const navNameEl = document.getElementById('faculty-nav-name');
            const navDeptEl = document.getElementById('faculty-nav-dept');
            if (navNameEl) navNameEl.textContent = faculty.name || 'Dr. Murugesan';
            if (navDeptEl) navDeptEl.textContent = faculty.department ? 'AI & DS' : 'Faculty';
        }
    } catch (e) {
        console.warn('Profile fetch warning:', e);
    }
}

// 3. Start Camera Scan
async function startCameraScan() {
    const alertBox = document.getElementById('camera-alert-box');
    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('viewfinder-placeholder');
    const detectedOverlay = document.getElementById('viewfinder-detected-overlay');
    const laser = document.getElementById('qr-laser-line');
    const startBtn = document.getElementById('btn-start-scan');
    const stopBtn = document.getElementById('btn-stop-scan');
    const indicator = document.getElementById('camera-status-indicator');

    if (alertBox) alertBox.classList.add('d-none');
    if (detectedOverlay) detectedOverlay.classList.add('d-none');
    isProcessingScan = false;

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError();
        return;
    }

    try {
        // Stop any existing stream
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }

        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
        });

        if (video) {
            video.srcObject = videoStream;
            video.classList.remove('d-none');
            await video.play();
        }

        if (placeholder) placeholder.classList.add('d-none');
        if (laser) laser.classList.remove('d-none');
        if (startBtn) startBtn.classList.add('d-none');
        if (stopBtn) stopBtn.classList.remove('d-none');

        // Update status indicator to CAMERA READY
        if (indicator) {
            indicator.textContent = '● CAMERA READY';
            indicator.style.backgroundColor = 'rgba(121, 168, 138, 0.15)';
            indicator.style.color = '#79A88A';
            indicator.style.border = '1px solid rgba(121, 168, 138, 0.3)';
        }

        // Start scanning frames
        scanVideoFrame();
    } catch (err) {
        console.error('Camera stream error:', err);
        showCameraError();
    }
}

// 4. Stop Camera Scan
function stopCameraScan() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('viewfinder-placeholder');
    const detectedOverlay = document.getElementById('viewfinder-detected-overlay');
    const laser = document.getElementById('qr-laser-line');
    const startBtn = document.getElementById('btn-start-scan');
    const stopBtn = document.getElementById('btn-stop-scan');
    const indicator = document.getElementById('camera-status-indicator');

    if (video) video.classList.add('d-none');
    if (placeholder) placeholder.classList.remove('d-none');
    if (detectedOverlay) detectedOverlay.classList.add('d-none');
    if (laser) laser.classList.add('d-none');
    if (startBtn) startBtn.classList.remove('d-none');
    if (stopBtn) stopBtn.classList.add('d-none');

    if (indicator) {
        indicator.textContent = 'CAMERA NOT STARTED';
        indicator.style.backgroundColor = 'rgba(129, 121, 134, 0.15)';
        indicator.style.color = '#B2AAB8';
        indicator.style.border = '1px solid rgba(129, 121, 134, 0.3)';
    }
}

// 5. Continuous Frame Processing Loop (jsQR)
function scanVideoFrame() {
    if (isProcessingScan) return;

    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');

    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (window.jsQR) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code && code.data && code.data.trim()) {
                const detectedQr = code.data.trim();
                handleQrDetected(detectedQr);
                return;
            }
        }
    }

    if (videoStream && !isProcessingScan) {
        animationFrameId = requestAnimationFrame(scanVideoFrame);
    }
}

// 6. Handle Immediate QR Detected State
function handleQrDetected(qrIdentifier) {
    if (isProcessingScan) return;
    isProcessingScan = true;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // 1. Immediately show in-viewfinder feedback overlay
    const detectedOverlay = document.getElementById('viewfinder-detected-overlay');
    const detectedIdEl = document.getElementById('detected-overlay-qr-id');
    const laser = document.getElementById('qr-laser-line');
    const indicator = document.getElementById('camera-status-indicator');

    if (laser) laser.classList.add('d-none');
    if (detectedIdEl) detectedIdEl.textContent = qrIdentifier;
    if (detectedOverlay) detectedOverlay.classList.remove('d-none');

    if (indicator) {
        indicator.textContent = '● QR CODE DETECTED';
        indicator.style.backgroundColor = 'rgba(139, 111, 179, 0.2)';
        indicator.style.color = '#B99AD9';
        indicator.style.border = '1px solid rgba(139, 111, 179, 0.4)';
    }

    // 2. Immediately show right-column loading state
    const standbyCard = document.getElementById('equipment-standby-card');
    const resultCard = document.getElementById('equipment-result-card');
    const errorCard = document.getElementById('equipment-error-card');
    const loadingCard = document.getElementById('equipment-loading-card');
    const loadingQrId = document.getElementById('loading-card-qr-id');
    const successBanner = document.getElementById('scan-success-banner');

    if (standbyCard) standbyCard.classList.add('d-none');
    if (resultCard) resultCard.classList.add('d-none');
    if (errorCard) errorCard.classList.add('d-none');
    if (successBanner) successBanner.classList.add('d-none');

    if (loadingQrId) loadingQrId.textContent = qrIdentifier;
    if (loadingCard) loadingCard.classList.remove('d-none');

    // 3. Initiate backend lookup
    performEquipmentLookup(qrIdentifier);
}

// 7. Perform Equipment Lookup API Request
async function performEquipmentLookup(qrIdentifier) {
    const cleanId = encodeURIComponent(qrIdentifier.trim());

    try {
        const res = await fetch(`/api/faculty/qr/${cleanId}`);
        if (res.status === 401) {
            window.location.replace('/login');
            return;
        }
        if (res.status === 403) {
            window.location.replace('/dashboard/student');
            return;
        }

        const json = await res.json();

        // Turn off camera stream cleanly after response
        stopCameraScan();

        const loadingCard = document.getElementById('equipment-loading-card');
        if (loadingCard) loadingCard.classList.add('d-none');

        if (res.ok && json.status === 'success' && json.data) {
            const item = json.data;
            saveRecentScan(item);
            displayEquipmentResult(item);
            showSuccessNotification(item);
        } else {
            displayEquipmentNotFound(qrIdentifier);
        }
    } catch (err) {
        console.error('Equipment lookup network error:', err);
        stopCameraScan();
        const loadingCard = document.getElementById('equipment-loading-card');
        if (loadingCard) loadingCard.classList.add('d-none');
        displayEquipmentNotFound(qrIdentifier);
    }
}

// 8. Display Identified Equipment Result
function displayEquipmentResult(item) {
    currentScannedEquipment = item;
    const standbyCard = document.getElementById('equipment-standby-card');
    const resultCard = document.getElementById('equipment-result-card');
    const errorCard = document.getElementById('equipment-error-card');
    const loadingCard = document.getElementById('equipment-loading-card');

    if (standbyCard) standbyCard.classList.add('d-none');
    if (errorCard) errorCard.classList.add('d-none');
    if (loadingCard) loadingCard.classList.add('d-none');
    if (!resultCard) return;

    const statusUpper = (item.status || 'Available').toUpperCase();
    const isFaulty = statusUpper === 'FAULTY';
    const statusClass = item.status_class || (isFaulty ? 'status-faulty' : 'status-available');

    // Populate Fields
    document.getElementById('result-lab-code').textContent = item.lab_code || 'DL-LAB-01';
    
    const pill = document.getElementById('result-status-pill');
    if (pill) {
        pill.className = `status-pill ${statusClass}`;
        pill.textContent = `● ${item.status || 'Available'}`;
    }

    document.getElementById('result-eq-name').textContent = item.name || '';
    document.getElementById('result-eq-code').textContent = item.equipment_code || '';
    document.getElementById('result-qr-code').textContent = item.qr_code || '';
    document.getElementById('result-category').textContent = item.category || 'Hardware';
    document.getElementById('result-lab-name').textContent = item.lab_name || 'Engineering Lab';
    document.getElementById('result-lab-loc').textContent = item.lab_location || 'Campus';

    // Fault warning
    const faultBlock = document.getElementById('result-fault-block');
    const actionBtn = document.getElementById('btn-result-action');

    if (isFaulty && item.fault_info) {
        if (faultBlock) {
            faultBlock.classList.remove('d-none');
            document.getElementById('result-fault-priority').textContent = `${item.fault_info.priority || 'Medium'} Priority`;
            document.getElementById('result-fault-desc').textContent = item.fault_info.description || 'Reported hardware malfunction';
        }
        if (actionBtn) {
            actionBtn.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> View Fault Details';
        }
    } else {
        if (faultBlock) faultBlock.classList.add('d-none');
        if (actionBtn) {
            actionBtn.innerHTML = '<i class="bi bi-tools me-1"></i> Report Fault';
        }
    }

    resultCard.classList.remove('d-none');
}

// 9. Display Prominent Success Notification
function showSuccessNotification(item) {
    const banner = document.getElementById('scan-success-banner');
    const nameEl = document.getElementById('success-banner-eq-name');
    const metaEl = document.getElementById('success-banner-eq-meta');

    if (!banner) return;

    if (nameEl) nameEl.textContent = item.name || 'Laboratory Equipment';
    if (metaEl) metaEl.textContent = `${item.equipment_code || 'LAB-AI-001'} • ${item.qr_code || 'QR_AI001'}`;

    banner.classList.remove('d-none');

    // Auto-dismiss after 4.5 seconds
    if (successBannerTimer) clearTimeout(successBannerTimer);
    successBannerTimer = setTimeout(() => {
        hideSuccessBanner();
    }, 4500);
}

function hideSuccessBanner() {
    const banner = document.getElementById('scan-success-banner');
    if (banner) banner.classList.add('d-none');
}

// 10. Display Not Found Error Card
function displayEquipmentNotFound(qrIdentifier) {
    const standbyCard = document.getElementById('equipment-standby-card');
    const resultCard = document.getElementById('equipment-result-card');
    const errorCard = document.getElementById('equipment-error-card');
    const loadingCard = document.getElementById('equipment-loading-card');
    const errorMsg = document.getElementById('error-card-message');

    if (standbyCard) standbyCard.classList.add('d-none');
    if (resultCard) resultCard.classList.add('d-none');
    if (loadingCard) loadingCard.classList.add('d-none');

    if (errorMsg && qrIdentifier) {
        errorMsg.textContent = `${qrIdentifier} is not registered as laboratory equipment.`;
    }

    if (errorCard) errorCard.classList.remove('d-none');
}

// 11. Scan Again Flow
function scanAgain() {
    isProcessingScan = false;
    hideSuccessBanner();

    const standbyCard = document.getElementById('equipment-standby-card');
    const resultCard = document.getElementById('equipment-result-card');
    const errorCard = document.getElementById('equipment-error-card');
    const loadingCard = document.getElementById('equipment-loading-card');

    if (resultCard) resultCard.classList.add('d-none');
    if (errorCard) errorCard.classList.add('d-none');
    if (loadingCard) loadingCard.classList.add('d-none');
    if (standbyCard) standbyCard.classList.remove('d-none');

    // Restart camera scan
    startCameraScan();
}

function resetScannerView() {
    scanAgain();
}

// 12. Manual QR Lookup
function handleManualLookup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('manual-qr-input');
    const qrId = input ? input.value.trim() : '';

    if (!qrId) {
        showToast('Please enter a QR identifier to look up.', 'error');
        return;
    }

    handleQrDetected(qrId);
}

function focusManualLookup() {
    const input = document.getElementById('manual-qr-input');
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function setQuickQr(code) {
    const input = document.getElementById('manual-qr-input');
    if (input) {
        input.value = code;
        input.focus();
        handleQrDetected(code);
    }
}

// 13. Camera Error Helper
function showCameraError() {
    stopCameraScan();
    const alertBox = document.getElementById('camera-alert-box');
    if (alertBox) alertBox.classList.remove('d-none');
    const indicator = document.getElementById('camera-status-indicator');
    if (indicator) {
        indicator.textContent = 'CAMERA UNAVAILABLE';
        indicator.style.backgroundColor = 'rgba(184, 117, 123, 0.15)';
        indicator.style.color = '#B8757B';
        indicator.style.border = '1px solid rgba(184, 117, 123, 0.3)';
    }
}

// 14. Handle Fault Action Click
function handleFaultAction() {
    if (currentScannedEquipment) {
        showToast(`Navigating to equipment fault status for ${currentScannedEquipment.equipment_code}`);
        setTimeout(() => {
            window.location.href = '/dashboard/faculty/equipment';
        }, 600);
    }
}

// 15. Session-based Recent Scans History
function saveRecentScan(item) {
    let scans = [];
    try {
        const stored = sessionStorage.getItem(RECENT_SCANS_KEY);
        if (stored) scans = JSON.parse(stored);
    } catch (e) {
        scans = [];
    }

    // De-duplicate
    scans = scans.filter(s => s.equipment_code !== item.equipment_code);

    // Insert at beginning
    scans.unshift({
        id: item.id,
        name: item.name,
        equipment_code: item.equipment_code,
        qr_code: item.qr_code,
        status: item.status,
        status_class: item.status_class,
        lab_name: item.lab_name,
        lab_code: item.lab_code,
        timestamp: new Date().toISOString()
    });

    // Limit to 5
    if (scans.length > 5) scans = scans.slice(0, 5);

    try {
        sessionStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
    } catch (e) {
        console.warn('SessionStorage save error:', e);
    }

    renderRecentScans();
}

function renderRecentScans() {
    const listEl = document.getElementById('recent-scans-list');
    if (!listEl) return;

    let scans = [];
    try {
        const stored = sessionStorage.getItem(RECENT_SCANS_KEY);
        if (stored) scans = JSON.parse(stored);
    } catch (e) {
        scans = [];
    }

    if (!scans || scans.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-4 text-slate-400 extra-small rounded-3" style="background-color: #19171F; border: 1px dashed #38323F;">
                <i class="bi bi-clock-history fs-4 d-block mb-1.5 text-slate-500"></i>
                No equipment scanned in this session.
            </div>
        `;
        return;
    }

    listEl.innerHTML = `
        <div class="d-flex flex-column gap-2.5">
            ${scans.map(s => {
                const statusClass = s.status_class || (s.status === 'Available' ? 'status-available' : (s.status === 'Faulty' ? 'status-faulty' : 'status-booked'));
                return `
                    <div class="p-3 rounded-3 cursor-pointer d-flex align-items-center justify-content-between gap-2" 
                         style="background-color: #19171F; border: 1px solid #38323F; transition: border-color 0.15s ease;"
                         onmouseover="this.style.borderColor='#8B6FB3'" 
                         onmouseout="this.style.borderColor='#38323F'"
                         onclick="handleQrDetected('${escapeHtml(s.qr_code)}')">
                        <div class="overflow-hidden">
                            <h6 class="text-white fw-bold mb-0.5 text-truncate" style="font-size: 0.88rem;">${escapeHtml(s.name)}</h6>
                            <div class="extra-small font-mono text-slate-400">
                                <span class="text-purple-highlight">${escapeHtml(s.equipment_code)}</span> • ${escapeHtml(s.qr_code)}
                            </div>
                        </div>
                        <div class="text-end flex-shrink-0">
                            <span class="status-pill ${statusClass} d-inline-block mb-1" style="font-size: 0.72rem;">● ${escapeHtml(s.status || 'Available')}</span>
                            <div class="extra-small text-slate-400 font-mono" style="font-size: 0.65rem;">${formatRelativeTime(s.timestamp)}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function clearRecentScans() {
    sessionStorage.removeItem(RECENT_SCANS_KEY);
    renderRecentScans();
    showToast('Recent scan history cleared.');
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Just now';
    try {
        const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch (e) {
        return 'Just now';
    }
}

// 16. Toast Popup Helper
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast show align-items-center text-white bg-card border border-border shadow-lg mb-2';
    toast.setAttribute('role', 'alert');
    const iconClass = type === 'error' ? 'bi bi-x-circle text-rose' : 'bi bi-check-circle text-purple-highlight';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body extra-small">
                <i class="${iconClass} me-1.5"></i> ${escapeHtml(msg)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto extra-small" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3500);
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

