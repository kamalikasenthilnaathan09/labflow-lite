from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
import re
from services.db import AuthService

auth_bp = Blueprint('auth', __name__)

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    
    name = (data.get('name') or '').strip()
    college_id = (data.get('college_id') or '').strip()
    email = (data.get('email') or '').strip().lower()
    department = (data.get('department') or '').strip()
    role = (data.get('role') or '').strip()
    password = data.get('password') or ''
    confirm_password = data.get('confirm_password') or ''
    
    # 1. Required field validations
    if not name:
        return jsonify({"status": "error", "message": "Please enter your full name."}), 400
    if not college_id:
        return jsonify({"status": "error", "message": "Please enter your College ID / Student ID."}), 400
    if not email:
        return jsonify({"status": "error", "message": "Please enter a valid email address."}), 400
    if not re.match(EMAIL_REGEX, email):
        return jsonify({"status": "error", "message": "Please enter a valid email format (e.g. user@college.edu.in)."}), 400
    if not department:
        return jsonify({"status": "error", "message": "Please select your department."}), 400
    if not role:
        return jsonify({"status": "error", "message": "Please select your role."}), 400
        
    # Security Rule: Block public registration as Admin
    if role.lower() == 'admin':
        return jsonify({"status": "error", "message": "Public registration for Administrator accounts is not permitted."}), 403
        
    if role not in ['Student', 'Faculty', 'Lab Staff']:
        return jsonify({"status": "error", "message": "Invalid role selected."}), 400

    if not password:
        return jsonify({"status": "error", "message": "Please enter a password."}), 400
    if len(password) < 6:
        return jsonify({"status": "error", "message": "Password must be at least 6 characters long."}), 400
    if password != confirm_password:
        return jsonify({"status": "error", "message": "Passwords do not match."}), 400

    # 2. Check duplicate email or college_id
    if AuthService.get_user_by_email(email):
        return jsonify({"status": "error", "message": "This email is already registered. Please sign in instead."}), 409
        
    if AuthService.get_user_by_college_id(college_id):
        return jsonify({"status": "error", "message": "This College ID / Student ID is already registered."}), 409

    # 3. Secure Password Hashing & Insert
    password_hash = generate_password_hash(password)
    new_user_id = AuthService.create_user(name, college_id, email, department, role, password_hash)

    if not new_user_id:
        return jsonify({"status": "error", "message": "Registration failed due to a database error. Please try again."}), 500

    return jsonify({
        "status": "success",
        "message": "Account created successfully! Redirecting to login...",
        "redirect": "/login"
    }), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    
    identifier = (data.get('identifier') or '').strip()
    password = data.get('password') or ''
    
    if not identifier:
        return jsonify({"status": "error", "message": "Please enter your Email or College ID."}), 400
    if not password:
        return jsonify({"status": "error", "message": "Please enter your password."}), 400

    # Retrieve user by email or college_id
    user = AuthService.get_user_by_identifier(identifier)
    
    if not user:
        return jsonify({"status": "error", "message": "Account not found. Please check your credentials or register."}), 404

    # Verify password hash
    if not check_password_hash(user['password_hash'], password):
        return jsonify({"status": "error", "message": "Incorrect password. Please check your password and try again."}), 401

    # Store Session (pristine session reset)
    session.clear()
    session['user_id'] = user['id']
    session['user_name'] = user['name']
    session['user_email'] = user['email']
    session['user_role'] = user['role']

    # Role-Based Redirect Determination
    role_redirects = {
        'Student': '/dashboard/student',
        'Faculty': '/dashboard/faculty',
        'Lab Staff': '/dashboard/faculty',
        'Admin': '/dashboard/admin'
    }
    
    redirect_url = role_redirects.get(user['role'], '/dashboard/student')

    return jsonify({
        "status": "success",
        "message": "Sign in successful! Redirecting to your workspace...",
        "user": {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "department": user.get('department')
        },
        "redirect": redirect_url
    }), 200


@auth_bp.route('/api/auth/logout', methods=['GET', 'POST'])
def logout():
    session.clear()
    resp = jsonify({
        "status": "success",
        "message": "Logged out successfully.",
        "redirect": "/login"
    })
    resp.delete_cookie('session')
    return resp, 200



@auth_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({"status": "unauthenticated"}), 401
    
    return jsonify({
        "status": "authenticated",
        "user": {
            "id": session.get('user_id'),
            "name": session.get('user_name'),
            "email": session.get('user_email'),
            "role": session.get('user_role')
        }
    }), 200
