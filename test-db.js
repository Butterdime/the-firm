// Simple test script to check database connection and create test data
require('dotenv').config();
const pool = require('./dist/config/database.js').default;

async function testDatabase() {
  try {
    console.log('Testing database connection...');

    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0].now);

    // Run CIS documents migration if needed
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'cis_documents'
      )
    `);
    console.log('✅ cis_documents table exists:', tableResult.rows[0].exists);

    if (!tableResult.rows[0].exists) {
      console.log('Running CIS documents migration...');
      const migrationSQL = require('fs').readFileSync('./migrations/003_cis_documents_table.sql', 'utf8');
      await pool.query(migrationSQL);
      console.log('✅ Migration completed');
    }

    // Create test document and verification
    console.log('Creating test verification...');

    const docResult = await pool.query(`
      INSERT INTO documents (filename, file_path, mime_type, status)
      VALUES ('test-abn.pdf', 'test', 'application/pdf', 'completed')
      RETURNING id
    `);
    const docId = docResult.rows[0].id;
    console.log('✅ Created test document with ID:', docId);

    const verResult = await pool.query(`
      INSERT INTO verifications (
        document_id, extracted_abn, extracted_acn, extracted_business_name,
        abr_abn, abr_acn, abr_business_name, abr_entity_status, abr_entity_type,
        abr_response_raw, trilogy_check_passed, verification_status
      ) VALUES (
        $1, '12345678901', '123456789', 'TEST COMPANY PTY LTD',
        '12345678901', '123456789', 'TEST COMPANY PTY LTD', 'Active', 'Company',
        '{}', true, 'approved'
      ) RETURNING id
    `, [docId]);

    const verId = verResult.rows[0].id;
    console.log('✅ Created test verification with ID:', verId);

    // Check CIS documents
    const cisResult = await pool.query(`
      SELECT cis_id, client_name, entity_name, generated_at, expires_at
      FROM cis_documents
      ORDER BY generated_at DESC
      LIMIT 5
    `);

    console.log('\n🎉 Test data created successfully!');
    console.log('Document ID:', docId);
    console.log('Verification ID:', verId);
    console.log('CIS Documents:', cisResult.rows.length);
    cisResult.rows.forEach(row => {
      console.log('  -', row.cis_id, row.client_name, row.entity_name, row.generated_at);
    });

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
