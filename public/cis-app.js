// React is loaded globally via script tag
const { useState, useEffect, useRef } = React;

// --- Type Definitions (converted to JSDoc for plain JS) ---
/**
 * @typedef {Object} FormErrors
 * @property {string} [key] - Error message for form field
 */

/**
 * @typedef {Object} DocumentFile
 * @property {string} id
 * @property {string} name
 * @property {boolean} required
 * @property {File|null} file
 * @property {string|null} preview
 * @property {string|null} processingState
 * @property {any} processingResult
 * @property {string} [overriddenType]
 */

/**
 * @typedef {Object} FormData
 * @property {string} [key] - Form field value
 */

/**
 * @typedef {'individual'|'entity'} ReportType
 */

const DOCUMENT_TYPES_CONFIG = [
  { id: 'proofOfId', name: 'Proof of ID', required: true },
  { id: 'proofOfResidence', name: 'Proof of Residence', required: true },
  { id: 'sourceOfFunds', name: 'Source of Funds', required: true },
  { id: 'business', name: 'Business Documents', required: false },
];

const App = () => {
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState('individual');
  const [documents, setDocuments] = useState(() =>
    DOCUMENT_TYPES_CONFIG.map(doc => ({
      ...doc,
      file: null,
      preview: null,
      processingState: null,
      processingResult: null,
    }))
  );
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [theme, setTheme] = useState('light');
  const [verificationResults, setVerificationResults] = useState(null);
  const [cisSessionId, setCisSessionId] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const fileInputRefs = useRef({});

  useEffect(() => {
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
      docs = docs.filter(doc => doc.id !== 'business');
    }
    return docs;
  };

  const handleFileUpload = async (id: string, file: File) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, file, preview: URL.createObjectURL(file), processingState: 'Uploading...', processingResult: null } : doc));

    // For now, just mark as uploaded - actual processing happens on analyze
    setTimeout(() => {
      setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
          return { ...doc, processingState: null };
        }
        return doc;
      }));
    }, 1000);
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

  const handleAnalyze = async () => {
    setIsLoading(true);
    setLoadingMessage('Uploading documents...');

    try {
      // Check minimum requirements
      const requiredDocs = getVisibleDocuments().filter(d => d.required);
      const uploadedRequired = requiredDocs.filter(d => d.file);

      if (uploadedRequired.length < 2) {
        alert('Please upload at least the first 2 required documents (ID and Residence)');
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      // Create FormData for upload
      const formData = new FormData();
      const cisSessionId = `cis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      formData.append('cisSessionId', cisSessionId);
      formData.append('customerType', reportType);

      // Add document type mapping
      const documentTypes = getVisibleDocuments().map(doc => doc.id);
      formData.append('documentTypes', JSON.stringify(documentTypes));

      // Add uploaded files
      getVisibleDocuments().forEach((doc, index) => {
        if (doc.file) {
          formData.append('documents', doc.file);
        }
      });

      setLoadingMessage('Processing documents...');

      // Upload documents
      const uploadResponse = await fetch('/api/cis/upload-documents', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();

      setLoadingMessage('Analyzing and cross-verifying...');

      // Perform analysis
      const analyzeResponse = await fetch('/api/cis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cisSessionId: uploadResult.cisSessionId
        })
      });

      if (!analyzeResponse.ok) {
        throw new Error(`Analysis failed: ${analyzeResponse.statusText}`);
      }

      const analyzeResult = await analyzeResponse.json();

      setCisSessionId(analyzeResult.cisSessionId);
      setVerificationResults(analyzeResult.verification);
      setStep(2);

    } catch (error) {
      console.error("Error during analysis:", error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDataChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const downloadCIS = async () => {
    if (!cisSessionId) {
      alert('No session available for PDF generation');
      return;
    }

    setLoadingMessage("Generating CIS PDF...");
    setIsLoading(true);

    try {
      const response = await fetch('/api/cis/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cisSessionId,
          formData
        })
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CIS_${cisSessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStep(3);

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`PDF generation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleStartOver = () => {
    setDocuments(DOCUMENT_TYPES_CONFIG.map(doc => ({ ...doc, file: null, preview: null, processingState: null, processingResult: null })));
    setFormData({});
    setFormErrors({});
    setVerificationResults(null);
    setCisSessionId(null);
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
            onAnalyze={handleAnalyze}
            fileInputRefs={fileInputRefs}
          />
        );
      case 2:
        return (
          <ResultsStep
            verificationResults={verificationResults}
            documents={getVisibleDocuments()}
            formData={formData}
            onDataChange={handleDataChange}
            reportType={reportType}
            formErrors={formErrors}
          />
        );
      case 3:
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
            onAnalyze={handleAnalyze}
            onDownload={downloadCIS}
            onStartOver={handleStartOver}
            canAnalyze={getVisibleDocuments().filter(d => d.required && d.file).length >= 2}
          />
        </>
      )}
    </div>
  );
};

// --- Components ---

const Header = ({ theme, onToggleTheme }) => (
  <header className="app-header">
    <h1>Customer Information Sheet Generator</h1>
    <div className="theme-toggle" onClick={onToggleTheme} role="button" aria-label="Toggle theme">
      <span className="icon">{theme === 'light' ? '☀️' : '🌙'}</span>
    </div>
  </header>
);

const ProgressBar = ({ currentStep }) => {
    const steps = ['Upload & Analyze', 'Review Results', 'Download CIS'];
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

const UploadStep = ({ reportType, setReportType, documents, onFileSelect, onRemoveFile, onAnalyze, fileInputRefs }) => {
  return (
    <div className="step-container">
      <h2>1. Select Customer Type & Upload Documents</h2>
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

const ProcessingFeedback = ({ state }) => {
    const isError = state.toLowerCase().includes('error');
    if (isError) {
        return <><div className="error-icon">⚠️</div><p>{state}</p></>;
    }
    return <><div className="spinner"></div><p>{state}</p></>;
};

const DocumentUploadItem = ({ doc, onFileSelect, onRemoveFile, onClick }) => {
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => {
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
            ) : null}
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

const ResultsStep = ({ verificationResults, documents, formData, onDataChange, reportType, formErrors }) => {

  const FormField = ({ name, label, type = 'text' }) => (
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
    </div>
  );

  return (
    <div className="step-container">
      <h2>2. Verification Results</h2>

      <div className="verification-results">
        <div className="result-card">
          <h3>Verification Status</h3>
          <div className={`status ${verificationResults?.status === 'verified' ? 'success' : 'warning'}`}>
            {verificationResults?.status === 'verified' ? '✅ Verified' : '⚠️ Requires Review'}
          </div>

          {verificationResults?.abnFound && (
            <div className="abn-info">
              <p><strong>ABN Found:</strong> {verificationResults.abnNumber}</p>
              <p>Certificate will be included in CIS</p>
            </div>
          )}

          {!verificationResults?.abnFound && reportType === 'entity' && (
            <div className="abn-warning">
              <p>⚠️ No ABN found for this entity. Please upload additional business documents.</p>
            </div>
          )}
        </div>

        <div className="extracted-data">
          <h3>Extracted Information</h3>
          <div className="verification-form">
            <FormField name="clientName" label="Client Name" />
            <FormField name="dateOfBirth" label="Date of Birth (YYYY-MM-DD)" />
            {reportType === 'entity' && <FormField name="entityName" label="Entity Name" />}
            {verificationResults?.abnNumber && <FormField name="abn" label="ABN" />}
            <FormField name="address" label="Address" />
            <FormField name="accountNumber" label="Account Number" />
          </div>
        </div>
      </div>
    </div>
  );
};

const FinalStep = () => (
  <div className="step-container final-step">
    <div className="success-icon">✓</div>
    <h2>CIS Generated Successfully!</h2>
    <p>Your Customer Information Sheet has been downloaded.</p>
    <p>The document includes all verified information and supporting certificates.</p>
  </div>
);

const ApiKeyErrorScreen = () => (
    <div className="step-container"><div className="api-key-error-screen">
        <div className="error-icon">⚠️</div>
        <h2>Configuration Error</h2>
        <p>This application requires API configuration. Please check your setup.</p>
    </div></div>
);

const Footer = ({ step, onAnalyze, onDownload, onStartOver, canAnalyze }) => (
  <footer className="app-footer">
    {step > 1 && <button onClick={() => window.history.back()}>Back</button>}
    <div className="footer-spacer"></div>
    {step === 1 && <button onClick={onAnalyze} disabled={!canAnalyze}>Analyze Documents</button>}
    {step === 2 && <button onClick={onDownload}>Download CIS</button>}
    {step === 3 && <button onClick={onStartOver}>Start New Verification</button>}
  </footer>
);

const LoadingOverlay = ({ message }) => (
  <div className="loading-overlay">
    <div className="spinner"></div>
    <p>{message}</p>
  </div>
);

// Add some additional CSS for the results
const style = document.createElement('style');
style.textContent = `
  .verification-results {
    display: grid;
    gap: 2rem;
  }

  .result-card, .extracted-data {
    background: var(--secondary-bg-color);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .status {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 1rem 0;
  }

  .status.success {
    color: var(--success-color);
  }

  .status.warning {
    color: var(--warning-color);
  }

  .abn-info {
    background: rgba(56, 161, 105, 0.1);
    border: 1px solid var(--success-color);
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
  }

  .abn-warning {
    background: rgba(221, 107, 32, 0.1);
    border: 1px solid var(--warning-color);
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
    color: var(--warning-color);
  }

  .form-field.full-width {
    grid-column: 1 / -1;
  }

  .form-field textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--background-color);
    color: var(--text-color);
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
  }

  .form-field textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;
document.head.appendChild(style);

const container = document.getElementById('root');
if (container) {
  ReactDOM.render(<App />, container);
}
