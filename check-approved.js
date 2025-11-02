require('dotenv').config();
const pool = require('./dist/config/database.js').default;

async function checkApproved() {
  try {
    const result = await pool.query(`
      SELECT verification_id, entity_name, entity_abn, entity_acn, verification_status, created_at
      FROM verifications 
      WHERE verification_status = 'approved'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\n📊 Approved Verifications:');
    if (result.rows.length === 0) {
      console.log('   ❌ No approved verifications found');
      console.log('\n💡 Creating a test approved verification...\n');
      
      // Create test approved verification
      const insert = await pool.query(`
        INSERT INTO verifications (
          verification_id,
          entity_name,
          entity_abn,
          entity_acn,
          entity_type,
          entity_status,
          entity_registration_date,
          verification_status,
          verification_method,
          document_hash
        ) VALUES (
          gen_random_uuid(),
          'Test Business Pty Ltd',
          '12345678901',
          '123456789',
          'Australian Private Company',
          'Active',
          '2020-01-01',
          'approved',
          'trilogy',
          'test-hash-' || gen_random_uuid()
        )
        RETURNING verification_id, entity_name, entity_abn
      `);
      
      console.log('✅ Created test verification:');
      console.log('   ID:', insert.rows[0].verification_id);
      console.log('   Name:', insert.rows[0].entity_name);
      console.log('   ABN:', insert.rows[0].entity_abn);
    } else {
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.verification_id}`);
        console.log(`      Name: ${row.entity_name}`);
        console.log(`      ABN: ${row.entity_abn}`);
        console.log(`      ACN: ${row.entity_acn || 'N/A'}`);
        console.log('');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkApproved();
