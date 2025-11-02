-- ===================================================================
-- Database Migration for Mismatch Detection System
-- ===================================================================
-- CORRECTED VERSION - Session ID type mismatch fixed
-- File: migrations/006_mismatch_detection.sql
-- Version: 1.1 (Fixed)
-- ===================================================================

-- 1. Create verification_reports table
CREATE TABLE IF NOT EXISTS verification_reports (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('clear', 'low_risk', 'medium_risk', 'high_risk', 'critical_risk')),
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  can_proceed_to_cis BOOLEAN NOT NULL DEFAULT true,
  review_status VARCHAR(50) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES cis_sessions(id) ON DELETE CASCADE
);

-- 2. Create verification_mismatches table (stores individual field mismatches)
CREATE TABLE IF NOT EXISTS verification_mismatches (
  id SERIAL PRIMARY KEY,
  verification_report_id INTEGER NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  extracted_value TEXT NOT NULL,
  registry_value TEXT NOT NULL,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  recommendation TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (verification_report_id) REFERENCES verification_reports(id) ON DELETE CASCADE
);

-- 3. Create verification_audit_log table (complete audit trail)
-- ✅ FIXED: session_id changed from UUID to VARCHAR(100)
CREATE TABLE IF NOT EXISTS verification_audit_log (
  id SERIAL PRIMARY KEY,
  verification_report_id INTEGER,
  session_id VARCHAR(100),  -- ✅ CHANGED from UUID to VARCHAR(100)
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (verification_report_id) REFERENCES verification_reports(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES cis_sessions(id) ON DELETE SET NULL
);

-- 4. Add verification columns to cis_sessions if they don't exist
ALTER TABLE cis_sessions
ADD COLUMN IF NOT EXISTS verification_report_id INTEGER REFERENCES verification_reports(id);

ALTER TABLE cis_sessions
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending' 
CHECK (verification_status IN ('pending', 'in_progress', 'passed', 'failed', 'manual_review'));

ALTER TABLE cis_sessions
ADD COLUMN IF NOT EXISTS final_risk_score INTEGER;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_reports_session_id ON verification_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_reports_risk_level ON verification_reports(risk_level);
CREATE INDEX IF NOT EXISTS idx_verification_reports_review_status ON verification_reports(review_status);
CREATE INDEX IF NOT EXISTS idx_verification_reports_created_at ON verification_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_mismatches_report_id ON verification_mismatches(verification_report_id);
CREATE INDEX IF NOT EXISTS idx_verification_mismatches_severity ON verification_mismatches(severity);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_session_id ON verification_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_action ON verification_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_cis_sessions_verification_report_id ON cis_sessions(verification_report_id);

-- 6. Create trigger function for audit logging
CREATE OR REPLACE FUNCTION log_verification_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if review_status actually changed
  IF OLD.review_status IS DISTINCT FROM NEW.review_status THEN
    INSERT INTO verification_audit_log (
      verification_report_id,
      session_id,
      action,
      old_value,
      new_value,
      details
    ) VALUES (
      NEW.id,
      NEW.session_id,
      'status_update',
      OLD.review_status,
      NEW.review_status,
      jsonb_build_object(
        'risk_score_old', OLD.risk_score,
        'risk_score_new', NEW.risk_score,
        'risk_level_old', OLD.risk_level,
        'risk_level_new', NEW.risk_level,
        'reviewed_by', NEW.reviewed_by
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger on verification_reports
DROP TRIGGER IF EXISTS verification_reports_audit_trigger ON verification_reports;
CREATE TRIGGER verification_reports_audit_trigger
AFTER UPDATE ON verification_reports
FOR EACH ROW
EXECUTE FUNCTION log_verification_change();

-- 8. Create view for verification dashboard
CREATE OR REPLACE VIEW verification_dashboard AS
SELECT
  vr.id,
  vr.session_id,
  vr.risk_score,
  vr.risk_level,
  vr.mismatch_count,
  COUNT(vm.id) as detailed_mismatch_count,
  SUM(CASE WHEN vm.severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
  SUM(CASE WHEN vm.severity = 'high' THEN 1 ELSE 0 END) as high_count,
  SUM(CASE WHEN vm.severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
  SUM(CASE WHEN vm.severity = 'low' THEN 1 ELSE 0 END) as low_count,
  vr.requires_manual_review,
  vr.can_proceed_to_cis,
  vr.review_status,
  vr.reviewed_by,
  vr.created_at,
  vr.reviewed_at,
  vr.updated_at
FROM verification_reports vr
LEFT JOIN verification_mismatches vm ON vr.id = vm.verification_report_id
GROUP BY vr.id, vr.session_id, vr.risk_score, vr.risk_level, vr.mismatch_count,
         vr.requires_manual_review, vr.can_proceed_to_cis, vr.review_status,
         vr.reviewed_by, vr.created_at, vr.reviewed_at, vr.updated_at;

-- 9. Create function to clean up old audit logs (compliance: 7-year retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 2555)
RETURNS void AS $$
BEGIN
  DELETE FROM verification_audit_log
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep
  AND session_id NOT IN (
    SELECT id FROM cis_sessions WHERE status = 'pending'
  );
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to get verification statistics
CREATE OR REPLACE FUNCTION get_verification_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  total_verifications BIGINT,
  clear_count BIGINT,
  low_risk_count BIGINT,
  medium_risk_count BIGINT,
  high_risk_count BIGINT,
  critical_risk_count BIGINT,
  pending_reviews BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  avg_risk_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_verifications,
    SUM(CASE WHEN risk_level = 'clear' THEN 1 ELSE 0 END) as clear_count,
    SUM(CASE WHEN risk_level = 'low_risk' THEN 1 ELSE 0 END) as low_risk_count,
    SUM(CASE WHEN risk_level = 'medium_risk' THEN 1 ELSE 0 END) as medium_risk_count,
    SUM(CASE WHEN risk_level = 'high_risk' THEN 1 ELSE 0 END) as high_risk_count,
    SUM(CASE WHEN risk_level = 'critical_risk' THEN 1 ELSE 0 END) as critical_risk_count,
    SUM(CASE WHEN review_status = 'pending' AND requires_manual_review THEN 1 ELSE 0 END) as pending_reviews,
    SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
    AVG(risk_score) as avg_risk_score
  FROM verification_reports
  WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;

-- 11. Create verification_field_cache table for performance optimization
CREATE TABLE IF NOT EXISTS verification_field_cache (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL UNIQUE,  -- ✅ VARCHAR(100) matches cis_sessions
  extracted_data JSONB NOT NULL,
  registry_data JSONB NOT NULL,
  abn_data JSONB,
  cache_status VARCHAR(20) NOT NULL DEFAULT 'valid' 
    CHECK (cache_status IN ('valid', 'stale', 'invalid')),
  cached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (session_id) REFERENCES cis_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verification_field_cache_session_id 
  ON verification_field_cache(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_field_cache_expires_at 
  ON verification_field_cache(expires_at);

-- 12. Grant permissions (adjust as needed for your security model)
-- GRANT SELECT, INSERT, UPDATE ON verification_reports TO your_app_user;
-- GRANT SELECT, INSERT ON verification_mismatches TO your_app_user;
-- GRANT SELECT, INSERT ON verification_audit_log TO your_app_user;
-- GRANT SELECT ON verification_dashboard TO your_app_user;

-- ===================================================================
-- Migration complete
-- ===================================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE 'Migration 006 complete. Tables created:';
  RAISE NOTICE '  - verification_reports';
  RAISE NOTICE '  - verification_mismatches';
  RAISE NOTICE '  - verification_audit_log';
  RAISE NOTICE '  - verification_field_cache';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - verification_dashboard';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - log_verification_change()';
  RAISE NOTICE '  - cleanup_old_audit_logs()';
  RAISE NOTICE '  - get_verification_stats()';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Mismatch detection system database schema ready';
END $$;
