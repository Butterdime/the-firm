// Document Validation and CIS Generation Script - V2 with Extra Debugging

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
    
    // Check if all required elements exist
    const requiredElements = [
        'zone-identity', 'input-identity', 'status-identity', 'summary-identity',
        'zone-residence', 'input-residence', 'status-residence', 'summary-residence',
        'zone-bank', 'input-bank', 'status-bank', 'summary-bank',
        'zone-abn', 'input-abn', 'status-abn', 'summary-abn',
        'btn-extract', 'btn-helper'
    ];
    
    console.log('🔍 Checking required elements:');
    let allElementsExist = true;
    requiredElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`❌ Missing element: ${id}`);
            allElementsExist = false;
        } else {
            console.log(`  ✅ ${id}`);
        }
    });
    
    if (!allElementsExist) {
        alert('ERROR: Some required form elements are missing! Check console for details.');
        return;
    }
    
    console.log('✅ All elements found, initializing...');
    
    try {
        initializeUploadZones();
        initializeFileInputs();
        initializeActionButton();
        console.log('✅ System initialized successfully');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        alert('Initialization error: ' + error.message);
    }
});

/**
 * Initialize drag-and-drop zones
 */
function initializeUploadZones() {
    console.log('📦 Initializing upload zones...');
    const zones = [
        { id: 'zone-identity', type: 'identity', inputId: 'input-identity', multiple: false },
        { id: 'zone-residence', type: 'residence', inputId: 'input-residence', multiple: false },
        { id: 'zone-bank', type: 'bank', inputId: 'input-bank', multiple: true },
        { id: 'zone-abn', type: 'abn', inputId: 'input-abn', multiple: false }
    ];

    zones.forEach(config => {
        const zoneElement = document.getElementById(config.id);
        const inputElement = document.getElementById(config.inputId);

        if (!zoneElement || !inputElement) {
            console.error(`❌ Missing zone or input: ${config.id}`);
            return;
        }

        // Click to upload
        zoneElement.addEventListener('click', () => {
            console.log(`🖱️ Zone clicked: ${config.type}`);
            inputElement.click();
        });

        // Drag and drop
        zoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            zoneElement.style.borderColor = '#00A896';
        });

        zoneElement.addEventListener('dragleave', () => {
            zoneElement.style.borderColor = '#D1D5DB';
        });

        zoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log(`📥 Files dropped on: ${config.type}`);
            zoneElement.style.borderColor = '#D1D5DB';
            handleFiles(e.dataTransfer.files, config.type, config.multiple);
        });
    });
    
    console.log('✅ Upload zones initialized');
}

/**
 * Initialize file input handlers
 */
function initializeFileInputs() {
    console.log('📝 Initializing file inputs...');
    
    // Identity
    const inputIdentity = document.getElementById('input-identity');
    if (inputIdentity) {
        inputIdentity.addEventListener('change', (e) => {
            console.log('📄 Identity file input changed:', e.target.files.length, 'files');
            if (e.target.files.length > 0) {
                uploadState.identity = e.target.files[0];
                console.log('   File:', e.target.files[0].name);
                updateUploadStatus('identity');
                validateAllUploads();
            }
        });
        console.log('  ✅ Identity input listener added');
    }

    // Residence
    const inputResidence = document.getElementById('input-residence');
    if (inputResidence) {
        inputResidence.addEventListener('change', (e) => {
            console.log('🏠 Residence file input changed:', e.target.files.length, 'files');
            if (e.target.files.length > 0) {
                uploadState.residence = e.target.files[0];
                console.log('   File:', e.target.files[0].name);
                updateUploadStatus('residence');
                validateAllUploads();
            }
        });
        console.log('  ✅ Residence input listener added');
    }

    // Bank statements (multiple files)
    const inputBank = document.getElementById('input-bank');
    if (inputBank) {
        inputBank.addEventListener('change', (e) => {
            console.log('🏦 Bank file input changed:', e.target.files.length, 'files');
            if (e.target.files.length > 0) {
                uploadState.bank = Array.from(e.target.files);
                console.log('   Files:', Array.from(e.target.files).map(f => f.name).join(', '));
                updateUploadStatus('bank');
                validateAllUploads();
            }
        });
        console.log('  ✅ Bank input listener added');
    }

    // ABN
    const inputAbn = document.getElementById('input-abn');
    if (inputAbn) {
        inputAbn.addEventListener('change', (e) => {
            console.log('📋 ABN file input changed:', e.target.files.length, 'files');
            if (e.target.files.length > 0) {
                uploadState.abn = e.target.files[0];
                console.log('   File:', e.target.files[0].name);
                updateUploadStatus('abn');
                validateAllUploads();
            }
        });
        console.log('  ✅ ABN input listener added');
    }
    
    console.log('✅ File inputs initialized');
}

/**
 * Handle dropped/selected files
 */
function handleFiles(files, type, allowMultiple) {
    console.log(`📂 Handling files for ${type}:`, files.length, 'files');
    
    // Validate file types
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = Array.from(files).filter(file => {
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

    if (validFiles.length === 0) {
        console.warn('⚠️ No valid files');
        return;
    }

    // Store files
    if (allowMultiple) {
        uploadState[type] = uploadState[type].concat(validFiles);
    } else {
        uploadState[type] = validFiles[0];
    }

    console.log(`✅ Stored ${validFiles.length} file(s) for ${type}`);

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
        const indicator = document.getElementById(config.indicator);
        const zone = document.getElementById(config.zone);
        const summary = document.getElementById(config.summary);
        
        if (indicator) indicator.classList.add('completed');
        if (zone) zone.classList.add('uploaded');
        
        if (summary) {
            if (type === 'bank') {
                summary.textContent = `✅ ${config.label}: ${uploadState[type].length} file(s) uploaded`;
            } else {
                const fileName = Array.isArray(uploadState[type]) 
                    ? uploadState[type][0].name 
                    : uploadState[type].name;
                summary.textContent = `✅ ${config.label}: ${fileName}`;
            }
        }
        
        console.log('   ✓ Updated UI for', type);
    }
}

/**
 * Validate all uploads
 */
function validateAllUploads() {
    console.log('🔍 Validating uploads...');
    console.log('   Current state:', {
        identity: !!uploadState.identity,
        residence: !!uploadState.residence,
        bank: uploadState.bank.length,
        abn: !!uploadState.abn
    });
    
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
    console.log('🔘 Initializing action button...');
    const btnExtract = document.getElementById('btn-extract');
    
    if (!btnExtract) {
        console.error('❌ Button not found: btn-extract');
        return;
    }
    
    btnExtract.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('🖱️ Button clicked!');
        console.log('   Button text:', btnExtract.textContent);
        console.log('   Button disabled?', btnExtract.disabled);
        
        if (btnExtract.disabled) {
            console.log('⚠️ Button is disabled, ignoring click');
            return;
        }
        
        if (btnExtract.textContent.includes('Extract')) {
            console.log('▶️ Starting extraction and verification...');
            await extractAndVerify();
        } else if (btnExtract.textContent.includes('Generate')) {
            console.log('▶️ Starting CIS generation...');
            await generateCIS();
        }
    });
    
    console.log('✅ Action button listener added');
}

/**
 * Update action button state
 */
function updateActionButton(enabled) {
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    
    console.log('🔘 Updating button state:', enabled ? 'ENABLED' : 'DISABLED');
    
    if (!btnExtract || !btnHelper) {
        console.error('❌ Button or helper not found');
        return;
    }
    
    btnExtract.disabled = !enabled;
    
    if (enabled) {
        btnExtract.classList.remove('disabled');
        btnHelper.textContent = '✓ All documents uploaded. Click to extract data and verify.';
        btnHelper.style.color = 'var(--accent-teal)';
        btnHelper.style.fontWeight = '600';
        console.log('✅ Button ENABLED');
    } else {
        btnExtract.classList.add('disabled');
        btnHelper.textContent = 'Please upload all 4 required AUSTRAC CDD documents to proceed';
        btnHelper.style.color = 'var(--cool-gray)';
        console.log('⚠️ Button DISABLED');
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
            throw new Error('No ABN document selected for verification');
        }

        console.log('📤 Sending verification request...');
        const formData = new FormData();
        formData.append('document', documentToVerify);

        const response = await fetch('/api/verify-document', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log('📥 Verification response:', result);

        if (!response.ok) {
            throw new Error(result.error || 'Verification failed');
        }

        if (result.status === 'approved') {
            console.log('✅ Verification APPROVED!', result.verification_id);
            uploadState.verificationId = result.verification_id;
            showClientInfoForm(result.verification_id);
        } else {
            console.warn('⚠️ Verification not approved:', result.status);
            alert(`Verification Status: ${result.status}\nReason: ${result.reason}\n\nThis document requires manual review.`);
            btnExtract.disabled = false;
            btnExtract.textContent = 'Extract Data & Verify';
            btnHelper.textContent = 'Verification completed but requires manual review';
        }

    } catch (error) {
        console.error('❌ Verification error:', error);
        alert('Error during verification: ' + error.message);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Extract Data & Verify';
        btnHelper.textContent = 'Error occurred. Please try again.';
    }
}

/**
 * Show client information form
 */
function showClientInfoForm(verificationId) {
    console.log('📋 Showing client info form');
    const clientSection = document.getElementById('client-info-section');
    if (clientSection) {
        clientSection.style.display = 'block';
    }

    // Update button to trigger CIS generation
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');
    btnExtract.textContent = 'Generate CIS Document';
    btnExtract.disabled = false;
    btnHelper.textContent = 'Fill in client information and click to generate CIS document';

    // Initialize hexagon field interactions
    initializeHexagonFields();

    // Scroll to form
    if (clientSection) {
        clientSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Initialize hexagon field interactions
 */
function initializeHexagonFields() {
    console.log('🔷 Initializing hexagon field interactions...');

    const hexagonFields = [
        'field-client-name',
        'field-client-dob',
        'field-client-id-number',
        'field-client-address',
        'field-relationship-start'
    ];

    hexagonFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const input = field.querySelector('.hexagon-input, .hexagon-textarea');

        if (field && input) {
            // Focus event
            input.addEventListener('focus', () => {
                field.classList.add('focused');
                field.classList.remove('error');
            });

            // Blur event
            input.addEventListener('blur', () => {
                field.classList.remove('focused');
                validateHexagonField(fieldId);
            });

            // Input event for real-time validation
            input.addEventListener('input', () => {
                validateHexagonField(fieldId);
            });
        }
    });

    console.log('✅ Hexagon field interactions initialized');
}

/**
 * Validate individual hexagon field
 */
function validateHexagonField(fieldId) {
    const field = document.getElementById(fieldId);
    const input = field.querySelector('.hexagon-input, .hexagon-textarea');
    const errorDiv = field.querySelector('.hexagon-error');
    const inputId = input.id;

    let isValid = true;
    let errorMessage = '';

    // Get field value
    const value = input.value.trim();

    // Field-specific validation
    switch (inputId) {
        case 'client-name':
            if (!value) {
                isValid = false;
                errorMessage = 'Client name is required';
            } else if (value.length < 2) {
                isValid = false;
                errorMessage = 'Client name must be at least 2 characters';
            } else if (value.length > 255) {
                isValid = false;
                errorMessage = 'Client name must be less than 255 characters';
            }
            break;

        case 'client-dob':
            if (!value) {
                isValid = false;
                errorMessage = 'Date of birth is required';
            } else {
                const date = new Date(value);
                const today = new Date();
                const minAge = 18;
                const maxAge = 120;

                if (isNaN(date.getTime())) {
                    isValid = false;
                    errorMessage = 'Please enter a valid date';
                } else if (date > today) {
                    isValid = false;
                    errorMessage = 'Date of birth cannot be in the future';
                } else {
                    const age = today.getFullYear() - date.getFullYear();
                    if (age < minAge) {
                        isValid = false;
                        errorMessage = 'Client must be at least 18 years old';
                    } else if (age > maxAge) {
                        isValid = false;
                        errorMessage = 'Please verify the date of birth';
                    }
                }
            }
            break;

        case 'client-id-number':
            if (!value) {
                isValid = false;
                errorMessage = 'ID number is required';
            } else if (value.length < 5) {
                isValid = false;
                errorMessage = 'ID number must be at least 5 characters';
            } else if (value.length > 20) {
                isValid = false;
                errorMessage = 'ID number must be less than 20 characters';
            } else if (!/^[A-Z0-9\s\-\.]+$/i.test(value)) {
                isValid = false;
                errorMessage = 'ID number can only contain letters, numbers, spaces, hyphens, and periods';
            }
            break;

        case 'client-address':
            if (!value) {
                isValid = false;
                errorMessage = 'Client address is required';
            } else if (value.length < 10) {
                isValid = false;
                errorMessage = 'Please provide a complete address';
            } else if (value.length > 500) {
                isValid = false;
                errorMessage = 'Address must be less than 500 characters';
            }
            break;

        case 'relationship-start':
            if (!value) {
                isValid = false;
                errorMessage = 'Relationship start date is required';
            } else {
                const date = new Date(value);
                const today = new Date();
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(today.getFullYear() - 1);
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(today.getFullYear() + 1);

                if (isNaN(date.getTime())) {
                    isValid = false;
                    errorMessage = 'Please enter a valid date';
                } else if (date > oneYearFromNow) {
                    isValid = false;
                    errorMessage = 'Relationship start date cannot be more than 1 year in the future';
                } else if (date < oneYearAgo) {
                    isValid = false;
                    errorMessage = 'Please verify the relationship start date';
                }
            }
            break;
    }

    // Update field appearance
    if (!isValid) {
        field.classList.add('error');
        errorDiv.textContent = errorMessage;
    } else {
        field.classList.remove('error');
        errorDiv.textContent = '';
    }

    return isValid;
}

/**
 * Validate all hexagon fields
 */
function validateAllHexagonFields() {
    const fields = [
        'field-client-name',
        'field-client-dob',
        'field-client-id-number',
        'field-client-address',
        'field-relationship-start'
    ];

    let allValid = true;
    fields.forEach(fieldId => {
        if (!validateHexagonField(fieldId)) {
            allValid = false;
        }
    });

    return allValid;
}

/**
 * Generate CIS document
 */
async function generateCIS() {
    console.log('📄 Generating CIS document...');

    // Get form values
    const clientName = document.getElementById('client-name').value.trim();
    const clientDob = document.getElementById('client-dob').value;
    const clientIdNumber = document.getElementById('client-id-number').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const relationshipStart = document.getElementById('relationship-start').value;

    // Validate all hexagon fields
    console.log('🔍 Validating form fields...');
    if (!validateAllHexagonFields()) {
        alert('Please correct the highlighted errors before generating the CIS document.');
        return;
    }

    // Additional validation for required fields
    if (!clientName || !clientDob || !clientIdNumber || !clientAddress || !relationshipStart) {
        alert('Please fill in all required client information fields');
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
        console.log('📤 Sending CIS generation request...');
        console.log('   Client Name:', clientName);
        console.log('   DOB:', clientDob);
        console.log('   ID Number:', clientIdNumber);
        console.log('   Address:', clientAddress.substring(0, 30) + '...');
        console.log('   Relationship Start:', relationshipStart);

        const response = await fetch('/api/generate-cis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                verification_id: uploadState.verificationId,
                client_name: clientName,
                date_of_birth: clientDob,
                id_number: clientIdNumber,
                client_address: clientAddress,
                relationship_start_date: relationshipStart
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'CIS generation failed');
        }

        console.log('📥 CIS generated successfully');

        // Download PDF
        const blob = await response.blob();
        console.log(`📦 PDF blob size: ${blob.size} bytes`);

        // Validate blob size
        if (blob.size === 0) {
            throw new Error('Received empty PDF file');
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('content-disposition');
        const defaultFilename = `CIS_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        let filename = defaultFilename;

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }

        a.download = filename;
        document.body.appendChild(a);

        // Small delay to ensure download starts before cleanup
        setTimeout(() => {
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        console.log('✅ PDF downloaded');
        alert(`CIS Document generated successfully!\n\nFile: ${filename}\nSize: ${Math.round(blob.size / 1024)} KB`);
        btnHelper.textContent = `✅ CIS Document generated and downloaded (${Math.round(blob.size / 1024)} KB)`;
        btnHelper.style.color = 'var(--accent-teal)';

    } catch (error) {
        console.error('❌ CIS generation error:', error);
        alert('Error generating CIS: ' + error.message);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Generate CIS Document';
        btnHelper.textContent = 'Error occurred. Please try again.';
    }
}

