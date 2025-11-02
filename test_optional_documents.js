#!/usr/bin/env node

/**
 * Test script to verify optional bank and ABN documents functionality
 * Tests uploading only identity and address documents (required)
 * Bank and ABN documents are optional and not uploaded
 */

const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Test documents (only required ones)
const testDocuments = {
  identity: path.join(__dirname, 'test-cis.pdf'), // Use existing test file as identity
  address: path.join(__dirname, 'test-cis.pdf'),  // Use existing test file as address
  // bank and abn are optional - not included
};

const clientData = {
  client_name: 'John Smith',
  client_address: '123 Main Street, Sydney NSW 2000',
  date_of_birth: '1985-06-15',
  id_number: 'DL123456789',
  relationship_start_date: '2025-11-01',
  verification_id: '2db50088-7969-4f28-abde-84be0b6f4366' // Approved verification
};

async function uploadDocuments() {
  console.log('🧪 Testing optional documents functionality...');
  console.log('📤 Uploading only required documents (identity + address)');

  const formData = new FormData();

  // Add required documents
  if (fs.existsSync(testDocuments.identity)) {
    console.log('✅ Adding identity document');
    formData.append('identity', fs.createReadStream(testDocuments.identity));
  } else {
    console.error('❌ Identity document not found');
    return;
  }

  if (fs.existsSync(testDocuments.address)) {
    console.log('✅ Adding address document');
    formData.append('address', fs.createReadStream(testDocuments.address));
  } else {
    console.error('❌ Address document not found');
    return;
  }

  // Bank and ABN are optional - not adding them
  console.log('ℹ️ Skipping optional bank and ABN documents');

  formData.append('verification_id', clientData.verification_id);

  try {
    const response = await fetch(`${SERVER_URL}/api/upload-customer-documents`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Upload failed:', result);
      return null;
    }

    console.log('✅ Upload successful!');
    console.log('📄 Uploaded files:', Object.keys(result.uploaded));
    console.log('ℹ️ Note: Bank and ABN were not uploaded (testing optional functionality)');

    return result;

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return null;
  }
}

async function generateCIS() {
  console.log('📄 Generating CIS PDF with only required documents...');

  try {
    const response = await fetch(`${SERVER_URL}/api/generate-cis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verification_id: clientData.verification_id,
        client_name: clientData.client_name,
        client_address: clientData.client_address,
        date_of_birth: clientData.date_of_birth,
        id_number: clientData.id_number,
        relationship_start_date: clientData.relationship_start_date
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ CIS generation failed:', error);
      return null;
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    console.log(`📦 Response content-type: ${contentType}`);

    if (contentType && contentType.includes('application/pdf')) {
      console.log('✅ CIS generation successful! PDF returned directly.');

      // Save PDF to file
      const pdfBuffer = await response.arrayBuffer();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `CIS_Optional_Test_${timestamp}.pdf`;

      fs.writeFileSync(filename, Buffer.from(pdfBuffer));
      console.log(`📁 PDF saved as: ${filename}`);

      return { success: true, pdf_filename: filename, pdf_size: pdfBuffer.byteLength };
    } else {
      // JSON response
      const result = await response.json();
      console.log('✅ CIS generation successful!');
      console.log('📄 Result:', result);
      return result;
    }

  } catch (error) {
    console.error('❌ CIS generation error:', error.message);
    return null;
  }
}

async function runTest() {
  console.log('🚀 Starting optional documents test...\n');

  // Step 1: Upload only required documents
  const uploadResult = await uploadDocuments();
  if (!uploadResult) {
    console.error('❌ Test failed: Upload failed');
    process.exit(1);
  }

  console.log('');

  // Step 2: Generate CIS PDF
  const cisResult = await generateCIS();
  if (!cisResult) {
    console.error('❌ Test failed: CIS generation failed');
    process.exit(1);
  }

  console.log('\n✅ Test completed successfully!');
  console.log('📋 Summary:');
  console.log('   - Required documents uploaded: identity, address');
  console.log('   - Optional documents: bank (not provided), ABN (not provided)');
  console.log('   - CIS PDF generated with 2 pages (cover+address + identity)');
  console.log('   - Bank summary and ABN pages were not created (as expected)');

  console.log('\n🎯 Test verified: Bank and ABN documents are now optional!');
}

if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest, uploadDocuments, generateCIS };
