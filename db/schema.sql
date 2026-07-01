-- Course Registration System - Database Schema (MySQL)
-- Creates the database and tables used by the frontend data model.
-- Safe to run on a fresh MySQL server.

-- If you want a different database name, edit the CREATE DATABASE line below.
CREATE DATABASE IF NOT EXISTS courseregistration
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE courseregistration;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================
-- Users
-- ============================
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS waitlist_entries;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_students_student_id (student_id),
  UNIQUE KEY uq_students_email (email)
) ENGINE=InnoDB;

-- ============================
-- Course catalog
-- ============================
CREATE TABLE courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_code VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  instructor VARCHAR(200) NOT NULL,

  department VARCHAR(120) NOT NULL,
  semester VARCHAR(60) NOT NULL,

  enrollment_status ENUM('Open','Waitlist') NOT NULL DEFAULT 'Open',
  seats_filled INT NOT NULL DEFAULT 0,
  seats_total INT NOT NULL DEFAULT 0,

  waitlist_count INT NOT NULL DEFAULT 0,
  waitlist_position_info VARCHAR(255) NULL,

  test_date_offset_days INT NOT NULL DEFAULT 14,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_course_code (course_code),
  KEY idx_courses_department_semester (department, semester),
  KEY idx_courses_status (enrollment_status)
) ENGINE=InnoDB;

-- ============================
-- Registrations (student ↔ course)
-- ============================
CREATE TABLE registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id_fk BIGINT UNSIGNED NOT NULL,
  course_id_fk BIGINT UNSIGNED NOT NULL,

  -- Mirrors app.js kcseGrade stored with registration
  kcse_grade VARCHAR(16) NOT NULL,

  -- Optional for future use (derived currently in frontend)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_registration_student_course (student_id_fk, course_id_fk),
  KEY idx_reg_student (student_id_fk),
  KEY idx_reg_course (course_id_fk),

  CONSTRAINT fk_reg_student
    FOREIGN KEY (student_id_fk) REFERENCES students(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_reg_course
    FOREIGN KEY (course_id_fk) REFERENCES courses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================
-- Waitlist entries (optional but aligns with existing model)
-- ============================
CREATE TABLE waitlist_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id_fk BIGINT UNSIGNED NOT NULL,
  course_id_fk BIGINT UNSIGNED NOT NULL,

  position INT NOT NULL,
  probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_waitlist_student_course (student_id_fk, course_id_fk),
  KEY idx_waitlist_course (course_id_fk),

  CONSTRAINT fk_waitlist_student
    FOREIGN KEY (student_id_fk) REFERENCES students(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_waitlist_course
    FOREIGN KEY (course_id_fk) REFERENCES courses(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================
-- Notifications (optional but aligns with existing model)
-- ============================
CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id_fk BIGINT UNSIGNED NOT NULL,

  type ENUM('course','payment','update','payment_reminder','other') NOT NULL DEFAULT 'other',
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notif_student (student_id_fk),
  KEY idx_notif_type (type),

  CONSTRAINT fk_notifications_student
    FOREIGN KEY (student_id_fk) REFERENCES students(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================
-- Seed course catalog (optional convenience)
-- ============================
-- Insert only if courses table is empty.
INSERT IGNORE INTO courses
  (course_code, title, description, instructor, department, semester, enrollment_status, seats_filled, seats_total, waitlist_count, waitlist_position_info, test_date_offset_days)
VALUES
  ('CS 101', 'Intro to Programming', 'Learn fundamental programming concepts including variables, loops, conditionals, and functions. Build your foundation in software development with practical coding exercises.', 'Dr. A. Mwangi', 'Computer Science', 'Semester 1', 'Open', 38, 50, 0, '', 4),
  ('CS 201', 'Data Structures', 'Explore essential data structures including arrays, linked lists, stacks, queues, and trees. Understand how to choose the right structure for optimal performance.', 'Prof. J. Otieno', 'Computer Science', 'Semester 1', 'Waitlist', 60, 60, 17, 'Positions 1–17 available', 10),
  ('IT 120', 'IT Fundamentals', 'Master foundational IT concepts covering computer systems, networking basics, databases, and security. Ideal for those starting their IT journey.', 'Dr. N. Wanjiku', 'IT', 'Semester 1', 'Open', 24, 40, 0, '', 8),
  ('BIT 210', 'Business & Technology', 'Examine the intersection of business strategy and technology implementation. Learn how enterprises leverage IT for competitive advantage.', 'Prof. K. Wambui', 'Business IT', 'Semester 2', 'Open', 29, 45, 0, '', 25),
  ('CS 305', 'Advanced React Patterns', 'Deep dive into advanced React patterns including hooks, context API, performance optimization, and state management. Build scalable web applications.', 'Dr. S. Njoroge', 'Computer Science', 'Semester 2', 'Waitlist', 55, 55, 9, 'Positions 1–9 available', 18),
  ('ENG 110', 'Engineering Fundamentals', 'Introduction to engineering principles, problem-solving methodologies, and technical design. Prepare for advanced engineering courses.', 'Dr. P. Kimani', 'Engineering', 'Semester 2', 'Open', 18, 30, 0, '', 8);

-- Done.

-- Course Registration System - Enhanced Database Schema
-- Adds eligibility validation columns for course drop functionality

-- Update students table with academic and financial status
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_status ENUM('Good','Probation','Suspended') DEFAULT 'Good';
ALTER TABLE students ADD COLUMN IF NOT EXISTS financial_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS minimum_courses INT DEFAULT 1;

-- Update courses table with drop restrictions
ALTER TABLE courses ADD COLUMN IF NOT EXISTS drop_allowed BOOLEAN DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS drop_deadline_days INT DEFAULT 14;

-- Create drop logs table for audit trail
CREATE TABLE IF NOT EXISTS drop_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id_fk BIGINT UNSIGNED NOT NULL,
  course_id_fk BIGINT UNSIGNED NOT NULL,
  drop_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255),
  
  PRIMARY KEY (id),
  KEY idx_drop_student (student_id_fk),
  KEY idx_drop_course (course_id_fk),
  
  CONSTRAINT fk_drop_student
    FOREIGN KEY (student_id_fk) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_drop_course
    FOREIGN KEY (course_id_fk) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Update seed data for courses to include drop deadline info
UPDATE courses SET drop_deadline_days = 14 WHERE course_code IN ('CS 101', 'CS 201', 'IT 120');
UPDATE courses SET drop_deadline_days = 21 WHERE course_code IN ('BIT 210', 'CS 305', 'ENG 110');

-- ============================
-- Tuition and Billing
-- ============================

CREATE TABLE IF NOT EXISTS tuition_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester VARCHAR(60) NOT NULL,
  base_fee DECIMAL(10, 2) NOT NULL,
  per_course_fee DECIMAL(10, 2) NOT NULL,
  max_courses INT NOT NULL DEFAULT 5,
  max_tuition DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uq_tuition_semester (semester)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_billing (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id_fk BIGINT UNSIGNED NOT NULL,
  course_id_fk BIGINT UNSIGNED NOT NULL,
  semester VARCHAR(60) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('Pending','Paid','Credited') DEFAULT 'Pending',
  transaction_type ENUM('Charge','Refund','Credit') DEFAULT 'Charge',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_billing_student (student_id_fk),
  KEY idx_billing_course (course_id_fk),
  
  CONSTRAINT fk_billing_student
    FOREIGN KEY (student_id_fk) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_billing_course
    FOREIGN KEY (course_id_fk) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed tuition policies
INSERT IGNORE INTO tuition_policies (semester, base_fee, per_course_fee, max_courses, max_tuition) VALUES
  ('Semester 1', 5000.00, 2500.00, 5, 17500.00),
  ('Semester 2', 5000.00, 2500.00, 5, 17500.00);

-- Done.
