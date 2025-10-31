-- ============================================================================
-- RPR CIS SCAN v2 - KYC Tables Migration
-- Hybrid Individual KYC + Business Entity Verification
-- ============================================================================
-- IMPORTANT: This migration adds new tables only. Existing tables are NOT modified.
-- Existing tables (verifications, documents, audit_logs) remain unchanged.
-- ============================================================================

-- ============================================================================
-- INDIVIDUALS TABLE (Core KYC record)
-- ============================================================================
CREATE TABLE IF NOT EXISTS individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Personal information
    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    residential_address TEXT NOT NULL,
    postcode VARCHAR(10) NOT NULL,
    
    -- Three-point verification status
    identity_verified BOOLEAN DEFAULT FALSE,
    residence_verified BOOLEAN DEFAULT FALSE,
    bank_verified BOOLEAN DEFAULT FALSE,
    
    -- Overall verification status
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    risk_level VARCHAR(20),
    
    -- AUSTRAC compliance
    austrac_compliant BOOLEAN DEFAULT FALSE,
    compliance_notes TEXT,
    
    -- Data retention (7-year AUSTRAC requirement)
    retention_until DATE NOT NULL,  -- Auto-calculated: created_at + 7 years
    archived_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT check_verification_status CHECK (
        verification_status IN ('pending', 'approved', 'manual_review', 'rejected')
    ),
    CONSTRAINT check_risk_level CHECK (
        risk_level IN ('low', 'medium', 'high', NULL)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_individuals_postcode ON individuals(postcode);
CREATE INDEX IF NOT EXISTS idx_individuals_status ON individuals(verification_status);
CREATE INDEX IF NOT EXISTS idx_individuals_retention ON individuals(retention_until);
CREATE INDEX IF NOT EXISTS idx_individuals_created ON individuals(created_at);

-- Trigger to auto-calculate retention_until
CREATE OR REPLACE FUNCTION set_retention_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.retention_until IS NULL THEN
        NEW.retention_until := NEW.created_at + INTERVAL '7 years';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_retention_trigger
    BEFORE INSERT ON individuals
    FOR EACH ROW
    EXECUTE FUNCTION set_retention_date();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_individuals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_individuals_timestamp
    BEFORE UPDATE ON individuals
    FOR EACH ROW
    EXECUTE FUNCTION update_individuals_timestamp();

-- ============================================================================
-- IDENTITY DOCUMENTS (Point 1: ID verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    
    -- Document details
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100),
    issuing_authority VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    
    -- File storage
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- OCR extraction results
    extracted_name VARCHAR(255),
    extracted_dob DATE,
    extracted_address TEXT,
    extracted_postcode VARCHAR(10),
    ocr_confidence DECIMAL(3,2),
    
    -- Verification results
    name_match BOOLEAN,
    dob_match BOOLEAN,
    document_valid BOOLEAN,
    document_expired BOOLEAN,
    verification_passed BOOLEAN,
    
    -- Timestamps
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    CONSTRAINT check_document_type CHECK (
        document_type IN ('drivers_license', 'passport', 'birth_certificate', 'citizenship_certificate')
    ),
    CONSTRAINT check_ocr_confidence CHECK (
        ocr_confidence >= 0 AND ocr_confidence <= 1
    )
);

CREATE INDEX IF NOT EXISTS idx_identity_docs_individual ON identity_documents(individual_id);
CREATE INDEX IF NOT EXISTS idx_identity_docs_uploaded ON identity_documents(uploaded_at);

-- ============================================================================
-- RESIDENCE DOCUMENTS (Point 2: Address verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS residence_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    
    -- Document details
    document_type VARCHAR(50) NOT NULL,
    issuer VARCHAR(100),
    document_date DATE,
    
    -- File storage
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- OCR extraction results
    extracted_address TEXT,
    extracted_postcode VARCHAR(10),
    ocr_confidence DECIMAL(3,2),
    
    -- Verification results
    address_match BOOLEAN,
    fuzzy_match_score DECIMAL(3,2),  -- 0.00-1.00 similarity score
    document_age_days INTEGER,
    document_fresh BOOLEAN,  -- Within acceptable age limits
    verification_passed BOOLEAN,
    
    -- Timestamps
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    CONSTRAINT check_residence_doc_type CHECK (
        document_type IN ('utility_bill', 'government_letter', 'bank_statement', 'rental_agreement')
    ),
    CONSTRAINT check_fuzzy_score CHECK (
        fuzzy_match_score >= 0 AND fuzzy_match_score <= 1
    )
);

CREATE INDEX IF NOT EXISTS idx_residence_docs_individual ON residence_documents(individual_id);
CREATE INDEX IF NOT EXISTS idx_residence_docs_uploaded ON residence_documents(uploaded_at);

-- ============================================================================
-- BANK VERIFICATION DOCUMENTS (Point 3: Bank account - multi-doc)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bank_verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    bank_verification_id UUID,  -- Links to aggregated result (FK added later)
    
    -- Document details
    document_type VARCHAR(50) NOT NULL,
    document_date DATE,
    
    -- File storage
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- OCR extraction results
    extracted_account_holder VARCHAR(255),
    extracted_bsb VARCHAR(7),
    extracted_account_number VARCHAR(20),
    extracted_bank_name VARCHAR(100),
    ocr_confidence DECIMAL(3,2),
    
    -- Visual authentication results (15 points total in confidence scoring)
    bank_logo_detected VARCHAR(100),  -- e.g., 'Commonwealth Bank', 'Westpac'
    logo_confidence DECIMAL(3,2),
    logo_points INTEGER DEFAULT 0,  -- 0-8 points
    
    font_matched BOOLEAN DEFAULT FALSE,
    font_confidence DECIMAL(3,2),
    font_points INTEGER DEFAULT 0,  -- 0-4 points
    
    watermark_detected BOOLEAN DEFAULT FALSE,
    watermark_confidence DECIMAL(3,2),
    watermark_points INTEGER DEFAULT 0,  -- 0-3 points
    
    visual_auth_total INTEGER DEFAULT 0,  -- Sum of above (0-15)
    
    -- Document authenticity score
    authenticity_score INTEGER,  -- 0-10 scale from Gemini
    
    -- Timestamps
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    CONSTRAINT check_bank_doc_type CHECK (
        document_type IN ('bank_statement', 'transfer_slip', 'deposit_slip', 'mobile_screenshot', 'payment_email', 'internet_banking_pdf')
    ),
    CONSTRAINT check_visual_points CHECK (
        logo_points BETWEEN 0 AND 8 AND
        font_points BETWEEN 0 AND 4 AND
        watermark_points BETWEEN 0 AND 3 AND
        visual_auth_total BETWEEN 0 AND 15
    )
);

CREATE INDEX IF NOT EXISTS idx_bank_docs_individual ON bank_verification_documents(individual_id);
CREATE INDEX IF NOT EXISTS idx_bank_docs_verification ON bank_verification_documents(bank_verification_id);
CREATE INDEX IF NOT EXISTS idx_bank_docs_uploaded ON bank_verification_documents(uploaded_at);

-- ============================================================================
-- BANK VERIFICATIONS (Aggregated bank verification result)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bank_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    
    -- Final determination (from all documents)
    account_holder_name VARCHAR(255) NOT NULL,
    bsb VARCHAR(7),
    account_number VARCHAR(20),
    bank_name VARCHAR(100),
    
    -- Verification methods used
    documents_count INTEGER NOT NULL DEFAULT 0,
    npp_payid_verified BOOLEAN DEFAULT FALSE,
    micro_deposit_verified BOOLEAN DEFAULT FALSE,
    oauth_verified BOOLEAN DEFAULT FALSE,
    
    -- NPP PayID details (if used)
    payid_value VARCHAR(255),
    payid_type VARCHAR(20),  -- 'email', 'phone', 'abn'
    payid_account_name VARCHAR(255),
    payid_match BOOLEAN,
    payid_points INTEGER DEFAULT 0,  -- 0 or 10 points
    
    -- 100-point confidence scoring breakdown
    name_consistency_score INTEGER DEFAULT 0,  -- 0-40 points
    bsb_account_consistency_score INTEGER DEFAULT 0,  -- 0-30 points
    visual_auth_score INTEGER DEFAULT 0,  -- 0-15 points
    npp_score INTEGER DEFAULT 0,  -- 0-10 points
    document_quality_score INTEGER DEFAULT 0,  -- 0-5 points
    
    overall_confidence_score INTEGER NOT NULL,  -- Sum of above (0-100)
    confidence_level VARCHAR(20) NOT NULL,  -- 'HIGH', 'MEDIUM', 'LOW'
    
    -- Entity matching result
    matched_entity_abn VARCHAR(11),
    entity_match_confidence DECIMAL(3,2),
    entity_match_method VARCHAR(50),
    
    -- Verification status
    verification_status VARCHAR(50) NOT NULL,
    verified_at TIMESTAMP,
    
    -- Evidence summary (JSON storage)
    evidence_summary JSONB,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT check_confidence_level CHECK (
        confidence_level IN ('HIGH', 'MEDIUM', 'LOW')
    ),
    CONSTRAINT check_confidence_score CHECK (
        overall_confidence_score BETWEEN 0 AND 100
    ),
    CONSTRAINT check_verification_status CHECK (
        verification_status IN ('approved', 'manual_review', 'rejected', 'pending')
    ),
    CONSTRAINT check_payid_type CHECK (
        payid_type IN ('email', 'phone', 'abn', NULL)
    ),
    CONSTRAINT check_entity_match_method CHECK (
        entity_match_method IN ('exact', 'fuzzy', 'manual', NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_bank_verif_individual ON bank_verifications(individual_id);
CREATE INDEX IF NOT EXISTS idx_bank_verif_status ON bank_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_bank_verif_confidence ON bank_verifications(confidence_level);
CREATE INDEX IF NOT EXISTS idx_bank_verif_created ON bank_verifications(created_at);

-- Add FK to bank_verification_documents (must be done after bank_verifications table exists)
ALTER TABLE bank_verification_documents
ADD CONSTRAINT fk_bank_verification
FOREIGN KEY (bank_verification_id) REFERENCES bank_verifications(id) ON DELETE SET NULL;

-- ============================================================================
-- INDIVIDUAL-ENTITY LINKS (Many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS individual_entity_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    verification_id UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
    
    -- Entity designation
    is_primary_entity BOOLEAN DEFAULT FALSE,
    entity_type VARCHAR(50),
    
    -- Matching details
    link_source VARCHAR(50) NOT NULL,
    match_confidence DECIMAL(3,2),
    match_method VARCHAR(50),
    
    -- Discovery context (if from ABR search)
    discovered_via_search BOOLEAN DEFAULT FALSE,
    search_name VARCHAR(255),
    search_postcode VARCHAR(10),
    search_result_count INTEGER,  -- How many entities found in search
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT check_entity_type CHECK (
        entity_type IN ('discovered_abr', 'bank_matched', 'manual_selected', NULL)
    ),
    CONSTRAINT check_link_source CHECK (
        link_source IN ('abr_search', 'bank_match', 'manual_override', 'customer_selection')
    ),
    CONSTRAINT check_match_method CHECK (
        match_method IN ('exact', 'fuzzy', 'accountant_confirmed', NULL)
    )
);

-- Unique constraint: Only one primary entity per individual
CREATE UNIQUE INDEX idx_one_primary_per_individual 
ON individual_entity_links(individual_id) 
WHERE is_primary_entity = TRUE;

CREATE INDEX IF NOT EXISTS idx_entity_links_individual ON individual_entity_links(individual_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_verification ON individual_entity_links(verification_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_primary ON individual_entity_links(is_primary_entity);

-- ============================================================================
-- ABR SEARCH CACHE (Avoid duplicate searches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS abr_search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Search parameters
    search_name VARCHAR(255) NOT NULL,
    search_postcode VARCHAR(10) NOT NULL,
    
    -- Search results
    entities_found INTEGER NOT NULL,
    entities_data JSONB NOT NULL,  -- Array of {abn, acn, name, status}
    
    -- Cache metadata
    searched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    cache_expires_at TIMESTAMP NOT NULL,  -- Refresh daily
    
    CONSTRAINT unique_search UNIQUE(search_name, search_postcode)
);

CREATE INDEX IF NOT EXISTS idx_abr_cache_expires ON abr_search_cache(cache_expires_at);

-- Auto-expire trigger
CREATE OR REPLACE FUNCTION set_cache_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cache_expires_at IS NULL THEN
        NEW.cache_expires_at := NEW.searched_at + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cache_expiry_trigger
    BEFORE INSERT ON abr_search_cache
    FOR EACH ROW
    EXECUTE FUNCTION set_cache_expiry();

-- ============================================================================
-- ENHANCED AUDIT LOGS (Extend existing audit_logs table)
-- ============================================================================
-- Note: Existing audit_logs table remains unchanged. We add new action types
-- by allowing NULL for verification_id/document_id (for KYC-specific events)

-- Add new action types support (if not already present)
-- This is done via ALTER TABLE to add new values to existing CHECK constraint
-- However, PostgreSQL doesn't support modifying ENUM/CHECK constraints easily,
-- so new action types will be handled in application code validation

-- ============================================================================
-- MANUAL REVIEW QUEUE (Cases requiring human review)
-- ============================================================================
CREATE TABLE IF NOT EXISTS manual_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    
    -- Review details
    review_reason TEXT NOT NULL,
    review_priority VARCHAR(20) DEFAULT 'normal',
    confidence_score INTEGER,
    
    -- Assignment
    assigned_to VARCHAR(255),  -- Accountant email
    assigned_at TIMESTAMP,
    
    -- SLA tracking
    queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    due_at TIMESTAMP,  -- Auto-calculated: 24 hours from queue
    reviewed_at TIMESTAMP,
    
    -- Decision
    decision VARCHAR(50),
    decision_reason TEXT,
    decision_notes TEXT,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    CONSTRAINT check_review_priority CHECK (
        review_priority IN ('urgent', 'normal', 'low')
    ),
    CONSTRAINT check_review_decision CHECK (
        decision IN ('approved', 'rejected', 'request_more_info', NULL)
    ),
    CONSTRAINT check_review_status CHECK (
        status IN ('pending', 'in_progress', 'completed')
    )
);

CREATE INDEX IF NOT EXISTS idx_review_queue_status ON manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_assigned ON manual_review_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_review_queue_due ON manual_review_queue(due_at);
CREATE INDEX IF NOT EXISTS idx_review_queue_individual ON manual_review_queue(individual_id);

-- Auto-calculate SLA due_at (24 hours)
CREATE OR REPLACE FUNCTION set_review_sla()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_at IS NULL THEN
        NEW.due_at := NEW.queued_at + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_review_sla_trigger
    BEFORE INSERT ON manual_review_queue
    FOR EACH ROW
    EXECUTE FUNCTION set_review_sla();

-- ============================================================================
-- CUSTOMER COMMUNICATIONS LOG (All notifications sent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    
    -- Communication details
    communication_type VARCHAR(50) NOT NULL,
    template_name VARCHAR(100),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    
    -- Delivery tracking
    recipient VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Context
    event_trigger VARCHAR(100),
    
    CONSTRAINT check_communication_type CHECK (
        communication_type IN ('email', 'sms', 'in_app_notification')
    )
);

CREATE INDEX IF NOT EXISTS idx_comms_individual ON customer_communications(individual_id);
CREATE INDEX IF NOT EXISTS idx_comms_sent ON customer_communications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_type ON customer_communications(communication_type);

-- ============================================================================
-- NPP PAYID USAGE TRACKING (Cost monitoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS npp_payid_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID REFERENCES individuals(id) ON DELETE SET NULL,
    
    -- PayID details
    payid_value VARCHAR(255) NOT NULL,
    payid_type VARCHAR(20) NOT NULL,
    
    -- API response
    api_success BOOLEAN NOT NULL,
    api_response JSONB,
    api_error TEXT,
    
    -- Cost tracking
    cost DECIMAL(6,2) DEFAULT 0.05,  -- $0.05 per lookup
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_payid_type_usage CHECK (
        payid_type IN ('email', 'phone', 'abn')
    )
);

CREATE INDEX IF NOT EXISTS idx_payid_usage_created ON npp_payid_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payid_usage_individual ON npp_payid_usage(individual_id);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All new tables created. Existing tables (verifications, documents, audit_logs) remain unchanged.

