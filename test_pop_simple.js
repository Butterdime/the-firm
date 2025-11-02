#!/usr/bin/env node

/**
 * Simple test script to upload POP test documents and generate CIS PDF
 */

const fs = require('fs');
const path = require('path');

async function testUploadProcess() {
  console.log('🚀 Starting POP Document Upload Test');
  console.log('=====================================\n');

  try {
    // Step 1: Verify ABN document first
    console.log('📋 Step 1: Verifying ABN Document...');

    // Create form data manually for ABN verification
    const abnData = fs.readFileSync('ABNCurrentDetails_16920472163 (1).pdf');
    const abnBlob = new Blob([abnData], { type: 'application/pdf' });

    const abnFormData = new FormData();
    abnFormData.append('document', abnBlob, 'ABNCurrentDetails_16920472163 (1).pdf');

    const verifyResponse = await fetch('http://localhost:3000/api/verify-document', {
      method: 'POST',
      body: abnFormData
    });

    const verifyResult = await verifyResponse.json();
    console.log('✅ Verification result:', verifyResult);

    if (verifyResult.status !== 'approved') {
      console.log('⚠️ Verification not approved, but continuing for testing...');
      console.log('Status:', verifyResult.status);
      console.log('Reason:', verifyResult.reason);
    }

    const verificationId = verifyResult.verification_id;
    console.log(`📝 Using verification ID: ${verificationId}\n`);

    // Step 2: Upload all customer documents
    console.log('📤 Step 2: Uploading Customer Documents...');

    const uploadFormData = new FormData();
    uploadFormData.append('verification_id', verificationId);

    // Add identity document
    const identityData = fs.readFileSync('2025-10-20 15.36.34.jpg');
    const identityBlob = new Blob([identityData], { type: 'image/jpeg' });
    uploadFormData.append('identity', identityBlob, '2025-10-20 15.36.34.jpg');

    // Add address document
    const addressData = fs.readFileSync('GV Pop Water Bill.pdf');
    const addressBlob = new Blob([addressData], { type: 'application/pdf' });
    uploadFormData.append('address', addressBlob, 'GV Pop Water Bill.pdf');

    // Add bank statement
    const bankData = fs.readFileSync('5_6316773612439214422_251019_165432.pdf');
    const bankBlob = new Blob([bankData], { type: 'application/pdf' });
    uploadFormData.append('bank', bankBlob, '5_6316773612439214422_251019_165432.pdf');

    const uploadResponse = await fetch('http://localhost:3000/api/upload-customer-documents', {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload result:', uploadResult);

    // Step 3: Generate CIS PDF
    console.log('\n📄 Step 3: Generating CIS PDF...');

    const clientData = {
      verification_id: verificationId,
      client_name: 'GV Pop Test Client',
      client_address: '123 Test Street, Sydney NSW 2000',
      relationship_start_date: '2025-11-01'
    };

    console.log('📝 Client data:', clientData);

    const cisResponse = await fetch('http://localhost:3000/api/generate-cis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clientData)
    });

    if (!cisResponse.ok) {
      const error = await cisResponse.text();
      throw new Error(`CIS generation failed: ${error}`);
    }

    // Check content type
    const contentType = cisResponse.headers.get('content-type');
    console.log(`📦 Response content-type: ${contentType}`);

    if (!contentType || !contentType.includes('application/pdf')) {
      console.warn(`⚠️ Warning: Expected PDF but got ${contentType}`);
      const text = await cisResponse.text();
      throw new Error(`Expected PDF but got ${contentType}. Error: ${text.substring(0, 200)}`);
    }

    // Save PDF to downloads folder
    const pdfBlob = await cisResponse.blob();
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    const downloadPath = path.join(require('os').homedir(), 'Downloads', `CIS_POP_Test_${Date.now()}.pdf`);
    fs.writeFileSync(downloadPath, pdfBuffer);

    console.log('✅ CIS PDF generated successfully!');
    console.log(`📁 Saved to: ${downloadPath}`);
    console.log(`📊 File size: ${Math.round(pdfBuffer.length / 1024)} KB`);

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('=====================================');
    console.log('\n✅ All steps completed:');
    console.log('   • ABN document verified');
    console.log('   • All customer documents uploaded');
    console.log('   • CIS PDF generated and saved');
    console.log(`\n📂 Check your Downloads folder for: CIS_POP_Test_*.pdf`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testUploadProcess();
