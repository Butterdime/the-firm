-- Migration: CIS Platform Tables for Multi-Document Verification
-- Author: CIS Platform Implementation
-- Date: 2025-11-01

-- CIS Sessions table - tracks verification sessions
CREATE TABLE IF NOT EXISTS cis_sessions (
  id VARCHAR(100) PRIMARY KEY,
  customer_type VARCHAR(20) NOT NULL DEFAULT 'individual', -- 'individual' or 'entity'
  status VARCHAR(50) NOT NULL DEFAULT 'created', -- 'created', 'documents_processed', 'verified', 'completed', 'failed'
  verification_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- CIS Documents table - stores uploaded documents for each session
CREATE TABLE IF NOT EXISTS cis_documents_platform (
  id SERIAL PRIMARY KEY,
  cis_session_id VARCHAR(100) NOT NULL REFERENCES cis_sessions(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'proofOfId', 'proofOfResidence', 'sourceOfFunds', 'business'
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'processing', 'processed', 'failed'
  extracted_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cis_sessions_status ON cis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cis_sessions_created_at ON cis_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cis_documents_platform_session_id ON cis_documents_platform(cis_session_id);
CREATE INDEX IF NOT EXISTS idx_cis_documents_platform_type ON cis_documents_platform(document_type);
CREATE INDEX IF NOT EXISTS idx_cis_documents_platform_status ON cis_documents_platform(status);

-- Add comments
COMMENT ON TABLE cis_sessions IS 'Tracks CIS verification sessions for multi-document processing';
COMMENT ON TABLE cis_documents_platform IS 'Stores uploaded documents and their extracted data for CIS sessions';
COMMENT ON COLUMN cis_sessions.customer_type IS 'Type of customer: individual or entity/business';
COMMENT ON COLUMN cis_sessions.verification_result IS 'JSON result of cross-verification analysis';
COMMENT ON COLUMN cis_documents_platform.document_type IS 'Type of document uploaded (ID, Address, Bank, Business)';
COMMENT ON COLUMN cis_documents_platform.extracted_data IS 'OCR and AI-extracted information from the document';
