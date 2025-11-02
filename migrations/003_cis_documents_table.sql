-- Migration: Add cis_documents table for generated Customer Information Sheets
-- Depends on: 001_schema.sql (verifications table must exist)
-- Author: Generated from Cursor analysis
-- Date: 2025-11-01

CREATE TABLE IF NOT EXISTS cis_documents (
  -- Primary Key
  cis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key to verification (note: verifications table uses 'id' column)
  verification_id UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  
  -- Client Information (from user input at CIS generation time)
  client_name VARCHAR(255) NOT NULL,
  client_address TEXT NOT NULL,
  relationship_start_date DATE NOT NULL,
  
  -- Verified Entity Data (copied from verification at generation time)
  entity_abn VARCHAR(11) NOT NULL,
  entity_acn VARCHAR(9), -- NULL for non-companies
  entity_name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100), -- e.g., "Company (Pty Ltd)", "Sole Trader", "Partnership"
  entity_status VARCHAR(50) NOT NULL, -- e.g., "Active", "Cancelled"
  entity_registration_date DATE,
  
  -- Document Metadata
  document_content BYTEA, -- PDF binary (consider external storage for large files)
  document_filename VARCHAR(255) NOT NULL,
  document_url VARCHAR(500), -- URL if stored in external storage (GCS, S3)
  document_format VARCHAR(20) DEFAULT 'PDF', -- 'PDF', 'HTML', 'DOCX'
  
  -- Document Status
  generation_status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'GENERATED', 'FAILED'
  generation_error TEXT, -- Error message if generation failed
  
  -- Audit & Compliance
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by VARCHAR(100), -- User ID or 'system'
  expires_at TIMESTAMP, -- 7-year retention for AUSTRAC compliance
  
  -- AUSTRAC Compliance Flags
  austrac_cdd_compliant BOOLEAN DEFAULT FALSE,
  austrac_retention_verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_verification FOREIGN KEY (verification_id) REFERENCES verifications(id),
  CONSTRAINT chk_abn_format CHECK (entity_abn ~ '^[0-9]{11}$'),
  CONSTRAINT chk_acn_format CHECK (entity_acn IS NULL OR entity_acn ~ '^[0-9]{9}$')
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_cis_verification_id ON cis_documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_cis_generated_at ON cis_documents(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cis_entity_abn ON cis_documents(entity_abn);
CREATE INDEX IF NOT EXISTS idx_cis_expires_at ON cis_documents(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to auto-set expires_at to 7 years from generation (AUSTRAC requirement)
CREATE OR REPLACE FUNCTION set_cis_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.generated_at IS NOT NULL AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.generated_at + INTERVAL '7 years';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_cis_expiry
BEFORE INSERT ON cis_documents
FOR EACH ROW
EXECUTE FUNCTION set_cis_expiry();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cis_timestamp
BEFORE UPDATE ON cis_documents
FOR EACH ROW
EXECUTE FUNCTION update_cis_timestamp();

-- Add comment for documentation
COMMENT ON TABLE cis_documents IS 'Stores generated Customer Information Sheet documents with 7-year AUSTRAC retention';
COMMENT ON COLUMN cis_documents.verification_id IS 'Links to the trilogy verification that approved this entity';
COMMENT ON COLUMN cis_documents.expires_at IS 'Auto-set to 7 years from generation for AUSTRAC compliance';
COMMENT ON COLUMN cis_documents.document_content IS 'PDF binary data (consider moving to external storage if >5MB)';

