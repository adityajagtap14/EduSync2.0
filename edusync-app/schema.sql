-- ═══════════════════════════════════════════════════════════════════
-- EduSync — Supabase Database Schema
-- Run this in your Supabase SQL Editor to create all tables.
-- ═══════════════════════════════════════════════════════════════════

-- ─── USERS TABLE (Authentication) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('dean', 'unified', 'faculty', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── FACULTY TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    semester TEXT DEFAULT 'Spring 2026',
    subject TEXT,
    primary_activity TEXT DEFAULT 'Lecture',
    email TEXT UNIQUE,
    is_phd BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ACTIVITIES TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    hours NUMERIC(5,1) NOT NULL,
    fte_value NUMERIC(5,1) NOT NULL,
    status TEXT DEFAULT 'Verified',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SETTINGS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════

-- Demo passwords: dean123, faculty123, admin123
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Dean Admin', 'dean@edusync.edu', 'dean123', 'unified'),
    ('Dr. A. Sharma', 'sharma@edusync.edu', 'faculty123', 'faculty'),
    ('System Admin', 'admin@edusync.edu', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Faculty seed data
INSERT INTO faculty (name, department, semester, subject, primary_activity, email, is_phd) VALUES
    ('Dr. A. Sharma', 'Computer Science', 'Spring 2026', 'Advanced Algorithms', 'Lecture', 'sharma@edusync.edu', true),
    ('Prof. R. Gupta', 'Mechanical', 'Spring 2026', 'Fluid Dynamics', 'Laboratory', 'gupta@edusync.edu', true),
    ('Dr. S. Reddy', 'Civil', 'Spring 2026', 'Structural Analysis', 'Administrative', 'reddy@edusync.edu', true),
    ('Dr. K. Singh', 'Electrical', 'Spring 2026', 'Power Systems', 'Clinical', 'singh@edusync.edu', false),
    ('Prof. M. Desai', 'AI & ML', 'Spring 2026', 'Neural Networks', 'Lecture', 'desai@edusync.edu', true),
    ('Dr. N. Patel', 'Biotech', 'Spring 2026', 'Genetic Engineering', 'Research', 'patel@edusync.edu', false),
    ('Dr. V. Kumar', 'Computer Science', 'Spring 2026', 'Data Structures', 'Lecture', 'kumar@edusync.edu', true),
    ('Prof. P. Iyer', 'Mechanical', 'Spring 2026', 'Thermodynamics', 'Lecture', 'iyer@edusync.edu', false)
ON CONFLICT (email) DO NOTHING;

-- Settings seed data
INSERT INTO settings (key, value) VALUES
    ('lecture_multiplier', '2.0'),
    ('lab_multiplier', '1.5'),
    ('max_weekly_hours', '40'),
    ('orcid_api_token', '')
ON CONFLICT (key) DO NOTHING;

-- Activities seed data
INSERT INTO activities (faculty_id, activity_type, description, hours, fte_value, status) VALUES
    ((SELECT id FROM faculty WHERE email='sharma@edusync.edu'), 'Lecture', 'Adv. Algorithms CS-101', 14, 28.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='sharma@edusync.edu'), 'Mentoring', 'Final Year Projects', 4, 4.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='sharma@edusync.edu'), 'Administrative', 'Curriculum Committee', 4.5, 4.5, 'Verified'),
    ((SELECT id FROM faculty WHERE email='gupta@edusync.edu'), 'Laboratory', 'Fluid Dynamics Lab', 18, 35.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='gupta@edusync.edu'), 'Workshop', 'Workshop Supervision', 5, 8.2, 'Verified'),
    ((SELECT id FROM faculty WHERE email='reddy@edusync.edu'), 'Administrative', 'HOD Duties', 12, 20.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='reddy@edusync.edu'), 'Research', 'Structural Analysis Research', 4, 12.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='singh@edusync.edu'), 'Clinical', 'Power Systems Lab', 16, 30.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='singh@edusync.edu'), 'Research', 'Final Year Guidance', 3, 8.8, 'Verified'),
    ((SELECT id FROM faculty WHERE email='desai@edusync.edu'), 'Lecture', 'Neural Networks', 16, 32.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='desai@edusync.edu'), 'Administrative', 'PhD Committee', 4.5, 9.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='patel@edusync.edu'), 'Research', 'Genetic Engineering Lab', 8, 15.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='patel@edusync.edu'), 'Laboratory', 'Biotech Lab', 7, 14.5, 'Verified'),
    ((SELECT id FROM faculty WHERE email='kumar@edusync.edu'), 'Lecture', 'Data Structures', 15, 30.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='kumar@edusync.edu'), 'Administrative', 'Departmental Seminar', 4.5, 9.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='iyer@edusync.edu'), 'Lecture', 'Thermodynamics', 12.5, 25.0, 'Verified'),
    ((SELECT id FROM faculty WHERE email='iyer@edusync.edu'), 'Mentoring', 'Student Mentoring', 5, 10.0, 'Verified');

-- ═══════════════════════════════════════════════════════════════════
-- ENABLE REALTIME (run once to sync data across all dashboards)
-- ═══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE faculty;

