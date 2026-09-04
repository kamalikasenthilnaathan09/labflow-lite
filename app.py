from flask import Flask, send_from_directory, session, redirect, request
from flask_cors import CORS
import os
from config import Config
from routes.health import health_bp
from routes.auth import auth_bp
from routes.student import student_bp
from routes.faculty import faculty_bp

def create_app():
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    
    app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
    app.config.from_object(Config)

    # Enable CORS for frontend interaction
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(faculty_bp)

    # Frontend Page Routes
    @app.route('/')
    def index():
        return send_from_directory(frontend_dir, 'index.html')

    @app.route('/logout')
    def logout_redirect():
        session.clear()
        resp = redirect('/login')
        resp.delete_cookie('session')
        return resp

    @app.route('/login')
    def login_page():
        return send_from_directory(frontend_dir, 'login.html')

    @app.route('/register')
    def register_page():
        return send_from_directory(frontend_dir, 'register.html')

    # Student Workspace Routes with Session Authentication Protection
    @app.route('/dashboard/student')
    @app.route('/student')
    @app.route('/student/')
    @app.route('/student/<path:subpath>')
    def student_dashboard(subpath=None):
        if 'user_id' not in session:
            return redirect('/login')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'student.html')

    # Faculty & Admin Dashboard Routes
    @app.route('/dashboard/faculty/sessions')
    @app.route('/faculty/sessions')
    @app.route('/faculty/sessions/')
    def faculty_sessions_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_sessions.html')

    @app.route('/dashboard/faculty/profile')
    @app.route('/faculty/profile')
    @app.route('/faculty/profile/')
    def faculty_profile_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_profile.html')

    @app.route('/dashboard/faculty/schedule')
    @app.route('/faculty/schedule')
    @app.route('/faculty/schedule/')
    def faculty_schedule_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_schedule.html')

    @app.route('/dashboard/faculty/booking')
    @app.route('/faculty/booking')
    @app.route('/faculty/booking/')
    def faculty_booking_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_booking.html')

    @app.route('/dashboard/faculty/qr-scanner')
    @app.route('/faculty/qr-scanner')
    @app.route('/faculty/qr-scanner/')
    def faculty_qr_scanner_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_qr_scanner.html')

    @app.route('/dashboard/faculty/equipment')
    @app.route('/faculty/equipment')
    @app.route('/faculty/equipment/')
    def faculty_equipment_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_equipment.html')

    @app.route('/dashboard/faculty/labs')
    @app.route('/faculty/labs')
    @app.route('/faculty/labs/')
    def faculty_labs_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_labs.html')

    
    
    @app.route('/dashboard/faculty/disruption-prediction')
    @app.route('/faculty/disruption-prediction')
    @app.route('/faculty/disruption-prediction/')
    def faculty_disruption_prediction_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_disruption_prediction.html')

    @app.route('/dashboard/faculty/usage-history')
    @app.route('/faculty/usage-history')
    @app.route('/faculty/usage-history/')
    def faculty_usage_history_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_usage_history.html')

    @app.route('/dashboard/faculty/fault-reports')
    @app.route('/faculty/fault-reports')
    @app.route('/faculty/fault-reports/')
    def faculty_fault_reports_page():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty_fault_reports.html')

    @app.route('/dashboard/faculty')
    @app.route('/faculty')
    @app.route('/faculty/')
    def faculty_dashboard():
        if 'user_id' not in session:
            return redirect('/login')
        user_role = session.get('user_role')
        if user_role == 'Student':
            return redirect('/dashboard/student')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'faculty.html')

    @app.route('/dashboard/admin')
    @app.route('/admin')
    @app.route('/admin/<path:subpath>')
    def admin_dashboard(subpath=None):
        if 'user_id' not in session:
            return redirect('/login')
        dash_dir = os.path.join(frontend_dir, 'dashboards')
        return send_from_directory(dash_dir, 'admin.html')

    @app.after_request
    def add_security_headers(response):
        if request.path.startswith(('/dashboard', '/student', '/faculty', '/admin', '/api/student', '/api/faculty', '/api/auth/me')):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response

    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
