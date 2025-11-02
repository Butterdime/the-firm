// Document Validation and CIS Generation Script

// Upload state tracking
const uploadState = {
    identity: null,
    residence: null,
    bank: [],
    abn: null,
    verificationId: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Document validation system initializing...');
    console.log('   Upload state:', uploadState);
    initializeUploadZones();
    initializeFileInputs();
    initializeActionButton();
    console.log('✅ System initialized');
});

/**
 * Initialize drag-and-drop zones
 */
function initializeUploadZones() {
    const zones = [
        { id: 'zone-identity', type: 'identity', inputId: 'input-identity', multiple: false },
        { id: 'zone-residence', type: 'residence', inputId: 'input-residence', multiple: false },
        { id: 'zone-bank', type: 'bank', inputId: 'input-bank', multiple: true },
        { id: 'zone-abn', type: 'abn', inputId: 'input-abn', multiple: false }
    ];

    zones.forEach(zone => {
        const zoneElement = document.getElementById(zone.id);
        
        // Click to browse
        zoneElement.addEventListener('click', () => {
            document.getElementById(zone.inputId).click();
        });

        // Drag and drop
        zoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            zoneElement.classList.add('dragover');
        });

        zoneElement.addEventListener('dragleave', () => {
            zoneElement.classList.remove('dragover');
        });

        zoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            zoneElement.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            handleFileUpload(files, zone.type, zone.multiple);
        });
    });
}

/**
 * Initialize file input change handlers
 */
function initializeFileInputs() {
    document.getElementById('input-identity').addEventListener('change', (e) => {
        handleFileUpload(Array.from(e.target.files), 'identity', false);
    });

    document.getElementById('input-residence').addEventListener('change', (e) => {
        handleFileUpload(Array.from(e.target.files), 'residence', false);
    });

    document.getElementById('input-bank').addEventListener('change', (e) => {
        handleFileUpload(Array.from(e.target.files), 'bank', true);
    });

    document.getElementById('input-abn').addEventListener('change', (e) => {
        handleFileUpload(Array.from(e.target.files), 'abn', false);
    });
}

/**
 * Handle file upload
 */
function handleFileUpload(files, type, allowMultiple) {
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = files.filter(file => {
        if (!validTypes.includes(file.type)) {
            alert(`Invalid file type: ${file.name}. Only PDF, JPG, PNG are allowed.`);
            return false;
        }
        if (file.size > maxSize) {
            alert(`File too large: ${file.name}. Maximum 10MB allowed.`);
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) return;

    // Store files
    if (allowMultiple) {
        uploadState[type] = uploadState[type].concat(validFiles);
    } else {
        uploadState[type] = validFiles[0];
    }

    // Update UI
    updateUploadStatus(type);
    validateAllUploads();
}

/**
 * Update upload status indicator
 */
function updateUploadStatus(type) {
    console.log('📊 Updating status for:', type);
    const statusMap = {
        'identity': { indicator: 'status-identity', summary: 'summary-identity', zone: 'zone-identity', label: 'Proof of Identity' },
        'residence': { indicator: 'status-residence', summary: 'summary-residence', zone: 'zone-residence', label: 'Proof of Residence' },
        'bank': { indicator: 'status-bank', summary: 'summary-bank', zone: 'zone-bank', label: 'Bank Statement' },
        'abn': { indicator: 'status-abn', summary: 'summary-abn', zone: 'zone-abn', label: 'ABN Statement' }
    };

    const config = statusMap[type];
    if (!config) {
        console.warn('⚠️ Unknown document type:', type);
        return;
    }

    const hasFile = uploadState[type] && (Array.isArray(uploadState[type]) ? uploadState[type].length > 0 : true);
    console.log('   Has file?', hasFile);

    if (hasFile) {
        document.getElementById(config.indicator).classList.add('completed');
        document.getElementById(config.zone).classList.add('uploaded');
        
        if (type === 'bank') {
            document.getElementById(config.summary).textContent = 
                `✅ ${config.label}: ${uploadState[type].length} file(s) uploaded`;
        } else {
            const fileName = Array.isArray(uploadState[type]) 
                ? uploadState[type][0].name 
                : uploadState[type].name;
            document.getElementById(config.summary).textContent = 
                `✅ ${config.label}: ${fileName}`;
        }
        console.log('   ✓ Updated UI for', type);
    }
}

// SOF-related functions removed (not needed for initial CIS generation)

/**
 * Validate all uploads
 */
function validateAllUploads() {
    console.log('🔍 Validating uploads...');
    const allUploaded = uploadState.identity && 
                       uploadState.residence &&
                       uploadState.bank.length > 0 && 
                       uploadState.abn;
    
    console.log('   All uploaded?', allUploaded);
    updateActionButton(allUploaded);
}

/**
 * Initialize action button
 */
function initializeActionButton() {
    const btnExtract = document.getElementById('btn-extract');
    btnExtract.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('🖱️ Button clicked:', btnExtract.textContent);
        console.log('   Button disabled?', btnExtract.disabled);
        
        if (btnExtract.disabled) {
            console.log('⚠️ Button is disabled, ignoring click');
            return;
        }
        
        if (btnExtract.textContent === 'Extract Data & Verify') {
            console.log('▶️ Starting extraction and verification...');
            await extractAndVerify();
        } else if (btnExtract.textContent === 'Generate CIS Document') {
            console.log('▶️ Starting CIS generation...');
            await generateCIS();
        }
    });
}

/**
 * Update action button state
 */
function updateActionButton(enabled) {
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    
    console.log('🔘 Updating button state:', enabled ? 'ENABLED' : 'DISABLED');
    console.log('   Upload state:', {
        identity: !!uploadState.identity,
        residence: !!uploadState.residence,
        bank: uploadState.bank.length,
        abn: !!uploadState.abn
    });
    
    btnExtract.disabled = !enabled;
    
    if (enabled) {
        btnExtract.classList.remove('disabled');
        btnHelper.textContent = '✓ All documents uploaded. Click to extract data and verify.';
        btnHelper.style.color = 'var(--accent-teal)';
    } else {
        btnExtract.classList.add('disabled');
        btnHelper.textContent = 'Please upload all 4 required AUSTRAC CDD documents to proceed';
        btnHelper.style.color = 'var(--cool-gray)';
    }
}

/**
 * Extract data and verify documents
 */
async function extractAndVerify() {
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    
    btnExtract.disabled = true;
    btnExtract.textContent = 'Processing...';
    btnHelper.textContent = 'Extracting data and verifying documents...';

    try {
        // Use ABN Statement for trilogy verification
        const documentToVerify = uploadState.abn;
        
        if (!documentToVerify) {
            throw new Error('No document selected for verification');
        }

        const formData = new FormData();
        formData.append('document', documentToVerify);

        const response = await fetch('/api/verify-document', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Verification failed');
        }

        if (result.status === 'approved') {
            uploadState.verificationId = result.verification_id;
            showClientInfoForm(result.verification_id);
        } else {
            alert(`Verification Status: ${result.status}\nReason: ${result.reason}\n\nThis document requires manual review.`);
            btnExtract.disabled = false;
            btnExtract.textContent = 'Extract Data & Verify';
            btnHelper.textContent = 'Verification completed but requires manual review';
        }
    } catch (error) {
        console.error('Verification error:', error);
        alert(`Error: ${error.message}`);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Extract Data & Verify';
        btnHelper.textContent = 'Please try again';
    }
}

/**
 * Show client information form
 */
function showClientInfoForm(verificationId) {
    const clientSection = document.getElementById('client-info-section');
    clientSection.style.display = 'block';
    
    // Update button to trigger CIS generation
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    btnExtract.textContent = 'Generate CIS Document';
    btnExtract.disabled = false;
    btnHelper.textContent = 'Fill in client information and click to generate CIS document';
    
    // Scroll to form
    clientSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Generate CIS document
 */
async function generateCIS() {
    const clientName = document.getElementById('client-name').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const relationshipStart = document.getElementById('relationship-start').value;
    
    // Validation
    if (!clientName || !clientAddress || !relationshipStart) {
        alert('Please fill in all client information fields');
        return;
    }
    
    if (!uploadState.verificationId) {
        alert('Verification ID not found. Please complete verification first.');
        return;
    }

    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    
    btnExtract.disabled = true;
    btnExtract.textContent = 'Generating...';
    btnHelper.textContent = 'Generating CIS document...';

    try {
        const response = await fetch('/api/generate-cis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                verification_id: uploadState.verificationId,
                client_name: clientName,
                client_address: clientAddress,
                relationship_start_date: relationshipStart
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert(`CIS Generated Successfully!\nCIS ID: ${result.cis_id}\n\nDownloading document...`);
            // Download the CIS
            window.location.href = result.document_url;
            
            // Reset form for next document
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            throw new Error(result.error || 'CIS generation failed');
        }
    } catch (error) {
        console.error('CIS generation error:', error);
        alert(`Error: ${error.message}`);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Generate CIS Document';
        btnHelper.textContent = 'Please try again';
    }
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { uploadState };
}

