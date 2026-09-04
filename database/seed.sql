-- LabFlow Lite - Demo Seed Data
USE labflow_lite;

-- Clear existing data (in reverse dependency order)
DELETE FROM equipment_usage;
DELETE FROM maintenance;
DELETE FROM fault_reports;
DELETE FROM bookings;
DELETE FROM equipment;
DELETE FROM labs;
DELETE FROM users;

-- 1. Insert Users (1 Admin, 2 Faculty, 1 Lab Staff, 2 Students)
-- Password for all seed users is 'password123'
INSERT INTO users (id, name, college_id, email, department, password_hash, role) VALUES
(1, 'System Administrator', 'ADM-2026-001', 'admin@college.edu.in', 'Administration', 'scrypt:32768:8:1$WACDTr6P0Uq7dWpi$b81216d3ac3d2aea481aa2b38929d1c5e4f756365dd29d97f6409970e8cd3c4d164b8bee38846bc94a1ee8b909cc183e1330a3f79de9fb2684cb7fc2776a5e05', 'Admin'),
(2, 'Assigned Faculty', 'FAC-ECE-101', 'assigned.faculty@college.edu.in', 'Electronics & Communication', 'scrypt:32768:8:1$WACDTr6P0Uq7dWpi$b81216d3ac3d2aea481aa2b38929d1c5e4f756365dd29d97f6409970e8cd3c4d164b8bee38846bc94a1ee8b909cc183e1330a3f79de9fb2684cb7fc2776a5e05', 'Faculty'),
(4, 'Suresh Kumar', 'STF-LAB-201', 'suresh.kumar@college.edu.in', 'Electrical Engineering', 'scrypt:32768:8:1$WACDTr6P0Uq7dWpi$b81216d3ac3d2aea481aa2b38929d1c5e4f756365dd29d97f6409970e8cd3c4d164b8bee38846bc94a1ee8b909cc183e1330a3f79de9fb2684cb7fc2776a5e05', 'Lab Staff'),
(5, 'Rohan Verma', 'STU-2026-089', 'rohan.verma@student.edu.in', 'Electronics & Communication', 'scrypt:32768:8:1$WACDTr6P0Uq7dWpi$b81216d3ac3d2aea481aa2b38929d1c5e4f756365dd29d97f6409970e8cd3c4d164b8bee38846bc94a1ee8b909cc183e1330a3f79de9fb2684cb7fc2776a5e05', 'Student'),
(6, 'Priya Patel', 'STU-2026-114', 'priya.patel@student.edu.in', 'Computer Science', 'scrypt:32768:8:1$WACDTr6P0Uq7dWpi$b81216d3ac3d2aea481aa2b38929d1c5e4f756365dd29d97f6409970e8cd3c4d164b8bee38846bc94a1ee8b909cc183e1330a3f79de9fb2684cb7fc2776a5e05', 'Student');

-- 2. Insert Labs (2 Labs)
INSERT INTO labs (id, name, location) VALUES
(1, 'Microprocessor & Embedded Systems Lab', 'Block B, 2nd Floor, Room 204'),
(2, 'Advanced Computing & AI Research Lab', 'Block A, 3rd Floor, Room 310');

-- 3. Insert Equipment (7 Items)
INSERT INTO equipment (id, equipment_code, name, category, lab_id, status, qr_code, description) VALUES
(1, 'LAB-MP-001', 'Digital Storage Oscilloscope 100MHz', 'Measurement', 1, 'Available', 'QR_MP001', 'Tektronix 100MHz 2-Channel DSO'),
(2, 'LAB-MP-002', 'ARM Cortex-M4 Microcontroller Trainer Board', 'Trainer Kit', 1, 'Booked', 'QR_MP002', 'Embedded systems hardware development board'),
(3, 'LAB-MP-003', 'Function Signal Generator 25MHz', 'Measurement', 1, 'Faulty', 'QR_MP003', 'Dual-channel arbitrary waveform signal generator'),
(4, 'LAB-MP-004', 'Logic Analyzer 16 Channel', 'Measurement', 1, 'Under Maintenance', 'QR_MP004', 'USB Logic analyzer for embedded bus decoding'),
(5, 'LAB-AI-001', 'NVIDIA RTX 4090 GPU Workstation PC-1', 'Computing', 2, 'Available', 'QR_AI001', 'High-performance AI/ML model training workstation'),
(6, 'LAB-AI-002', 'NVIDIA RTX 4090 GPU Workstation PC-2', 'Computing', 2, 'Booked', 'QR_AI002', 'High-performance AI/ML model training workstation');
-- (3D printer removed)

-- 4. Insert Bookings
INSERT INTO bookings (id, equipment_id, user_id, batch_name, session_date, start_time, end_time, status) VALUES
(1, 2, 2, 'ECE 2026 Batch A', '2026-09-01', '09:30:00', '11:30:00', 'Confirmed'),
(2, 6, 3, 'CSE AI Research Group', '2026-09-01', '14:00:00', '17:00:00', 'Confirmed'),
(3, 1, 5, 'B.Tech Embedded Lab', '2026-08-25', '10:00:00', '12:00:00', 'Completed');

-- 5. Insert Fault Reports
INSERT INTO fault_reports (id, equipment_id, reported_by, fault_type, description, priority, status) VALUES
(1, 3, 2, 'Display Artifacts', 'Channel 1 output amplitude fluctuates uncontrollably and display flickers.', 'High', 'Open'),
(2, 4, 4, 'Power Supply Failure', 'Unit fails to power on via USB or DC adapter.', 'Medium', 'In Progress');

-- 6. Insert Maintenance Records
INSERT INTO maintenance (id, equipment_id, fault_report_id, assigned_to, maintenance_type, description, status, started_at) VALUES
(1, 4, 2, 4, 'Hardware Repair', 'Replaced blown DC jack fuse and verified power rail voltages.', 'In Progress', '2026-08-27 10:00:00');

-- 7. Insert Equipment Usage Records
INSERT INTO equipment_usage (id, equipment_id, booking_id, usage_date, duration_minutes) VALUES
(1, 1, 3, '2026-08-25', 120),
(2, 5, NULL, '2026-08-26', 180),
(3, 2, 1, '2026-08-27', 90);
