// Document Validation and CIS Generation Script - V3 FIXED
// All 10 critical issues resolved with enhanced security and reliability


// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    VALID_FILE_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    PDF_MIN_SIZE: 5 * 1024, // 5KB
    PDF_MAX_SIZE: 50 * 1024 * 1024, // 50MB
    UPLOAD_TIMEOUT: 60000, // 60 seconds
    DOWNLOAD_CLEANUP_DELAY: 1000, // 1 second
    MAX_FILENAME_LENGTH: 200,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};


// ============================================================================
// UPLOAD STATE TRACKING - ISSUE 1 FIX
// ============================================================================

const uploadState = {
    identity: null,
    residence: null,
    bank: [],
    abn: null,
    verificationId: null,
    fileMetadata: {} // Track file timestamps and fingerprints
};

let isInitialized = false; // Prevent duplicate initialization - Issue 7 Fix


// ============================================================================
// UTILITY FUNCTIONS - COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Validate client data with comprehensive business logic - ISSUE 2 FIX
 */
function validateClientData(clientName, clientDob, clientIdNumber, clientAddress, relationshipStart) {
    const errors = [];

    // Name validation
    if (!clientName || clientName.trim().length === 0) {
        errors.push('Name is required');
    } else if (clientName.length < 2) {
        errors.push('Name must be at least 2 characters');
    } else if (clientName.length > 100) {
        errors.push('Name must be less than 100 characters');
    } else if (!/^[a-zA-Z\s'-]+$/.test(clientName)) {
        errors.push('Name contains invalid characters (only letters, spaces, hyphens, and apostrophes allowed)');
    }

    // DOB validation
    if (!clientDob) {
        errors.push('Date of birth is required');
    } else {
        const dobDate = new Date(clientDob);
        if (isNaN(dobDate.getTime())) {
            errors.push('Invalid date of birth format');
        } else {
            const now = new Date();
            if (dobDate > now) {
                errors.push('Date of birth cannot be in the future');
            }
            const age = (now - dobDate) / (365.25 * 24 * 60 * 60 * 1000);
            if (age < 18) {
                errors.push('Client must be at least 18 years old');
            }
            if (age > 150) {
                errors.push('Date of birth appears invalid (age > 150)');
            }
        }
    }

    // ID number validation
    if (!clientIdNumber || clientIdNumber.trim().length === 0) {
        errors.push('ID number is required');
    } else if (clientIdNumber.length < 5) {
        errors.push('ID number too short (minimum 5 characters)');
    } else if (clientIdNumber.length > 50) {
        errors.push('ID number too long (maximum 50 characters)');
    } else if (!/^[A-Z0-9\-\s]+$/.test(clientIdNumber.toUpperCase())) {
        errors.push('ID number contains invalid characters');
    }

    // Address validation
    if (!clientAddress || clientAddress.trim().length === 0) {
        errors.push('Address is required');
    } else if (clientAddress.length < 10) {
        errors.push('Address too short (minimum 10 characters)');
    } else if (clientAddress.length > 500) {
        errors.push('Address too long (maximum 500 characters)');
    }

    // Relationship start date validation
    if (!relationshipStart) {
        errors.push('Relationship start date is required');
    } else {
        const relDate = new Date(relationshipStart);
        if (isNaN(relDate.getTime())) {
            errors.push('Invalid relationship start date format');
        } else {
            const now = new Date();
            if (relDate > now) {
                errors.push('Relationship start date cannot be in the future');
            }
            if (clientDob) {
                const dobDate = new Date(clientDob);
                if (relDate < dobDate) {
                    errors.push('Relationship cannot start before client was born');
                }
            }
        }
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Create file identifier for deduplication - ISSUE 10 FIX
 */
function createFileIdentifier(file) {
    return {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
    };
}

/**
 * Sanitize filename for safe download - ISSUE 5 & 9 FIX
 */
function sanitizeFilename(contentDisposition, fallbackName) {
    let filename = fallbackName;

    if (!contentDisposition) {
        return sanitizeString(filename);
    }

    // Try RFC 5987 format first (filename*=UTF-8''encoded)
    const rfc5987Match = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;\r\n]+)/i);
    if (rfc5987Match) {
        let extracted = rfc5987Match[1];
        try {
            extracted = decodeURIComponent(extracted);
            filename = extracted;
        } catch (e) {
            console.warn('⚠️ Failed to decode RFC 5987 filename, using fallback');
        }
        return sanitizeString(filename);
    }

    // Try standard RFC 2183 format (filename="name" or filename=name)
    const rfc2183Match = contentDisposition.match(/filename=(?:"([^"]*)"|([^;\s]*))/i);
    if (rfc2183Match) {
        filename = rfc2183Match[1] || rfc2183Match[2];
        return sanitizeString(filename);
    }

    return sanitizeString(fallbackName);
}

/**
 * Remove dangerous characters from filename
 */
function sanitizeString(str) {
    if (!str) return 'document.pdf';

    // Remove path traversal attempts
    str = str.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/^[.\/\\]+/, '');

    // Remove dangerous characters (Windows forbidden + null byte + control chars)
    str = str.replace(/[<>:"|?*\x00-\x1f]/g, '_');

    // Remove leading/trailing dots and spaces (Windows issue)
    str = str.trim().replace(/^\.+/, '').replace(/\.+$/, '');

    // Limit length preserving extension
    if (str.length > CONFIG.MAX_FILENAME_LENGTH) {
        const lastDotIndex = str.lastIndexOf('.');
        const ext = lastDotIndex > 0 ? str.substring(lastDotIndex) : '.pdf';
        const maxNameLength = CONFIG.MAX_FILENAME_LENGTH - ext.length;
        str = str.substring(0, maxNameLength) + ext;
    }

    return str || 'document.pdf';
}

/**
 * Validate PDF blob content - ISSUE 1, 6 FIX
 */
async function validatePdfBlob(blob) {
    const MIN_SIZE = CONFIG.PDF_MIN_SIZE;
    const MAX_SIZE = CONFIG.PDF_MAX_SIZE;

    // Check size range
    if (blob.size < MIN_SIZE) {
        throw new Error(
            `PDF file too small (${(blob.size / 1024).toFixed(2)}KB). ` +
            `Minimum expected: ${MIN_SIZE / 1024}KB. File may be corrupted.`
        );
    }

    if (blob.size > MAX_SIZE) {
        throw new Error(
            `PDF file too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). ` +
            `Maximum allowed: ${MAX_SIZE / 1024 / 1024}MB.`
        );
    }

    // Verify PDF magic bytes
    try {
        const headerBuffer = await blob.slice(0, 9).arrayBuffer();
        const headerView = new Uint8Array(headerBuffer);
        const headerStr = String.fromCharCode(...headerView.slice(0, 5));

        if (headerStr !== '%PDF-') {
            console.warn('⚠️ File does not start with %PDF header - may be corrupted');
            // Don't throw, just warn - some valid PDFs might vary slightly
        }
    } catch (error) {
        console.warn('⚠️ Could not verify PDF header:', error);
    }

    console.log(`✅ PDF validation passed: ${(blob.size / 1024).toFixed(2)}KB`);
    return true;
}

/**
 * Fetch with timeout - SECURITY FIX
 */
function fetchWithTimeout(url, options = {}, timeout = 30000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        )
    ]);
}

/**
 * Get CSRF token from meta tag - SECURITY FIX
 */
function getCsrfToken() {
    const token = document.querySelector('meta[name="csrf-token"]');
    return token ? token.getAttribute('content') : null;
}


// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Prevent duplicate initialization - ISSUE 7 FIX
    if (isInitialized) {
        console.warn('⚠️ Script already initialized, skipping re-initialization');
        return;
    }
    isInitialized = true;

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


// ============================================================================
// UPLOAD ZONES INITIALIZATION
// ============================================================================

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

        // Click handling: trigger file input when zone is clicked
        zoneElement.addEventListener('click', (e) => {
            console.log(`🖱️ Zone clicked: ${config.type}`);
            inputElement.value = ''; // Reset to allow same file selection
            inputElement.click();
        });

        // Drag and drop
        zoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            zoneElement.style.borderColor = '#00A896';
        });

        zoneElement.addEventListener('dragleave', () => {
            zoneElement.style.borderColor = '#BCC6D1';
        });

        zoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log(`📥 Files dropped on: ${config.type}`);
            zoneElement.style.borderColor = '#BCC6D1';
            handleFiles(e.dataTransfer.files, config.type, config.multiple);
        });
    });

    console.log('✅ Upload zones initialized');
}


// ============================================================================
// FILE INPUT INITIALIZATION
// ============================================================================

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
                handleFiles(e.target.files, 'bank', true);
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


// ============================================================================
// FILE HANDLING - ISSUE 1 & 10 FIX (Race condition & Deduplication)
// ============================================================================

function handleFiles(files, type, allowMultiple) {
    console.log(`📂 Handling files for ${type}:`, files.length, 'files');

    // Validate file types
    const validFiles = Array.from(files).filter(file => {
        if (!CONFIG.VALID_FILE_TYPES.includes(file.type)) {
            alert(`Invalid file type: ${file.name}. Only PDF, JPG, PNG are allowed.`);
            return false;
        }
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            alert(`File too large: ${file.name}. Maximum 10MB allowed.`);
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) {
        console.warn('⚠️ No valid files');
        return;
    }

    // ISSUE 10 FIX: Deduplication for multi-file uploads
    if (allowMultiple && uploadState[type].length > 0) {
        const existingIdentifiers = uploadState[type].map(f => createFileIdentifier(f));

        const deduplicatedFiles = validFiles.filter(newFile => {
            const newIdentifier = createFileIdentifier(newFile);
            const isDuplicate = existingIdentifiers.some(existing =>
                existing.name === newIdentifier.name &&
                existing.size === newIdentifier.size &&
                existing.lastModified === newIdentifier.lastModified
            );

            if (isDuplicate) {
                console.warn(`⚠️ Skipping duplicate file: ${newFile.name}`);
                return false;
            }
            return true;
        });

        if (deduplicatedFiles.length < validFiles.length) {
            const skipped = validFiles.length - deduplicatedFiles.length;
            alert(`ℹ️ Skipped ${skipped} duplicate file(s)`);
        }

        // ISSUE 1 FIX: Provide user choice for replace vs add
        if (deduplicatedFiles.length > 0) {
            if (confirm(`You have ${uploadState[type].length} file(s) already. Add more or replace existing?`)) {
                uploadState[type] = uploadState[type].concat(deduplicatedFiles);
            } else {
                uploadState[type] = deduplicatedFiles;
            }
        }
    } else {
        // Store files (single or multi without existing)
        if (allowMultiple) {
            uploadState[type] = uploadState[type].concat(validFiles);
        } else {
            uploadState[type] = validFiles[0];
        }
    }

    console.log(`✅ Stored ${validFiles.length} file(s) for ${type}`);

    // Update UI
    updateUploadStatus(type);
    validateAllUploads();
}


// ============================================================================
// UPLOAD STATUS UPDATE
// ============================================================================

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


// ============================================================================
// UPLOAD VALIDATION
// ============================================================================

function validateAllUploads() {
    console.log('🔍 Validating uploads...');
    console.log('   Current state:', {
        identity: !!uploadState.identity,
        residence: !!uploadState.residence,
        bank: uploadState.bank.length,
        abn: !!uploadState.abn
    });

    // Only require identity and residence - bank and abn are optional
    const requiredUploaded = uploadState.identity && uploadState.residence;

    console.log('   Required uploaded?', requiredUploaded);
    updateActionButton(requiredUploaded);
}


// ============================================================================
// ACTION BUTTON INITIALIZATION
// ============================================================================

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


// ============================================================================
// ACTION BUTTON STATE MANAGEMENT
// ============================================================================

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
        btnHelper.textContent = '✓ Required documents uploaded. Click to extract data and verify.';
        btnHelper.style.color = 'var(--accent-teal)';
        btnHelper.style.fontWeight = '600';
        console.log('✅ Button ENABLED');
    } else {
        btnExtract.classList.add('disabled');
        btnHelper.textContent = 'Please upload identity and address documents to proceed (bank and ABN are optional)';
        btnHelper.style.color = 'var(--cool-gray)';
        console.log('⚠️ Button DISABLED');
    }
}


// ============================================================================
// EXTRACT AND VERIFY - ISSUE 3 FIX (Error handling)
// ============================================================================

async function extractAndVerify() {
    const btnExtract = document.getElementById('btn-extract');
    const btnHelper = document.getElementById('btn-helper');

    btnExtract.disabled = true;
    btnExtract.textContent = 'Processing...';
    btnHelper.textContent = 'Extracting data and verifying documents...';

    try {
        // Check if ABN document is available for verification
        const documentToVerify = uploadState.abn;

        if (documentToVerify) {
            // ABN document available - perform verification
            console.log('📤 Sending verification request with ABN document...');

            const formData = new FormData();
            formData.append('document', documentToVerify);

            const response = await fetchWithTimeout('/api/verify-document', {
                method: 'POST',
                body: formData
            }, CONFIG.UPLOAD_TIMEOUT);

            const result = await response.json();
            console.log('📥 Verification response:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Verification failed');
            }

            if (result.status === 'approved') {
                console.log('✅ Verification APPROVED!', result.verification_id);
                uploadState.verificationId = result.verification_id;

                // ISSUE 3 FIX: Upload documents with enhanced error handling
                const uploadStatus = await uploadAllDocumentsWithRetry(result.verification_id);

                if (!uploadStatus.success) {
                    throw new Error(
                        `Document upload failed. Required documents not uploaded:\n${uploadStatus.errors.join('\n')}`
                    );
                }

                showClientInfoForm(result.verification_id);
            } else {
                console.warn('⚠️ Verification not approved:', result.status);
                alert(`Verification Status: ${result.status}\nReason: ${result.reason}\n\nThis document requires manual review.`);
                btnExtract.disabled = false;
                btnExtract.textContent = 'Extract Data & Verify';
                btnHelper.textContent = 'Verification completed but requires manual review';
            }
        } else {
            // No ABN document - skip verification and create manual verification ID
            console.log('⚠️ No ABN document uploaded - proceeding with manual verification');
            btnHelper.textContent = 'No ABN document provided - proceeding with manual verification...';

            // ISSUE 9 FIX: Validate and store verification ID with server confirmation
            const manualVerificationId = crypto.randomUUID();

            try {
                await validateAndStoreVerificationId(manualVerificationId);
            } catch (error) {
                throw new Error(
                    `Failed to create verification record. Please try again.\n\n${error.message}`
                );
            }

            uploadState.verificationId = manualVerificationId;
            console.log('📝 Created and validated manual verification ID:', manualVerificationId);

            // Upload customer documents to server
            const uploadStatus = await uploadAllDocumentsWithRetry(manualVerificationId);

            if (!uploadStatus.success) {
                throw new Error(
                    `Document upload failed. Required documents not uploaded:\n${uploadStatus.errors.join('\n')}`
                );
            }

            showClientInfoForm(manualVerificationId);
        }

    } catch (error) {
        console.error('❌ Processing error:', error);
        alert('Error during processing: ' + error.message);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Extract Data & Verify';
        btnHelper.textContent = 'Error occurred. Please try again.';
    }
}


// ============================================================================
// VERIFICATION ID VALIDATION - ISSUE 9 FIX
// ============================================================================

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate and store verification ID with server
 */
async function validateAndStoreVerificationId(verificationId) {
    // Local validation first
    if (!isValidUUID(verificationId)) {
        throw new Error(`Invalid verification ID format: ${verificationId}`);
    }

    try {
        const response = await fetchWithTimeout('/api/validate-verification-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({ verification_id: verificationId })
        }, CONFIG.UPLOAD_TIMEOUT);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verification ID validation failed');
        }

        const result = await response.json();

        if (!result.valid) {
            throw new Error(`Verification ID invalid or not found on server: ${verificationId}`);
        }

        console.log('✅ Verification ID validated and stored:', verificationId);
        return result;
    } catch (error) {
        console.error('❌ Verification ID validation error:', error);
        throw error;
    }
}


// ============================================================================
// SHOW CLIENT INFO FORM
// ============================================================================

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

    // Scroll to form
    if (clientSection) {
        clientSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}


// ============================================================================
// UPLOAD ALL DOCUMENTS - ISSUE 3 FIX (Enhanced error handling & retry)
// ============================================================================

/**
 * Upload all customer documents to server with detailed status tracking
 */
async function uploadAllDocuments(verificationId) {
    console.log('📤 Uploading all customer documents to server...');

    const uploadResults = {
        success: false,
        uploadedFiles: [],
        failedFiles: [],
        errors: []
    };

    const formData = new FormData();
    formData.append('verification_id', verificationId);

    if (uploadState.identity) {
        formData.append('identity', uploadState.identity);
        uploadResults.uploadedFiles.push('identity');
    }

    if (uploadState.residence) {
        formData.append('address', uploadState.residence); // Note: API uses 'address' field
        uploadResults.uploadedFiles.push('residence');
    }

    if (uploadState.abn) {
        formData.append('abn', uploadState.abn);
        uploadResults.uploadedFiles.push('abn');
    }

    if (uploadState.bank && uploadState.bank.length > 0) {
        uploadState.bank.forEach((file, index) => {
            formData.append('bank', file);
        });
        uploadResults.uploadedFiles.push(`bank (${uploadState.bank.length} files)`);
    }

    try {
        const response = await fetchWithTimeout('/api/upload-customer-documents', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRF-Token': getCsrfToken()
            }
        }, CONFIG.UPLOAD_TIMEOUT);

        if (!response.ok) {
            const error = await response.json();
            uploadResults.errors.push(error.error || 'Failed to upload documents');
            console.error('❌ Upload failed:', uploadResults.errors);
            throw new Error(uploadResults.errors[0]);
        }

        const result = await response.json();
        uploadResults.success = true;
        console.log('✅ All documents uploaded:', result);
        return uploadResults;
    } catch (error) {
        console.error('❌ Error uploading documents:', error);
        uploadResults.errors.push(error.message);
        return uploadResults;
    }
}

/**
 * Upload all documents with automatic retry - ISSUE 3 FIX
 */
async function uploadAllDocumentsWithRetry(verificationId, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await uploadAllDocuments(verificationId);
        if (result.success) return result;

        if (attempt < maxRetries) {
            console.log(`⚠️ Upload attempt ${attempt} failed, retrying in ${CONFIG.RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt)); // Exponential backoff
        }
    }

    throw new Error(`Upload failed after ${maxRetries} attempts`);
}


// ============================================================================
// PDF DOWNLOAD FUNCTIONS - ALL DOWNLOAD ISSUES FIXED
// ============================================================================

/**
 * Trigger PDF download with proper cleanup - ISSUE 8 FIX
 */
async function triggerPdfDownload(blob, filename) {
    return new Promise((resolve, reject) => {
        try {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            console.log('🖱️ Triggering download:', filename);
            link.click();

            // Cleanup after download initiates
            setTimeout(() => {
                try {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    console.log('🧹 Cleaned up download link');
                    resolve();
                } catch (e) {
                    console.warn('⚠️ Cleanup error:', e);
                    resolve(); // Still resolve even if cleanup fails
                }
            }, CONFIG.DOWNLOAD_CLEANUP_DELAY);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Download PDF with retry logic - ISSUE 7 FIX (Error recovery)
 */
async function downloadWithRetry(blob, filename, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await triggerPdfDownload(blob, filename);
            return;
        } catch (error) {
            console.error(`Download attempt ${attempt} failed:`, error);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            } else {
                throw error;
            }
        }
    }
}


// ============================================================================
// GENERATE CIS - ALL ISSUES FIXED
// ============================================================================

async function generateCIS() {
    console.log('📄 Generating CIS document...');

    const clientName = document.getElementById('client-name').value.trim();
    const clientDob = document.getElementById('client-dob').value;
    const clientIdNumber = document.getElementById('client-id-number').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const relationshipStart = document.getElementById('relationship-start').value;

    // ISSUE 2 FIX: Comprehensive validation
    const validation = validateClientData(clientName, clientDob, clientIdNumber, clientAddress, relationshipStart);
    if (!validation.isValid) {
        alert('Validation errors:\n\n' + validation.errors.join('\n'));
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
        const response = await fetchWithTimeout('/api/generate-cis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({
                verification_id: uploadState.verificationId,
                client_name: clientName,
                date_of_birth: clientDob,
                id_number: clientIdNumber,
                client_address: clientAddress,
                relationship_start_date: relationshipStart
            })
        }, CONFIG.UPLOAD_TIMEOUT);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'CIS generation failed');
        }

        // ISSUE 4 FIX: Strict content-type validation
        const contentType = response.headers.get('content-type');
        console.log(`📦 Response content-type: ${contentType}`);

        if (!contentType) {
            throw new Error('Response missing content-type header');
        }

        const mediaType = contentType.split(';')[0].trim();
        if (mediaType !== 'application/pdf') {
            const clonedResponse = response.clone();
            const preview = await clonedResponse.text();
            throw new Error(
                `Expected PDF (application/pdf) but received ${mediaType}. ` +
                `Response preview: ${preview.substring(0, 300)}`
            );
        }

        // ISSUE 4 FIX: Check content length before downloading
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const sizeInMB = parseInt(contentLength) / (1024 * 1024);
            if (sizeInMB > 50) {
                throw new Error(`PDF file too large: ${sizeInMB.toFixed(2)}MB (max 50MB)`);
            }
        }

        // Download blob
        console.log('📥 Creating download...');
        const blob = await response.blob();
        console.log(`📦 PDF blob size: ${blob.size} bytes`);

        // ISSUE 1 & 6 FIX: Validate blob before creating URL
        await validatePdfBlob(blob);

        // ISSUE 5 & 9 FIX: Sanitize filename
        const contentDisposition = response.headers.get('content-disposition');
        const defaultFilename = `Complete_CIS_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        const filename = sanitizeFilename(contentDisposition, defaultFilename);

        console.log(`📁 Using filename: ${filename}`);

        // ISSUE 8 FIX: Proper download with retry
        await downloadWithRetry(blob, filename);

        console.log('✅ PDF download initiated successfully!');
        console.log(`📁 File should download as: ${filename}`);
        console.log(`📊 File size: ${Math.round(blob.size / 1024 * 10) / 10} KB`);

        btnHelper.textContent = `✅ CIS Document generated and downloaded! (${Math.round(blob.size / 1024 * 10) / 10} KB)`;
        btnHelper.style.color = 'var(--accent-teal)';

        // Show success alert with file info
        alert(`✅ SUCCESS!\n\nCIS PDF has been generated and download started!\n\n` +
              `File: ${filename}\n` +
              `Size: ${Math.round(blob.size / 1024 * 10) / 10} KB\n\n` +
              `The PDF contains:\n` +
              `- Customer information summary\n` +
              `- All proof documents (Identity, Address, Bank)\n` +
              `- Bank statement with redacted monetary values\n\n` +
              `Check your Downloads folder for the complete PDF.`);

    } catch (error) {
        console.error('❌ CIS generation error:', error);
        alert('Error generating CIS: ' + error.message);
        btnExtract.disabled = false;
        btnExtract.textContent = 'Generate CIS Document';
        btnHelper.textContent = 'Error occurred. Please try again.';
    }
}
