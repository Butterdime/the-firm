const pool = require('./dist/config/database.js').default;

async function createTable() {
  try {
    console.log('Creating verification_documents table...');

    await pool.query(`
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

        UNIQUE(verification_id, document_type)
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id
      ON verification_documents(verification_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_documents_type
      ON verification_documents(verification_id, document_type);
    `);

    // Add columns to cis_documents if they don't exist
    await pool.query(`
      ALTER TABLE cis_documents
      ADD COLUMN IF NOT EXISTS attachment_identity_filename VARCHAR(255),
      ADD COLUMN IF NOT EXISTS attachment_address_filename VARCHAR(255),
      ADD COLUMN IF NOT EXISTS attachment_bank_filename VARCHAR(255),
      ADD COLUMN IF NOT EXISTS total_pages INTEGER,
      ADD COLUMN IF NOT EXISTS has_redacted_bank BOOLEAN DEFAULT FALSE;
    `);

    console.log('✅ verification_documents table created successfully');
  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    await pool.end();
  }
}

createTable();
