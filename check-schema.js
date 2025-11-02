require('dotenv').config();
const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('📊 Checking verifications table schema...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'verifications'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in verifications table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? '* required' : ''}`);
    });
    
    console.log('\n📊 Checking cis_documents table schema...\n');
    
    const cisResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cis_documents'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in cis_documents table:');
    cisResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? '* required' : ''}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
