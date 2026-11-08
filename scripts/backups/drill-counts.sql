-- Restore drill: READ-ONLY row counts (docs/runbooks/backup-setup.md, part C).
-- Run the same file against the scratch branch and against production (read-only role backup_ro),
-- then compare. It only SELECTs; it never writes. Output holds counts and the newest migration id only,
-- no personal data.
BEGIN TRANSACTION READ ONLY;

SELECT 'alembic_version' AS item, version_num::text AS value FROM alembic_version
UNION ALL SELECT 'clinic_settings',  count(*)::text FROM clinic_settings
UNION ALL SELECT 'department',       count(*)::text FROM department
UNION ALL SELECT 'doctor',           count(*)::text FROM doctor
UNION ALL SELECT 'doctor_weekly_schedule', count(*)::text FROM doctor_weekly_schedule
UNION ALL SELECT 'lab_test',         count(*)::text FROM lab_test
UNION ALL SELECT 'health_package',   count(*)::text FROM health_package
UNION ALL SELECT 'appointment',      count(*)::text FROM appointment
UNION ALL SELECT 'appointment_status_change', count(*)::text FROM appointment_status_change
UNION ALL SELECT 'audit_log',        count(*)::text FROM audit_log
UNION ALL SELECT 'staff_account',    count(*)::text FROM staff_account
UNION ALL SELECT 'newest_booking_created_at', coalesce(max(created_at)::text, 'none') FROM appointment;

COMMIT;
