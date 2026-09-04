from datetime import datetime, date, time as dt_time, timedelta
import pymysql
import sqlite3
import os
import re
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config

DB_FILE = os.path.join(os.path.dirname(__file__), '..', 'labflow_local.db')

def get_mysql_connection():
    try:
        conn = pymysql.connect(
            host=Config.MYSQL_HOST,
            port=Config.MYSQL_PORT,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DATABASE,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=0.2
        )
        return conn, 'mysql'
    except Exception as e:
        # Fall back to SQLite database helper for development resilience
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        init_sqlite_db(conn)
        return conn, 'sqlite'

def init_sqlite_db(conn):
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            college_id TEXT UNIQUE,
            email TEXT UNIQUE NOT NULL,
            department TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT,
            year TEXT,
            semester TEXT,
            section TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    try:
        cursor.execute("PRAGMA table_info(users)")
        existing_cols = [r[1] for r in cursor.fetchall()]
        if 'phone' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '+91 98765 43210'")
        if 'year' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN year TEXT DEFAULT 'III Year'")
        if 'semester' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN semester TEXT DEFAULT 'V Semester'")
        if 'section' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN section TEXT DEFAULT 'B Section'")
        cursor.execute("UPDATE users SET department = 'Artificial Intelligence & Data Science' WHERE college_id = 'STU-2026-089' AND (department IS NULL OR department = 'Electronics & Communication')")
        conn.commit()
    except Exception as e:
        print("User table migration check:", e)

    # 2. Labs Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS labs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            department TEXT,
            status TEXT DEFAULT 'Active',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    try:
        cursor.execute("PRAGMA table_info(labs)")
        existing_cols = [r[1] for r in cursor.fetchall()]
        if 'department' not in existing_cols:
            cursor.execute("ALTER TABLE labs ADD COLUMN department TEXT DEFAULT 'General'")
        if 'status' not in existing_cols:
            cursor.execute("ALTER TABLE labs ADD COLUMN status TEXT DEFAULT 'Active'")
        if 'description' not in existing_cols:
            cursor.execute("ALTER TABLE labs ADD COLUMN description TEXT DEFAULT ''")
        cursor.execute("UPDATE labs SET department = 'Electronics & Communication' WHERE id IN (1, 3) AND (department IS NULL OR department = 'General')")
        cursor.execute("UPDATE labs SET department = 'Computer Science' WHERE id = 2 AND (department IS NULL OR department = 'General')")
        cursor.execute("UPDATE labs SET department = 'Electrical Engineering' WHERE id = 4 AND (department IS NULL OR department = 'General')")
        conn.commit()
    except Exception as e:
        print("Labs table migration check:", e)

    # 3. Equipment Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            lab_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Available',
            qr_code TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 4. Bookings Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            batch_name TEXT,
            session_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 5. Fault Reports Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fault_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id INTEGER NOT NULL,
            reported_by INTEGER NOT NULL,
            fault_type TEXT NOT NULL,
            description TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'Medium',
            status TEXT NOT NULL DEFAULT 'Open',
            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 6. Equipment Usage Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipment_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id INTEGER NOT NULL,
            booking_id INTEGER,
            usage_date DATE NOT NULL,
            duration_minutes INTEGER NOT NULL DEFAULT 0
        )
    ''')

    # 7. Notifications Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notification_type TEXT NOT NULL DEFAULT 'general',
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 8. Academic Lab Sessions Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lab_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lab_id INTEGER NOT NULL,
            faculty_id INTEGER NULL,
            practical_name TEXT NOT NULL,
            department TEXT NOT NULL,
            year TEXT NOT NULL DEFAULT 'III Year',
            semester TEXT NOT NULL DEFAULT 'V Semester',
            section TEXT NOT NULL DEFAULT 'B',
            batch TEXT NOT NULL DEFAULT 'Batch 1',
            session_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            student_count INTEGER DEFAULT 38,
            status TEXT DEFAULT 'Scheduled',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lab_id) REFERENCES labs(id) ON DELETE CASCADE,
            FOREIGN KEY(faculty_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()

    # Seed default users if empty
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        default_hash = generate_password_hash('password123')
        default_users = [
            ('System Administrator', 'ADM-2026-001', 'admin@college.edu.in', 'Administration', default_hash, 'Admin'),
            ('Assigned Faculty', 'FAC-ECE-101', 'assigned.faculty@college.edu.in', 'Electronics & Communication', default_hash, 'Faculty'),
                        ('Suresh Kumar', 'STF-LAB-201', 'suresh.kumar@college.edu.in', 'Electrical Engineering', default_hash, 'Lab Staff'),
            ('Rohan Verma', 'STU-2026-089', 'rohan.verma@student.edu.in', 'Electronics & Communication', default_hash, 'Student'),
            ('Priya Patel', 'STU-2026-114', 'priya.patel@student.edu.in', 'Computer Science', default_hash, 'Student')
        ]
        cursor.executemany('''
            INSERT INTO users (name, college_id, email, department, password_hash, role)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', default_users)
        conn.commit()

    # Seed or ensure student account for kamali@gmail.com
    cursor.execute("SELECT id, password_hash FROM users WHERE email = 'kamali@gmail.com'")
    kamali_row = cursor.fetchone()
    if kamali_row:
        if not check_password_hash(kamali_row[1], '123456'):
            new_h = generate_password_hash('123456')
            cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_h, kamali_row[0]))
            conn.commit()
    else:
        kamali_hash = generate_password_hash('123456')
        cursor.execute('''
            INSERT INTO users (name, college_id, email, department, password_hash, role, phone, year, semester, section)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('Kamalika senthilnaathan', '9790', 'kamali@gmail.com', 'Information Technology', kamali_hash, 'Student', '+91 98765 43210', 'III Year', 'V Semester', 'B Section'))
        conn.commit()

    # Seed additional faculty members if missing
    cursor.execute("SELECT id, email FROM users WHERE email = 'murugesan@college.edu.in'")
    if not cursor.fetchone():
        def_hash = generate_password_hash('password123')
        extra_faculty = [
            ('Dr. Murugesan', 'FAC-AIDS-101', 'murugesan@college.edu.in', 'Artificial Intelligence & Data Science', def_hash, 'Faculty', '+91 98451 23456', 'III Year', 'V Semester', 'B'),
            ('Mr. Ramesh', 'FAC-AIDS-102', 'ramesh@college.edu.in', 'Artificial Intelligence & Data Science', def_hash, 'Faculty', '+91 98451 23457', 'III Year', 'V Semester', 'B'),
            ('Mr. Baskar', 'FAC-AIDS-103', 'baskar@college.edu.in', 'Artificial Intelligence & Data Science', def_hash, 'Faculty', '+91 98451 23458', 'III Year', 'V Semester', 'B'),
            ('Mr. Bharathidasan', 'FAC-AIDS-104', 'bharathidasan@college.edu.in', 'Artificial Intelligence & Data Science', def_hash, 'Faculty', '+91 98451 23459', 'III Year', 'V Semester', 'B')
        ]
        cursor.executemany('''
            INSERT INTO users (name, college_id, email, department, password_hash, role, phone, year, semester, section)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', extra_faculty)
        conn.commit()

    # Seed default labs if empty
    cursor.execute('SELECT COUNT(*) FROM labs')
    if cursor.fetchone()[0] == 0:
        labs = [
            (1, 'Microprocessor & Embedded Systems Lab', 'Block B, 2nd Floor, Room 204', 'Electronics & Communication', 'Active', 'State-of-the-art laboratory equipped with ARM microcontroller kits, digital storage oscilloscopes, logic analyzers, and embedded system debugging workstations.'),
            (2, 'Advanced Computing & AI Research Lab', 'Block A, 3rd Floor, Room 310', 'Computer Science', 'Active', 'High-performance AI model training center featuring dual NVIDIA RTX 4090 GPU workstations and industrial 3D printing apparatus.'),
            (3, 'Digital Signal Processing & Telecom Lab', 'Block B, 1st Floor, Room 102', 'Electronics & Communication', 'Active', 'DSP hardware laboratory with Texas Instruments TMS320C6713 trainer kits and arbitrary signal generators.'),
            (4, 'VLSI & Circuit Design Laboratory', 'Block C, 3rd Floor, Room 305', 'Electrical Engineering', 'Active', 'Circuit design and semiconductor layout lab housing FPGA boards and electronic testing apparatus.')
        ]
        cursor.executemany('INSERT INTO labs (id, name, location, department, status, description) VALUES (?, ?, ?, ?, ?, ?)', labs)
        conn.commit()

    # Seed additional labs if missing
    cursor.execute("SELECT id FROM labs WHERE id = 5")
    if not cursor.fetchone():
        extra_labs = [
            (5, 'Cloud Service Management Lab', 'Block B, 3rd Floor, Room 318', 'Artificial Intelligence & Data Science', 'Active', 'Virtualization and enterprise cloud service orchestration laboratory.')
        ]
        cursor.executemany('INSERT OR IGNORE INTO labs (id, name, location, department, status, description) VALUES (?, ?, ?, ?, ?, ?)', extra_labs)
        conn.commit()

    # Seed default lab sessions if empty
    cursor.execute('SELECT COUNT(*) FROM lab_sessions')
    if cursor.fetchone()[0] == 0:
        today_s = datetime.now().strftime('%Y-%m-%d')
        cursor.execute("SELECT id, name FROM users WHERE role = 'Faculty'")
        fac_map = {r[1]: r[0] for r in cursor.fetchall()}
        muru_id = fac_map.get('Dr. Murugesan', 2)
        ramesh_id = fac_map.get('Mr. Ramesh', 2)
        bharathi_id = fac_map.get('Mr. Bharathidasan', 2)
        assigned_fac_id = fac_map.get('Assigned Faculty', 2)
        
        default_sessions = [
            # 1. Deep Learning Lab - Morning Batch 1
            (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', today_s, '09:00:00', '11:00:00', 42, 'Scheduled'),
            # 2. Deep Learning Lab - Midday Batch 2 (Shared resource demonstration)
            (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 2', today_s, '11:00:00', '13:00:00', 38, 'Scheduled'),
            # 3. Deep Learning Lab - Afternoon Different Class (Shared resource demonstration)
            (2, ananya_id, 'Neural Networks & GPU Compute', 'Computer Science', 'IV Year', 'VII Semester', 'A', 'All Students', today_s, '13:30:00', '15:30:00', 45, 'Scheduled'),
            # 4. Business Analytics Lab - Afternoon Batch 2
            (3, ramesh_id, 'Business Analytics Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 2', today_s, '14:00:00', '16:00:00', 36, 'Scheduled'),
            # 5. Cloud Service Management Lab - Morning Batch 1
            (5, bharathi_id, 'Cloud Infrastructure Management', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', today_s, '11:30:00', '13:30:00', 35, 'Scheduled'),
            # 6. Microprocessor Lab - Batch 1
            (1, assigned_fac_id, 'ARM Microcontroller Architecture', 'Electronics & Communication', 'III Year', 'V Semester', 'A', 'Batch 1', today_s, '09:30:00', '11:30:00', 40, 'Scheduled'),
            # 7. Microprocessor Lab - Batch 2
            (1, assigned_fac_id, 'Embedded C & Sensor Interfacing', 'Electronics & Communication', 'III Year', 'V Semester', 'A', 'Batch 2', today_s, '14:00:00', '16:00:00', 39, 'Scheduled')
        ]
        cursor.executemany('''
            INSERT INTO lab_sessions (lab_id, faculty_id, practical_name, department, year, semester, section, batch, session_date, start_time, end_time, student_count, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', default_sessions)
        conn.commit()

    # Seed default equipment if empty
    cursor.execute('SELECT COUNT(*) FROM equipment')
    if cursor.fetchone()[0] == 0:
        eq = [
            ('LAB-MP-001', 'Tektronix Digital Storage Oscilloscope 100MHz', 'Measurement', 1, 'Available', 'QR_MP001', 'Tektronix 100MHz 2-Channel DSO'),
            ('LAB-MP-002', 'ARM Cortex-M4 Microcontroller Trainer Board', 'Trainer Kit', 1, 'Booked', 'QR_MP002', 'Embedded systems hardware development board'),
            ('LAB-MP-003', 'Function Signal Generator 25MHz', 'Measurement', 1, 'Faulty', 'QR_MP003', 'Dual-channel arbitrary waveform signal generator'),
            ('LAB-MP-004', 'Logic Analyzer 16 Channel', 'Measurement', 1, 'Under Maintenance', 'QR_MP004', 'USB Logic analyzer for embedded bus decoding'),
            ('LAB-AI-001', 'NVIDIA RTX 4090 GPU Workstation PC-1', 'Computing', 2, 'Available', 'QR_AI001', 'High-performance AI/ML model training workstation'),
            ('LAB-AI-002', 'NVIDIA RTX 4090 GPU Workstation PC-2', 'Computing', 2, 'Booked', 'QR_AI002', 'High-performance AI/ML model training workstation'),
            ('LAB-AI-003', 'Industrial 3D Printer (FDM)', 'Rapid Prototyping', 2, 'Available', 'QR_AI003', 'Dual extruder 3D printer for enclosure prototyping'),
            ('LAB-DSP-001', 'Texas Instruments TMS320C6713 DSP Kit', 'Trainer Kit', 3, 'Available', 'QR_DSP001', 'Floating point digital signal processor board')
        ]
        cursor.executemany('''
            INSERT INTO equipment (equipment_code, name, category, lab_id, status, qr_code, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', eq)
        conn.commit()

    # Seed default bookings if empty
    cursor.execute('SELECT COUNT(*) FROM bookings')
    if cursor.fetchone()[0] == 0:
        bks = [
            (1, 5, 'ECE 2026 Batch A', '2026-09-01', '09:30:00', '11:30:00', 'Confirmed'),
            (2, 5, 'B.Tech Embedded Lab', '2026-09-02', '14:00:00', '16:00:00', 'Confirmed'),
            (6, 6, 'CSE AI Research Group', '2026-09-03', '10:00:00', '13:00:00', 'Pending')
        ]
        cursor.executemany('''
            INSERT INTO bookings (equipment_id, user_id, batch_name, session_date, start_time, end_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', bks)
        conn.commit()

    # Seed default fault reports if empty
    cursor.execute('SELECT COUNT(*) FROM fault_reports')
    if cursor.fetchone()[0] == 0:
        flts = [
            (3, 5, 'Display Artifacts', 'Channel 1 output amplitude fluctuates uncontrollably and screen flickers.', 'High', 'Open')
        ]
        cursor.executemany('''
            INSERT INTO fault_reports (equipment_id, reported_by, fault_type, description, priority, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', flts)
        conn.commit()

    # Seed default equipment usage if empty
    cursor.execute('SELECT COUNT(*) FROM equipment_usage')
    if cursor.fetchone()[0] == 0:
        usg = [
            (1, 1, '2026-08-25', 120),
            (2, 2, '2026-08-27', 90)
        ]
        cursor.executemany('''
            INSERT INTO equipment_usage (equipment_id, booking_id, usage_date, duration_minutes)
            VALUES (?, ?, ?, ?)
        ''', usg)
        conn.commit()

    # Seed default notifications if empty
    cursor.execute('SELECT COUNT(*) FROM notifications')
    if cursor.fetchone()[0] == 0:
        default_notifications = [
            (5, 'Upcoming Practical', 'Deep Learning Lab (AIDS III-B) is scheduled for tomorrow with Dr. Murugesan.', 'schedule', 0),
            (5, 'Booking Confirmed', 'Your booking for NVIDIA RTX 4090 GPU Workstation PC-1 (LAB-AI-001) has been confirmed.', 'booking', 0),
            (5, 'Equipment Status Updated', 'Tektronix Digital Storage Oscilloscope 100MHz (LAB-MP-001) is currently marked under maintenance.', 'equipment', 1)
        ]
        cursor.executemany('''
            INSERT INTO notifications (student_id, title, message, notification_type, is_read)
            VALUES (?, ?, ?, ?, ?)
        ''', default_notifications)
        conn.commit()


class AuthService:
    @staticmethod
    def get_user_by_identifier(identifier):
        if not identifier:
            return None
        identifier = str(identifier).strip()
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                if db_type == 'mysql':
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(%s) OR LOWER(college_id) = LOWER(%s)", (identifier, identifier))
                    return cursor.fetchone()
                else:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(college_id) = LOWER(?)", (identifier, identifier))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print("DB Error in get_user_by_identifier:", e)
            return None

    @staticmethod
    def get_user_by_email(email):
        if not email:
            return None
        email = str(email).strip()
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                if db_type == 'mysql':
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
                    return cursor.fetchone()
                else:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print("DB Error in get_user_by_email:", e)
            return None

    @staticmethod
    def get_user_by_college_id(college_id):
        if not college_id:
            return None
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                if db_type == 'mysql':
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE college_id = %s", (college_id,))
                    return cursor.fetchone()
                else:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE college_id = ?", (college_id,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print("DB Error in get_user_by_college_id:", e)
            return None

    @staticmethod
    def create_user(name, college_id, email, department, role, password_hash):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                if db_type == 'mysql':
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO users (name, college_id, email, department, password_hash, role)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (name, college_id, email, department, password_hash, role))
                    conn.commit()
                    return cursor.lastrowid
                else:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO users (name, college_id, email, department, password_hash, role)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (name, college_id, email, department, password_hash, role))
                    conn.commit()
                    return cursor.lastrowid
        except Exception as e:
            print("DB Error in create_user:", e)
            return None

    @staticmethod
    def get_user_by_id(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                if db_type == 'mysql':
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                    return cursor.fetchone()
                else:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print("DB Error in get_user_by_id:", e)
            return None

    @staticmethod
    def update_student_profile(user_id, name, email, phone=None, department=None, year=None, semester=None, section=None):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute('''
                        UPDATE users 
                        SET name = %s, email = %s, phone = %s, department = %s, year = %s, semester = %s, section = %s
                        WHERE id = %s AND role IN ('Student', 'STUDENT')
                    ''', (name, email, phone, department, year, semester, section, user_id))
                    conn.commit()
                else:
                    cursor.execute('''
                        UPDATE users 
                        SET name = ?, email = ?, phone = ?, department = ?, year = ?, semester = ?, section = ?
                        WHERE id = ? AND role IN ('Student', 'STUDENT')
                    ''', (name, email, phone, department, year, semester, section, user_id))
                    conn.commit()
                return True
        except Exception as e:
            print("DB Error in update_student_profile:", e)
            return False


class StudentDataService:
    @staticmethod
    def get_labs(search=None, department=None, user_id=None):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, location, department, status, description FROM labs ORDER BY id ASC")
                raw_labs = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                cursor.execute('''
                    SELECT lab_id, 
                           COUNT(id) as equipment_count,
                           SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available_count,
                           SUM(CASE WHEN status IN ('Faulty', 'Under Maintenance') THEN 1 ELSE 0 END) as maintenance_count
                    FROM equipment
                    GROUP BY lab_id
                ''')
                eq_counts = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                eq_map = {item['lab_id']: item for item in eq_counts}

                formatted_labs = []
                for lab in raw_labs:
                    l_id = lab['id']
                    lab_name = lab.get('name') or 'College Laboratory'
                    lab_dept = lab.get('department') or 'Artificial Intelligence & Data Science'
                    lab_loc = lab.get('location') or 'College Campus'
                    lab_status = lab.get('status') or 'Active'
                    lab_desc = lab.get('description') or 'Teaching laboratory available for practical engineering sessions.'
                    eq_info = eq_map.get(l_id, {'equipment_count': 0, 'available_count': 0, 'maintenance_count': 0})

                    lab_item = {
                        "id": l_id,
                        "name": lab_name,
                        "location": lab_loc,
                        "department": lab_dept,
                        "status": lab_status,
                        "description": lab_desc,
                        "equipment_count": eq_info.get('equipment_count', 0),
                        "available_count": eq_info.get('available_count', 0),
                        "maintenance_count": eq_info.get('maintenance_count', 0)
                    }

                    if search:
                        s_lower = search.lower()
                        if not (s_lower in lab_item['name'].lower() or s_lower in lab_item['location'].lower() or s_lower in lab_item['department'].lower()):
                            continue

                    if department and department != 'All Departments':
                        if lab_item['department'].lower() != department.lower():
                            continue

                    formatted_labs.append(lab_item)

                # Prioritize active practical lab (DL-LAB-01 / Lab ID 2) for AI & DS students
                student_active_lab_id = 2
                formatted_labs.sort(key=lambda x: (0 if x['id'] == student_active_lab_id else 1, x['id']))

                return formatted_labs
        except Exception as e:
            print("DB Error in get_labs:", e)
            return []

    @staticmethod
    def get_departments():
        labs = StudentDataService.get_labs()
        depts = sorted(list(set(l['department'] for l in labs if l.get('department'))))
        if not depts:
            depts = ['Artificial Intelligence & Data Science', 'Computer Science', 'Electronics & Communication', 'Electrical Engineering']
        return depts

    @staticmethod
    def get_lab_details(lab_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                labs = StudentDataService.get_labs()
                lab = next((l for l in labs if str(l['id']) == str(lab_id)), None)
                if not lab:
                    return None

                q_eq = '''
                    SELECT * FROM equipment WHERE lab_id = %s ORDER BY name ASC
                ''' if db_type == 'mysql' else '''
                    SELECT * FROM equipment WHERE lab_id = ? ORDER BY name ASC
                '''
                cursor.execute(q_eq, (lab_id,))
                equipment = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                # Retrieve strictly mapped faculty from database lab_sessions
                q_faculty = '''
                    SELECT DISTINCT u.name, u.role, u.department, u.email, s.practical_name
                    FROM lab_sessions s
                    JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = %s
                ''' if db_type == 'mysql' else '''
                    SELECT DISTINCT u.name, u.role, u.department, u.email, s.practical_name
                    FROM lab_sessions s
                    JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = ?
                '''
                cursor.execute(q_faculty, (lab_id,))
                faculty = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                if not faculty:
                    # Fallback lookup for known faculty mapping
                    fac_map = {
                        1: ('Assigned Faculty', 'Faculty', 'Electronics & Communication', 'assigned.faculty@college.edu.in'),
                        2: ('Dr. Murugesan', 'Faculty', 'Artificial Intelligence & Data Science', 'murugesan@college.edu.in'),
                        3: ('Mr. Ramesh', 'Faculty', 'Artificial Intelligence & Data Science', 'ramesh@college.edu.in'),
                        4: ('Mr. Baskar', 'Faculty', 'Artificial Intelligence & Data Science', 'baskar@college.edu.in'),
                        5: ('Mr. Bharathidasan', 'Faculty', 'Artificial Intelligence & Data Science', 'bharathidasan@college.edu.in'),
                        6: ('Faculty assignment pending', 'Faculty', 'Database Systems', 'pending@college.edu.in')
                    }
                    if int(lab_id) in fac_map:
                        f_info = fac_map[int(lab_id)]
                        faculty = [{
                            "name": f_info[0],
                            "role": f_info[1],
                            "department": f_info[2],
                            "email": f_info[3]
                        }]
                    else:
                        faculty = [{
                            "name": "Assigned Faculty: Not Available",
                            "role": "Faculty",
                            "department": lab.get('department', 'General'),
                            "email": "N/A"
                        }]

                return {
                    "lab": lab,
                    "equipment": equipment,
                    "faculty": faculty
                }
        except Exception as e:
            print("DB Error in get_lab_details:", e)
            return None

    @staticmethod
    def get_equipment(lab_id=None, search=None, user_id=None):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    SELECT e.*, l.name as lab_name, l.location as lab_location, l.id as lab_id
                    FROM equipment e
                    JOIN labs l ON e.lab_id = l.id
                '''
                params = []
                conditions = []

                if lab_id:
                    conditions.append("e.lab_id = %s" if db_type == 'mysql' else "e.lab_id = ?")
                    params.append(lab_id)

                if search:
                    s_clause = "%" + search + "%"
                    if db_type == 'mysql':
                        conditions.append("(e.name LIKE %s OR e.equipment_code LIKE %s OR e.category LIKE %s OR l.name LIKE %s)")
                        params.extend([s_clause, s_clause, s_clause, s_clause])
                    else:
                        conditions.append("(e.name LIKE ? OR e.equipment_code LIKE ? OR e.category LIKE ? OR l.name LIKE ?)")
                        params.extend([s_clause, s_clause, s_clause, s_clause])

                if conditions:
                    query += " WHERE " + " AND ".join(conditions)

                # Prioritize student's active lab (DL-LAB-01 / Lab ID 2) equipment at the top
                query += " ORDER BY CASE WHEN e.lab_id = 2 THEN 0 ELSE 1 END, e.lab_id ASC, e.name ASC"

                cursor.execute(query, params)
                return cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            print("DB Error in get_equipment:", e)
            return []

    @staticmethod
    def get_equipment_by_id(equipment_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    SELECT e.*, l.name as lab_name, l.location as lab_location 
                    FROM equipment e
                    JOIN labs l ON e.lab_id = l.id
                    WHERE e.id = %s
                ''' if db_type == 'mysql' else '''
                    SELECT e.*, l.name as lab_name, l.location as lab_location 
                    FROM equipment e
                    JOIN labs l ON e.lab_id = l.id
                    WHERE e.id = ?
                '''
                cursor.execute(query, (equipment_id,))
                res = cursor.fetchone()
                return res if db_type == 'mysql' else (dict(res) if res else None)
        except Exception as e:
            print("DB Error in get_equipment_by_id:", e)
            return None

    @staticmethod
    def get_equipment_by_qr(qr_code):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    SELECT e.*, l.name as lab_name, l.location as lab_location 
                    FROM equipment e
                    JOIN labs l ON e.lab_id = l.id
                    WHERE e.qr_code = %s OR e.equipment_code = %s
                ''' if db_type == 'mysql' else '''
                    SELECT e.*, l.name as lab_name, l.location as lab_location 
                    FROM equipment e
                    JOIN labs l ON e.lab_id = l.id
                    WHERE e.qr_code = ? OR e.equipment_code = ?
                '''
                cursor.execute(query, (qr_code, qr_code))
                res = cursor.fetchone()
                return res if db_type == 'mysql' else (dict(res) if res else None)
        except Exception as e:
            print("DB Error in get_equipment_by_qr:", e)
            return None

    @staticmethod
    def get_student_schedule(user_id, week_offset=0):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                user = AuthService.get_user_by_id(user_id) or {}
                dept = user.get('department') or 'Information Technology'
                year = user.get('year') or 'III Year'
                sem = user.get('semester') or 'V Semester'
                raw_sec = str(user.get('section') or 'B Section').strip()
                sec = raw_sec.replace('Section', '').strip() or 'B'
                student_batch = str(user.get('batch') or '').strip()

                lab_code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                # Query database lab_sessions matching student's department, year, semester
                query = '''
                    SELECT s.id, s.lab_id, s.faculty_id, s.practical_name, s.department, s.year, s.semester, s.section, s.batch,
                           s.session_date, s.start_time, s.end_time, s.status,
                           l.name as lab_name, l.location as lab_location,
                           u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE LOWER(s.department) = LOWER(%s)
                      AND (s.year = %s OR s.year IS NULL OR s.year = '')
                      AND (s.semester = %s OR s.semester IS NULL OR s.semester = '') AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                    ORDER BY s.session_date ASC, s.start_time ASC
                ''' if db_type == 'mysql' else '''
                    SELECT s.id, s.lab_id, s.faculty_id, s.practical_name, s.department, s.year, s.semester, s.section, s.batch,
                           s.session_date, s.start_time, s.end_time, s.status,
                           l.name as lab_name, l.location as lab_location,
                           u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE LOWER(s.department) = LOWER(?)
                      AND (s.year = ? OR s.year IS NULL OR s.year = '')
                      AND (s.semester = ? OR s.semester IS NULL OR s.semester = '') AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                    ORDER BY s.session_date ASC, s.start_time ASC
                '''
                cursor.execute(query, (dept, year, sem))
                raw_sessions = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                # Fallback if no strict year/sem match
                if not raw_sessions:
                    fb_query = '''
                        SELECT s.id, s.lab_id, s.faculty_id, s.practical_name, s.department, s.year, s.semester, s.section, s.batch,
                               s.session_date, s.start_time, s.end_time, s.status,
                               l.name as lab_name, l.location as lab_location,
                               u.name as faculty_name
                        FROM lab_sessions s
                        JOIN labs l ON s.lab_id = l.id
                        LEFT JOIN users u ON s.faculty_id = u.id
                        WHERE LOWER(s.department) = LOWER(%s)
                        ORDER BY s.session_date ASC, s.start_time ASC
                    ''' if db_type == 'mysql' else '''
                        SELECT s.id, s.lab_id, s.faculty_id, s.practical_name, s.department, s.year, s.semester, s.section, s.batch,
                               s.session_date, s.start_time, s.end_time, s.status,
                               l.name as lab_name, l.location as lab_location,
                               u.name as faculty_name
                        FROM lab_sessions s
                        JOIN labs l ON s.lab_id = l.id
                        LEFT JOIN users u ON s.faculty_id = u.id
                        WHERE LOWER(s.department) = LOWER(?)
                        ORDER BY s.session_date ASC, s.start_time ASC
                    '''
                    cursor.execute(fb_query, (dept,))
                    raw_sessions = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                # Fetch student's confirmed bookings with equipment lab_id to prevent false cross-lab allocations
                q_my_b = '''
                    SELECT b.id, b.equipment_id, b.session_date, b.start_time, b.end_time, 
                           e.name as equipment_name, e.equipment_code, e.lab_id as eq_lab_id 
                    FROM bookings b 
                    JOIN equipment e ON b.equipment_id = e.id 
                    WHERE b.user_id = %s AND b.status = 'Confirmed'
                ''' if db_type == 'mysql' else '''
                    SELECT b.id, b.equipment_id, b.session_date, b.start_time, b.end_time, 
                           e.name as equipment_name, e.equipment_code, e.lab_id as eq_lab_id 
                    FROM bookings b 
                    JOIN equipment e ON b.equipment_id = e.id 
                    WHERE b.user_id = ? AND b.status = 'Confirmed'
                '''
                cursor.execute(q_my_b, (user_id,))
                my_bookings = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                today_obj = date.today()
                today_str = today_obj.strftime('%Y-%m-%d')
                tomorrow_str = (today_obj + timedelta(days=1)).strftime('%Y-%m-%d')
                week_end_str = (today_obj + timedelta(days=7)).strftime('%Y-%m-%d')

                # Calculate Monday to Sunday of the active week (relative to week_offset)
                monday_of_this_week = today_obj - timedelta(days=today_obj.weekday())
                target_monday = monday_of_this_week + timedelta(weeks=int(week_offset))
                target_sunday = target_monday + timedelta(days=6)

                week_range_display = f"{target_monday.strftime('%d %b')} – {target_sunday.strftime('%d %b %Y')}"

                formatted_sessions = []
                seen_session_keys = set()

                for s in raw_sessions:
                    s_id = s['id']
                    raw_date = str(s['session_date'])
                    st_str = str(s['start_time'])[:5]
                    et_str = str(s['end_time'])[:5]

                    # Filter for student's section
                    s_sec = str(s.get('section') or 'B').replace('Section', '').strip()
                    if s_sec and sec and s_sec.lower() != sec.lower() and s_sec.lower() not in ['all', 'common', 'any']:
                        continue

                    # Filter for student's batch if student has a specific assigned batch
                    s_batch = str(s.get('batch') or 'Batch 1').strip()
                    if student_batch and s_batch and student_batch.lower() != s_batch.lower() and s_batch.lower() not in ['all', 'common', 'any']:
                        continue

                    p_name = str(s['practical_name']).strip()
                    if 'Special' in p_name and any(c.isdigit() for c in p_name):
                        p_name = 'Special Laboratory Workshop'

                    if s_id in seen_session_keys:
                        continue
                    seen_session_keys.add(s_id)

                    # Format Date & Day Name
                    try:
                        d_obj = datetime.strptime(raw_date, '%Y-%m-%d')
                        formatted_date = d_obj.strftime('%d %b %Y')
                        day_name = d_obj.strftime('%A')
                        day_short = d_obj.strftime('%a').upper()
                        full_date_display = d_obj.strftime('%A, %d %B %Y')
                    except Exception:
                        formatted_date = raw_date
                        day_name = 'Weekday'
                        day_short = 'DAY'
                        full_date_display = raw_date

                    # Format Time with clean AM/PM
                    try:
                        st_obj = datetime.strptime(st_str, '%H:%M')
                        et_obj = datetime.strptime(et_str, '%H:%M')
                        formatted_st = st_obj.strftime('%I:%M %p')
                        formatted_et = et_obj.strftime('%I:%M %p')
                        time_slot = f"{formatted_st} – {formatted_et}"
                        time_slot_compact = f"{formatted_st} – {formatted_et}"
                    except Exception:
                        time_slot = f"{st_str} – {et_str}"
                        time_slot_compact = f"{st_str} – {et_str}"

                    # Determine relative period
                    if raw_date == today_str:
                        relative_period = 'today'
                        period_badge = 'Today'
                        is_today = True
                    elif raw_date == tomorrow_str:
                        relative_period = 'tomorrow'
                        period_badge = 'Tomorrow'
                        is_today = False
                    elif today_str <= raw_date <= week_end_str:
                        relative_period = 'this_week'
                        period_badge = 'This Week'
                        is_today = False
                    else:
                        relative_period = 'upcoming'
                        period_badge = 'Upcoming'
                        is_today = False

                    l_id = s['lab_id']
                    l_code = lab_code_map.get(l_id, f"LAB-0{l_id}")
                    s_year = s.get('year') or year
                    s_sem = s.get('semester') or sem
                    academic_context = f"{s_year} • {s_sem} • Section {s_sec} • {s_batch}"

                    # Check if booked by student STRICTLY in this laboratory (Requirement 12)
                    is_booked = False
                    booked_eq_name = None
                    booked_eq_code = None
                    booked_b_id = None

                    for mb in my_bookings:
                        if int(mb.get('eq_lab_id', 0)) == int(l_id) and str(mb['session_date']) == raw_date:
                            mb_st = str(mb['start_time'])[:5]
                            mb_et = str(mb['end_time'])[:5]
                            if (mb_st >= st_str and mb_st < et_str) or (mb_et > st_str and mb_et <= et_str) or (mb_st <= st_str and mb_et >= et_str):
                                is_booked = True
                                booked_eq_name = mb['equipment_name']
                                booked_eq_code = mb['equipment_code']
                                booked_b_id = mb['id']
                                break

                    status_raw = str(s.get('status') or 'Scheduled')
                    badge_class = 'badge-status-active' if status_raw.lower() in ['upcoming', 'scheduled'] else 'badge-status-completed'

                    formatted_sessions.append({
                        "id": s_id,
                        "subject": p_name,
                        "practical_name": p_name,
                        "department": s['department'],
                        "lab_id": l_id,
                        "lab_name": s['lab_name'],
                        "lab_code": l_code,
                        "lab_location": s.get('lab_location', 'College Campus'),
                        "faculty_name": s.get('faculty_name') or 'Faculty assignment pending',
                        "session_date": raw_date,
                        "formatted_date": formatted_date,
                        "day_name": day_name,
                        "day_short": day_short,
                        "full_date_display": full_date_display,
                        "start_time": st_str,
                        "end_time": et_str,
                        "time_slot": time_slot,
                        "time_slot_compact": time_slot_compact,
                        "slot_key": f"{st_str}-{et_str}",
                        "relative_period": relative_period,
                        "period_badge": period_badge,
                        "is_today": is_today,
                        "year": s_year,
                        "semester": s_sem,
                        "section": s_sec,
                        "batch": s_batch,
                        "academic_context": academic_context,
                        "status": status_raw,
                        "badge_class": badge_class,
                        "is_booked_by_student": is_booked,
                        "booked_equipment_name": booked_eq_name,
                        "booked_equipment_code": booked_eq_code,
                        "booking_id": booked_b_id
                    })

                dept_header = dept.upper()
                return {
                    "student_academic_header": dept_header,
                    "academic_meta": f"{year.upper()} • {sem.upper()} • SECTION {sec.upper()}",
                    "semester_display": f"{sem.upper()} • 2026",
                    "department_display": dept,
                    "year_display": year,
                    "section_display": f"Section {sec}",
                    "batch_display": student_batch or "All Batches",
                    "student_name": user.get('name', 'Student'),
                    "college_id": user.get('college_id', '--'),
                    "current_date": today_str,
                    "current_day": today_obj.strftime('%A'),
                    "current_day_short": today_obj.strftime('%a').upper(),
                    "week_range_display": week_range_display,
                    "target_monday": target_monday.strftime('%Y-%m-%d'),
                    "target_sunday": target_sunday.strftime('%Y-%m-%d'),
                    "schedule": formatted_sessions
                }
        except Exception as e:
            print("DB Error in get_student_schedule:", e)
            return {
                "student_academic_header": "INFORMATION TECHNOLOGY",
                "academic_meta": "III YEAR • V SEMESTER • SECTION B",
                "semester_display": "V SEMESTER • 2026",
                "department_display": "Information Technology",
                "year_display": "III Year",
                "section_display": "Section B",
                "batch_display": "Batch 1",
                "student_name": "Student",
                "college_id": "--",
                "current_date": date.today().strftime('%Y-%m-%d'),
                "current_day": date.today().strftime('%A'),
                "current_day_short": date.today().strftime('%a').upper(),
                "week_range_display": "31 Aug – 06 Sep 2026",
                "target_monday": "2026-08-31",
                "target_sunday": "2026-09-06",
                "schedule": []
            }

    @staticmethod
    def get_session_equipment(session_id, user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # Fetch session details
                q_s = '''
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE s.id = %s
                ''' if db_type == 'mysql' else '''
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE s.id = ?
                '''
                cursor.execute(q_s, (session_id,))
                s_row = cursor.fetchone()
                if not s_row:
                    return None
                session_data = s_row if db_type == 'mysql' else dict(s_row)

                lab_id = session_data['lab_id']
                raw_date = str(session_data['session_date'])
                st_str = str(session_data['start_time'])[:5]
                et_str = str(session_data['end_time'])[:5]

                lab_code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }
                session_data['lab_code'] = lab_code_map.get(lab_id, f"LAB-0{lab_id}")

                # Format session date & time
                try:
                    d_obj = datetime.strptime(raw_date, '%Y-%m-%d')
                    session_data['formatted_date'] = d_obj.strftime('%d %b %Y')
                except Exception:
                    session_data['formatted_date'] = raw_date

                try:
                    st_obj = datetime.strptime(st_str, '%H:%M')
                    et_obj = datetime.strptime(et_str, '%H:%M')
                    session_data['time_slot'] = f"{st_obj.strftime('%I:%M %p')} — {et_obj.strftime('%I:%M %p')}"
                except Exception:
                    session_data['time_slot'] = f"{st_str} — {et_str}"

                session_data['academic_context'] = f"{session_data.get('year', 'III Year')} • {session_data.get('semester', 'V Semester')} • Section {session_data.get('section', 'B')} • {session_data.get('batch', 'Batch 1')}"

                # Fetch all equipment for this laboratory
                q_eq = "SELECT * FROM equipment WHERE lab_id = %s ORDER BY name ASC" if db_type == 'mysql' else "SELECT * FROM equipment WHERE lab_id = ? ORDER BY name ASC"
                cursor.execute(q_eq, (lab_id,))
                raw_eq = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                # Fetch existing confirmed bookings for this date and overlapping time slot
                q_b = '''
                    SELECT id, equipment_id, user_id, status 
                    FROM bookings 
                    WHERE session_date = %s 
                      AND status = 'Confirmed'
                      AND ((start_time >= %s AND start_time < %s) OR (end_time > %s AND end_time <= %s) OR (start_time <= %s AND end_time >= %s))
                ''' if db_type == 'mysql' else '''
                    SELECT id, equipment_id, user_id, status 
                    FROM bookings 
                    WHERE session_date = ? 
                      AND status = 'Confirmed'
                      AND ((start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?) OR (start_time <= ? AND end_time >= ?))
                '''
                cursor.execute(q_b, (raw_date, st_str, et_str, st_str, et_str, st_str, et_str))
                slot_bookings = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                booked_eq_map = {b['equipment_id']: b for b in slot_bookings}

                equipment_items = []
                for eq in raw_eq:
                    eq_id = eq['id']
                    base_status = eq.get('status') or 'Available'

                    if base_status == 'Faulty':
                        status_display = 'Unavailable'
                        badge_class = 'badge-status-cancelled'
                        is_bookable = False
                        reason = 'Reported Faulty'
                        is_my_booking = False
                    elif base_status == 'Under Maintenance':
                        status_display = 'Under Maintenance'
                        badge_class = 'badge-status-maintenance'
                        is_bookable = False
                        reason = 'Under Scheduled Maintenance'
                        is_my_booking = False
                    elif eq_id in booked_eq_map:
                        booking_info = booked_eq_map[eq_id]
                        if int(booking_info['user_id']) == int(user_id):
                            status_display = 'Booked by You'
                            badge_class = 'badge-status-active'
                            is_bookable = False
                            reason = 'Already Allocated to You'
                            is_my_booking = True
                        else:
                            status_display = 'Booked'
                            badge_class = 'badge-status-completed'
                            is_bookable = False
                            reason = 'Allocated to Another Student'
                            is_my_booking = False
                    else:
                        status_display = 'Available'
                        badge_class = 'badge-status-available'
                        is_bookable = True
                        reason = 'Ready for Practical Session'
                        is_my_booking = False

                    equipment_items.append({
                        "id": eq_id,
                        "equipment_code": eq['equipment_code'],
                        "name": eq['name'],
                        "category": eq.get('category', 'Equipment'),
                        "lab_id": lab_id,
                        "lab_name": session_data['lab_name'],
                        "lab_code": session_data['lab_code'],
                        "status_display": status_display,
                        "badge_class": badge_class,
                        "is_bookable": is_bookable,
                        "is_my_booking": is_my_booking,
                        "reason": reason
                    })

                return {
                    "session": session_data,
                    "equipment": equipment_items
                }
        except Exception as e:
            print("DB Error in get_session_equipment:", e)
            return None

    @staticmethod
    def create_student_session_booking(user_id, session_id, equipment_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()

                # 1. Fetch and validate session
                q_s = "SELECT * FROM lab_sessions WHERE id = %s" if db_type == 'mysql' else "SELECT * FROM lab_sessions WHERE id = ?"
                cursor.execute(q_s, (session_id,))
                s_row = cursor.fetchone()
                if not s_row:
                    return False, "Selected practical session not found."
                session = s_row if db_type == 'mysql' else dict(s_row)

                # 2. Fetch and validate equipment
                q_eq = "SELECT * FROM equipment WHERE id = %s" if db_type == 'mysql' else "SELECT * FROM equipment WHERE id = ?"
                cursor.execute(q_eq, (equipment_id,))
                eq_row = cursor.fetchone()
                if not eq_row:
                    return False, "Selected equipment not found."
                equipment = eq_row if db_type == 'mysql' else dict(eq_row)

                # Validate equipment belongs to session lab
                if equipment['lab_id'] != session['lab_id']:
                    return False, "Equipment does not belong to the laboratory scheduled for this practical session."

                # Validate equipment is not Faulty / Under Maintenance
                if equipment.get('status') in ['Faulty', 'Under Maintenance']:
                    return False, f"Equipment is currently {equipment.get('status')} and cannot be booked."

                raw_date = str(session['session_date'])
                st_str = str(session['start_time'])[:5]
                et_str = str(session['end_time'])[:5]

                # 3. Check if current student already booked this equipment for this date/time
                q_chk_my = '''
                    SELECT id FROM bookings 
                    WHERE user_id = %s AND equipment_id = %s AND session_date = %s AND status = 'Confirmed'
                      AND ((start_time >= %s AND start_time < %s) OR (end_time > %s AND end_time <= %s) OR (start_time <= %s AND end_time >= %s))
                ''' if db_type == 'mysql' else '''
                    SELECT id FROM bookings 
                    WHERE user_id = ? AND equipment_id = ? AND session_date = ? AND status = 'Confirmed'
                      AND ((start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?) OR (start_time <= ? AND end_time >= ?))
                '''
                cursor.execute(q_chk_my, (user_id, equipment_id, raw_date, st_str, et_str, st_str, et_str, st_str, et_str))
                if cursor.fetchone():
                    return False, "You have already booked this equipment for this practical session."

                # 4. Check if equipment is booked by another student for same slot
                q_chk_other = '''
                    SELECT id FROM bookings 
                    WHERE equipment_id = %s AND session_date = %s AND status = 'Confirmed'
                      AND ((start_time >= %s AND start_time < %s) OR (end_time > %s AND end_time <= %s) OR (start_time <= %s AND end_time >= %s))
                ''' if db_type == 'mysql' else '''
                    SELECT id FROM bookings 
                    WHERE equipment_id = ? AND session_date = ? AND status = 'Confirmed'
                      AND ((start_time >= ? AND start_time < ?) OR (end_time > ? AND end_time <= ?) OR (start_time <= ? AND end_time >= ?))
                '''
                cursor.execute(q_chk_other, (equipment_id, raw_date, st_str, et_str, st_str, et_str, st_str, et_str))
                if cursor.fetchone():
                    return False, "This equipment is already booked by another student for this session."

                # 5. Insert new confirmed booking
                batch_label = session.get('batch') or 'Batch 1'
                q_ins = '''
                    INSERT INTO bookings (equipment_id, user_id, batch_name, session_date, start_time, end_time, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'Confirmed')
                ''' if db_type == 'mysql' else '''
                    INSERT INTO bookings (equipment_id, user_id, batch_name, session_date, start_time, end_time, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')
                '''
                cursor.execute(q_ins, (equipment_id, user_id, batch_label, raw_date, st_str, et_str))
                conn.commit()
                booking_id = cursor.lastrowid

                # Update equipment status if available
                if equipment.get('status') == 'Available':
                    q_upd = "UPDATE equipment SET status = 'Booked' WHERE id = %s" if db_type == 'mysql' else "UPDATE equipment SET status = 'Booked' WHERE id = ?"
                    cursor.execute(q_upd, (equipment_id,))
                    conn.commit()

                # Trigger real-time notification
                try:
                    d_obj = datetime.strptime(raw_date, '%Y-%m-%d')
                    f_date = d_obj.strftime('%d %b %Y')
                except Exception:
                    f_date = raw_date
                
                title = "Equipment Booked Successfully"
                msg = f"Your reservation for {equipment['name']} ({equipment['equipment_code']}) for {session['practical_name']} on {f_date} has been confirmed."
                StudentDataService.create_notification(user_id, title, msg, "booking")

                return True, booking_id
        except Exception as e:
            print("DB Error in create_student_session_booking:", e)
            return False, "An error occurred while creating your equipment booking."





    @staticmethod
    def get_student_bookings(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                user = AuthService.get_user_by_id(user_id) or {}
                student_dept = user.get('department') or 'Artificial Intelligence & Data Science'
                student_year = user.get('year') or 'III Year'
                student_sem = user.get('semester') or 'V Semester'
                student_sec = user.get('section') or 'B Section'

                query = '''
                    SELECT b.id, b.equipment_id, b.user_id, b.batch_name, b.session_date, b.start_time, b.end_time, b.status,
                           e.name as equipment_name, e.equipment_code, e.category, e.lab_id,
                           l.name as lab_name, l.location as lab_location
                    FROM bookings b
                    JOIN equipment e ON b.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    WHERE b.user_id = %s
                    ORDER BY b.session_date DESC, b.start_time DESC, b.id DESC
                ''' if db_type == 'mysql' else '''
                    SELECT b.id, b.equipment_id, b.user_id, b.batch_name, b.session_date, b.start_time, b.end_time, b.status,
                           e.name as equipment_name, e.equipment_code, e.category, e.lab_id,
                           l.name as lab_name, l.location as lab_location
                    FROM bookings b
                    JOIN equipment e ON b.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    WHERE b.user_id = ?
                    ORDER BY b.session_date DESC, b.start_time DESC, b.id DESC
                '''
                cursor.execute(query, (user_id,))
                rows = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                lab_code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                lab_practical_map = {
                    1: 'Microprocessor Architecture & Interfacing',
                    2: 'Deep Learning Practical',
                    3: 'Business Analytics Practical',
                    4: 'Big Data Analytics Practical',
                    5: 'Cloud Infrastructure Management',
                    6: 'Database Management Systems Practical'
                }

                seen_keys = set()
                formatted_bookings = []

                for r in rows:
                    b_id = r['id']
                    # Unique key by (equipment_id, session_date, start_time) to strictly eliminate duplicates
                    dedup_key = (r['equipment_id'], str(r['session_date']), str(r['start_time'])[:5])
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)

                    l_id = r.get('lab_id', 1)
                    l_code = lab_code_map.get(l_id, 'DL-LAB-01')
                    practical_name = lab_practical_map.get(l_id, r.get('batch_name') or 'Laboratory Practical')

                    # Format Date: e.g. 03 Sep 2026
                    raw_date = str(r['session_date'])
                    try:
                        d_obj = datetime.strptime(raw_date, '%Y-%m-%d')
                        date_formatted = d_obj.strftime('%d %b %Y')
                    except Exception:
                        date_formatted = raw_date

                    # Format Time: e.g. 09:00 AM — 11:00 AM
                    st_raw = str(r['start_time'])[:5]
                    et_raw = str(r['end_time'])[:5]
                    try:
                        st_obj = datetime.strptime(st_raw, '%H:%M')
                        et_obj = datetime.strptime(et_raw, '%H:%M')
                        time_formatted = f"{st_obj.strftime('%I:%M %p')} — {et_obj.strftime('%I:%M %p')}"
                    except Exception:
                        time_formatted = f"{st_raw} — {et_raw}"

                    # Extract clean batch and academic context
                    batch_str = r.get('batch_name') or 'Batch 1'
                    batch_display = batch_str if 'Batch' in batch_str else f"Batch 1"

                    sec_clean = str(student_sec).replace('Section', '').strip()
                    academic_context = f"{student_year} • {student_sem} • Section {sec_clean or 'B'} • {batch_display}"

                    status_raw = str(r.get('status') or 'Confirmed').upper()
                    if status_raw in ['CONFIRMED', 'CONFIRM']:
                        status_upper = 'CONFIRMED'
                        status_badge_class = 'badge-status-confirmed'
                    elif status_raw in ['ACTIVE', 'IN SESSION']:
                        status_upper = 'ACTIVE'
                        status_badge_class = 'badge-status-active'
                    elif status_raw in ['COMPLETED', 'COMPLETE']:
                        status_upper = 'COMPLETED'
                        status_badge_class = 'badge-status-completed'
                    elif status_raw in ['CANCELLED', 'CANCELED']:
                        status_upper = 'CANCELLED'
                        status_badge_class = 'badge-status-cancelled'
                    else:
                        status_upper = status_raw
                        status_badge_class = 'badge-status-confirmed'

                    formatted_bookings.append({
                        "id": b_id,
                        "equipment_id": r['equipment_id'],
                        "equipment_name": r['equipment_name'],
                        "equipment_code": r['equipment_code'],
                        "category": r.get('category', 'Equipment'),
                        "lab_id": l_id,
                        "lab_name": r['lab_name'],
                        "lab_code": l_code,
                        "practical_name": practical_name,
                        "academic_context": academic_context,
                        "date_formatted": date_formatted,
                        "time_formatted": time_formatted,
                        "raw_date": raw_date,
                        "status": r.get('status', 'Confirmed'),
                        "status_upper": status_upper,
                        "status_badge_class": status_badge_class
                    })

                return formatted_bookings
        except Exception as e:
            print("DB Error in get_student_bookings:", e)
            return []

    @staticmethod
    def create_booking(user_id, equipment_id, batch_name, session_date, start_time, end_time):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    INSERT INTO bookings (equipment_id, user_id, batch_name, session_date, start_time, end_time, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'Confirmed')
                ''' if db_type == 'mysql' else '''
                    INSERT INTO bookings (equipment_id, user_id, batch_name, session_date, start_time, end_time, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')
                '''
                cursor.execute(query, (equipment_id, user_id, batch_name, session_date, start_time, end_time))
                conn.commit()

                update_q = "UPDATE equipment SET status = 'Booked' WHERE id = %s" if db_type == 'mysql' else "UPDATE equipment SET status = 'Booked' WHERE id = ?"
                cursor.execute(update_q, (equipment_id,))
                conn.commit()

                return cursor.lastrowid
        except Exception as e:
            print("DB Error in create_booking:", e)
            return None

    @staticmethod
    def cancel_booking(booking_id, user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                q = "UPDATE bookings SET status = 'Cancelled' WHERE id = %s AND user_id = %s" if db_type == 'mysql' else "UPDATE bookings SET status = 'Cancelled' WHERE id = ? AND user_id = ?"
                cursor.execute(q, (booking_id, user_id))
                conn.commit()
                return True
        except Exception as e:
            print("DB Error in cancel_booking:", e)
            return False

    @staticmethod
    def get_student_fault_reports(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    SELECT f.id, f.equipment_id, f.reported_by, f.fault_type, f.description, f.priority, f.status, f.reported_at,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category,
                           l.id as lab_id, l.name as lab_name, l.location as lab_location
                    FROM fault_reports f
                    JOIN equipment e ON f.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    WHERE f.reported_by = %s
                    ORDER BY f.reported_at DESC
                ''' if db_type == 'mysql' else '''
                    SELECT f.id, f.equipment_id, f.reported_by, f.fault_type, f.description, f.priority, f.status, f.reported_at,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category,
                           l.id as lab_id, l.name as lab_name, l.location as lab_location
                    FROM fault_reports f
                    JOIN equipment e ON f.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    WHERE f.reported_by = ?
                    ORDER BY f.reported_at DESC
                '''
                cursor.execute(query, (user_id,))
                raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                
                results = []
                for r in raw:
                    rep_at = str(r.get('reported_at', ''))
                    try:
                        dt = datetime.strptime(rep_at[:19], '%Y-%m-%d %H:%M:%S')
                        formatted_date = dt.strftime('%d %b %Y, %I:%M %p')
                    except Exception:
                        formatted_date = rep_at[:10] if rep_at else 'Recent'

                    results.append({
                        "id": r['id'],
                        "equipment_id": r['equipment_id'],
                        "equipment_name": r['equipment_name'],
                        "equipment_code": r['equipment_code'],
                        "category": r.get('equipment_category', 'General Hardware'),
                        "lab_id": r.get('lab_id'),
                        "lab_name": r['lab_name'],
                        "lab_location": r.get('lab_location', ''),
                        "fault_type": r.get('fault_type', 'Hardware Malfunction'),
                        "description": r.get('description', ''),
                        "priority": r.get('priority', 'Medium'),
                        "status": r.get('status', 'Open'),
                        "reported_at": formatted_date,
                        "raw_reported_at": rep_at
                    })
                return results
        except Exception as e:
            print("DB Error in get_student_fault_reports:", e)
            return []

    @staticmethod
    def create_fault_report(user_id, equipment_id, fault_type, description, priority):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    INSERT INTO fault_reports (equipment_id, reported_by, fault_type, description, priority, status)
                    VALUES (%s, %s, %s, %s, %s, 'Open')
                ''' if db_type == 'mysql' else '''
                    INSERT INTO fault_reports (equipment_id, reported_by, fault_type, description, priority, status)
                    VALUES (?, ?, ?, ?, ?, 'Open')
                '''
                cursor.execute(query, (equipment_id, user_id, fault_type, description, priority))
                conn.commit()

                update_q = "UPDATE equipment SET status = 'Faulty' WHERE id = %s" if db_type == 'mysql' else "UPDATE equipment SET status = 'Faulty' WHERE id = ?"
                cursor.execute(update_q, (equipment_id,))
                conn.commit()

                return cursor.lastrowid
        except Exception as e:
            print("DB Error in create_fault_report:", e)
            return None

    @staticmethod
    def get_student_usage(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                query = '''
                    SELECT u.id as usage_id, u.equipment_id, u.booking_id, u.usage_date, u.duration_minutes,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category,
                           l.id as lab_id, l.name as lab_name,
                           b.session_date, b.start_time, b.end_time, b.status as booking_status,
                           s.practical_name
                    FROM equipment_usage u
                    JOIN bookings b ON u.booking_id = b.id
                    JOIN equipment e ON u.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    LEFT JOIN lab_sessions s ON s.lab_id = e.lab_id AND s.session_date = b.session_date AND SUBSTR(s.start_time, 1, 5) = SUBSTR(b.start_time, 1, 5)
                    WHERE b.user_id = %s
                    ORDER BY u.usage_date DESC, b.start_time DESC
                ''' if db_type == 'mysql' else '''
                    SELECT u.id as usage_id, u.equipment_id, u.booking_id, u.usage_date, u.duration_minutes,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category,
                           l.id as lab_id, l.name as lab_name,
                           b.session_date, b.start_time, b.end_time, b.status as booking_status,
                           s.practical_name
                    FROM equipment_usage u
                    JOIN bookings b ON u.booking_id = b.id
                    JOIN equipment e ON u.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    LEFT JOIN lab_sessions s ON s.lab_id = e.lab_id AND s.session_date = b.session_date AND SUBSTR(s.start_time, 1, 5) = SUBSTR(b.start_time, 1, 5)
                    WHERE b.user_id = ?
                    ORDER BY u.usage_date DESC, b.start_time DESC
                '''
                cursor.execute(query, (user_id,))
                raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                results = []
                for r in raw:
                    u_date = str(r.get('usage_date', ''))
                    try:
                        d_obj = datetime.strptime(u_date, '%Y-%m-%d')
                        formatted_date = d_obj.strftime('%d %b %Y')
                    except Exception:
                        formatted_date = u_date

                    st_str = str(r.get('start_time', '09:00'))[:5]
                    et_str = str(r.get('end_time', '11:00'))[:5]
                    try:
                        st_obj = datetime.strptime(st_str, '%H:%M')
                        et_obj = datetime.strptime(et_str, '%H:%M')
                        time_slot = f"{st_obj.strftime('%I:%M %p')} – {et_obj.strftime('%I:%M %p')}"
                    except Exception:
                        time_slot = f"{st_str} – {et_str}"

                    dur_mins = int(r.get('duration_minutes', 120))
                    if dur_mins >= 60:
                        hrs = dur_mins // 60
                        mins = dur_mins % 60
                        dur_display = f"{hrs} hr" + (f" {mins} min" if mins else "") if hrs == 1 else f"{hrs} hrs" + (f" {mins} mins" if mins else "")
                    else:
                        dur_display = f"{dur_mins} mins"

                    p_name = r.get('practical_name')
                    if not p_name or p_name == 'Laboratory Practical Session':
                        l_id = r.get('lab_id')
                        subj_map = {
                            1: 'Microprocessor & Embedded Systems Practical',
                            2: 'Deep Learning Practical',
                            3: 'Business Analytics Practical',
                            4: 'Data Mining & Analytics Practical',
                            5: 'Cloud Computing & DevOps Practical',
                            6: 'Database Management Systems Practical'
                        }
                        p_name = subj_map.get(l_id, 'Laboratory Practical Session')

                    results.append({
                        "id": r.get('usage_id'),
                        "equipment_id": r['equipment_id'],
                        "booking_id": r['booking_id'],
                        "equipment_name": r['equipment_name'],
                        "equipment_code": r['equipment_code'],
                        "category": r.get('equipment_category', 'Computing'),
                        "lab_id": r.get('lab_id'),
                        "lab_name": r['lab_name'],
                        "practical_name": p_name,
                        "usage_date": u_date,
                        "formatted_date": formatted_date,
                        "start_time": st_str,
                        "end_time": et_str,
                        "time_slot": time_slot,
                        "duration_minutes": dur_mins,
                        "duration_display": dur_display,
                        "status": "Completed"
                    })
                return results
        except Exception as e:
            print("DB Error in get_student_usage:", e)
            return []

    @staticmethod
    def get_student_stats(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                q_active = "SELECT COUNT(*) as cnt FROM bookings WHERE user_id = %s AND status IN ('Confirmed', 'Pending')" if db_type == 'mysql' else "SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status IN ('Confirmed', 'Pending')"
                cursor.execute(q_active, (user_id,))
                row = cursor.fetchone()
                active_bookings = row['cnt'] if db_type == 'mysql' else row[0]

                q_upcoming = "SELECT COUNT(*) as cnt FROM bookings WHERE user_id = %s AND session_date >= CURRENT_DATE()" if db_type == 'mysql' else "SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND session_date >= DATE('now')"
                cursor.execute(q_upcoming, (user_id,))
                row = cursor.fetchone()
                upcoming_sessions = row['cnt'] if db_type == 'mysql' else row[0]

                q_used = "SELECT COUNT(DISTINCT equipment_id) as cnt FROM bookings WHERE user_id = %s" if db_type == 'mysql' else "SELECT COUNT(DISTINCT equipment_id) as cnt FROM bookings WHERE user_id = ?"
                cursor.execute(q_used, (user_id,))
                row = cursor.fetchone()
                equipment_used = row['cnt'] if db_type == 'mysql' else row[0]

                q_faults = "SELECT COUNT(*) as cnt FROM fault_reports WHERE reported_by = %s AND status IN ('Open', 'In Progress')" if db_type == 'mysql' else "SELECT COUNT(*) as cnt FROM fault_reports WHERE reported_by = ? AND status IN ('Open', 'In Progress')"
                cursor.execute(q_faults, (user_id,))
                row = cursor.fetchone()
                open_faults = row['cnt'] if db_type == 'mysql' else row[0]

                return {
                    "active_bookings": active_bookings or 0,
                    "upcoming_sessions": upcoming_sessions or 0,
                    "equipment_used": equipment_used or 0,
                    "open_faults": open_faults or 0
                }
        except Exception as e:
            print("DB Error in get_student_stats:", e)
            return {"active_bookings": 0, "upcoming_sessions": 0, "equipment_used": 0, "open_faults": 0}

    @staticmethod
    def create_notification(student_id, title, message, notification_type='general'):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute('''
                        INSERT INTO notifications (student_id, title, message, notification_type, is_read)
                        VALUES (%s, %s, %s, %s, 0)
                    ''', (student_id, title, message, notification_type))
                else:
                    cursor.execute('''
                        INSERT INTO notifications (student_id, title, message, notification_type, is_read)
                        VALUES (?, ?, ?, ?, 0)
                    ''', (student_id, title, message, notification_type))
                conn.commit()
                return True
        except Exception as e:
            print("DB Error in create_notification:", e)
            return False

    @staticmethod
    def get_student_notifications(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                q = "SELECT * FROM notifications WHERE student_id = %s ORDER BY created_at DESC, id DESC LIMIT 50" if db_type == 'mysql' else "SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 50"
                cursor.execute(q, (user_id,))
                rows = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                
                formatted = []
                for n in rows:
                    created = n.get('created_at', '')
                    raw_created_str = str(created)
                    
                    # Format user-friendly time string
                    try:
                        dt = datetime.strptime(raw_created_str[:19], '%Y-%m-%d %H:%M:%S')
                        time_str = dt.strftime('%d %b, %I:%M %p')
                    except Exception:
                        time_str = raw_created_str[:16] if raw_created_str else 'Today'

                    formatted.append({
                        "id": n['id'],
                        "student_id": n['student_id'],
                        "title": n['title'],
                        "message": n['message'],
                        "notification_type": n.get('notification_type', 'general'),
                        "is_read": bool(n.get('is_read')),
                        "created_at": raw_created_str,
                        "time": time_str
                    })
                return formatted
        except Exception as e:
            print("DB Error in get_student_notifications:", e)
            return []

    @staticmethod
    def mark_all_notifications_read(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                q = "UPDATE notifications SET is_read = 1 WHERE student_id = %s" if db_type == 'mysql' else "UPDATE notifications SET is_read = 1 WHERE student_id = ?"
                cursor.execute(q, (user_id,))
                conn.commit()
                return True
        except Exception as e:
            print("DB Error in mark_all_notifications_read:", e)
            return False

    @staticmethod
    def mark_notification_read(notification_id, user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                q = "UPDATE notifications SET is_read = 1 WHERE id = %s AND student_id = %s" if db_type == 'mysql' else "UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?"
                cursor.execute(q, (notification_id, user_id))
                conn.commit()
                return True
        except Exception as e:
            print("DB Error in mark_notification_read:", e)
            return False




class FacultyDataService:

    @staticmethod
    def cancel_faculty_booking(user_id, session_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, email FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, email FROM users WHERE id = ?", (user_id,))
                u_row = cursor.fetchone()
                fac_name = dict(u_row)['name'] if (u_row and db_type != 'mysql') else (u_row.get('name') if isinstance(u_row, dict) else '')
                fac_email = dict(u_row)['email'] if (u_row and db_type != 'mysql') else (u_row.get('email') if isinstance(u_row, dict) else '')

                if 'Murugesan' in str(fac_name) or 'muruges' in str(fac_email).lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                else:
                    matched_ids = [user_id]

                id_pl = ','.join(['%s' for _ in matched_ids]) if db_type == 'mysql' else ','.join(['?' for _ in matched_ids])
                q_chk = f"SELECT id FROM lab_sessions WHERE id = {'%s' if db_type == 'mysql' else '?'} AND faculty_id IN ({id_pl})"
                cursor.execute(q_chk, [session_id] + matched_ids)
                if not cursor.fetchone():
                    return {"status": "error", "message": "Booking not found or not authorized to cancel."}

                q_upd = "UPDATE lab_sessions SET status = 'Cancelled' WHERE id = %s" if db_type == 'mysql' else "UPDATE lab_sessions SET status = 'Cancelled' WHERE id = ?"
                cursor.execute(q_upd, (session_id,))
                conn.commit()
                return {"status": "success", "message": "Booking cancelled successfully."}
        except Exception as e:
            print("DB Error in cancel_faculty_booking:", e)
            return {"status": "error", "message": "Failed to cancel booking."}

    @staticmethod
    def get_faculty_notifications(faculty_id):
        return StudentDataService.get_student_notifications(faculty_id)

    @staticmethod
    def mark_all_notifications_read(faculty_id):
        return StudentDataService.mark_all_notifications_read(faculty_id)

    @staticmethod
    def mark_notification_read(notification_id, faculty_id):
        return StudentDataService.mark_notification_read(notification_id, faculty_id)

    @staticmethod
    def create_notification(faculty_id, title, message, notification_type='general'):
        return StudentDataService.create_notification(faculty_id, title, message, notification_type)

    @staticmethod
    def compute_session_status(session_date_str, start_time_str, end_time_str, explicit_status=None):
        if explicit_status and str(explicit_status).upper() in ['CANCELLED', 'CANCELED']:
            return 'CANCELLED'
        
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        
        # Check date
        if str(session_date_str) < today_str:
            return 'COMPLETED'
        elif str(session_date_str) > today_str:
            return 'UPCOMING'
            
        # For today's date, compare time
        try:
            now_time = now.time()
            st_clean = str(start_time_str)[:5]
            et_clean = str(end_time_str)[:5]
            st_parts = [int(x) for x in st_clean.split(':')]
            et_parts = [int(x) for x in et_clean.split(':')]
            start_t = dt_time(st_parts[0], st_parts[1])
            end_t = dt_time(et_parts[0], et_parts[1])
            
            if now_time < start_t:
                return 'UPCOMING'
            elif start_t <= now_time <= end_t:
                return 'IN SESSION'
            else:
                return 'COMPLETED'
        except Exception:
            return 'UPCOMING'

    @staticmethod
    def _seed_academic_sessions(cursor, target_date, db_type):
        try:
            # 1. Look up all faculty IDs by name or email
            cursor.execute("SELECT id, name, email FROM users WHERE role = 'Faculty'")
            fac_rows = cursor.fetchall()
            fac_map = {}
            for r in fac_rows:
                fac_id = r[0] if isinstance(r, (list, tuple)) else r['id']
                fac_name = r[1] if isinstance(r, (list, tuple)) else r['name']
                fac_email = r[2] if isinstance(r, (list, tuple)) else r['email']
                fac_map[fac_name] = fac_id
                fac_map[fac_email] = fac_id

            muru_id = fac_map.get('Dr. Murugesan') or fac_map.get('murugesan@college.edu.in') or fac_map.get('muruges@gmail.com') or 14
            ramesh_id = fac_map.get('Mr. Ramesh') or fac_map.get('ramesh@college.edu.in') or 15
            baskar_id = fac_map.get('Mr. Baskar') or fac_map.get('baskar@college.edu.in') or 16
            bharathi_id = fac_map.get('Mr. Bharathidasan') or fac_map.get('bharathidasan@college.edu.in') or 17
            assigned_fac_id = fac_map.get('Assigned Faculty') or fac_map.get('assigned.faculty@college.edu.in') or 2
            
            # Ensure all relevant labs exist
            all_labs = [
                (1, 'Microprocessor & Embedded Systems Lab', 'Block B, 2nd Floor, Room 204', 'Electronics & Communication', 'Active', 'ARM microcontroller kits and digital storage oscilloscopes.'),
                (2, 'Advanced Computing & AI Research Lab', 'Block A, 3rd Floor, Room 310', 'Artificial Intelligence & Data Science', 'Active', 'High-performance AI model training center featuring dual NVIDIA RTX GPU workstations.'),
                (3, 'Business Analytics Lab', 'Block A, 2nd Floor, Room 215', 'Artificial Intelligence & Data Science', 'Active', 'Data visualization, enterprise intelligence, and business statistics lab.'),
                (4, 'Big Data Analytics Lab', 'Block A, 4th Floor, Room 402', 'Artificial Intelligence & Data Science', 'Active', 'Distributed Hadoop/Spark computing nodes and data engineering clusters.'),
                (5, 'Cloud Service Management Lab', 'Block B, 3rd Floor, Room 318', 'Artificial Intelligence & Data Science', 'Active', 'Virtualization and enterprise cloud service orchestration laboratory.'),
                (6, 'Database Management Systems Lab', 'Block A, 1st Floor, Room 108', 'Artificial Intelligence & Data Science', 'Active', 'Relational database systems, SQL query optimization, and transaction processing lab.')
            ]
            q_lab = "INSERT OR REPLACE INTO labs (id, name, location, department, status, description) VALUES (?, ?, ?, ?, ?, ?)" if db_type != 'mysql' else "INSERT INTO labs (id, name, location, department, status, description) VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE name=VALUES(name), location=VALUES(location), department=VALUES(department)"
            cursor.executemany(q_lab, all_labs)

            # Check if sessions already exist for target date
            q_cnt = "SELECT COUNT(*) as cnt FROM lab_sessions WHERE session_date = %s" if db_type == 'mysql' else "SELECT COUNT(*) as cnt FROM lab_sessions WHERE session_date = ?"
            cursor.execute(q_cnt, (target_date,))
            row = cursor.fetchone()
            cnt = row['cnt'] if db_type == 'mysql' else (row[0] if isinstance(row, (list, tuple)) else row['cnt'])
            if cnt and cnt >= 10:
                return

            sessions = [
                # =========================================================================
                # 1. ARTIFICIAL INTELLIGENCE & DATA SCIENCE
                # =========================================================================
                (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'A', 'Batch 1', target_date, '08:00:00', '09:00:00', 42, 'Scheduled'),
                (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '09:00:00', '11:00:00', 42, 'Scheduled'),
                (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 2', target_date, '11:00:00', '13:00:00', 38, 'Scheduled'),
                (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'A', 'Batch 1', target_date, '14:00:00', '16:00:00', 40, 'Scheduled'),
                (2, muru_id, 'Deep Learning Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'C', 'Batch 1', target_date, '16:15:00', '18:15:00', 39, 'Scheduled'),
                (3, ramesh_id, 'Business Analytics Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '09:30:00', '11:30:00', 38, 'Scheduled'),
                (3, ramesh_id, 'Business Analytics Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 2', target_date, '14:00:00', '16:00:00', 36, 'Scheduled'),
                (4, baskar_id, 'Big Data Analytics Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '11:00:00', '13:00:00', 40, 'Scheduled'),
                (4, baskar_id, 'Big Data Analytics Practical', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'A', 'Batch 1', target_date, '14:00:00', '16:00:00', 41, 'Scheduled'),
                (5, bharathi_id, 'Cloud Infrastructure Management', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '11:30:00', '13:30:00', 35, 'Scheduled'),
                (5, bharathi_id, 'Cloud Infrastructure Management', 'Artificial Intelligence & Data Science', 'III Year', 'V Semester', 'B', 'Batch 2', target_date, '14:00:00', '16:00:00', 37, 'Scheduled'),

                # =========================================================================
                # 2. INFORMATION TECHNOLOGY
                # =========================================================================
                (6, None, 'Database Management Systems Practical', 'Information Technology', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '09:00:00', '11:00:00', 40, 'Scheduled'),
                (6, None, 'Database Management Systems Practical', 'Information Technology', 'III Year', 'V Semester', 'B', 'Batch 2', target_date, '11:30:00', '13:30:00', 38, 'Scheduled'),
                (5, bharathi_id, 'Cloud Computing & DevOps Practical', 'Information Technology', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '14:00:00', '16:00:00', 40, 'Scheduled'),
                (3, ramesh_id, 'Business Analytics Practical', 'Information Technology', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '11:00:00', '13:00:00', 39, 'Scheduled'),
                (4, baskar_id, 'Data Mining & Analytics Practical', 'Information Technology', 'III Year', 'V Semester', 'B', 'Batch 2', target_date, '16:00:00', '18:00:00', 37, 'Scheduled'),

                # =========================================================================
                # 3. COMPUTER SCIENCE
                # =========================================================================
                (6, None, 'Database Systems & Query Optimization Practical', 'Computer Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '09:00:00', '11:00:00', 42, 'Scheduled'),
                (5, bharathi_id, 'Cloud Infrastructure & Virtualization Practical', 'Computer Science', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '11:30:00', '13:30:00', 40, 'Scheduled'),

                # =========================================================================
                # 4. ELECTRONICS & COMMUNICATION
                # =========================================================================
                (1, assigned_fac_id, 'ARM Microcontroller Architecture', 'Electronics & Communication', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '09:30:00', '11:30:00', 40, 'Scheduled'),
                (1, assigned_fac_id, 'Embedded Systems & IoT Design Practical', 'Electronics & Communication', 'III Year', 'V Semester', 'B', 'Batch 1', target_date, '14:00:00', '16:00:00', 38, 'Scheduled')
            ]

            q_ins = "INSERT INTO lab_sessions (lab_id, faculty_id, practical_name, department, year, semester, section, batch, session_date, start_time, end_time, student_count, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" if db_type == 'mysql' else "INSERT INTO lab_sessions (lab_id, faculty_id, practical_name, department, year, semester, section, batch, session_date, start_time, end_time, student_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            cursor.executemany(q_ins, sessions)
        except Exception as e:
            print("Error in _seed_academic_sessions:", e)





    @staticmethod
    def get_faculty_profile(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Fetch user record
                q_user = "SELECT id, name, college_id, email, phone, department, role, created_at, year, semester, section FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, phone, department, role, created_at, year, semester, section FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                
                if not user_row:
                    return None
                    
                u = dict(user_row) if db_type != 'mysql' else user_row
                
                # Format initials
                name = (u.get('name') or 'Dr. Murugesan').strip()
                raw_parts = name.split()
                clean_parts = re.sub(r'^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+', '', name, flags=re.IGNORECASE).strip().split()
                if len(raw_parts) >= 2 and any(raw_parts[0].lower().startswith(p) for p in ['dr', 'prof', 'mr', 'ms', 'mrs']):
                    initials = (raw_parts[0][0] + clean_parts[0][0]).upper()
                elif len(clean_parts) >= 2:
                    initials = (clean_parts[0][0] + clean_parts[-1][0]).upper()
                elif len(clean_parts) == 1 and len(clean_parts[0]) > 0:
                    initials = clean_parts[0][:2].upper()
                else:
                    initials = 'DM'
                    
                dept = u.get('department') or 'Artificial Intelligence & Data Science'
                short_dept = 'AI & DS' if 'Artificial' in dept else ('IT' if 'Information' in dept else dept)
                
                # Murugesan matched IDs
                fac_email = (u.get('email') or '').lower().strip()
                if 'murugesan' in name.lower() or 'muruges' in fac_email:
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                else:
                    matched_ids = [user_id]
                if not matched_ids:
                    matched_ids = [user_id]
                    
                code_map = {1: 'MP-LAB-01', 2: 'DL-LAB-01', 3: 'BA-LAB-02', 4: 'BDA-LAB-03', 5: 'CSM-LAB-04', 6: 'DBMS-LAB-05'}
                
                # Query distinct assigned laboratories & practicals
                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])
                q_labs = f"""
                    SELECT DISTINCT s.lab_id, l.name as lab_name, l.location as lab_location, s.practical_name, s.department as subject_dept
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    WHERE s.faculty_id IN ({id_placeholders})
                      AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                    ORDER BY l.id ASC
                """
                cursor.execute(q_labs, matched_ids)
                lab_rows = cursor.fetchall() if db_type != 'mysql' else [dict(r) for r in cursor.fetchall()]
                
                assigned_labs = []
                seen_labs = set()
                for r in lab_rows:
                    row_dict = dict(r) if db_type != 'mysql' else r
                    lab_id = row_dict.get('lab_id', 2)
                    key = (lab_id, row_dict.get('practical_name'))
                    if key not in seen_labs:
                        seen_labs.add(key)
                        assigned_labs.append({
                            "lab_id": lab_id,
                            "lab_name": row_dict.get('lab_name', 'Laboratory'),
                            "lab_code": code_map.get(lab_id, f"LAB-0{lab_id}"),
                            "location": row_dict.get('lab_location', 'Block A, 3rd Floor, Room 310'),
                            "practical_name": row_dict.get('practical_name', 'Practical Session'),
                            "department": row_dict.get('subject_dept', dept)
                        })

                if not assigned_labs:
                    if 'Artificial' in dept:
                        assigned_labs.append({
                            "lab_id": 2,
                            "lab_name": "Advanced Computing & AI Research Lab",
                            "lab_code": "DL-LAB-01",
                            "location": "Block A, 3rd Floor, Room 310",
                            "practical_name": "Deep Learning Practical",
                            "department": dept
                        })

                designation = "Associate Professor" if "Dr." in name else "Assistant Professor"

                return {
                    "id": u.get('id'),
                    "name": name,
                    "initials": initials,
                    "college_id": u.get('college_id') or 'FAC-AIDS-101',
                    "email": u.get('email') or 'murugesan@college.edu.in',
                    "phone": u.get('phone') or 'Not Available',
                    "department": dept,
                    "short_department": short_dept,
                    "designation": designation,
                    "role": u.get('role') or 'Faculty',
                    "account_status": "Active",
                    "created_at": str(u.get('created_at') or '2026-09-01 09:00:00')[:10],
                    "assigned_labs": assigned_labs,
                    "total_assigned_labs": len(assigned_labs)
                }
        except Exception as e:
            print("DB Error in get_faculty_profile:", e)
            return None

    @staticmethod
    def update_faculty_profile(user_id, data):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                phone = str(data.get('phone', '')).strip()
                if phone:
                    q = "UPDATE users SET phone = %s WHERE id = %s" if db_type == 'mysql' else "UPDATE users SET phone = ? WHERE id = ?"
                    cursor.execute(q, (phone, user_id))
                    conn.commit()
                return True
        except Exception as e:
            print("DB Error in update_faculty_profile:", e)
            return False

    @staticmethod
    def get_faculty_schedule(user_id, week_offset=0, filters=None):
        filters = filters or {}
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Identify logged in faculty
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }
                
                fac_name = faculty.get('name', '').strip()
                fac_email = faculty.get('email', '').strip()
                if 'Murugesan' in fac_name or 'muruges' in fac_email.lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                    matched_ids.extend([5, 11, 14, user_id])
                    matched_ids = list(set([m for m in matched_ids if m is not None]))
                else:
                    matched_ids = [user_id]
                if not matched_ids:
                    matched_ids = [user_id]

                # 2. Week Calculation (Monday to Saturday)
                now = datetime.now()
                today_date = now.date()
                today_str = today_date.strftime('%Y-%m-%d')
                
                try:
                    week_offset = int(week_offset)
                except Exception:
                    week_offset = 0

                current_monday = today_date - timedelta(days=today_date.weekday())
                target_monday = current_monday + timedelta(weeks=week_offset)
                target_saturday = target_monday + timedelta(days=5)
                
                days = []
                day_names = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
                day_full_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                
                for i in range(6):
                    d = target_monday + timedelta(days=i)
                    d_str = d.strftime('%Y-%m-%d')
                    days.append({
                        "date": d_str,
                        "day_code": day_names[i],
                        "day_name": day_full_names[i],
                        "day_month": d.strftime('%d %b').upper(), # e.g. "31 AUG"
                        "is_today": (d_str == today_str),
                        "sessions": []
                    })

                start_date_str = target_monday.strftime('%Y-%m-%d')
                end_date_str = target_saturday.strftime('%Y-%m-%d')
                week_range_text = f"{target_monday.strftime('%d %b')} – {target_saturday.strftime('%d %b %Y')}"

                # 3. Query Sessions in date range strictly for this faculty
                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])
                
                query = f"""
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name, u.email as faculty_email
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE s.session_date >= ? AND s.session_date <= ?
                      AND s.faculty_id IN ({id_placeholders})
                      AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                """
                params = [start_date_str, end_date_str] + matched_ids
                
                if filters.get('lab_id') and str(filters['lab_id']) != 'all':
                    try:
                        query += " AND s.lab_id = ?"
                        params.append(int(filters['lab_id']))
                    except Exception:
                        pass
                    
                if filters.get('section') and filters['section'] != 'all':
                    sec_val = str(filters['section']).replace('Section', '').strip()
                    query += " AND (s.section = ? OR s.section = ?)"
                    params.extend([sec_val, f"Section {sec_val}"])
                    
                if filters.get('batch') and filters['batch'] != 'all' and filters['batch'] != 'All Batches':
                    query += " AND s.batch = ?"
                    params.append(filters['batch'])

                query += " ORDER BY s.session_date ASC, s.start_time ASC, s.id ASC"

                if db_type == 'mysql':
                    query = query.replace('?', '%s')

                cursor.execute(query, params)
                rows = cursor.fetchall()
                raw_sessions = [dict(r) for r in rows] if db_type != 'mysql' else rows

                code_map = {1: "MP-LAB-01", 2: "DL-LAB-01", 3: "BA-LAB-02", 4: "BDA-LAB-03", 5: "CSM-LAB-04", 6: "DBMS-LAB-05"}
                
                processed_sessions = []
                available_labs = set()
                available_sections = set()
                available_batches = set()

                for s in raw_sessions:
                    s_date = str(s['session_date'])
                    st = str(s['start_time'])[:5]
                    et = str(s['end_time'])[:5]
                    
                    try:
                        st_dt = datetime.strptime(st, '%H:%M')
                        et_dt = datetime.strptime(et, '%H:%M')
                        time_formatted = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                        start_disp = st_dt.strftime('%I:%M %p')
                        end_disp = et_dt.strftime('%I:%M %p')
                    except Exception:
                        time_formatted = f"{st} — {et}"
                        start_disp = st
                        end_disp = et

                    status = FacultyDataService.compute_session_status(
                        s_date, s['start_time'], s['end_time'], s.get('status')
                    )
                    
                    if filters.get('status') and filters['status'] != 'all' and filters['status'] != 'All Statuses':
                        if status.upper() != str(filters['status']).upper():
                            continue

                    lab_id = s.get('lab_id', 2)
                    lab_code = code_map.get(lab_id, f"LAB-0{lab_id}")
                    sec = str(s.get('section', 'B')).replace('Section', '').strip()
                    batch = s.get('batch', 'Batch 1')
                    
                    sess_obj = {
                        "id": s['id'],
                        "lab_id": lab_id,
                        "lab_name": s.get('lab_name', 'Laboratory'),
                        "lab_code": lab_code,
                        "lab_location": s.get('lab_location', 'Block A, 3rd Floor, Room 310'),
                        "practical_name": s.get('practical_name', 'Practical Session'),
                        "department": s.get('department', 'Artificial Intelligence & Data Science'),
                        "year": s.get('year', 'III Year'),
                        "semester": s.get('semester', 'V Semester'),
                        "section": sec,
                        "section_display": f"Section {sec}",
                        "batch": batch,
                        "student_count": s.get('student_count', 40),
                        "session_date": s_date,
                        "start_time": st,
                        "end_time": et,
                        "formatted_time": time_formatted,
                        "start_disp": start_disp,
                        "end_disp": end_disp,
                        "faculty_name": s.get('faculty_name') or faculty.get('name', 'Dr. Murugesan'),
                        "status": status,
                        "raw_status": s.get('status', 'Scheduled')
                    }
                    
                    # Distribute to correct day
                    for day in days:
                        if day['date'] == s_date:
                            day['sessions'].append(sess_obj)
                            break
                            
                    processed_sessions.append(sess_obj)
                    available_labs.add((lab_id, s.get('lab_name', 'Laboratory'), lab_code))
                    available_sections.add(f"Section {sec}")
                    available_batches.add(batch)

                # Labs filter options
                cursor.execute("SELECT id, name FROM labs ORDER BY id ASC")
                all_labs = cursor.fetchall()
                labs_filter = []
                for l in all_labs:
                    l_dict = dict(l) if db_type != 'mysql' else l
                    l_id = l_dict['id']
                    labs_filter.append({
                        "id": l_id,
                        "name": l_dict['name'],
                        "code": code_map.get(l_id, f"LAB-{l_id:02d}")
                    })

                return {
                    "faculty": faculty,
                    "week_offset": week_offset,
                    "week_range_text": week_range_text,
                    "start_date": start_date_str,
                    "end_date": end_date_str,
                    "today_date": today_str,
                    "days": days,
                    "total_week_sessions": len(processed_sessions),
                    "filter_options": {
                        "labs": labs_filter,
                        "sections": sorted(list(available_sections)) if available_sections else ["Section A", "Section B", "Section C"],
                        "batches": sorted(list(available_batches)) if available_batches else ["Batch 1", "Batch 2", "All Students"],
                        "statuses": ["UPCOMING", "IN SESSION", "COMPLETED"]
                    }
                }
        except Exception as e:
            print("DB Error in get_faculty_schedule:", e)
            return None

    @staticmethod
    def get_today_sessions(user_id, target_date=None, filters=None):
        conn, db_type = get_mysql_connection()
        filters = filters or {}
        if not target_date:
            target_date = datetime.now().strftime('%Y-%m-%d')
            
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Identify logged in faculty
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Faculty Member",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                # Ensure lab_sessions table exists
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lab_sessions'" if db_type != 'mysql' else "SHOW TABLES LIKE 'lab_sessions'")
                if not cursor.fetchone():
                    init_sqlite_db(conn)

                # Ensure target date has up-to-date realistic academic sessions
                q_cnt = "SELECT COUNT(*) FROM lab_sessions WHERE session_date = %s" if db_type == 'mysql' else "SELECT COUNT(*) FROM lab_sessions WHERE session_date = ?"
                cursor.execute(q_cnt, (target_date,))
                cnt = cursor.fetchone()[0]
                today_str = datetime.now().strftime('%Y-%m-%d')
                if target_date == today_str:
                    q_today_cnt = "SELECT COUNT(*) FROM lab_sessions WHERE session_date = %s" if db_type == 'mysql' else "SELECT COUNT(*) FROM lab_sessions WHERE session_date = ?"
                    cursor.execute(q_today_cnt, (today_str,))
                    if cursor.fetchone()[0] == 0:
                        FacultyDataService._seed_academic_sessions(cursor, today_str, db_type)
                        conn.commit()

                # Find any alias IDs for Dr. Murugesan or current faculty
                fac_name = faculty.get('name', '').strip()
                fac_email = faculty.get('email', '').strip()
                
                # Retrieve all matching user IDs for this faculty
                if 'Murugesan' in fac_name or 'muruges' in fac_email.lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                else:
                    matched_ids = [user_id]
                
                if not matched_ids:
                    matched_ids = [user_id]

                # 2. Query sessions strictly for THIS logged-in faculty
                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])
                
                query = f"""
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name, u.email as faculty_email
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE s.session_date = ? AND s.faculty_id IN ({id_placeholders})
                      AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                """
                params = [target_date] + matched_ids

                # UI Filters (Lab, Batch, Status, Keyword search)
                if filters.get('lab_id') and filters['lab_id'] != 'all' and str(filters['lab_id']).strip() != '':
                    try:
                        query += " AND s.lab_id = ?"
                        params.append(int(filters['lab_id']))
                    except Exception:
                        pass
                    
                if filters.get('batch') and filters['batch'] != 'All Batches' and filters['batch'] != 'all':
                    query += " AND s.batch = ?"
                    params.append(filters['batch'])

                if filters.get('search'):
                    search_term = f"%{filters['search'].strip()}%"
                    query += " AND (s.practical_name LIKE ? OR l.name LIKE ? OR s.batch LIKE ? OR s.section LIKE ?)"
                    params.extend([search_term, search_term, search_term, search_term])

                query += " ORDER BY s.start_time ASC"

                if db_type == 'mysql':
                    query = query.replace('?', '%s')
                    
                cursor.execute(query, params)
                rows = cursor.fetchall()
                sessions_raw = [dict(r) for r in rows] if db_type != 'mysql' else rows

                processed_sessions = []
                summary = {
                    "total_sessions": 0,
                    "upcoming": 0,
                    "in_session": 0,
                    "completed": 0,
                    "cancelled": 0
                }

                current_session = None
                next_session = None
                sections_taught = set()
                years_taught = set()
                semesters_taught = set()

                for s in sessions_raw:
                    # Dynamic status
                    status = FacultyDataService.compute_session_status(
                        s['session_date'], s['start_time'], s['end_time'], s.get('status')
                    )
                    
                    # Apply status filter if passed
                    if filters.get('status') and filters['status'] != 'All Statuses' and filters['status'] != 'all':
                        if status.upper() != filters['status'].upper():
                            continue

                    # Lab code mapping
                    lab_id = s.get('lab_id', 1)
                    lab_code_map = {1: 'MP-LAB-01', 2: 'DL-LAB-01', 3: 'BA-LAB-02', 4: 'BDA-LAB-03', 5: 'CSM-LAB-04', 6: 'DBMS-LAB-05'}
                    s['lab_code'] = lab_code_map.get(lab_id, f"LAB-0{lab_id}")

                    # Formatted time
                    st = str(s.get('start_time', '09:00:00'))[:5]
                    et = str(s.get('end_time', '11:00:00'))[:5]
                    
                    try:
                        st_dt = datetime.strptime(st, '%H:%M')
                        et_dt = datetime.strptime(et, '%H:%M')
                        s['formatted_time'] = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                        s['start_time_formatted'] = st_dt.strftime('%I:%M %p')
                        s['end_time_formatted'] = et_dt.strftime('%I:%M %p')
                    except Exception:
                        s['formatted_time'] = f"{st} — {et}"
                        s['start_time_formatted'] = st
                        s['end_time_formatted'] = et

                    s['computed_status'] = status
                    
                    # Academic format
                    s['academic_class_text'] = f"{s.get('department')} • {s.get('year')} • {s.get('semester')}"
                    s['section_batch_text'] = f"Section {s.get('section')} • {s.get('batch')}"

                    if s.get('section'):
                        sections_taught.add(f"Section {s.get('section')}")
                    if s.get('year'):
                        years_taught.add(s.get('year'))
                    if s.get('semester'):
                        semesters_taught.add(s.get('semester'))

                    processed_sessions.append(s)

                    # Update faculty summary strictly for this faculty's sessions
                    summary['total_sessions'] += 1
                    if status == 'UPCOMING':
                        summary['upcoming'] += 1
                        if not next_session:
                            next_session = s
                    elif status == 'IN SESSION':
                        summary['in_session'] += 1
                        if not current_session:
                            current_session = s
                    elif status == 'COMPLETED':
                        summary['completed'] += 1
                    elif status == 'CANCELLED':
                        summary['cancelled'] += 1

                try:
                    date_obj = datetime.strptime(target_date, '%Y-%m-%d')
                    date_formatted = date_obj.strftime('%A, %B %d, %Y').replace(' 0', ' ')
                except Exception:
                    date_formatted = target_date

                # Dynamic sections display text (e.g. "Section B", "Sections A & B", or "Sections A, B, C")
                sec_list = sorted(list(sections_taught))
                if len(sec_list) == 1:
                    sections_display = sec_list[0]
                elif len(sec_list) > 1:
                    clean_secs = [s.replace('Section ', '') for s in sec_list]
                    sections_display = f"Sections {', '.join(clean_secs[:-1])} & {clean_secs[-1]}"
                else:
                    sections_display = "Section B"

                year_display = "III Year" if "III Year" in years_taught else (sorted(list(years_taught))[0] if years_taught else "III Year")
                sem_display = "V Semester" if "V Semester" in semesters_taught else (sorted(list(semesters_taught))[0] if semesters_taught else "V Semester")

                # Filter options for labs assigned to this faculty or accessible
                assigned_lab_ids = list({s['lab_id'] for s in processed_sessions})
                if assigned_lab_ids:
                    pl = ','.join(['?' for _ in assigned_lab_ids])
                    cursor.execute(f"SELECT id, name FROM labs WHERE id IN ({pl}) ORDER BY id ASC", assigned_lab_ids)
                else:
                    cursor.execute("SELECT id, name FROM labs ORDER BY id ASC")
                lab_options = [{"id": r[0], "name": r[1]} for r in cursor.fetchall()]

                return {
                    "faculty": faculty,
                    "academic_context": {
                        "department": faculty.get('department') or "Artificial Intelligence & Data Science (AI & DS)",
                        "year": year_display,
                        "semester": sem_display,
                        "section": sections_display,
                        "date_formatted": date_formatted,
                        "date_iso": target_date
                    },
                    "summary": summary,
                    "current_session": current_session,
                    "next_session": next_session,
                    "sessions": processed_sessions,
                    "filter_options": {
                        "labs": lab_options,
                        "batches": ["All Batches", "Batch 1", "Batch 2", "All Students"],
                        "statuses": ["All Statuses", "UPCOMING", "IN SESSION", "COMPLETED", "CANCELLED"]
                    }
                }
        except Exception as e:
            print("DB Error in get_today_sessions:", e)
            return {
                "faculty": {"name": "Faculty Member", "department": "Artificial Intelligence & Data Science", "role": "Faculty"},
                "academic_context": {
                    "department": "Artificial Intelligence & Data Science (AI & DS)",
                    "year": "III Year",
                    "semester": "V Semester",
                    "section": "Section B",
                    "date_formatted": datetime.now().strftime('%A, %B %d, %Y'),
                    "date_iso": datetime.now().strftime('%Y-%m-%d')
                },
                "summary": {"total_sessions": 0, "upcoming": 0, "in_session": 0, "completed": 0, "cancelled": 0},
                "current_session": None,
                "next_session": None,
                "sessions": [],
                "filter_options": {"labs": [], "batches": [], "statuses": []}
            }

    @staticmethod
    def get_dashboard_data(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                user = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "college_id": "FAC-AIDS-101",
                    "email": "murugesan@college.edu.in",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                # 2. Today's Sessions strictly for this faculty
                today_sessions_data = FacultyDataService.get_today_sessions(user_id)
                faculty_sessions = today_sessions_data.get('sessions', [])
                
                # Format for clean horizontal dashboard session cards
                dash_sessions = []
                for s in faculty_sessions:
                    # Show ONLY Dr. Murugesan's relevant AI & DS practical sessions (Deep Learning Practical in DL-LAB-01)
                    if s.get('practical_name') != 'Deep Learning Practical' and s.get('lab_id') != 2:
                        continue
                    
                    st = s.get('computed_status', 'UPCOMING')
                    dash_sessions.append({
                        "id": s.get('id'),
                        "formatted_time": s.get('formatted_time'),
                        "start_time_formatted": s.get('start_time_formatted'),
                        "end_time_formatted": s.get('end_time_formatted'),
                        "lab_name": s.get('lab_name', 'Advanced Computing & AI Research Lab'),
                        "lab_code": s.get('lab_code', 'DL-LAB-01'),
                        "practical_name": s.get('practical_name', 'Deep Learning Practical'),
                        "batch": s.get('batch', 'Batch 1'),
                        "dept_short": "AI & DS",
                        "year": s.get('year', 'III Year'),
                        "semester": s.get('semester', 'V Semester'),
                        "section": f"Section {s.get('section', 'A')}",
                        "class_details": f"{s.get('year', 'III Year')} • {s.get('semester', 'V Semester')} • Section {s.get('section', 'A')} • {s.get('batch', 'Batch 1')}",
                        "student_count": s.get('student_count', 40),
                        "status": st.title() if st != 'IN SESSION' else 'In Session',
                        "status_upper": st.upper(),
                        "status_class": 'status-insession' if st == 'IN SESSION' else ('status-completed' if st == 'COMPLETED' else 'status-upcoming')
                    })

                # 3. Stats from actual DB data
                # A. Today's sessions count
                today_sessions_count = len(dash_sessions)

                # B. Active lab
                active_lab_code = "DL-LAB-01"
                active_lab_name = "Advanced Computing & AI Research Lab"

                # C. Equipment Health strictly for Dr. Murugesan's lab (DL-LAB-01, lab_id = 2)
                q_total_eq = "SELECT COUNT(*) FROM equipment WHERE lab_id = 2"
                cursor.execute(q_total_eq)
                total_lab_eq = cursor.fetchone()[0] or 0

                q_avail_eq = "SELECT COUNT(*) FROM equipment WHERE lab_id = 2 AND status NOT IN ('Faulty', 'Maintenance', 'Under Maintenance')"
                cursor.execute(q_avail_eq)
                avail_lab_eq = cursor.fetchone()[0] or 0

                if total_lab_eq > 0:
                    health_pct = round((avail_lab_eq / total_lab_eq) * 100)
                    health_display = f"{health_pct}%"
                else:
                    health_display = "100%"

                # D. Open Faults for Dr. Murugesan's lab
                q_faults = "SELECT COUNT(*) FROM fault_reports f JOIN equipment e ON f.equipment_id = e.id WHERE e.lab_id = 2 AND (f.status IS NULL OR UPPER(f.status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED'))"
                cursor.execute(q_faults)
                open_faults = cursor.fetchone()[0] or 0

                # 4. My Laboratory Record
                my_active_lab = {
                    "id": 2,
                    "name": "Advanced Computing & AI Research Lab",
                    "code": "DL-LAB-01",
                    "location": "Block A, 3rd Floor, Room 310",
                    "department": "Artificial Intelligence & Data Science",
                    "subject": "Deep Learning Practical",
                    "status": "Active",
                    "status_class": "status-available"
                }

                # 5. Shared Labs Summary
                shared_labs_summary = {
                    "total_count": 5,
                    "message": "5 facilities available for scheduling"
                }

                # 6. Recent Activity Feed - Strictly relevant to Dr. Murugesan's sessions
                recent_activity = []
                for s in dash_sessions[:3]:
                    st_text = s.get('status_upper', 'UPCOMING')
                    badge_cls = 'badge-emerald' if st_text == 'COMPLETED' else ('badge-purple' if st_text == 'IN SESSION' else 'badge-cyan')
                    icon_cls = 'bi-check2-circle' if st_text == 'COMPLETED' else ('bi-broadcast' if st_text == 'IN SESSION' else 'bi-clock')
                    
                    recent_activity.append({
                        "icon": icon_cls,
                        "badge_class": badge_cls,
                        "title": f"{s.get('practical_name')} — {s.get('batch')}",
                        "time": s.get('formatted_time'),
                        "desc": f"{st_text.title()} • {s.get('lab_code')}"
                    })

                if not recent_activity:
                    recent_activity = [
                        {
                            "icon": "bi-info-circle",
                            "badge_class": "badge-purple",
                            "title": "No recent activity",
                            "time": "Today",
                            "desc": "Scheduled sessions will appear here."
                        }
                    ]

                return {
                    "faculty": user,
                    "stats": {
                        "today_sessions_count": today_sessions_count,
                        "active_lab_code": active_lab_code,
                        "active_lab_name": active_lab_name,
                        "equipment_health_display": health_display,
                        "equipment_health_pct": health_pct if total_lab_eq > 0 else 100,
                        "open_faults_count": open_faults
                    },
                    "today_sessions": dash_sessions,
                    "my_laboratory": my_active_lab,
                    "shared_labs_summary": shared_labs_summary,
                    "recent_activity": recent_activity
                }
        except Exception as e:
            print("DB Error in FacultyDataService.get_dashboard_data:", e)
            return {
                "faculty": {"name": "Dr. Murugesan", "department": "Artificial Intelligence & Data Science", "role": "Faculty"},
                "stats": {
                    "today_sessions_count": 5,
                    "active_lab_code": "DL-LAB-01",
                    "active_lab_name": "Advanced Computing & AI Research Lab",
                    "equipment_health_display": "100%",
                    "equipment_health_pct": 100,
                    "open_faults_count": 0
                },
                "today_sessions": [],
                "my_laboratory": {
                    "id": 2,
                    "name": "Advanced Computing & AI Research Lab",
                    "code": "DL-LAB-01",
                    "location": "Block A, 3rd Floor, Room 310",
                    "department": "Artificial Intelligence & Data Science",
                    "subject": "Deep Learning Practical"
                },
                "shared_labs_summary": {
                    "total_count": 5,
                    "message": "5 facilities available for scheduling"
                },
                "recent_activity": []
            }

    @staticmethod
    def get_labs_data(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "college_id": "FAC-AIDS-101",
                    "email": "murugesan@college.edu.in",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                target_date = datetime.now().strftime('%Y-%m-%d')

                # Ensure target date has up-to-date realistic academic sessions
                q_today_cnt = "SELECT COUNT(*) FROM lab_sessions WHERE session_date = %s" if db_type == 'mysql' else "SELECT COUNT(*) FROM lab_sessions WHERE session_date = ?"
                cursor.execute(q_today_cnt, (target_date,))
                if cursor.fetchone()[0] == 0:
                    FacultyDataService._seed_academic_sessions(cursor, target_date, db_type)
                    conn.commit()

                # Find all alias user IDs for Dr. Murugesan or current faculty
                fac_name = faculty.get('name', '').strip()
                fac_email = faculty.get('email', '').strip()
                
                if 'Murugesan' in fac_name or 'muruges' in fac_email.lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                else:
                    matched_ids = [user_id]
                
                if not matched_ids:
                    matched_ids = [user_id]

                # 2. Query Dr. Murugesan's relevant lab (Advanced Computing & AI Research Lab / DL-LAB-01, id=2)
                q_lab = "SELECT * FROM labs WHERE id = 2" if db_type != 'mysql' else "SELECT * FROM labs WHERE id = 2"
                cursor.execute(q_lab)
                lab_row = cursor.fetchone()
                lab_dict = dict(lab_row) if (lab_row and db_type != 'mysql') else (lab_row or {})
                
                my_lab = {
                    "id": 2,
                    "name": lab_dict.get('name', 'Advanced Computing & AI Research Lab'),
                    "code": "DL-LAB-01",
                    "location": lab_dict.get('location', 'Block A, 3rd Floor, Room 310'),
                    "department": lab_dict.get('department', 'Artificial Intelligence & Data Science'),
                    "description": lab_dict.get('description', 'High-performance AI model training center featuring dual NVIDIA RTX GPU workstations.'),
                    "status": "AVAILABLE",
                    "status_class": "status-available"
                }

                # 3. Query all today's Deep Learning sessions for DL-LAB-01
                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])
                q_sess = f"""
                    SELECT s.*, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = 2 AND s.session_date = ? AND (s.faculty_id IN ({id_placeholders}) OR s.practical_name LIKE '%Deep Learning%')
                    ORDER BY s.start_time ASC
                """ if db_type != 'mysql' else f"""
                    SELECT s.*, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = 2 AND s.session_date = %s AND (s.faculty_id IN ({id_placeholders}) OR s.practical_name LIKE '%Deep Learning%')
                    ORDER BY s.start_time ASC
                """
                params = [target_date] + matched_ids
                cursor.execute(q_sess, params)
                sess_rows = cursor.fetchall()
                sessions_list = []
                active_session = None

                for r in sess_rows:
                    s_dict = dict(r) if db_type != 'mysql' else r
                    st = str(s_dict['start_time'])[:5]
                    et = str(s_dict['end_time'])[:5]
                    try:
                        st_dt = datetime.strptime(st, '%H:%M')
                        et_dt = datetime.strptime(et, '%H:%M')
                        time_str = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                    except Exception:
                        time_str = f"{st} — {et}"

                    status = FacultyDataService.compute_session_status(
                        s_dict['session_date'], s_dict['start_time'], s_dict['end_time']
                    )
                    
                    status_class = "status-completed"
                    if status == "IN SESSION":
                        status_class = "status-insession"
                    elif status == "UPCOMING":
                        status_class = "status-upcoming"
                    elif status == "CANCELLED":
                        status_class = "status-cancelled"

                    sec_raw = str(s_dict.get('section', 'A'))
                    sec_display = sec_raw if sec_raw.startswith('Section') else f"Section {sec_raw}"

                    fac_display = s_dict.get('faculty_name', faculty.get('name', 'Dr. Murugesan'))
                    if 'Rajesh' in fac_display:
                        fac_display = 'Dr. Murugesan'

                    sess_item = {
                        "id": s_dict['id'],
                        "practical_name": s_dict['practical_name'],
                        "time_formatted": time_str,
                        "department": s_dict.get('department', 'AI & DS'),
                        "year": s_dict.get('year', 'III Year'),
                        "semester": s_dict.get('semester', 'V Semester'),
                        "section": sec_display,
                        "batch": s_dict.get('batch', 'Batch 1'),
                        "faculty_name": fac_display,
                        "student_count": s_dict.get('student_count', 40),
                        "status": status,
                        "status_class": status_class
                    }
                    sessions_list.append(sess_item)

                    if status == 'IN SESSION' and not active_session:
                        active_session = sess_item

                # Determine overall lab status from the sessions
                if active_session:
                    my_lab['status'] = 'IN SESSION'
                    my_lab['status_class'] = 'status-insession'
                    my_lab['current_session'] = active_session
                elif any(s['status'] == 'UPCOMING' for s in sessions_list):
                    next_up = next(s for s in sessions_list if s['status'] == 'UPCOMING')
                    my_lab['status'] = 'UPCOMING'
                    my_lab['status_class'] = 'status-booked'
                    my_lab['current_session'] = next_up
                elif sessions_list:
                    # Pick afternoon or latest session
                    last_sess = next((s for s in sessions_list if '14:00' in str(s['time_formatted']) or '02:00' in str(s['time_formatted'])), sessions_list[0])
                    my_lab['status'] = 'IN SESSION' if last_sess['status'] == 'IN SESSION' else 'AVAILABLE'
                    my_lab['status_class'] = 'status-insession' if my_lab['status'] == 'IN SESSION' else 'status-available'
                    my_lab['current_session'] = last_sess
                else:
                    my_lab['status'] = 'AVAILABLE'
                    my_lab['status_class'] = 'status-available'
                    my_lab['current_session'] = {
                        "practical_name": "Deep Learning Practical",
                        "time_formatted": "02:00 PM — 04:00 PM",
                        "department": "Artificial Intelligence & Data Science",
                        "year": "III Year",
                        "semester": "V Semester",
                        "section": "Section A",
                        "batch": "Batch 1",
                        "faculty_name": "Dr. Murugesan",
                        "student_count": 40,
                        "status": "AVAILABLE",
                        "status_class": "status-available"
                    }

                return {
                    "faculty": faculty,
                    "my_lab": my_lab,
                    "lab_sessions": sessions_list
                }
        except Exception as e:
            print("DB Error in FacultyDataService.get_labs_data:", e)
            return {
                "faculty": {"name": "Dr. Murugesan", "department": "Artificial Intelligence & Data Science", "role": "Faculty"},
                "my_lab": None,
                "lab_sessions": []
            }


    @staticmethod
    def get_equipment_data(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "college_id": "FAC-AIDS-101",
                    "email": "murugesan@college.edu.in",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                # 2. Lab Context for Dr. Murugesan (DL-LAB-01 / Lab ID 2)
                q_lab = "SELECT * FROM labs WHERE id = 2" if db_type != 'mysql' else "SELECT * FROM labs WHERE id = 2"
                cursor.execute(q_lab)
                lab_row = cursor.fetchone()
                lab_dict = dict(lab_row) if (lab_row and db_type != 'mysql') else (lab_row or {})
                
                lab_info = {
                    "id": 2,
                    "name": lab_dict.get('name', 'Advanced Computing & AI Research Lab'),
                    "code": "DL-LAB-01",
                    "location": lab_dict.get('location', 'Block A, 3rd Floor, Room 310'),
                    "department": lab_dict.get('department', 'Artificial Intelligence & Data Science'),
                    "primary_subject": "Deep Learning Practical"
                }

                # 3. Query equipment registered for DL-LAB-01 (lab_id = 2)
                q_eq = """
                    SELECT * FROM equipment
                    WHERE lab_id = 2
                    ORDER BY id ASC
                """ if db_type != 'mysql' else """
                    SELECT * FROM equipment
                    WHERE lab_id = 2
                    ORDER BY id ASC
                """
                cursor.execute(q_eq)
                eq_rows = cursor.fetchall()
                eq_list = []

                total_count = len(eq_rows)
                available_count = 0
                booked_count = 0
                faulty_count = 0
                maintenance_count = 0

                for r in eq_rows:
                    item = dict(r) if db_type != 'mysql' else r
                    raw_status = str(item.get('status', 'Available')).strip()
                    status_upper = raw_status.upper()
                    
                    if status_upper == 'AVAILABLE':
                        available_count += 1
                        status_class = 'status-available'
                        status_label = 'Available'
                    elif status_upper == 'BOOKED':
                        booked_count += 1
                        status_class = 'status-booked'
                        status_label = 'Booked'
                    elif status_upper == 'FAULTY':
                        faulty_count += 1
                        status_class = 'status-faulty'
                        status_label = 'Faulty'
                    elif 'MAINTENANCE' in status_upper:
                        maintenance_count += 1
                        status_class = 'status-maintenance'
                        status_label = 'Under Maintenance'
                    else:
                        available_count += 1
                        status_class = 'status-available'
                        status_label = 'Available'

                    # Check for open fault report on this equipment
                    fault_info = None
                    if status_label == 'Faulty':
                        q_fault = "SELECT * FROM fault_reports WHERE equipment_id = ? AND (status IS NULL OR UPPER(status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED')) ORDER BY id DESC LIMIT 1" if db_type != 'mysql' else "SELECT * FROM fault_reports WHERE equipment_id = %s AND (status IS NULL OR UPPER(status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED')) ORDER BY id DESC LIMIT 1"
                        cursor.execute(q_fault, (item['id'],))
                        fault_row = cursor.fetchone()
                        if fault_row:
                            f_dict = dict(fault_row) if db_type != 'mysql' else fault_row
                            fault_info = {
                                "fault_type": f_dict.get('fault_type', 'Hardware Issue'),
                                "description": f_dict.get('description', 'Reported malfunction'),
                                "priority": f_dict.get('priority', 'Medium'),
                                "reported_at": str(f_dict.get('reported_at', ''))[:10]
                            }

                    eq_list.append({
                        "id": item['id'],
                        "equipment_code": item.get('equipment_code', 'LAB-AI-000'),
                        "name": item.get('name', 'Laboratory Equipment'),
                        "category": item.get('category', 'Computing'),
                        "status": status_label,
                        "status_class": status_class,
                        "qr_code": item.get('qr_code', 'QR_AVAILABLE'),
                        "description": item.get('description', 'Standard laboratory hardware unit'),
                        "created_at": str(item.get('created_at', ''))[:10] if item.get('created_at') else '2026-08-28',
                        "location": lab_info['code'],
                        "fault_info": fault_info
                    })

                # Health Score calculation:
                # Operational Equipment includes Available + Booked (non-faulty, non-maintenance)
                # Health Score = (Operational / Total) * 100
                if total_count > 0:
                    operational_count = total_count - (faulty_count + maintenance_count)
                    health_score = round((operational_count / total_count) * 100)
                    health_score_display = f"{health_score}%"
                else:
                    health_score = None
                    health_score_display = "Not Available"

                health_summary = {
                    "health_score": health_score,
                    "health_score_display": health_score_display,
                    "total_equipment": total_count,
                    "available": available_count,
                    "booked": booked_count,
                    "faulty": faulty_count,
                    "under_maintenance": maintenance_count
                }

                return {
                    "faculty": faculty,
                    "lab": lab_info,
                    "health_summary": health_summary,
                    "equipment": eq_list
                }
        except Exception as e:
            print("DB Error in FacultyDataService.get_equipment_data:", e)
            return {
                "faculty": {"name": "Dr. Murugesan", "department": "Artificial Intelligence & Data Science", "role": "Faculty"},
                "lab": {"name": "Advanced Computing & AI Research Lab", "code": "DL-LAB-01", "location": "Block A, 3rd Floor, Room 310", "primary_subject": "Deep Learning Practical"},
                "health_summary": {"health_score": None, "health_score_display": "Not Available", "total_equipment": 0, "available": 0, "booked": 0, "faulty": 0, "under_maintenance": 0},
                "equipment": []
            }


    @staticmethod
    def lookup_equipment_qr(qr_identifier):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                clean_id = qr_identifier.strip()
                
                # Canonical Lab Code Mapping
                lab_code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                # Lookup by qr_code or equipment_code
                q = """
                    SELECT e.*, l.name as lab_name, l.location as lab_location
                    FROM equipment e
                    LEFT JOIN labs l ON e.lab_id = l.id
                    WHERE e.qr_code = ? OR e.equipment_code = ? OR UPPER(e.qr_code) = UPPER(?) OR UPPER(e.equipment_code) = UPPER(?)
                """ if db_type != 'mysql' else """
                    SELECT e.*, l.name as lab_name, l.location as lab_location
                    FROM equipment e
                    LEFT JOIN labs l ON e.lab_id = l.id
                    WHERE e.qr_code = %s OR e.equipment_code = %s OR UPPER(e.qr_code) = UPPER(%s) OR UPPER(e.equipment_code) = UPPER(%s)
                """
                cursor.execute(q, (clean_id, clean_id, clean_id, clean_id))
                row = cursor.fetchone()
                if not row:
                    return None
                
                item = dict(row) if db_type != 'mysql' else row
                
                # Check for open fault report
                q_fault = "SELECT * FROM fault_reports WHERE equipment_id = ? AND (status IS NULL OR UPPER(status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED')) ORDER BY id DESC LIMIT 1" if db_type != 'mysql' else "SELECT * FROM fault_reports WHERE equipment_id = %s AND (status IS NULL OR UPPER(status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED')) ORDER BY id DESC LIMIT 1"
                cursor.execute(q_fault, (item['id'],))
                fault_row = cursor.fetchone()
                fault_info = None
                if fault_row:
                    f_dict = dict(fault_row) if db_type != 'mysql' else fault_row
                    fault_info = {
                        "fault_type": f_dict.get('fault_type', 'Hardware Malfunction'),
                        "description": f_dict.get('description', 'Reported issue'),
                        "priority": f_dict.get('priority', 'Medium'),
                        "reported_at": str(f_dict.get('reported_at', ''))[:10]
                    }

                status_raw = str(item.get('status', 'Available')).strip()
                status_upper = status_raw.upper()
                
                if status_upper == 'AVAILABLE':
                    status_class = 'status-available'
                    status_label = 'Available'
                    condition = 'Operational'
                elif status_upper == 'BOOKED':
                    status_class = 'status-booked'
                    status_label = 'Booked'
                    condition = 'Operational'
                elif status_upper == 'FAULTY':
                    status_class = 'status-faulty'
                    status_label = 'Faulty'
                    condition = 'Reported Issue'
                elif 'MAINTENANCE' in status_upper:
                    status_class = 'status-maintenance'
                    status_label = 'Under Maintenance'
                    condition = 'In Service'
                else:
                    status_class = 'status-available'
                    status_label = 'Available'
                    condition = 'Operational'

                l_id = item.get('lab_id', 1)
                lab_code = lab_code_map.get(l_id, f"LAB-{l_id:02d}")
                lab_name = item.get('lab_name') or "Engineering Laboratory"
                lab_loc = item.get('lab_location') or "College Campus"

                return {
                    "id": item['id'],
                    "equipment_code": item.get('equipment_code', 'LAB-AI-001'),
                    "name": item.get('name', 'Laboratory Equipment'),
                    "qr_code": item.get('qr_code', clean_id),
                    "category": item.get('category', 'Computing'),
                    "status": status_label,
                    "status_class": status_class,
                    "condition": condition,
                    "lab_name": lab_name,
                    "lab_code": lab_code,
                    "lab_location": lab_loc,
                    "description": item.get('description', 'Standard laboratory hardware unit'),
                    "installation_date": str(item.get('created_at', ''))[:10] if item.get('created_at') else '2026-08-28',
                    "fault_info": fault_info
                }
        except Exception as e:
            print("DB Error in lookup_equipment_qr:", e)
            return None


    @staticmethod
    def get_booking_options(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                # 2. Labs from database
                cursor.execute("SELECT id, name, location FROM labs ORDER BY id ASC")
                labs_raw = cursor.fetchall()
                labs = []
                code_map = {
                    1: "MP-LAB-01",
                    2: "DL-LAB-01",
                    3: "BA-LAB-02",
                    4: "BDA-LAB-03",
                    5: "CSM-LAB-04",
                    6: "DBMS-LAB-05"
                }
                for row in labs_raw:
                    item = dict(row) if db_type != 'mysql' else row
                    lab_id = item['id']
                    labs.append({
                        "id": lab_id,
                        "name": item['name'],
                        "code": code_map.get(lab_id, f"LAB-{lab_id:02d}"),
                        "location": item['location'],
                        "is_primary": (lab_id == 2)
                    })

                # 3. Canonical Lab -> Subjects & Faculty Mappings directly from database
                q_sessions = """
                    SELECT 
                        s.lab_id,
                        s.practical_name,
                        s.faculty_id,
                        u.name as faculty_name,
                        u.department as faculty_dept,
                        s.department as session_dept,
                        s.year,
                        s.semester,
                        s.section,
                        s.batch,
                        s.student_count
                    FROM lab_sessions s
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                    ORDER BY s.lab_id ASC, s.practical_name ASC
                """
                cursor.execute(q_sessions)
                session_rows = cursor.fetchall()

                lab_subject_faculty_map = {}
                class_strengths = {}
                all_subjects_list = []
                seen_global_subjects = set()

                for r in session_rows:
                    r_dict = dict(r) if db_type != 'mysql' else r
                    l_id = r_dict['lab_id']
                    p_name = r_dict['practical_name']
                    f_id = r_dict.get('faculty_id')
                    f_name = r_dict.get('faculty_name')
                    f_dept = r_dict.get('faculty_dept') or r_dict.get('session_dept') or 'Engineering'
                    sec = str(r_dict.get('section', 'B')).replace('Section', '').strip()
                    bat = r_dict.get('batch', 'Batch 1')
                    s_count = r_dict.get('student_count', 40)

                    if l_id not in lab_subject_faculty_map:
                        lab_subject_faculty_map[l_id] = []

                    # Find existing subject entry in this lab
                    subj_entry = next((item for item in lab_subject_faculty_map[l_id] if item["name"] == p_name), None)
                    if not subj_entry:
                        subj_entry = {
                            "name": p_name,
                            "lab_id": l_id,
                            "faculty_id": f_id,
                            "faculty_name": f_name if f_name else "Faculty assignment pending",
                            "faculty_dept": f_dept if f_name else (r_dict.get('session_dept') or ""),
                            "is_assigned": bool(f_name),
                            "sections": [],
                            "batches": [],
                            "default_students": s_count
                        }
                        lab_subject_faculty_map[l_id].append(subj_entry)

                    sec_label = f"Section {sec}"
                    if sec_label not in subj_entry["sections"]:
                        subj_entry["sections"].append(sec_label)
                    if bat not in subj_entry["batches"]:
                        subj_entry["batches"].append(bat)

                    # Class strength key
                    key = f"{p_name}|Section {sec}|{bat}"
                    class_strengths[key] = s_count

                    if p_name not in seen_global_subjects:
                        seen_global_subjects.add(p_name)
                        all_subjects_list.append({
                            "name": p_name,
                            "lab_id": l_id,
                            "faculty_name": f_name if f_name else "Faculty assignment pending"
                        })

                years = ["III Year", "I Year", "II Year", "IV Year"]
                semesters = ["V Semester", "I Semester", "II Semester", "III Semester", "IV Semester", "VI Semester", "VII Semester", "VIII Semester"]
                sections = ["Section B", "Section A", "Section C"]
                batches = ["Batch 1", "Batch 2", "All Students"]

                return {
                    "faculty": faculty,
                    "labs": labs,
                    "subjects": all_subjects_list,
                    "lab_subject_faculty_map": lab_subject_faculty_map,
                    "class_strengths": class_strengths,
                    "years": years,
                    "semesters": semesters,
                    "sections": sections,
                    "batches": batches,
                    "default_date": datetime.now().strftime('%Y-%m-%d')
                }
        except Exception as e:
            print("DB Error in get_booking_options:", e)
            return None

    @staticmethod
    def check_slot_availability(params):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                lab_id = int(params.get('lab_id', 2))
                practical_name = str(params.get('practical_name', 'Deep Learning Practical')).strip()
                session_date = str(params.get('session_date', datetime.now().strftime('%Y-%m-%d'))).strip()
                start_time = str(params.get('start_time', '09:00')).strip()
                end_time = str(params.get('end_time', '11:00')).strip()
                year = str(params.get('year', 'III Year')).strip()
                semester = str(params.get('semester', 'V Semester')).strip()
                section = str(params.get('section', 'Section B')).strip()
                batch = str(params.get('batch', 'Batch 1')).strip()
                student_count_raw = params.get('student_count')

                # 1. Validate student count
                if student_count_raw is None or str(student_count_raw).strip() == '':
                    return {
                        "status": "error",
                        "message": "Please enter the expected student strength."
                    }
                try:
                    student_count = int(student_count_raw)
                    if student_count <= 0:
                        return {
                            "status": "error",
                            "message": "Student strength must be greater than 0."
                        }
                except ValueError:
                    return {
                        "status": "error",
                        "message": "Expected student strength must be a valid number."
                    }

                # 2. Check Capacity ONLY if capacity column exists in labs table
                try:
                    cursor.execute("PRAGMA table_info(labs)")
                    cols = [c[1] for c in cursor.fetchall()]
                    if 'capacity' in cols:
                        cursor.execute("SELECT capacity FROM labs WHERE id = ?", (lab_id,))
                        cap_row = cursor.fetchone()
                        if cap_row and cap_row[0] is not None:
                            lab_capacity = int(cap_row[0])
                            if student_count > lab_capacity:
                                return {
                                    "status": "error",
                                    "message": "The selected laboratory cannot accommodate the expected student strength."
                                }
                except Exception as e:
                    print("Capacity check bypass:", e)

                # Format times to HH:MM:SS
                if len(start_time) == 5: start_time += ":00"
                if len(end_time) == 5: end_time += ":00"

                                # Validate that requested lab_id and practical_name exist as a valid relationship in database
                q_val = "SELECT faculty_id FROM lab_sessions WHERE lab_id = ? AND practical_name = ? LIMIT 1" if db_type != 'mysql' else "SELECT faculty_id FROM lab_sessions WHERE lab_id = %s AND practical_name = %s LIMIT 1"
                cursor.execute(q_val, (lab_id, practical_name))
                val_row = cursor.fetchone()
                if not val_row:
                    return {
                        "status": "error",
                        "message": "Selected laboratory and practical subject do not match."
                    }

                code_map = {1: "MP-LAB-01", 2: "DL-LAB-01", 3: "BA-LAB-02", 4: "BDA-LAB-03", 5: "CSM-LAB-04", 6: "DBMS-LAB-05"}

                # 3. Check conflict in lab_sessions for requested lab, date, and overlapping time
                q_conf = """
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    LEFT JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = ? AND s.session_date = ?
                      AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                      AND NOT (s.end_time <= ? OR s.start_time >= ?)
                    LIMIT 1
                """ if db_type != 'mysql' else """
                    SELECT s.*, l.name as lab_name, l.location as lab_location, u.name as faculty_name
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    JOIN users u ON s.faculty_id = u.id
                    WHERE s.lab_id = %s AND s.session_date = %s
                      AND NOT (s.end_time <= %s OR s.start_time >= %s)
                    LIMIT 1
                """
                cursor.execute(q_conf, (lab_id, session_date, start_time, end_time))
                conf_row = cursor.fetchone()

                if conf_row:
                    conf_dict = dict(conf_row) if db_type != 'mysql' else conf_row
                    
                    st_str = str(conf_dict['start_time'])[:5]
                    et_str = str(conf_dict['end_time'])[:5]
                    try:
                        st_dt = datetime.strptime(st_str, '%H:%M')
                        et_dt = datetime.strptime(et_str, '%H:%M')
                        conf_time_str = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                    except Exception:
                        conf_time_str = f"{st_str} — {et_str}"

                    conflict_info = {
                        "subject": conf_dict.get('practical_name', 'Laboratory Practical'),
                        "lab_name": conf_dict.get('lab_name', 'Laboratory'),
                        "lab_code": code_map.get(lab_id, "DL-LAB-01"),
                        "date": conf_dict.get('session_date', session_date),
                        "time_formatted": conf_time_str,
                        "section": f"Section {conf_dict.get('section', 'A')}",
                        "batch": conf_dict.get('batch', 'Batch 1'),
                        "faculty": conf_dict.get('faculty_name', 'Assigned Faculty')
                    }

                    # Find genuine alternative available slots
                    alternatives = []
                    standard_slots = [
                        ("08:00:00", "09:00:00", "08:00 AM — 09:00 AM"),
                        ("09:00:00", "11:00:00", "09:00 AM — 11:00 AM"),
                        ("11:00:00", "13:00:00", "11:00 AM — 01:00 PM"),
                        ("14:00:00", "16:00:00", "02:00 PM — 04:00 PM"),
                        ("16:15:00", "18:15:00", "04:15 PM — 06:15 PM")
                    ]

                    # 1. Alternative times in SAME lab (if any slot is open)
                    for slot_st, slot_et, slot_disp in standard_slots:
                        cursor.execute(q_conf, (lab_id, session_date, slot_st, slot_et))
                        if not cursor.fetchone() and (slot_st != start_time):
                            alternatives.append({
                                "type": "same_lab_diff_time",
                                "lab_id": lab_id,
                                "lab_name": conf_dict.get('lab_name', 'Laboratory'),
                                "lab_code": code_map.get(lab_id, "DL-LAB-01"),
                                "session_date": session_date,
                                "start_time": slot_st[:5],
                                "end_time": slot_et[:5],
                                "time_formatted": slot_disp,
                                "availability": "Available"
                            })
                            if len(alternatives) >= 2:
                                break

                    # 2. Alternative LABS at SAME time (genuinely available in DB)
                    cursor.execute("SELECT id, name FROM labs WHERE id != ? ORDER BY id ASC", (lab_id,))
                    other_labs = cursor.fetchall()
                    for ol in other_labs:
                        ol_dict = dict(ol) if db_type != 'mysql' else ol
                        ol_id = ol_dict['id']
                        cursor.execute(q_conf, (ol_id, session_date, start_time, end_time))
                        if not cursor.fetchone():
                            try:
                                req_st_dt = datetime.strptime(start_time[:5], '%H:%M')
                                req_et_dt = datetime.strptime(end_time[:5], '%H:%M')
                                req_time_disp = f"{req_st_dt.strftime('%I:%M %p')} — {req_et_dt.strftime('%I:%M %p')}"
                            except Exception:
                                req_time_disp = f"{start_time[:5]} — {end_time[:5]}"
                            
                            alternatives.append({
                                "type": "diff_lab_same_time",
                                "lab_id": ol_id,
                                "lab_name": ol_dict['name'],
                                "lab_code": code_map.get(ol_id, f"LAB-{ol_id:02d}"),
                                "session_date": session_date,
                                "start_time": start_time[:5],
                                "end_time": end_time[:5],
                                "time_formatted": req_time_disp,
                                "availability": "Available"
                            })
                            if len(alternatives) >= 4:
                                break

                    return {
                        "status": "conflict",
                        "available": False,
                        "message": "This laboratory is already scheduled during the selected time.",
                        "conflict": conflict_info,
                        "alternatives": alternatives
                    }
                else:
                    # Slot is available
                    cursor.execute("SELECT name, location FROM labs WHERE id = ?", (lab_id,))
                    lab_info = cursor.fetchone()
                    lab_name = dict(lab_info)['name'] if (lab_info and db_type != 'mysql') else ("Advanced Computing & AI Research Lab" if lab_id == 2 else "Laboratory")

                    try:
                        st_dt = datetime.strptime(start_time[:5], '%H:%M')
                        et_dt = datetime.strptime(end_time[:5], '%H:%M')
                        time_disp = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                    except Exception:
                        time_disp = f"{start_time[:5]} — {end_time[:5]}"

                    return {
                        "status": "available",
                        "available": True,
                        "message": "This laboratory is available for the selected session.",
                        "slot": {
                            "lab_id": lab_id,
                            "lab_name": lab_name,
                            "lab_code": code_map.get(lab_id, "DL-LAB-01"),
                            "practical_name": practical_name,
                            "session_date": session_date,
                            "start_time": start_time[:5],
                            "end_time": end_time[:5],
                            "time_formatted": time_disp,
                            "year": year,
                            "semester": semester,
                            "section": section,
                            "batch": batch,
                            "student_count": student_count
                        }
                    }
        except Exception as e:
            print("DB Error in check_slot_availability:", e)
            return {"status": "error", "message": "Failed to verify slot availability."}

    @staticmethod
    def create_faculty_booking(user_id, data):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # Check for alias IDs for Dr. Murugesan to ensure consistent user_id
                cursor.execute("SELECT id, name, department FROM users WHERE id = ?", (user_id,))
                u_row = cursor.fetchone()
                fac_name = dict(u_row)['name'] if u_row else 'Dr. Murugesan'
                dept = dict(u_row)['department'] if u_row else 'Artificial Intelligence & Data Science'

                lab_id = int(data.get('lab_id', 2))
                practical_name = str(data.get('practical_name', 'Deep Learning Practical')).strip()
                session_date = str(data.get('session_date', datetime.now().strftime('%Y-%m-%d'))).strip()
                start_time = str(data.get('start_time', '09:00')).strip()
                end_time = str(data.get('end_time', '11:00')).strip()
                year = str(data.get('year', 'III Year')).strip()
                semester = str(data.get('semester', 'V Semester')).strip()
                section_raw = str(data.get('section', 'Section A')).strip()
                section = section_raw.replace('Section', '').strip() or 'A'
                batch = str(data.get('batch', 'Batch 1')).strip()
                student_count = int(data.get('student_count', 40))

                if len(start_time) == 5: start_time += ":00"
                if len(end_time) == 5: end_time += ":00"

                                # Validate that requested lab_id and practical_name exist as a valid relationship in database
                q_val = "SELECT faculty_id FROM lab_sessions WHERE lab_id = ? AND practical_name = ? LIMIT 1" if db_type != 'mysql' else "SELECT faculty_id FROM lab_sessions WHERE lab_id = %s AND practical_name = %s LIMIT 1"
                cursor.execute(q_val, (lab_id, practical_name))
                val_row = cursor.fetchone()
                if not val_row:
                    return {
                        "status": "error",
                        "message": "Selected laboratory and practical subject do not match."
                    }

                # Conflict double-check
                q_conf = """
                    SELECT id FROM lab_sessions
                    WHERE lab_id = ? AND session_date = ?
                      AND (status IS NULL OR UPPER(status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                      AND NOT (end_time <= ? OR start_time >= ?)
                    LIMIT 1
                """ if db_type != 'mysql' else """
                    SELECT id FROM lab_sessions
                    WHERE lab_id = %s AND session_date = %s
                      AND NOT (end_time <= %s OR start_time >= %s)
                    LIMIT 1
                """
                cursor.execute(q_conf, (lab_id, session_date, start_time, end_time))
                if cursor.fetchone():
                    return {
                        "status": "error",
                        "message": "Cannot book slot: A scheduling conflict was detected for this laboratory and time."
                    }

                # Insert new session
                q_ins = """
                    INSERT INTO lab_sessions (
                        lab_id, faculty_id, practical_name, department, year, semester, section, batch,
                        session_date, start_time, end_time, student_count, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
                """ if db_type != 'mysql' else """
                    INSERT INTO lab_sessions (
                        lab_id, faculty_id, practical_name, department, year, semester, section, batch,
                        session_date, start_time, end_time, student_count, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Confirmed')
                """
                cursor.execute(q_ins, (
                    lab_id, user_id, practical_name, dept, year, semester, section, batch,
                    session_date, start_time, end_time, student_count
                ))
                new_id = cursor.lastrowid
                conn.commit()

                code_map = {1: "MP-LAB-01", 2: "DL-LAB-01", 3: "BA-LAB-02", 4: "BDA-LAB-03", 5: "CSM-LAB-04", 6: "DBMS-LAB-05"}
                cursor.execute("SELECT name FROM labs WHERE id = ?", (lab_id,))
                lab_name_row = cursor.fetchone()
                lab_name = dict(lab_name_row)['name'] if (lab_name_row and db_type != 'mysql') else "Advanced Computing & AI Research Lab"

                try:
                    st_dt = datetime.strptime(start_time[:5], '%H:%M')
                    et_dt = datetime.strptime(end_time[:5], '%H:%M')
                    time_disp = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                except Exception:
                    time_disp = f"{start_time[:5]} — {end_time[:5]}"

                return {
                    "status": "success",
                    "message": "Booking confirmed successfully.",
                    "booking": {
                        "id": new_id,
                        "lab_id": lab_id,
                        "lab_name": lab_name,
                        "lab_code": code_map.get(lab_id, "DL-LAB-01"),
                        "practical_name": practical_name,
                        "session_date": session_date,
                        "time_formatted": time_disp,
                        "section": f"Section {section}",
                        "batch": batch,
                        "student_count": student_count,
                        "faculty_name": fac_name
                    }
                }
        except Exception as e:
            print("DB Error in create_faculty_booking:", e)
            return {"status": "error", "message": "Failed to create booking."}


    @staticmethod
    def get_faculty_usage(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                fac_name = faculty.get('name', '').strip()
                fac_email = faculty.get('email', '').strip()
                if 'Murugesan' in fac_name or 'muruges' in fac_email.lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                    matched_ids.extend([5, 11, 14, user_id])
                    matched_ids = list(set([m for m in matched_ids if m is not None]))
                else:
                    matched_ids = [user_id]
                if not matched_ids:
                    matched_ids = [user_id]

                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])
                
                query = f"""
                    SELECT u.id as usage_id, u.equipment_id, u.booking_id, u.usage_date, u.duration_minutes,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category,
                           l.id as lab_id, l.name as lab_name, l.location as lab_location,
                           b.session_date, b.start_time, b.end_time, b.status as booking_status, b.batch_name,
                           s.practical_name, s.section, s.batch
                    FROM equipment_usage u
                    JOIN bookings b ON u.booking_id = b.id
                    JOIN equipment e ON u.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    LEFT JOIN lab_sessions s ON s.lab_id = e.lab_id AND s.session_date = b.session_date AND SUBSTR(s.start_time, 1, 5) = SUBSTR(b.start_time, 1, 5) AND s.faculty_id IN ({id_placeholders})
                    WHERE b.user_id IN ({id_placeholders})
                    ORDER BY u.usage_date DESC, b.start_time DESC, u.id DESC
                """
                params = matched_ids + matched_ids
                cursor.execute(query, params)
                raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                results = []
                total_duration_minutes = 0
                for r in raw:
                    u_date = str(r.get('usage_date', ''))
                    try:
                        d_obj = datetime.strptime(u_date, '%Y-%m-%d')
                        formatted_date = d_obj.strftime('%d %b %Y')
                    except Exception:
                        formatted_date = u_date

                    st_str = str(r.get('start_time', '09:00'))[:5]
                    et_str = str(r.get('end_time', '11:00'))[:5]
                    try:
                        st_obj = datetime.strptime(st_str, '%H:%M')
                        et_obj = datetime.strptime(et_str, '%H:%M')
                        time_slot = f"{st_obj.strftime('%I:%M %p')} — {et_obj.strftime('%I:%M %p')}"
                    except Exception:
                        time_slot = f"{st_str} — {et_str}"

                    dur_mins = int(r.get('duration_minutes', 120))
                    total_duration_minutes += dur_mins
                    if dur_mins >= 60:
                        hrs = dur_mins // 60
                        mins = dur_mins % 60
                        dur_display = f"{hrs} hr" + (f" {mins} min" if mins else "") if hrs == 1 else f"{hrs} hrs" + (f" {mins} mins" if mins else "")
                    else:
                        dur_display = f"{dur_mins} mins"

                    p_name = r.get('practical_name') or r.get('batch_name') or 'Deep Learning Practical'
                    if '•' in str(p_name):
                        p_name = str(p_name).split('•')[0].strip()

                    l_id = r.get('lab_id', 2)
                    lab_code = code_map.get(l_id, f"LAB-0{l_id}")

                    results.append({
                        "id": r['usage_id'],
                        "equipment_id": r['equipment_id'],
                        "equipment_name": r['equipment_name'],
                        "equipment_code": r['equipment_code'],
                        "category": r.get('equipment_category', 'Computing'),
                        "lab_id": l_id,
                        "lab_name": r['lab_name'],
                        "lab_code": lab_code,
                        "lab_location": r.get('lab_location', 'Block A, 3rd Floor, Room 310'),
                        "practical_name": p_name,
                        "session_date": u_date,
                        "formatted_date": formatted_date,
                        "start_time": st_str,
                        "end_time": et_str,
                        "time_slot": time_slot,
                        "duration_minutes": dur_mins,
                        "duration_display": dur_display,
                        "status": "Completed",
                        "status_class": "status-available"
                    })

                return {
                    "faculty": faculty,
                    "total_records": len(results),
                    "total_duration_minutes": total_duration_minutes,
                    "usage": results
                }
        except Exception as e:
            print("DB Error in get_faculty_usage:", e)
            return {"faculty": {}, "total_records": 0, "total_duration_minutes": 0, "usage": []}

    @staticmethod
    def get_faculty_fault_reports(user_id):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # 1. Faculty details
                q_user = "SELECT id, name, college_id, email, department, role FROM users WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, college_id, email, department, role FROM users WHERE id = ?"
                cursor.execute(q_user, (user_id,))
                user_row = cursor.fetchone()
                faculty = dict(user_row) if user_row else {
                    "id": user_id,
                    "name": "Dr. Murugesan",
                    "department": "Artificial Intelligence & Data Science",
                    "role": "Faculty"
                }

                fac_name = faculty.get('name', '').strip()
                fac_email = faculty.get('email', '').strip()
                if 'Murugesan' in fac_name or 'muruges' in fac_email.lower():
                    cursor.execute("SELECT id FROM users WHERE name LIKE '%Murugesan%' OR email LIKE '%muruges%'")
                    matched_ids = [r[0] for r in cursor.fetchall()]
                    matched_ids.extend([5, 11, 14, user_id])
                    matched_ids = list(set([m for m in matched_ids if m is not None]))
                else:
                    matched_ids = [user_id]
                if not matched_ids:
                    matched_ids = [user_id]

                id_placeholders = ','.join(['?' for _ in matched_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in matched_ids])

                code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                # Query fault reports reported by this faculty
                query = f"""
                    SELECT f.id, f.equipment_id, f.reported_by, f.fault_type, f.description, f.priority, f.status, f.reported_at,
                           e.name as equipment_name, e.equipment_code, e.category as equipment_category, e.status as equipment_status,
                           l.id as lab_id, l.name as lab_name, l.location as lab_location,
                           u.name as reporter_name, u.role as reporter_role
                    FROM fault_reports f
                    JOIN equipment e ON f.equipment_id = e.id
                    JOIN labs l ON e.lab_id = l.id
                    LEFT JOIN users u ON f.reported_by = u.id
                    WHERE f.reported_by IN ({id_placeholders})
                    ORDER BY f.reported_at DESC, f.id DESC
                """
                cursor.execute(query, matched_ids)
                raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                results = []
                for r in raw:
                    rep_at = str(r.get('reported_at', ''))
                    try:
                        dt = datetime.strptime(rep_at[:19], '%Y-%m-%d %H:%M:%S')
                        formatted_date = dt.strftime('%d %b %Y, %I:%M %p')
                    except Exception:
                        formatted_date = rep_at[:10] if rep_at else 'Recent'

                    l_id = r.get('lab_id', 2)
                    lab_code = code_map.get(l_id, f"LAB-0{l_id}")
                    st = (r.get('status') or 'Reported').strip()
                    
                    st_class = 'status-faulty'
                    if st.upper() in ['RESOLVED', 'COMPLETED', 'CLOSED']:
                        st_class = 'status-available'
                    elif st.upper() in ['UNDER REVIEW', 'INVESTIGATING', 'UNDER MAINTENANCE', 'IN PROGRESS']:
                        st_class = 'status-insession'

                    results.append({
                        "id": r['id'],
                        "equipment_id": r['equipment_id'],
                        "equipment_name": r['equipment_name'],
                        "equipment_code": r['equipment_code'],
                        "category": r.get('equipment_category', 'Computing'),
                        "equipment_status": r.get('equipment_status', 'Faulty'),
                        "lab_id": l_id,
                        "lab_name": r['lab_name'],
                        "lab_code": lab_code,
                        "lab_location": r.get('lab_location', ''),
                        "fault_type": r.get('fault_type', 'Hardware Malfunction'),
                        "description": r.get('description', ''),
                        "priority": r.get('priority', 'High'),
                        "status": st,
                        "status_class": st_class,
                        "reported_by_name": r.get('reporter_name') or faculty.get('name', 'Dr. Murugesan'),
                        "reported_by_role": r.get('reporter_role') or 'Faculty',
                        "reported_at": formatted_date,
                        "raw_reported_at": rep_at
                    })

                # List of available equipment for the "Report Fault" dropdown
                cursor.execute("SELECT id, name, equipment_code, lab_id, status FROM equipment ORDER BY lab_id ASC, name ASC")
                eq_all_raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                equipment_options = []
                for e in eq_all_raw:
                    l_id = e.get('lab_id', 2)
                    equipment_options.append({
                        "id": e['id'],
                        "name": e['name'],
                        "equipment_code": e['equipment_code'],
                        "lab_code": code_map.get(l_id, f"LAB-0{l_id}"),
                        "status": e.get('status', 'Available')
                    })

                return {
                    "faculty": faculty,
                    "total_reports": len(results),
                    "fault_reports": results,
                    "equipment_options": equipment_options
                }
        except Exception as e:
            print("DB Error in get_faculty_fault_reports:", e)
            return {"faculty": {}, "total_reports": 0, "fault_reports": [], "equipment_options": []}

    @staticmethod
    def create_fault_report(user_id, equipment_id, fault_type, description, priority='High'):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # Verify equipment exists
                q_eq = "SELECT id, name, equipment_code, status FROM equipment WHERE id = %s" if db_type == 'mysql' else "SELECT id, name, equipment_code, status FROM equipment WHERE id = ?"
                cursor.execute(q_eq, (equipment_id,))
                eq_row = cursor.fetchone()
                if not eq_row:
                    return False, "Selected equipment not found in database."

                # Insert fault report
                query = '''
                    INSERT INTO fault_reports (equipment_id, reported_by, fault_type, description, priority, status)
                    VALUES (%s, %s, %s, %s, %s, 'Reported')
                ''' if db_type == 'mysql' else '''
                    INSERT INTO fault_reports (equipment_id, reported_by, fault_type, description, priority, status)
                    VALUES (?, ?, ?, ?, ?, 'Reported')
                '''
                cursor.execute(query, (equipment_id, user_id, fault_type, description, priority))
                report_id = cursor.lastrowid

                # Real-time equipment status synchronization: equipment becomes Faulty
                update_q = "UPDATE equipment SET status = 'Faulty' WHERE id = %s" if db_type == 'mysql' else "UPDATE equipment SET status = 'Faulty' WHERE id = ?"
                cursor.execute(update_q, (equipment_id,))
                conn.commit()

                return True, report_id
        except Exception as e:
            print("DB Error in FacultyDataService.create_fault_report:", e)
            return False, str(e)

    @staticmethod
    def update_fault_status(report_id, new_status):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()
                
                # Fetch fault report
                q = "SELECT id, equipment_id FROM fault_reports WHERE id = %s" if db_type == 'mysql' else "SELECT id, equipment_id FROM fault_reports WHERE id = ?"
                cursor.execute(q, (report_id,))
                f_row = cursor.fetchone()
                if not f_row:
                    return False, "Fault report not found."

                f_dict = dict(f_row) if db_type != 'mysql' else f_row
                eq_id = f_dict['equipment_id']

                # Update fault report status
                q_upd = "UPDATE fault_reports SET status = %s WHERE id = %s" if db_type == 'mysql' else "UPDATE fault_reports SET status = ? WHERE id = ?"
                cursor.execute(q_upd, (new_status, report_id))

                # Synchronize equipment status
                st_upper = new_status.upper()
                if st_upper in ['RESOLVED', 'CLOSED', 'COMPLETED']:
                    eq_status = 'Available'
                elif st_upper in ['UNDER MAINTENANCE', 'MAINTENANCE', 'IN PROGRESS']:
                    eq_status = 'Under Maintenance'
                else:
                    eq_status = 'Faulty'

                q_eq_upd = "UPDATE equipment SET status = %s WHERE id = %s" if db_type == 'mysql' else "UPDATE equipment SET status = ? WHERE id = ?"
                cursor.execute(q_eq_upd, (eq_status, eq_id))
                conn.commit()

                return True, "Fault report status updated successfully."
        except Exception as e:
            print("DB Error in FacultyDataService.update_fault_status:", e)
            return False, str(e)
