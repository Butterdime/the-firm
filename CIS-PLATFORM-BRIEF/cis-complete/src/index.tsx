import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { processDocument, DocumentFile, FormData, ReportType } from './server/documentProcessor';
import { generateVerificationPdf } from './utils/pdfGenerator';
import { getReportHtml } from './utils/reportTemplate';
import { appIdToDocTypeDisplayNameMap, docTypeToAppIdMap } from './server/imageProcessor';
import { aiClient } from './server/apiClient';
import { Type as GenAiType } from '@google/genai';


// --- Type Definitions ---
type FormErrors = { [key: string]: string };

const DOCUMENT_TYPES_CONFIG: Omit<DocumentFile, 'file' | 'preview' | 'processingState' | 'processingResult' | 'overriddenType'>[] = [
  { id: 'proofOfId', name: 'Proof of ID', required: true },
  { id: 'proofOfResidence', name: 'Proof of Residence', required: true },
  { id: 'abnStatement', name: 'ABN Statement', required: true },
  { id: 'sourceOfFunds', name: 'Source of Funds', required: false },
  { id: 'photoAnalysis', name: 'Photo for Analysis', required: false },
];


const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('individual');
  const [documents, setDocuments] = useState<DocumentFile[]>(() =>
    DOCUMENT_TYPES_CONFIG.map(doc => ({
      ...doc,
      file: null,
      preview: null,
      processingState: null,
      processingResult: null,
    }))
  );
  const [formData, setFormData] = useState<FormData>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [theme, setTheme] = useState('light');
  const [apiKeyMissing, setApiKeyMissing] = useState(!process.env.API_KEY);

  // State for Human-in-the-Loop and Audit Trail
  const [formDataHistory, setFormDataHistory] = useState<FormData[]>([]);
  const [editedFields, setEditedFields] = useState<string[]>([]);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    // PDF.js worker setup
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getVisibleDocuments = () => {
    let docs = documents;
    if (reportType === 'individual') {
      docs = docs.filter(doc => doc.id !== 'abnStatement');
    }
    return docs;
  };
  
  const handleFileUpload = async (id: string, file: File) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, file, preview: URL.createObjectURL(file), processingState: 'Starting...', processingResult: null } : doc));
    try {
      const result = await processDocument(
        { id, file },
        (message: string) => {
          setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, processingState: message } : doc));
        }
      );
      setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
          const newPreview = result.pages.length > 0 ? `data:image/jpeg;base64,${result.pages[0]}` : doc.preview;
          if (doc.preview && newPreview !== doc.preview) {
            URL.revokeObjectURL(doc.preview);
          }
          return { ...doc, processingState: null, processingResult: result, preview: newPreview };
        }
        return doc;
      }));
    } catch (error) {
      console.error("Error processing file:", error);
      setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, processingState: `Error: ${(error as Error).message}` } : doc));
    }
  };

  const handleRemoveFile = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        if (doc.preview) URL.revokeObjectURL(doc.preview);
        return { ...doc, file: null, preview: null, processingResult: null };
      }
      return doc;
    }));
  };

  const handleDocTypeOverride = (docId: string, newAppId: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId && doc.processingResult && doc.processingResult.auditTrail) {
        const newAuditTrail = { ...doc.processingResult.auditTrail };
        const existingOverride = newAuditTrail.humanOverrides.find(o => o.field === 'documentType');

        const overrideEntry = {
          field: 'documentType',
          aiValue: doc.processingResult.detectedDocumentType || 'N/A',
          humanValue: appIdToDocTypeDisplayNameMap[newAppId] || newAppId,
          timestamp: new Date().toISOString()
        };

        if (existingOverride) {
          existingOverride.humanValue = overrideEntry.humanValue;
          existingOverride.timestamp = overrideEntry.timestamp;
        } else {
          newAuditTrail.humanOverrides.push(overrideEntry);
        }
        
        return {
          ...doc,
          overriddenType: newAppId,
          processingResult: {
            ...doc.processingResult,
            auditTrail: newAuditTrail
          }
        };
      }
      return doc;
    }));
  };


  const handleNext = async () => {
    if (step === 1) {
      // Human-in-the-Loop Quality Gate
      const failingDocs = getVisibleDocuments().filter(d => d.processingResult?.auditTrail?.qualityGateStatus === 'FAIL');
      if (failingDocs.length > 0) {
        const docNames = failingDocs.map(d => d.name).join(', ');
        const message = `The following documents have low OCR quality and require manual review: ${docNames}.\n\nDo you want to proceed anyway? You will need to carefully verify all extracted data.`;
        const userConfirms = window.confirm(message);

        if (!userConfirms) return;

        setDocuments(prev => prev.map(doc => {
          if (failingDocs.some(fd => fd.id === doc.id) && doc.processingResult && doc.processingResult.auditTrail) {
            return {
              ...doc,
              processingResult: {
                ...doc.processingResult,
                auditTrail: { ...doc.processingResult.auditTrail, qualityGateStatus: 'OVERRIDE' }
              }
            };
          }
          return doc;
        }));
      }
      
      setIsLoading(true);
      setLoadingMessage('Consolidating and extracting final data...');
      
      try {
        const uploadedDocs = getVisibleDocuments().filter(d => d.processingResult);

        const ocrContext = uploadedDocs
            .map(doc => {
                if (doc.id === 'photoAnalysis' || !doc.file) return null;
                const ocrText = doc.processingResult?.ocrWords.map(w => w.text).join(' ') || '';
                return `--- OCR from ${doc.name} (${doc.file.name}, classified as ${doc.processingResult?.detectedDocumentType}) ---\n${ocrText}`;
            })
            .filter(Boolean)
            .join('\n\n');

        const photoDescriptionFromProcessing = uploadedDocs.find(d => d.id === 'photoAnalysis')?.processingResult?.photoDescription;

        const individualSchema = {
            type: GenAiType.OBJECT,
            properties: {
                clientName: { type: GenAiType.STRING, nullable: true },
                dateOfBirth: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD', nullable: true },
                driversLicenceNumber: { type: GenAiType.STRING, nullable: true },
                passportNumber: { type: GenAiType.STRING, nullable: true },
                nationalIdNumber: { type: GenAiType.STRING, nullable: true },
                medicareNumber: { type: GenAiType.STRING, nullable: true },
                licenceExpiryDate: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD', nullable: true },
                licenceHolder: { type: GenAiType.STRING, nullable: true },
                addressOnLicence: { type: GenAiType.STRING, nullable: true },
                accountHolder: { type: GenAiType.STRING, nullable: true },
                serviceAddress: { type: GenAiType.STRING, nullable: true },
                issueDate: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD', nullable: true },
                abnOfProvider: { type: GenAiType.STRING, nullable: true },
                sourceOfFundsAccount: { type: GenAiType.STRING, nullable: true },
                bsb: { type: GenAiType.STRING, nullable: true },
                accountNumber: { type: GenAiType.STRING, nullable: true },
                statementPeriod: { type: GenAiType.STRING, nullable: true },
                payPeriod: { type: GenAiType.STRING, description: "Pay period from a payslip.", nullable: true },
                grossPay: { type: GenAiType.STRING, nullable: true },
                netPay: { type: GenAiType.STRING, nullable: true },
                photoDescription: { type: GenAiType.STRING, description: 'The detailed description of the uploaded photo.', nullable: true },
            }
        };

        const entitySchemaProperties = {
            ...individualSchema.properties,
            abn: { type: GenAiType.STRING, nullable: true },
            entityName: { type: GenAiType.STRING, nullable: true },
            trusteeName: { type: GenAiType.STRING, nullable: true },
            tradingName: { type: GenAiType.STRING, nullable: true },
            overallRisk: { type: GenAiType.STRING, description: "Assess risk as 'Low', 'Medium', or 'High'.", nullable: true}
        };

        const extractionPrompt = `
          Act as a compliance analyst. Extract and structure information from the provided OCR text from multiple documents.
          Use the document's name and its AI classification to correctly source the data.
          - Proof of ID: Can be a Driver's License, Passport, National ID, or Medicare Card. Extract name, DOB, and relevant numbers (licence, passport, etc.).
          - Proof of Residence: For service address.
          - ABN Statement: For ABN, Entity Name, etc.
          - Source of Funds: Can be a Bank Statement or Payslip. For Bank Statements, extract account details. For Payslips, extract Pay Period, Gross Pay, and Net Pay.
          
          A photo was analyzed separately. Its description is: "${photoDescriptionFromProcessing || "No photo provided."}"
          Populate the 'photoDescription' field with this exact description.

          ${reportType === 'entity' ? '- Assess an overall risk level (Low, Medium, High) based on document consistency.' : ''}

          Here is the combined OCR text:
          ${ocrContext}
        `;
        
        const imageParts = uploadedDocs
            .filter(doc => doc.processingResult?.pages?.[0])
            .map(doc => ({
                inlineData: { mimeType: 'image/jpeg', data: doc.processingResult!.pages[0] }
            }));
        
        const parts = [{ text: extractionPrompt }, ...imageParts];

        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: GenAiType.OBJECT,
                    properties: reportType === 'individual' ? individualSchema.properties : entitySchemaProperties,
                }
            }
        });

        const extractedData = JSON.parse(response.text.trim());
        setFormData(extractedData);
        setFormDataHistory([extractedData]);
        setStep(2);

      } catch (error) {
          console.error("Error during final data extraction:", error);
          alert(`An error occurred during data consolidation: ${(error as Error).message}`);
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
    } else {
        setStep(step + 1);
    }
  };
  
  const handleBack = () => setStep(step - 1);

  const handleDataChange = (field: string, value: string) => {
    const originalValue = formDataHistory[0]?.[field];
    if (originalValue !== undefined && originalValue !== value) {
      if (!editedFields.includes(field)) {
        setEditedFields(prev => [...prev, field]);
      }
    } else {
      setEditedFields(prev => prev.filter(f => f !== field));
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const downloadPdf = async () => {
    setLoadingMessage("Generating PDF report...");
    setIsLoading(true);
    await generateVerificationPdf(formData, reportType, getVisibleDocuments(), editedFields, formDataHistory[0] || {});
    setIsLoading(false);
    setLoadingMessage('');
    setStep(4);
  };

  const handleStartOver = () => {
    setDocuments(DOCUMENT_TYPES_CONFIG.map(doc => ({ ...doc, file: null, preview: null, processingState: null, processingResult: null })));
    setFormData({});
    setFormErrors({});
    setFormDataHistory([]);
    setEditedFields([]);
    setStep(1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <UploadStep
            reportType={reportType}
            setReportType={setReportType}
            documents={getVisibleDocuments()}
            onFileSelect={(id, file) => file && handleFileUpload(id, file)}
            onRemoveFile={handleRemoveFile}
            onDocTypeOverride={handleDocTypeOverride}
            fileInputRefs={fileInputRefs}
          />
        );
      case 2:
        return (
          <VerificationStep
            formData={formData}
            formErrors={{}}
            onDataChange={handleDataChange}
          />
        );
      case 3:
        return (
          <GeneratedDocument
            formData={formData}
            reportType={reportType}
            visibleDocuments={getVisibleDocuments()}
            editedFields={editedFields}
            originalData={formDataHistory[0] || {}}
          />
        );
      case 4:
         return <FinalStep />;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <Header theme={theme} onToggleTheme={toggleTheme} />
      {apiKeyMissing ? (
        <main className="main-content"><ApiKeyErrorScreen /></main>
      ) : (
        <>
          <ProgressBar currentStep={step} />
          <main className="main-content">
            {isLoading && <LoadingOverlay message={loadingMessage} />}
            {renderStep()}
          </main>
          <Footer
            step={step}
            onNext={handleNext}
            onBack={handleBack}
            onDownload={downloadPdf}
            onStartOver={handleStartOver}
            isNextDisabled={step === 1 && (getVisibleDocuments().some(d => d.required && !d.file) || getVisibleDocuments().some(d => d.processingState !== null))}
          />
        </>
      )}
    </div>
  );
};


// --- Components ---

const Header: React.FC<{ theme: string; onToggleTheme: () => void }> = ({ theme, onToggleTheme }) => (
  <header className="app-header">
    <h1>Customer Information Sheet Generator</h1>
    <div className="theme-toggle" onClick={onToggleTheme} role="button" aria-label="Toggle theme">
      <span className="icon">{theme === 'light' ? '☀️' : '🌙'}</span>
    </div>
  </header>
);

const ProgressBar: React.FC<{currentStep: number}> = ({ currentStep }) => {
    const steps = ['Upload', 'Verify', 'Preview', 'Success'];
    return (
        <div className="progress-bar">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === currentStep;
                const isCompleted = stepNumber < currentStep;
                return (
                     <div key={step} className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                        <div className="progress-circle">
                            {isCompleted ? '✔' : stepNumber}
                        </div>
                        <div className="progress-label">{step}</div>
                    </div>
                );
            })}
        </div>
    );
};

const UploadStep: React.FC<{
  reportType: ReportType;
  setReportType: (type: ReportType) => void;
  documents: DocumentFile[];
  onFileSelect: (id: string, file: File | null) => void;
  onRemoveFile: (id: string) => void;
  onDocTypeOverride: (docId: string, newAppId: string) => void;
  fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
}> = ({ reportType, setReportType, documents, onFileSelect, onRemoveFile, onDocTypeOverride, fileInputRefs }) => {
  return (
    <div className="step-container">
      <h2>1. Select Report Type & Upload Documents</h2>
       <div className="report-type-selector">
          <button className={reportType === 'individual' ? 'active' : ''} onClick={() => setReportType('individual')}>Individual</button>
          <button className={reportType === 'entity' ? 'active' : ''} onClick={() => setReportType('entity')}>Entity / Business</button>
      </div>
      <div className="upload-checklist">
        {documents.map(doc => (
          <DocumentUploadItem
            key={doc.id}
            doc={doc}
            onFileSelect={onFileSelect}
            onRemoveFile={onRemoveFile}
            onDocTypeOverride={onDocTypeOverride}
            onClick={() => fileInputRefs.current[doc.id]?.click()}
          />
        ))}
      </div>
       <div style={{display: 'none'}}>
          {documents.map(doc => (
            <input
              key={doc.id}
              type="file"
              ref={el => { fileInputRefs.current[doc.id] = el; }}
              onChange={e => onFileSelect(doc.id, e.target.files ? e.target.files[0] : null)}
              accept="image/*,application/pdf"
            />
          ))}
       </div>
    </div>
  );
};

const ProcessingFeedback: React.FC<{ state: string }> = ({ state }) => {
    const isError = state.toLowerCase().includes('error');
    if (isError) {
        return <><div className="error-icon">⚠️</div><p>{state}</p></>;
    }
    return <><div className="spinner"></div><p>{state}</p></>;
};

const DocumentUploadItem: React.FC<{
  doc: DocumentFile;
  onFileSelect: (id: string, file: File | null) => void;
  onRemoveFile: (id: string) => void;
  onDocTypeOverride: (docId: string, newAppId: string) => void;
  onClick: () => void;
}> = ({ doc, onFileSelect, onRemoveFile, onDocTypeOverride, onClick }) => {
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(doc.id, e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={`checklist-item ${doc.file ? 'completed' : ''}`}>
      <div className="checklist-header">
        <h3>{doc.name} {doc.required && '*'}</h3>
        <div className="status-icon">{doc.file && !doc.processingState ? '✔' : '...'}</div>
      </div>
      <div className="checklist-content">
        {doc.file ? (
          <div className="file-info">
            <div className="file-thumbnail">
                {doc.preview && <img src={doc.preview} alt="preview" />}
            </div>
            <span>{doc.file.name}</span>
            <button onClick={() => onRemoveFile(doc.id)} className="remove-btn" aria-label="Remove file">&times;</button>
            {doc.processingState ? (
              <div className={`processing-overlay ${doc.processingState.toLowerCase().includes('error') ? 'error' : ''}`}>
                <ProcessingFeedback state={doc.processingState} />
              </div>
            ) : (
                doc.processingResult && (
                    <>
                        {doc.processingResult.warning && (
                            <div className="doc-warning-box">
                                {doc.processingResult.warning}
                            </div>
                        )}
                        <div className="doc-classification-override">
                            <label>AI Detected Type:</label>
                            <select
                                value={doc.overriddenType || (doc.processingResult.detectedDocumentType && docTypeToAppIdMap[doc.processingResult.detectedDocumentType]) || 'unknown'}
                                onChange={(e) => onDocTypeOverride(doc.id, e.target.value)}
                            >
                                <option value="unknown" disabled>Select to override...</option>
                                <option value="proofOfId">Proof of ID</option>
                                <option value="proofOfResidence">Proof of Residence</option>
                                <option value="abnStatement">ABN Statement</option>
                                <option value="sourceOfFunds">Source of Funds</option>
                                <option value="photoAnalysis">Photo Analysis</option>
                            </select>
                        </div>
                    </>
                )
            )}
          </div>
        ) : (
          <div className="dropzone" onClick={onClick} onDragOver={onDragOver} onDrop={onDrop}>
            <p>Drag & drop your file here, or click to browse.</p>
          </div>
        )}
      </div>
    </div>
  );
};


const VerificationStep: React.FC<{
  formData: FormData;
  formErrors: FormErrors;
  onDataChange: (field: string, value: string) => void;
}> = ({ formData, formErrors, onDataChange }) => {

  const FormField: React.FC<{ name: string, label: string, type?: 'text' | 'textarea' }> = ({ name, label, type = 'text' }) => (
    <div className={`form-field ${type === 'textarea' ? 'full-width' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {type === 'textarea' ? (
        <textarea
            id={name}
            value={formData[name] || ''}
            onChange={e => onDataChange(name, e.target.value)}
            className={formErrors[name] ? 'input-error' : ''}
            rows={4}
        />
      ) : (
        <input
            id={name}
            type="text"
            value={formData[name] || ''}
            onChange={e => onDataChange(name, e.target.value)}
            className={formErrors[name] ? 'input-error' : ''}
        />
      )}
      {formErrors[name] && <span className="error-text">{formErrors[name]}</span>}
    </div>
  );

  return (
    <div className="step-container">
      <div className="verification-form">
        <h2>2. Verify Extracted Information</h2>
        <p style={{ gridColumn: '1 / -1' }}>Please review the information extracted from your documents. Correct any errors before proceeding.</p>
        
        <FormField name="clientName" label="Client Name" />
        <FormField name="dateOfBirth" label="Date of Birth (YYYY-MM-DD)" />
        {formData.entityName && <FormField name="entityName" label="Entity Name" />}
        {formData.abn && <FormField name="abn" label="ABN" />}
        
        <h3 style={{gridColumn: '1 / -1'}}>Identification Details</h3>
        <FormField name="licenceHolder" label="Licence Holder" />
        <FormField name="driversLicenceNumber" label="Driver's Licence Number" />
        {formData.passportNumber && <FormField name="passportNumber" label="Passport Number" />}
        {formData.nationalIdNumber && <FormField name="nationalIdNumber" label="National ID Number" />}
        {formData.medicareNumber && <FormField name="medicareNumber" label="Medicare Number" />}

        <h3 style={{gridColumn: '1 / -1'}}>Proof of Address Details</h3>
        <FormField name="accountHolder" label="Account Holder (Utility Bill)" />
        <FormField name="serviceAddress" label="Service Address" />

        <h3 style={{gridColumn: '1 / -1'}}>Source of Funds Details</h3>
        <FormField name="sourceOfFundsAccount" label="Account Name" />
        <FormField name="accountNumber" label="Account Number" />
        {formData.payPeriod && <FormField name="payPeriod" label="Pay Period" />}
        {formData.grossPay && <FormField name="grossPay" label="Gross Pay" />}
        {formData.netPay && <FormField name="netPay" label="Net Pay" />}

        {formData.photoDescription && <FormField name="photoDescription" label="Photo Analysis Description" type="textarea" />}
      </div>
    </div>
  );
};

const GeneratedDocument: React.FC<{ 
    formData: FormData, 
    reportType: ReportType, 
    visibleDocuments: DocumentFile[],
    editedFields: string[],
    originalData: FormData
}> = (props) => {
    const htmlString = getReportHtml(props.formData, props.reportType, props.visibleDocuments, props.editedFields, props.originalData);
    return (
        <div className="step-container">
            <h2>3. Preview Report</h2>
            <div className="generated-doc" dangerouslySetInnerHTML={{ __html: htmlString }} />
        </div>
    );
};

const FinalStep: React.FC = () => (
  <div className="step-container final-step">
    <div className="success-icon">✓</div>
    <h2>Report Generated Successfully!</h2>
    <p>Your Customer Information Sheet has been downloaded as a PDF.</p>
  </div>
);

const ApiKeyErrorScreen: React.FC = () => (
    <div className="step-container"><div className="api-key-error-screen">
        <div className="error-icon">⚠️</div>
        <h2>Configuration Error</h2>
        <p>This application requires a Google AI API key. Please set the <code>API_KEY</code> environment variable.</p>
    </div></div>
);

const Footer: React.FC<{
  step: number;
  onNext: () => void;
  onBack: () => void;
  onDownload: () => void;
  onStartOver: () => void;
  isNextDisabled: boolean;
}> = ({ step, onNext, onBack, onDownload, onStartOver, isNextDisabled }) => (
  <footer className="app-footer">
    {step > 1 && step < 4 && <button onClick={onBack}>Back</button>}
    <div className="footer-spacer"></div>
    {step === 1 && <button onClick={onNext} disabled={isNextDisabled}>Next: Verify Data</button>}
    {step === 2 && <button onClick={onNext}>Next: Preview Report</button>}
    {step === 3 && <button onClick={onDownload}>Download PDF & Finish</button>}
    {step === 4 && <button onClick={onStartOver}>Start Over</button>}
  </footer>
);

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="loading-overlay">
    <div className="spinner"></div>
    <p>{message}</p>
  </div>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}