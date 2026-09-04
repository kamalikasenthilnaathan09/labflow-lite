import os
from datetime import datetime, timedelta
from services.db import get_mysql_connection, FacultyDataService

class DisruptionPredictionService:
    @staticmethod
    def calculate_session_disruption_risk(session_id=None, user_id=None):
        conn, db_type = get_mysql_connection()
        try:
            with conn:
                cursor = conn.cursor()

                # 1. Identify logged-in faculty
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

                # 2. Query faculty's upcoming practical sessions from database
                q_sessions = f"""
                    SELECT s.*, l.name as lab_name, l.location as lab_location
                    FROM lab_sessions s
                    JOIN labs l ON s.lab_id = l.id
                    WHERE s.faculty_id IN ({id_placeholders})
                      AND (s.status IS NULL OR UPPER(s.status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED'))
                    ORDER BY s.session_date ASC, s.start_time ASC, s.id ASC
                """
                cursor.execute(q_sessions, matched_ids)
                raw_sessions = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                code_map = {
                    1: 'MP-LAB-01',
                    2: 'DL-LAB-01',
                    3: 'BA-LAB-02',
                    4: 'BDA-LAB-03',
                    5: 'CSM-LAB-04',
                    6: 'DBMS-LAB-05'
                }

                sessions_list = []
                for s in raw_sessions:
                    s_id = s['id']
                    s_date = str(s['session_date'])
                    st = str(s['start_time'])[:5]
                    et = str(s['end_time'])[:5]

                    try:
                        d_obj = datetime.strptime(s_date, '%Y-%m-%d')
                        f_date = d_obj.strftime('%d %b %Y')
                    except Exception:
                        f_date = s_date

                    try:
                        st_dt = datetime.strptime(st, '%H:%M')
                        et_dt = datetime.strptime(et, '%H:%M')
                        time_slot = f"{st_dt.strftime('%I:%M %p')} — {et_dt.strftime('%I:%M %p')}"
                    except Exception:
                        time_slot = f"{st} — {et}"

                    l_id = s.get('lab_id', 2)
                    sec_clean = str(s.get('section', 'B')).replace('Section', '').strip()

                    sessions_list.append({
                        "id": s_id,
                        "practical_name": s['practical_name'],
                        "lab_id": l_id,
                        "lab_name": s['lab_name'],
                        "lab_code": code_map.get(l_id, f"LAB-0{l_id}"),
                        "lab_location": s.get('lab_location', 'College Campus'),
                        "department": s.get('department', faculty.get('department')),
                        "year": s.get('year', 'III Year'),
                        "semester": s.get('semester', 'V Semester'),
                        "section": f"Section {sec_clean}",
                        "batch": s.get('batch', 'Batch 1'),
                        "student_count": s.get('student_count', 40),
                        "session_date": s_date,
                        "formatted_date": f_date,
                        "start_time": st,
                        "end_time": et,
                        "time_slot": time_slot,
                        "academic_context": f"{s.get('year', 'III Year')} • {s.get('semester', 'V Semester')} • Section {sec_clean} • {s.get('batch', 'Batch 1')}"
                    })

                # Pick selected session or default to the next upcoming session
                target_session = None
                if session_id:
                    target_session = next((s for s in sessions_list if str(s['id']) == str(session_id)), None)
                
                if not target_session and sessions_list:
                    target_session = sessions_list[0]

                if not target_session:
                    # Fallback session if database has no scheduled sessions
                    target_session = {
                        "id": 131,
                        "practical_name": "Deep Learning Practical",
                        "lab_id": 2,
                        "lab_name": "Advanced Computing & AI Research Lab",
                        "lab_code": "DL-LAB-01",
                        "lab_location": "Block A, 3rd Floor, Room 310",
                        "department": "Artificial Intelligence & Data Science",
                        "year": "III Year",
                        "semester": "V Semester",
                        "section": "Section B",
                        "batch": "Batch 1",
                        "student_count": 42,
                        "session_date": datetime.now().strftime('%Y-%m-%d'),
                        "formatted_date": datetime.now().strftime('%d %b %Y'),
                        "start_time": "09:00",
                        "end_time": "11:00",
                        "time_slot": "09:00 AM — 11:00 AM",
                        "academic_context": "III Year • V Semester • Section B • Batch 1"
                    }

                lab_id = target_session['lab_id']
                sess_date = target_session['session_date']
                st_str = target_session['start_time'][:5]
                et_str = target_session['end_time'][:5]

                # 3. Query equipment for the session's laboratory
                q_eq = "SELECT * FROM equipment WHERE lab_id = ? ORDER BY id ASC" if db_type != 'mysql' else "SELECT * FROM equipment WHERE lab_id = %s ORDER BY id ASC"
                cursor.execute(q_eq, (lab_id,))
                lab_equipment_raw = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                total_eq_count = len(lab_equipment_raw)
                operational_count = 0
                faulty_count = 0
                maintenance_count = 0
                affected_equipment = []

                # Active fault reports for equipment in this lab
                q_active_faults = """
                    SELECT f.*, e.name as equipment_name, e.equipment_code, e.category as equipment_category, e.status as equipment_status
                    FROM fault_reports f
                    JOIN equipment e ON f.equipment_id = e.id
                    WHERE e.lab_id = ? AND (f.status IS NULL OR UPPER(f.status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED'))
                    ORDER BY f.reported_at DESC
                """ if db_type != 'mysql' else """
                    SELECT f.*, e.name as equipment_name, e.equipment_code, e.category as equipment_category, e.status as equipment_status
                    FROM fault_reports f
                    JOIN equipment e ON f.equipment_id = e.id
                    WHERE e.lab_id = %s AND (f.status IS NULL OR UPPER(f.status) NOT IN ('RESOLVED', 'CLOSED', 'COMPLETED'))
                    ORDER BY f.reported_at DESC
                """
                cursor.execute(q_active_faults, (lab_id,))
                active_faults = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]

                fault_map = {f['equipment_id']: f for f in active_faults}

                for eq in lab_equipment_raw:
                    eq_id = eq['id']
                    st = (eq.get('status') or 'Available').strip()
                    st_upper = st.upper()

                    if st_upper == 'FAULTY':
                        faulty_count += 1
                        fault_detail = fault_map.get(eq_id)
                        rep_at = str(fault_detail.get('reported_at', '')) if fault_detail else ''
                        try:
                            dt = datetime.strptime(rep_at[:19], '%Y-%m-%d %H:%M:%S')
                            f_rep_date = dt.strftime('%d %b %Y, %I:%M %p')
                        except Exception:
                            f_rep_date = rep_at[:10] if rep_at else 'Recent'

                        affected_equipment.append({
                            "id": eq_id,
                            "equipment_code": eq['equipment_code'],
                            "name": eq['name'],
                            "category": eq.get('category', 'Computing'),
                            "status": "Faulty",
                            "status_class": "status-faulty",
                            "fault_type": fault_detail.get('fault_type', 'Hardware Malfunction') if fault_detail else 'Hardware Malfunction',
                            "fault_description": fault_detail.get('description', 'Reported hardware defect') if fault_detail else 'Hardware defect reported',
                            "fault_priority": fault_detail.get('priority', 'High') if fault_detail else 'High',
                            "reported_at": f_rep_date
                        })
                    elif 'MAINTENANCE' in st_upper:
                        maintenance_count += 1
                        affected_equipment.append({
                            "id": eq_id,
                            "equipment_code": eq['equipment_code'],
                            "name": eq['name'],
                            "category": eq.get('category', 'Computing'),
                            "status": "Under Maintenance",
                            "status_class": "status-maintenance",
                            "fault_type": "Scheduled Maintenance",
                            "fault_description": "Apparatus is currently undergoing scheduled service inspection.",
                            "fault_priority": "Medium",
                            "reported_at": "Active Service"
                        })
                    else:
                        operational_count += 1

                # 4. Check for overlapping Confirmed Bookings (conflicts)
                q_conflicts = """
                    SELECT b.*, e.name as equipment_name, e.equipment_code
                    FROM bookings b
                    JOIN equipment e ON b.equipment_id = e.id
                    WHERE e.lab_id = ? AND b.session_date = ? AND b.status = 'Confirmed'
                      AND NOT (b.end_time <= ? OR b.start_time >= ?)
                """ if db_type != 'mysql' else """
                    SELECT b.*, e.name as equipment_name, e.equipment_code
                    FROM bookings b
                    JOIN equipment e ON b.equipment_id = e.id
                    WHERE e.lab_id = %s AND b.session_date = %s AND b.status = 'Confirmed'
                      AND NOT (b.end_time <= %s OR b.start_time >= %s)
                """
                cursor.execute(q_conflicts, (lab_id, sess_date, st_str, et_str))
                conflict_rows = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                booking_conflict_count = len(conflict_rows)

                # 5. Search for strictly Compatible Alternate Equipment (same category only)
                affected_categories = list(set(e['category'] for e in affected_equipment))
                affected_ids = [e['id'] for e in affected_equipment]
                alternate_equipment = []

                if affected_categories:
                    q_placeholders = ','.join(['?' for _ in affected_categories]) if db_type != 'mysql' else ','.join(['%s' for _ in affected_categories])
                    aff_placeholders = ','.join(['?' for _ in affected_ids]) if db_type != 'mysql' else ','.join(['%s' for _ in affected_ids])

                    q_alt = f"""
                        SELECT e.*, l.name as lab_name, l.id as lab_id
                        FROM equipment e
                        JOIN labs l ON e.lab_id = l.id
                        WHERE e.status = 'Available' 
                          AND e.category IN ({q_placeholders})
                          AND e.id NOT IN ({aff_placeholders})
                        ORDER BY (e.lab_id = ?) DESC, e.id ASC
                        LIMIT 3
                    """ if db_type != 'mysql' else f"""
                        SELECT e.*, l.name as lab_name, l.id as lab_id
                        FROM equipment e
                        JOIN labs l ON e.lab_id = l.id
                        WHERE e.status = 'Available' 
                          AND e.category IN ({q_placeholders})
                          AND e.id NOT IN ({aff_placeholders})
                        ORDER BY (e.lab_id = %s) DESC, e.id ASC
                        LIMIT 3
                    """
                    alt_params = affected_categories + affected_ids + [lab_id]
                    cursor.execute(q_alt, alt_params)
                    alt_rows = cursor.fetchall() if db_type == 'mysql' else [dict(r) for r in cursor.fetchall()]
                else:
                    alt_rows = []

                alternate_equipment = []
                for alt in alt_rows:
                    alt_l_id = alt.get('lab_id', 1)
                    alternate_equipment.append({
                        "id": alt['id'],
                        "equipment_code": alt['equipment_code'],
                        "name": alt['name'],
                        "category": alt.get('category', 'Computing'),
                        "lab_name": alt['lab_name'],
                        "lab_code": code_map.get(alt_l_id, f"LAB-0{alt_l_id}"),
                        "status": "Available",
                        "status_class": "status-available"
                    })

                # 6. Calculate Explainable Disruption Risk Score (0 - 100)
                risk_score = 0
                factors = []

                # Factor A: Equipment Operational Availability
                if total_eq_count > 0:
                    avail_pct = round((operational_count / total_eq_count) * 100)
                    if avail_pct >= 90:
                        risk_score += 0
                        factors.append({
                            "name": "Equipment Availability",
                            "status": "success",
                            "badge": "Operational",
                            "badge_class": "badge-emerald",
                            "icon": "bi-check2-circle",
                            "details": f"{operational_count} of {total_eq_count} apparatus operational ({avail_pct}%)"
                        })
                    elif avail_pct >= 65:
                        risk_score += 15
                        factors.append({
                            "name": "Equipment Availability",
                            "status": "warning",
                            "badge": "Reduced Capacity",
                            "badge_class": "badge-amber",
                            "icon": "bi-exclamation-triangle",
                            "details": f"{operational_count} of {total_eq_count} apparatus operational ({avail_pct}%)"
                        })
                    elif avail_pct >= 40:
                        risk_score += 25
                        factors.append({
                            "name": "Equipment Availability",
                            "status": "warning",
                            "badge": "Low Availability",
                            "badge_class": "badge-amber",
                            "icon": "bi-exclamation-triangle",
                            "details": f"Only {operational_count} of {total_eq_count} apparatus operational ({avail_pct}%)"
                        })
                    else:
                        risk_score += 35
                        factors.append({
                            "name": "Equipment Availability",
                            "status": "danger",
                            "badge": "Severe Shortage",
                            "badge_class": "badge-rose",
                            "icon": "bi-x-circle",
                            "details": f"Critical shortage: {operational_count} of {total_eq_count} operational ({avail_pct}%)"
                        })
                else:
                    factors.append({
                        "name": "Equipment Availability",
                        "status": "info",
                        "badge": "No Data",
                        "badge_class": "badge-cyan",
                        "icon": "bi-info-circle",
                        "details": "No physical apparatus assigned to this facility."
                    })

                # Factor B: Faulty Equipment & Active Fault Tickets
                if faulty_count > 0:
                    risk_score += (25 + (faulty_count - 1) * 10)
                    active_fault_names = [e['equipment_code'] for e in affected_equipment if e['status'] == 'Faulty']
                    factors.append({
                        "name": "Active Fault Reports",
                        "status": "danger",
                        "badge": f"{faulty_count} Faulty",
                        "badge_class": "badge-rose",
                        "icon": "bi-exclamation-octagon",
                        "details": f"{faulty_count} apparatus flagged with active fault ticket ({', '.join(active_fault_names)})"
                    })
                else:
                    factors.append({
                        "name": "Active Fault Reports",
                        "status": "success",
                        "badge": "No Active Faults",
                        "badge_class": "badge-emerald",
                        "icon": "bi-shield-check",
                        "details": "Zero active malfunction or hardware defect tickets logged."
                    })

                # Factor C: Maintenance Status
                if maintenance_count > 0:
                    risk_score += 20
                    factors.append({
                        "name": "Scheduled Maintenance",
                        "status": "warning",
                        "badge": f"{maintenance_count} In Service",
                        "badge_class": "badge-amber",
                        "icon": "bi-tools",
                        "details": f"{maintenance_count} apparatus currently undergoing technician maintenance."
                    })
                else:
                    factors.append({
                        "name": "Scheduled Maintenance",
                        "status": "success",
                        "badge": "Clear",
                        "badge_class": "badge-emerald",
                        "icon": "bi-check2-circle",
                        "details": "No facility or apparatus maintenance scheduled during this session."
                    })

                # Factor D: Booking / Slot Conflicts
                if booking_conflict_count > 0:
                    risk_score += 20
                    factors.append({
                        "name": "Booking Conflicts",
                        "status": "warning",
                        "badge": f"{booking_conflict_count} Overlap",
                        "badge_class": "badge-amber",
                        "icon": "bi-calendar-x",
                        "details": f"{booking_conflict_count} apparatus double-booking conflict detected in timetable."
                    })
                else:
                    factors.append({
                        "name": "Booking Conflicts",
                        "status": "success",
                        "badge": "No Conflicts",
                        "badge_class": "badge-emerald",
                        "icon": "bi-calendar-check",
                        "details": "No apparatus double-booking or scheduling conflicts detected."
                    })

                # Cap score at 100 max, 0 min
                final_risk_score = min(max(risk_score, 0), 100)

                # Determine Risk Level
                if final_risk_score >= 60:
                    risk_level = "HIGH"
                    risk_level_class = "status-faulty"
                    risk_color = "#E06C75"
                    recommendation = "High disruption risk detected. Critical apparatus is impaired with an active fault ticket. Dispatch a technician immediately or allocate alternate operational workstations before the practical begins."
                    summary_text = f"High risk of session disruption ({final_risk_score}%) due to active hardware faults on {len(affected_equipment)} apparatus."
                elif final_risk_score >= 30:
                    risk_level = "MEDIUM"
                    risk_level_class = "status-insession"
                    risk_color = "#E5C07B"
                    recommendation = "Review apparatus availability prior to the practical session. Prepare backup workstations or assign students in pairs to minimize downtime."
                    summary_text = f"Moderate disruption risk ({final_risk_score}%) detected in laboratory resources."
                else:
                    risk_level = "LOW"
                    risk_level_class = "status-available"
                    risk_color = "#79A88A"
                    recommendation = "Session is well supported. All required laboratory apparatus are operational with no scheduled maintenance disruptions."
                    summary_text = f"Low risk ({final_risk_score}%). Laboratory apparatus is fully operational for the scheduled practical."

                return {
                    "faculty": faculty,
                    "sessions_list": sessions_list,
                    "selected_session": target_session,
                    "risk_score": final_risk_score,
                    "risk_level": risk_level,
                    "risk_level_class": risk_level_class,
                    "risk_color": risk_color,
                    "summary_text": summary_text,
                    "factors": factors,
                    "affected_equipment": affected_equipment,
                    "alternate_equipment": alternate_equipment,
                    "recommendation": recommendation,
                    "generated_at": datetime.now().strftime('%d %b %Y, %I:%M %p')
                }
        except Exception as e:
            print("DB Error in DisruptionPredictionService.calculate_session_disruption_risk:", e)
            return {
                "faculty": {"name": "Dr. Murugesan", "department": "Artificial Intelligence & Data Science"},
                "sessions_list": [],
                "selected_session": None,
                "risk_score": 0,
                "risk_level": "LOW",
                "risk_level_class": "status-available",
                "risk_color": "#79A88A",
                "summary_text": "Unable to calculate risk.",
                "factors": [],
                "affected_equipment": [],
                "alternate_equipment": [],
                "recommendation": "Check database connectivity.",
                "generated_at": datetime.now().strftime('%d %b %Y, %I:%M %p')
            }
