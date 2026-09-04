/* ==========================================================================
   LabFlow Lite - Dedicated Authentication Client JavaScript
   Handles Registration, Login, Form Validations, & Role-Based Redirects
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();
    initRegisterForm();
    initLoginForm();
});

// 1. Password Visibility Toggle
function initPasswordToggles() {
    const toggleBtns = document.querySelectorAll('.password-toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            
            if (passwordInput) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('bi-eye');
                    icon.classList.add('bi-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('bi-eye-slash');
                    icon.classList.add('bi-eye');
                }
            }
        });
    });
}

// 2. Helper Alert Renderer
function showAlert(message, type = 'danger') {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;

    alertBox.className = type === 'success' 
        ? 'alert alert-auth-success mb-4 d-flex align-items-center gap-2' 
        : 'alert alert-auth-danger mb-4 d-flex align-items-center gap-2';

    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    
    alertBox.innerHTML = `
        <i class="bi ${iconClass} fs-5 flex-shrink-0"></i>
        <div>${message}</div>
    `;
    alertBox.classList.remove('d-none');
}

function clearAlert() {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) {
        alertBox.classList.add('d-none');
        alertBox.innerHTML = '';
    }
}

// 3. Registration Handler
function initRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const name = document.getElementById('reg-name').value.trim();
        const collegeId = document.getElementById('reg-college-id').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const department = document.getElementById('reg-department').value;
        const roleRadio = document.querySelector('input[name="role"]:checked');
        const role = roleRadio ? roleRadio.value : '';
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const submitBtn = document.getElementById('register-submit-btn');

        // Client-side validations
        if (!name) {
            showAlert('Please enter your full name.');
            return;
        }
        if (!collegeId) {
            showAlert('Please enter your College ID / Student ID.');
            return;
        }
        if (!email) {
            showAlert('Please enter a valid email address.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAlert('Please enter a valid email format (e.g. user@college.edu.in).');
            return;
        }
        if (!department) {
            showAlert('Please select your department.');
            return;
        }
        if (!role) {
            showAlert('Please select your role (Student or Faculty/Lab Staff).');
            return;
        }
        if (!password) {
            showAlert('Please enter a password.');
            return;
        }
        if (password.length < 6) {
            showAlert('Password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('Passwords do not match. Please re-enter your password.');
            return;
        }

        // Set Loading State
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creating Account...`;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    college_id: collegeId,
                    email: email,
                    department: department,
                    role: role,
                    password: password,
                    confirm_password: confirmPassword
                })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                showAlert(result.message || 'Account created successfully! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = result.redirect || '/login';
                }, 1400);
            } else {
                showAlert(result.message || 'Registration failed. Please check your information and try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        } catch (err) {
            console.error('Registration API Error:', err);
            showAlert('Unable to connect to server. Please check your network connection.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// 4. Login Handler
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit-btn');

        // Client-side validations
        if (!identifier) {
            showAlert('Please enter your Email or College ID.');
            return;
        }
        if (!password) {
            showAlert('Please enter your password.');
            return;
        }

        // Set Loading State
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Signing In...`;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    identifier: identifier,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                showAlert(result.message || 'Sign in successful! Redirecting to your workspace...', 'success');
                setTimeout(() => {
                    window.location.href = result.redirect || '/dashboard/student';
                }, 1000);
            } else {
                showAlert(result.message || 'Incorrect credentials. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        } catch (err) {
            console.error('Login API Error:', err);
            showAlert('Unable to connect to authentication server. Please check your network.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}
