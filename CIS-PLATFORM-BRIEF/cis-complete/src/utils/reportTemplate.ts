import { FormData, ReportType, DocumentFile, HumanOverride } from '../server/documentProcessor';

const escapeHtml = (unsafe: string): string => {
    if (unsafe === null || unsafe === undefined) return 'N/A';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

const wasEdited = (fieldName: string, editedFields: string[]) => editedFields.includes(fieldName);

const renderField = (label: string, value: string, fieldName: string, editedFields: string[]) => {
    if (!value && value !== '0') return ''; // Allow '0' to be displayed
    return `
        <div class="field-item ${wasEdited(fieldName, editedFields) ? 'edited' : ''}">
            <span class="field-label">${label}:</span>
            <span class="field-value">${escapeHtml(value)}</span>
            ${wasEdited(fieldName, editedFields) ? '<span class="edited-indicator">*</span>' : ''}
        </div>
    `;
};

const renderAuditTrail = (
    visibleDocuments: DocumentFile[],
    editedFields: string[],
    originalData: FormData
): string => {
    const manualOverrides = visibleDocuments
        .flatMap(d => d.processingResult?.auditTrail?.humanOverrides || [])
        .filter(o => o.field === 'documentType');

    const editedFieldDetails = editedFields.map(field => ({
        field,
        aiValue: originalData[field] || 'N/A',
        humanValue: (window as any).APP_CURRENT_FORM_DATA[field] || 'N/A' // Access global for final value
    }));

    return `
        <div class="section audit-trail">
            <h2>Processing Audit Trail</h2>
            
            <h3>AI Processing Summary</h3>
            <table class="audit-trail-table">
                <thead>
                    <tr>
                        <th>Document</th>
                        <th>AI Confidence</th>
                        <th>Quality Gate</th>
                        <th>AI Detected Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${visibleDocuments.filter(d => d.file).map(doc => `
                        <tr>
                            <td>${escapeHtml(doc.name)}</td>
                            <td>${(doc.processingResult?.overallConfidence * 100).toFixed(0)}%</td>
                            <td>${doc.processingResult?.auditTrail?.qualityGateStatus || 'N/A'}</td>
                            <td>${escapeHtml(doc.processingResult?.detectedDocumentType || 'N/A')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${(manualOverrides.length > 0 || editedFieldDetails.length > 0) ? `
            <h3>Manual Corrections Summary</h3>
            <p>The following inputs were manually corrected by the user, overriding the AI's initial assessment or extraction.</p>
            <table class="audit-trail-table">
                <thead>
                    <tr>
                        <th>Correction Type</th>
                        <th>Details</th>
                        <th>Original AI Value</th>
                        <th>Corrected Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${manualOverrides.map(override => `
                        <tr>
                            <td>Document Re-classification</td>
                            <td>Document uploaded for "${escapeHtml(override.field)}"</td>
                            <td>${escapeHtml(override.aiValue)}</td>
                            <td>${escapeHtml(override.humanValue)}</td>
                        </tr>
                    `).join('')}
                    ${editedFieldDetails.map(edit => `
                        <tr>
                            <td>Field Data Correction</td>
                            <td>${escapeHtml(edit.field)}</td>
                            <td>${escapeHtml(edit.aiValue)}</td>
                            <td>${escapeHtml(edit.humanValue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p>No manual corrections were made during the verification process.</p>'}
        </div>
    `;
};


export const getReportHtml = (
    formData: FormData,
    reportType: ReportType,
    visibleDocuments: DocumentFile[],
    editedFields: string[],
    originalData: FormData
): string => {
    // Hack to get the most current form data for the audit trail comparison
    (window as any).APP_CURRENT_FORM_DATA = formData;

    const reportTitle = reportType === 'individual' ? 'Customer Information Sheet - Individual' : 'Customer Information Sheet - Entity';
    const individualFields = `
        ${renderField('Client Name', formData.clientName, 'clientName', editedFields)}
        ${renderField('Date of Birth', formData.dateOfBirth, 'dateOfBirth', editedFields)}
    `;
    const entityFields = `
        ${renderField('Entity Name', formData.entityName, 'entityName', editedFields)}
        ${renderField('ABN', formData.abn, 'abn', editedFields)}
        ${renderField('Trustee Name', formData.trusteeName, 'trusteeName', editedFields)}
        ${renderField('Trading Name', formData.tradingName, 'tradingName', editedFields)}
    `;

    const commonSections = `
        <div class="section">
            <h2>Identification Details (Proof of ID)</h2>
            ${renderField('Licence Holder', formData.licenceHolder, 'licenceHolder', editedFields)}
            ${renderField('Driver\'s Licence Number', formData.driversLicenceNumber, 'driversLicenceNumber', editedFields)}
            ${renderField('Passport Number', formData.passportNumber, 'passportNumber', editedFields)}
            ${renderField('National ID Number', formData.nationalIdNumber, 'nationalIdNumber', editedFields)}
            ${renderField('Medicare Number', formData.medicareNumber, 'medicareNumber', editedFields)}
        </div>
        <div class="section">
            <h2>Proof of Address Details</h2>
            ${renderField('Account Holder (Utility Bill)', formData.accountHolder, 'accountHolder', editedFields)}
            ${renderField('Service Address', formData.serviceAddress, 'serviceAddress', editedFields)}
        </div>
        <div class="section">
            <h2>Source of Funds Details</h2>
            ${renderField('Account Name', formData.sourceOfFundsAccount, 'sourceOfFundsAccount', editedFields)}
            ${renderField('Account Number', formData.accountNumber, 'accountNumber', editedFields)}
            ${renderField('Pay Period', formData.payPeriod, 'payPeriod', editedFields)}
            ${renderField('Gross Pay', formData.grossPay, 'grossPay', editedFields)}
            ${renderField('Net Pay', formData.netPay, 'netPay', editedFields)}
        </div>
    `;
    
    const photoAnalysisSection = formData.photoDescription ? `
        <div class="section">
            <h2>Photo Analysis</h2>
            <div class="field-item multi-line">
                <span class="field-label">AI Description:</span>
                <span class="field-value">${escapeHtml(formData.photoDescription)}</span>
            </div>
        </div>
    ` : '';

    const riskSection = reportType === 'entity' ? `
        <div class="section">
            <h2>Risk Assessment</h2>
            ${renderField('Overall Risk Assessment', formData.overallRisk, 'overallRisk', editedFields)}
        </div>
    ` : '';
    
    const auditTrailSection = renderAuditTrail(visibleDocuments, editedFields, originalData);
    
    return `
        <html>
            <head>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; font-size: 12px;}
                    h1 { color: #1a2c4e; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; font-size: 24px; }
                    h2 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px; font-size: 18px; }
                    h3 { font-size: 14px; color: #333; margin-top: 20px; margin-bottom: 10px; }
                    .section { margin-bottom: 20px; padding: 10px; border: 1px solid #f0f0f0; border-radius: 5px; }
                    .field-item { display: flex; margin-bottom: 8px; font-size: 12px; align-items: flex-start; }
                    .field-item.multi-line { flex-direction: column; align-items: flex-start; }
                    .field-label { font-weight: bold; width: 200px; color: #555; flex-shrink: 0; }
                    .field-item.multi-line .field-label { margin-bottom: 4px; }
                    .field-value { flex-grow: 1; }
                    .edited { background-color: #fffbe6; }
                    .edited-indicator { color: #d9534f; font-weight: bold; margin-left: 5px; }
                    .audit-trail p { font-size: 11px; color: #666; }
                    .audit-trail-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                    .audit-trail-table th, .audit-trail-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    .audit-trail-table th { background-color: #f7f7f7; font-weight: bold; }
                    .audit-trail-table td { word-break: break-all; }
                </style>
            </head>
            <body>
                <h1>${reportTitle}</h1>
                <div class="section">
                    <h2>Primary Details</h2>
                    ${reportType === 'individual' ? individualFields : entityFields}
                    ${reportType === 'entity' ? individualFields : ''}
                </div>
                ${commonSections}
                ${photoAnalysisSection}
                ${riskSection}
                ${editedFields.length > 0 ? '<p style="font-size: 10px; color: #777;">* Fields marked with an asterisk were manually edited by the user.</p>' : ''}
                ${auditTrailSection}
            </body>
        </html>
    `;
};