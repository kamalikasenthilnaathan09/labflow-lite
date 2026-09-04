from flask import Blueprint, request, jsonify, session
from services.db import FacultyDataService
from services.prediction import DisruptionPredictionService

faculty_bp = Blueprint('faculty', __name__)

@faculty_bp.before_request
def require_faculty_auth():
    if request.path.startswith('/api/faculty'):
        if 'user_id' not in session:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required. Please sign in.',
                'redirect': '/login'
            }), 401
        
        user_role = session.get('user_role')
        if user_role not in ['Faculty', 'Lab Staff', 'Admin']:
            return jsonify({
                'status': 'error',
                'message': 'Access restricted to Faculty and Lab Staff.',
                'redirect': '/dashboard/student'
            }), 403

@faculty_bp.route('/api/faculty/dashboard', methods=['GET'])
def get_faculty_dashboard():
    user_id = session.get('user_id')
    data = FacultyDataService.get_dashboard_data(user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200

@faculty_bp.route('/api/faculty/sessions/today', methods=['GET'])
@faculty_bp.route('/api/faculty/sessions', methods=['GET'])
def get_today_sessions():
    user_id = session.get('user_id')
    date_param = request.args.get('date')
    
    filters = {
        'lab_id': request.args.get('lab_id'),
        'department': request.args.get('department'),
        'batch': request.args.get('batch'),
        'status': request.args.get('status'),
        'search': request.args.get('search'),
        'faculty_filter': request.args.get('faculty_filter', 'all')
    }
    
    data = FacultyDataService.get_today_sessions(user_id, target_date=date_param, filters=filters)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200


@faculty_bp.route('/api/faculty/profile', methods=['GET', 'PUT'])
def faculty_profile_api():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    if request.method == 'GET':
        profile = FacultyDataService.get_faculty_profile(user_id)
        if profile:
            return jsonify({'status': 'success', 'data': profile}), 200
        else:
            return jsonify({'status': 'error', 'message': 'Faculty profile not found'}), 404
            
    elif request.method == 'PUT':
        data = request.get_json() or {}
        success = FacultyDataService.update_faculty_profile(user_id, data)
        if success:
            updated = FacultyDataService.get_faculty_profile(user_id)
            return jsonify({'status': 'success', 'message': 'Profile updated successfully', 'data': updated}), 200
        else:
            return jsonify({'status': 'error', 'message': 'Failed to update profile'}), 500

@faculty_bp.route('/api/faculty/schedule', methods=['GET'])
def get_faculty_schedule():
    user_id = session.get('user_id')
    week_offset = request.args.get('week_offset', 0)
    try:
        week_offset = int(week_offset)
    except Exception:
        week_offset = 0
        
    filters = {
        'lab_id': request.args.get('lab_id'),
        'section': request.args.get('section'),
        'batch': request.args.get('batch'),
        'status': request.args.get('status')
    }
    
    data = FacultyDataService.get_faculty_schedule(user_id, week_offset=week_offset, filters=filters)
    if data:
        return jsonify({
            'status': 'success',
            'data': data
        }), 200
    else:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve laboratory schedule.'
        }), 500

@faculty_bp.route('/api/faculty/labs', methods=['GET'])
def get_faculty_labs():
    user_id = session.get('user_id')
    data = FacultyDataService.get_labs_data(user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200


@faculty_bp.route('/api/faculty/equipment', methods=['GET'])
def get_faculty_equipment():
    user_id = session.get('user_id')
    data = FacultyDataService.get_equipment_data(user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200


@faculty_bp.route('/api/faculty/qr/<path:qr_identifier>', methods=['GET'])
@faculty_bp.route('/api/faculty/qr/lookup/<path:qr_identifier>', methods=['GET'])
def lookup_equipment_by_qr(qr_identifier):
    user_id = session.get('user_id')
    clean_qr = str(qr_identifier).strip()
    result = FacultyDataService.lookup_equipment_qr(clean_qr)
    if result:
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
    else:
        return jsonify({
            'status': 'error',
            'message': 'No equipment record matches this QR identifier.'
        }), 404


@faculty_bp.route('/api/faculty/booking/options', methods=['GET'])
def get_booking_options():
    user_id = session.get('user_id')
    data = FacultyDataService.get_booking_options(user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200

@faculty_bp.route('/api/faculty/booking/check-availability', methods=['POST'])
@faculty_bp.route('/api/faculty/booking/availability', methods=['POST', 'GET'])
def check_booking_availability():
    if request.method == 'GET':
        params = request.args
    else:
        params = request.get_json() or {}
    result = FacultyDataService.check_slot_availability(params)
    return jsonify(result), 200

@faculty_bp.route('/api/faculty/booking', methods=['POST'])
@faculty_bp.route('/api/faculty/booking/confirm', methods=['POST'])
def create_booking():
    user_id = session.get('user_id')
    data = request.get_json() or {}
    result = FacultyDataService.create_faculty_booking(user_id, data)
    status_code = 200 if result.get('status') == 'success' else 400
    return jsonify(result), status_code

@faculty_bp.route('/api/faculty/booking/<int:session_id>/cancel', methods=['POST', 'DELETE'])
@faculty_bp.route('/api/faculty/sessions/<int:session_id>/cancel', methods=['POST', 'DELETE'])
def cancel_faculty_session(session_id):
    user_id = session.get('user_id')
    result = FacultyDataService.cancel_faculty_booking(user_id, session_id)
    status_code = 200 if result.get('status') == 'success' else 400
    return jsonify(result), status_code

@faculty_bp.route('/api/faculty/notifications', methods=['GET'])
def get_faculty_notifications():
    user_id = session.get('user_id')
    notifications = FacultyDataService.get_faculty_notifications(user_id)
    unread_count = sum(1 for n in notifications if not n.get('is_read'))
    return jsonify({
        'status': 'success',
        'notifications': notifications,
        'unread_count': unread_count
    }), 200

@faculty_bp.route('/api/faculty/notifications/read-all', methods=['PUT', 'POST'])
def mark_all_faculty_notifications_read():
    user_id = session.get('user_id')
    FacultyDataService.mark_all_notifications_read(user_id)
    return jsonify({
        'status': 'success',
        'message': 'All faculty notifications marked as read.'
    }), 200

@faculty_bp.route('/api/faculty/notifications/<int:notification_id>/read', methods=['PUT', 'POST'])
def mark_faculty_notification_read(notification_id):
    user_id = session.get('user_id')
    FacultyDataService.mark_notification_read(notification_id, user_id)
    return jsonify({
        'status': 'success',
        'message': 'Faculty notification marked as read.'
    }), 200

@faculty_bp.route('/api/faculty/usage', methods=['GET'])
@faculty_bp.route('/api/faculty/usage-history', methods=['GET'])
def get_faculty_usage():
    user_id = session.get('user_id')
    data = FacultyDataService.get_faculty_usage(user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200

@faculty_bp.route('/api/faculty/fault-reports', methods=['GET', 'POST'])
def handle_faculty_fault_reports():
    user_id = session.get('user_id')
    if request.method == 'GET':
        data = FacultyDataService.get_faculty_fault_reports(user_id)
        return jsonify({
            'status': 'success',
            'data': data
        }), 200
    elif request.method == 'POST':
        payload = request.get_json() or {}
        equipment_id = payload.get('equipment_id')
        fault_type = (payload.get('fault_type') or 'Hardware Issue').strip()
        description = (payload.get('description') or '').strip()
        priority = payload.get('priority', 'High')

        if not equipment_id or not description:
            return jsonify({'status': 'error', 'message': 'Please select equipment and describe the fault.'}), 400

        success, res = FacultyDataService.create_fault_report(user_id, equipment_id, fault_type, description, priority)
        if not success:
            return jsonify({'status': 'error', 'message': res or 'Failed to create fault report.'}), 400

        return jsonify({
            'status': 'success',
            'message': 'Fault report submitted successfully. Equipment status updated to Faulty.',
            'report_id': res
        }), 201

@faculty_bp.route('/api/faculty/fault-reports/<int:report_id>/status', methods=['PUT', 'POST'])
def update_faculty_fault_report_status(report_id):
    payload = request.get_json() or {}
    new_status = (payload.get('status') or '').strip()
    if not new_status:
        return jsonify({'status': 'error', 'message': 'Status parameter is required.'}), 400

    success, msg = FacultyDataService.update_fault_status(report_id, new_status)
    if not success:
        return jsonify({'status': 'error', 'message': msg}), 400

    return jsonify({
        'status': 'success',
        'message': msg
    }), 200

@faculty_bp.route('/api/faculty/disruption-prediction', methods=['GET'])
def get_faculty_disruption_prediction():
    user_id = session.get('user_id')
    session_id = request.args.get('session_id')
    data = DisruptionPredictionService.calculate_session_disruption_risk(session_id=session_id, user_id=user_id)
    return jsonify({
        'status': 'success',
        'data': data
    }), 200
