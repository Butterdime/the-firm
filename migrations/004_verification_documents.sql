-- Migration: 004_verification_documents.sql
-- Create table to track uploaded customer proof documents
-- These documents are stored on disk and referenced in database for CIS generation

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('identity', 'address', 'bank', 'abn')),
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure only one document per type per verification
  UNIQUE(verification_id, document_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id 
  ON verification_documents(verification_id);

CREATE INDEX IF NOT EXISTS idx_verification_documents_type 
  ON verification_documents(verification_id, document_type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verification_documents_updated_at
  BEFORE UPDATE ON verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_documents_updated_at();

-- Add columns to cis_documents table for attachment tracking
ALTER TABLE cis_documents 
  ADD COLUMN IF NOT EXISTS attachment_identity_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_address_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_bank_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS total_pages INTEGER,
  ADD COLUMN IF NOT EXISTS has_redacted_bank BOOLEAN DEFAULT FALSE;

-- Comments for documentation
COMMENT ON TABLE verification_documents IS 'Tracks customer proof documents (identity, address, bank, ABN) stored on disk for each verification';
COMMENT ON COLUMN verification_documents.document_type IS 'Type of document: identity (driver license/passport), address (utility bill), bank (statement), abn (ABR certificate)';
COMMENT ON COLUMN verification_documents.file_path IS 'Full file system path where document is stored';
COMMENT ON COLUMN cis_documents.attachment_identity_filename IS 'Filename of embedded identity proof document';
COMMENT ON COLUMN cis_documents.attachment_address_filename IS 'Filename of embedded address proof document';
COMMENT ON COLUMN cis_documents.attachment_bank_filename IS 'Filename of embedded bank statement (with redacted values)';
COMMENT ON COLUMN cis_documents.total_pages IS 'Total number of pages in the complete CIS PDF (summary + attachments)';
COMMENT ON COLUMN cis_documents.has_redacted_bank IS 'Flag indicating if bank statement had monetary values redacted';

