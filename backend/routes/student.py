from flask import Blueprint, request, jsonify, session
from services.db import AuthService, StudentDataService

student_bp = Blueprint('student', __name__)

@student_bp.before_request
def require_student_auth():
    if request.path.startswith('/api/student'):
        if 'user_id' not in session:
            return jsonify({
                "status": "error",
                "message": "Authentication required. Please sign in.",
                "redirect": "/login"
            }), 401

def get_current_student_id():
    return session.get('user_id')


@student_bp.route('/api/student/profile', methods=['GET', 'PUT', 'POST'])
def handle_student_profile():
    user_id = get_current_student_id()
    user = AuthService.get_user_by_id(user_id)
    if not user:
        return jsonify({"status": "error", "message": "Student profile not found."}), 404

    if request.method == 'GET':
        return jsonify({
            "status": "success",
            "student": {
                "id": user['id'],
                "name": user['name'],
                "college_id": user.get('college_id', 'STU-2026-089'),
                "email": user['email'],
                "phone": user.get('phone') or '+91 98765 43210',
                "department": user.get('department') or 'Artificial Intelligence & Data Science',
                "year": user.get('year') or 'III Year',
                "semester": user.get('semester') or 'V Semester',
                "section": user.get('section') or 'B Section',
                "role": user['role'],
                "created_at": user.get('created_at', '2026-08-01')
            }
        })

    elif request.method in ['PUT', 'POST']:
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        department = (data.get('department') or 'Artificial Intelligence & Data Science').strip()
        year = (data.get('year') or 'III Year').strip()
        semester = (data.get('semester') or 'V Semester').strip()
        section = (data.get('section') or 'B Section').strip()

        # Input Validations
        if not name:
            return jsonify({"status": "error", "message": "Student Name is required."}), 400

        if not email or '@' not in email or '.' not in email.split('@')[-1]:
            return jsonify({"status": "error", "message": "Please enter a valid college email address."}), 400

        success = AuthService.update_student_profile(
            user_id, 
            name=name, 
            email=email, 
            phone=phone, 
            department=department, 
            year=year, 
            semester=semester, 
            section=section
        )

        if not success:
            return jsonify({"status": "error", "message": "Failed to update profile record."}), 500

        updated_user = AuthService.get_user_by_id(user_id)
        return jsonify({
            "status": "success",
            "message": "Profile updated successfully.",
            "student": {
                "id": updated_user['id'],
                "name": updated_user['name'],
                "college_id": updated_user.get('college_id', 'STU-2026-089'),
                "email": updated_user['email'],
                "phone": updated_user.get('phone') or phone or '+91 98765 43210',
                "department": updated_user.get('department') or department or 'Artificial Intelligence & Data Science',
                "year": updated_user.get('year') or year or 'III Year',
                "semester": updated_user.get('semester') or semester or 'V Semester',
                "section": updated_user.get('section') or section or 'B Section',
                "role": updated_user['role'],
                "created_at": updated_user.get('created_at', '2026-08-01')
            }
        })

@student_bp.route('/api/student/stats', methods=['GET'])
def get_stats():
    user_id = get_current_student_id()
    stats = StudentDataService.get_student_stats(user_id)
    return jsonify({
        "status": "success",
        "stats": stats
    })

@student_bp.route('/api/student/labs', methods=['GET'])
def get_labs():
    user_id = get_current_student_id()
    search = request.args.get('search', type=str)
    department = request.args.get('department', type=str)
    
    labs = StudentDataService.get_labs(search=search, department=department, user_id=user_id)
    departments = StudentDataService.get_departments()

    return jsonify({
        "status": "success",
        "total_count": len(labs),
        "departments": departments,
        "labs": labs
    })

@student_bp.route('/api/student/labs/<int:lab_id>', methods=['GET'])
def get_lab_details(lab_id):
    data = StudentDataService.get_lab_details(lab_id)
    if not data:
        return jsonify({"status": "error", "message": "Laboratory record not found."}), 404
    
    return jsonify({
        "status": "success",
        "lab": data['lab'],
        "equipment": data['equipment'],
        "faculty": data['faculty']
    })

@student_bp.route('/api/student/equipment', methods=['GET'])
def get_equipment():
    user_id = get_current_student_id()
    lab_id = request.args.get('lab_id', type=int)
    search = request.args.get('search', type=str)
    equipment = StudentDataService.get_equipment(lab_id=lab_id, search=search, user_id=user_id)
    return jsonify({
        "status": "success",
        "equipment": equipment
    })

@student_bp.route('/api/student/qr-lookup/<qr_code>', methods=['GET'])
def qr_lookup(qr_code):
    eq = StudentDataService.get_equipment_by_qr(qr_code)
    if not eq:
        return jsonify({"status": "error", "message": "No equipment found matching QR code / tag code."}), 404
    
    return jsonify({
        "status": "success",
        "equipment": eq
    })

@student_bp.route('/api/student/sessions/<int:session_id>/equipment', methods=['GET'])
def get_session_equipment_route(session_id):
    user_id = get_current_student_id()
    data = StudentDataService.get_session_equipment(session_id, user_id)
    if not data:
        return jsonify({"status": "error", "message": "Practical session not found."}), 404
    return jsonify({
        "status": "success",
        "data": data
    })

@student_bp.route('/api/student/bookings', methods=['GET', 'POST'])
def handle_bookings():
    user_id = get_current_student_id()

    if request.method == 'GET':
        bookings = StudentDataService.get_student_bookings(user_id)
        return jsonify({
            "status": "success",
            "bookings": bookings
        })

    elif request.method == 'POST':
        data = request.get_json() or {}
        session_id = data.get('session_id')
        equipment_id = data.get('equipment_id')

        if session_id and equipment_id:
            # Realistic practical session-linked equipment booking workflow
            success, res = StudentDataService.create_student_session_booking(user_id, session_id, equipment_id)
            if not success:
                return jsonify({"status": "error", "message": res}), 400
            return jsonify({
                "status": "success",
                "message": "Equipment booked successfully",
                "booking_id": res
            }), 201
        else:
            # Fallback legacy booking parameters support
            batch_name = (data.get('batch_name') or 'Batch 1').strip()
            session_date = data.get('session_date')
            start_time = data.get('start_time', '10:00:00')
            end_time = data.get('end_time', '12:00:00')

            if not equipment_id or not session_date:
                return jsonify({"status": "error", "message": "Please select equipment and session."}), 400

            booking_id = StudentDataService.create_booking(user_id, equipment_id, batch_name, session_date, start_time, end_time)
            if not booking_id:
                return jsonify({"status": "error", "message": "Failed to create booking. Please try again."}), 500

            eq = StudentDataService.get_equipment_by_id(equipment_id)
            eq_code = eq.get('equipment_code', '') if eq else ''
            eq_name = eq.get('name', 'Apparatus') if eq else 'Apparatus'
            title = "Equipment Booked Successfully"
            msg = f"Your booking for {eq_name} ({eq_code}) on {session_date} has been confirmed."
            StudentDataService.create_notification(user_id, title, msg, "booking")

            return jsonify({
                "status": "success",
                "message": "Equipment booked successfully",
                "booking_id": booking_id
            }), 201

@student_bp.route('/api/student/bookings/<int:booking_id>/cancel', methods=['POST'])
def cancel_booking_endpoint(booking_id):
    user_id = get_current_student_id()
    success = StudentDataService.cancel_booking(booking_id, user_id)
    if success:
        title = "Booking Cancelled"
        msg = f"Your booking #{booking_id} has been cancelled."
        StudentDataService.create_notification(user_id, title, msg, "booking")
        return jsonify({"status": "success", "message": "Booking cancelled successfully."})
    return jsonify({"status": "error", "message": "Unable to cancel booking."}), 400

@student_bp.route('/api/student/fault-reports', methods=['GET', 'POST'])
def handle_fault_reports():
    user_id = get_current_student_id()

    if request.method == 'GET':
        reports = StudentDataService.get_student_fault_reports(user_id)
        return jsonify({
            "status": "success",
            "fault_reports": reports
        })

    elif request.method == 'POST':
        data = request.get_json() or {}
        equipment_id = data.get('equipment_id')
        fault_type = (data.get('fault_type') or 'Hardware Issue').strip()
        description = (data.get('description') or '').strip()
        priority = data.get('priority', 'Medium')

        if not equipment_id or not description:
            return jsonify({"status": "error", "message": "Please select equipment and describe the fault."}), 400

        report_id = StudentDataService.create_fault_report(user_id, equipment_id, fault_type, description, priority)
        if not report_id:
            return jsonify({"status": "error", "message": "Failed to submit fault report."}), 500

        # Trigger real-time notification
        eq = StudentDataService.get_equipment_by_id(equipment_id)
        eq_name = eq.get('name', 'Apparatus') if eq else 'Apparatus'
        title = "Fault Report Submitted"
        msg = f"Your fault report for {eq_name} has been logged for technician maintenance."
        StudentDataService.create_notification(user_id, title, msg, "fault")

        return jsonify({
            "status": "success",
            "message": "Fault report logged successfully. Technician alerted.",
            "report_id": report_id
        }), 201

@student_bp.route('/api/student/usage', methods=['GET'])
def get_usage():
    user_id = get_current_student_id()
    usage = StudentDataService.get_student_usage(user_id)
    return jsonify({
        "status": "success",
        "usage": usage
    })

@student_bp.route('/api/student/notifications', methods=['GET'])
def get_notifications():
    user_id = get_current_student_id()
    notifications = StudentDataService.get_student_notifications(user_id)
    unread_count = sum(1 for n in notifications if not n.get('is_read'))
    return jsonify({
        "status": "success",
        "unread_count": unread_count,
        "notifications": notifications
    })

@student_bp.route('/api/student/notifications/read-all', methods=['PUT', 'POST'])
def mark_all_notifications_read():
    user_id = get_current_student_id()
    StudentDataService.mark_all_notifications_read(user_id)
    return jsonify({
        "status": "success",
        "message": "All notifications marked as read."
    })

@student_bp.route('/api/student/notifications/<int:notification_id>/read', methods=['PUT', 'POST'])
def mark_notification_read(notification_id):
    user_id = get_current_student_id()
    StudentDataService.mark_notification_read(notification_id, user_id)
    return jsonify({
        "status": "success",
        "message": "Notification marked as read."
    })

@student_bp.route('/api/student/schedule', methods=['GET'])
def get_schedule():
    user_id = get_current_student_id()
    week_offset = request.args.get('week_offset', 0, type=int)
    data = StudentDataService.get_student_schedule(user_id, week_offset=week_offset)
    return jsonify({
        "status": "success",
        "data": data
    })
