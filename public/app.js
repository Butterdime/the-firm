// RPR CIS SCAN v1 - Client-side JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitSpinner = document.getElementById('submit-spinner');
    const resultsSection = document.getElementById('results-section');
    const auditToggle = document.getElementById('audit-toggle');
    const auditContent = document.getElementById('audit-content');
    const verifyAnotherBtn = document.getElementById('verify-another');
    const downloadReportBtn = document.getElementById('download-report');

    let selectedFile = null;
    let currentVerificationId = null;

    // File upload handling
    fileInput.addEventListener('change', handleFileSelect);
    removeFileBtn.addEventListener('click', clearFile);

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            displayFileInfo(file);
        }
    }

    function displayFileInfo(file) {
        fileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        dropZone.querySelector('.drop-zone-content').style.display = 'none';
        fileInfo.style.display = 'flex';
    }

    function clearFile() {
        selectedFile = null;
        fileInput.value = '';
        dropZone.querySelector('.drop-zone-content').style.display = 'flex';
        fileInfo.style.display = 'none';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.includes(file.type)) {
                fileInput.files = e.dataTransfer.files;
                selectedFile = file;
                displayFileInfo(file);
            } else {
                alert('Please upload a PDF or image file (JPG, PNG, GIF, WEBP)');
            }
        }
    });

    // Form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!selectedFile) {
            alert('Please select a file to upload');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitText.style.display = 'none';
        submitSpinner.style.display = 'inline-block';
        resultsSection.style.display = 'none';

        try {
            const formData = new FormData();
            formData.append('document', selectedFile);
            
            const documentDate = document.getElementById('document-date').value;
            if (documentDate) {
                formData.append('document_date', documentDate);
            }

            const response = await fetch('/api/verify-document', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                displayResults(data);
                currentVerificationId = data.verification_id;
            } else {
                alert(`Error: ${data.error || 'Verification failed'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while uploading the document. Please try again.');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitText.style.display = 'inline';
            submitSpinner.style.display = 'none';
        }
    });

    // Display verification results
    function displayResults(data) {
        const statusCard = document.getElementById('status-card');
        const statusIcon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        const statusReason = document.getElementById('status-reason');

        // Set status
        statusCard.className = 'status-card ' + data.status;
        
        if (data.status === 'approved') {
            statusIcon.textContent = '✓';
            statusText.textContent = 'Verification Approved';
            statusText.style.color = 'var(--success-color)';
        } else if (data.status === 'manual_review') {
            statusIcon.textContent = '⚠';
            statusText.textContent = 'Manual Review Required';
            statusText.style.color = 'var(--warning-color)';
        } else {
            statusIcon.textContent = '✕';
            statusText.textContent = 'Verification Rejected';
            statusText.style.color = 'var(--danger-color)';
        }

        statusReason.textContent = data.reason || 'No additional information';

        // Display extracted data
        if (data.extracted_data) {
            displayExtractedData(data.extracted_data);
        }

        // Display ABR data
        if (data.abr_data) {
            displayABRData(data.abr_data);
        } else {
            document.getElementById('abr-section').style.display = 'none';
        }

        // Display trilogy checks
        if (data.trilogy_checks) {
            displayTrilogyChecks(data.trilogy_checks);
        } else {
            document.getElementById('trilogy-section').style.display = 'none';
        }

        // Load and display audit trail
        if (data.verification_id) {
            loadAuditTrail(data.verification_id);
        }

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function displayExtractedData(data) {
        const container = document.getElementById('extracted-data');
        container.innerHTML = '';

        const fields = [
            { label: 'ABN', value: data.abn },
            { label: 'ACN', value: data.acn },
            { label: 'Business Name', value: data.business_name },
            { label: 'Address', value: data.address }
        ];

        fields.forEach(field => {
            if (field.value) {
                const item = document.createElement('div');
                item.className = 'detail-item';
                item.innerHTML = `
                    <span class="detail-label">${field.label}</span>
                    <span class="detail-value">${field.value}</span>
                `;
                container.appendChild(item);
            }
        });
    }

    function displayABRData(data) {
        const container = document.getElementById('abr-data');
        container.innerHTML = '';

        const fields = [
            { label: 'ABN', value: data.abn },
            { label: 'ACN', value: data.acn },
            { label: 'Business Name', value: data.business_name },
            { label: 'Entity Status', value: data.entity_status },
            { label: 'Entity Type', value: data.entity_type }
        ];

        fields.forEach(field => {
            if (field.value) {
                const item = document.createElement('div');
                item.className = 'detail-item';
                item.innerHTML = `
                    <span class="detail-label">${field.label}</span>
                    <span class="detail-value">${field.value}</span>
                `;
                container.appendChild(item);
            }
        });
    }

    function displayTrilogyChecks(checks) {
        const container = document.getElementById('trilogy-checks');
        container.innerHTML = '';

        const checkFields = [
            { label: 'ABN Match', key: 'abn_match' },
            { label: 'ACN Match', key: 'acn_match' },
            { label: 'Business Name Match', key: 'name_match' },
            { label: 'Entity Active Status', key: 'entity_active' }
        ];

        checkFields.forEach(field => {
            if (field.key in checks) {
                const isPassing = checks[field.key];
                const item = document.createElement('div');
                item.className = `check-item ${isPassing ? 'pass' : 'fail'}`;
                item.innerHTML = `
                    <span class="check-icon">${isPassing ? '✓' : '✕'}</span>
                    <span class="check-label">${field.label}</span>
                    <span class="detail-value" style="margin-left: auto;">${isPassing ? 'Pass' : 'Fail'}</span>
                `;
                container.appendChild(item);
            }
        });
    }

    async function loadAuditTrail(verificationId) {
        try {
            const response = await fetch(`/api/verifications/${verificationId}`);
            const data = await response.json();

            if (data.audit_trail && data.audit_trail.length > 0) {
                displayAuditTrail(data.audit_trail);
            } else {
                document.getElementById('audit-trail').innerHTML = '<p>No audit trail available</p>';
            }
        } catch (error) {
            console.error('Error loading audit trail:', error);
            document.getElementById('audit-trail').innerHTML = '<p>Failed to load audit trail</p>';
        }
    }

    function displayAuditTrail(auditTrail) {
        const container = document.getElementById('audit-trail');
        container.innerHTML = '';

        auditTrail.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = `audit-event ${event.decision_result}`;
            
            const timestamp = new Date(event.event_timestamp).toLocaleString();
            
            eventDiv.innerHTML = `
                <div class="audit-event-header">
                    <span class="audit-event-type">${event.event_type.replace(/_/g, ' ')}</span>
                    <span class="audit-event-timestamp">${timestamp}</span>
                </div>
                <div class="audit-event-result ${event.decision_result}">${event.decision_result}</div>
                <p class="audit-event-reason">${event.decision_reason}</p>
            `;
            
            container.appendChild(eventDiv);
        });
    }

    // Audit trail toggle
    auditToggle.addEventListener('click', () => {
        auditToggle.classList.toggle('active');
        auditContent.classList.toggle('open');
    });

    // Verify another document
    verifyAnotherBtn.addEventListener('click', () => {
        clearFile();
        document.getElementById('document-date').value = '';
        resultsSection.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Download report
    downloadReportBtn.addEventListener('click', async () => {
        if (!currentVerificationId) {
            alert('No verification ID available');
            return;
        }

        try {
            const response = await fetch(`/api/reports/${currentVerificationId}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `CDD_Report_${currentVerificationId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('Failed to download report');
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            alert('An error occurred while downloading the report');
        }
    });
});

