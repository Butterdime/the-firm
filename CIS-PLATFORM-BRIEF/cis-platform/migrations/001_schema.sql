-- CIS Platform Database Schema
-- Mismatched Verification Prevention Architecture

-- Documents table: stores uploaded files
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    document_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verifications table: stores entity verification results with trilogy check
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- OCR Extracted Data (from Gemini Vision)
    extracted_abn VARCHAR(11),
    extracted_acn VARCHAR(9),
    extracted_business_name TEXT,
    extracted_address TEXT,
    
    -- ABR Verified Data (from public API)
    abr_abn VARCHAR(11),
    abr_acn VARCHAR(9),
    abr_business_name TEXT,
    abr_entity_status VARCHAR(50),
    abr_entity_type VARCHAR(100),
    abr_response_raw JSONB,
    
    -- Trilogy Verification Results (ABN + ACN + Name exact match)
    trilogy_check_passed BOOLEAN NOT NULL,
    verification_status VARCHAR(50) NOT NULL CHECK (verification_status IN ('approved', 'rejected', 'manual_review')),
    mismatch_reason TEXT,
    
    -- Timestamp Validation
    document_capture_date TIMESTAMP,
    verification_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    staleness_warning BOOLEAN DEFAULT FALSE,
    staleness_days INTEGER,
    
    -- Manual Review Fields
    requires_manual_review BOOLEAN DEFAULT FALSE,
    manual_review_completed BOOLEAN DEFAULT FALSE,
    manual_review_by VARCHAR(255),
    manual_review_date TIMESTAMP,
    manual_review_decision VARCHAR(50),
    manual_review_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table: complete decision trail (no false positives)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID REFERENCES verifications(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Event Details
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
        'ocr_extraction', 
        'abr_query', 
        'trilogy_check', 
        'manual_review', 
        'approval', 
        'rejection',
        'staleness_check'
    )),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Decision Context
    decision_maker VARCHAR(50) CHECK (decision_maker IN ('system', 'user')),
    decision_result VARCHAR(50) CHECK (decision_result IN ('pass', 'fail', 'warning', 'flagged')),
    decision_reason TEXT NOT NULL,
    
    -- Data Snapshot (what was compared at this decision point)
    data_snapshot JSONB,
    
    -- User Context
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_verifications_document_id ON verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_verifications_manual_review ON verifications(requires_manual_review) WHERE requires_manual_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_verification_id ON audit_logs(verification_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(event_timestamp);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verifications_updated_at 
    BEFORE UPDATE ON verifications
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
