// This combines the restoration of the full app with the new iterative enhancement feature.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type as GenAiType } from '@google/genai';
import { processDocument, OcrWord, BoundingBox } from './server/documentProcessor';
import { generateVerificationPdf } from './utils/pdfGenerator';

// --- Type Definitions ---
declare global {
  interface Window {
    pdfjsLib: any;
    jspdf: any;
  }
}

type ReportType = 'individual' | 'entity';

interface DocumentFile {
  id: string;
  name: string;
  required: boolean;
  file: File | null;
  preview: string | null;
  processingState: string | null;
  processedData: string | null;
}

type FormData = { [key: string]: any };
type FormErrors = { [key: string]: string };

const DOCUMENT_TYPES: Omit<DocumentFile, 'file' | 'preview' | 'processingState' | 'processedData'>[] = [
  { id: 'proofOfId', name: 'Proof of ID', required: true },
  { id: 'proofOfResidence', name: 'Proof of Residence', required: true },
  { id: 'abnStatement', name: 'ABN Statement', required: true },
  { id: 'sourceOfFunds', name: 'Source of Funds', required: false },
];

// --- Main App Component ---

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('entity');
  const [documents, setDocuments] = useState<DocumentFile[]>(() =>
    DOCUMENT_TYPES.map(doc => ({
      ...doc,
      file: null,
      preview: null,
      processingState: null,
      processedData: null,
    }))
  );
  const [processedPdfPages, setProcessedPdfPages] = useState<{ [docId: string]: string[] }>({});
  const [processedOcrData, setProcessedOcrData] = useState<{ [docId: string]: OcrWord[] }>({});
  const [processedOcrConfidence, setProcessedOcrConfidence] = useState<{ [docId: string]: number }>({});
  const [documentWarnings, setDocumentWarnings] = useState<{ [docId: string]: string }>({});
  const [formData, setFormData] = useState<FormData>({});
  const [initialFormData, setInitialFormData] = useState<FormData>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [viewingPdfDocId, setViewingPdfDocId] = useState<string | null>(null);
  
  const aiClient = useRef<GoogleGenAI | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    if (process.env.API_KEY) {
      aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.error("API_KEY environment variable not set.");
      setApiKeyMissing(true);
    }
  }, []);

  const getVisibleDocuments = () => {
    if (reportType === 'individual') {
      return documents.filter(doc => doc.id !== 'abnStatement');
    }
    return documents;
  };

  const handleFileSelect = (id: string, file: File | null) => {
    if (file) {
      handleFileUpload(id, file);
    }
  };

  const setProcessingState = (id: string, state: string | null) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, processingState: state } : doc));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (id: string, file: File) => {
    setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
            const newPreview = doc.file === file ? doc.preview : URL.createObjectURL(file);
            return { ...doc, file, preview: newPreview, processingState: 'Starting...' };
        }
        return doc;
    }));
    
    try {
        const fileAsBase64 = await fileToBase64(file);
        
        const result = await processDocument(
            fileAsBase64, 
            file.type,
            id,
            (message: string) => setProcessingState(id, message)
        );
        
        setProcessedOcrData(prev => ({ ...prev, [id]: result.ocrWords }));
        setProcessedOcrConfidence(prev => ({ ...prev, [id]: result.confidence }));

        if (result.pages) { // PDF result
            setProcessedPdfPages(prev => ({ ...prev, [id]: result.pages! }));
            if (result.confidence < 0.85) {
                setDocumentWarnings(prev => ({...prev, [id]: "Overall document quality is low and may affect final report accuracy."}));
            }
            const firstPagePreview = `data:image/jpeg;base64,${result.pages[0]}`;
            setDocuments(prev => {
                const oldPreview = prev.find(d => d.id === id)?.preview;
                if (oldPreview && oldPreview.startsWith('blob:')) URL.revokeObjectURL(oldPreview);
                return prev.map(doc => doc.id === id ? { ...doc, preview: firstPagePreview, processingState: null } : doc);
            });
        } else { // Image result
             setDocuments(prev => {
                const newPreview = `data:image/jpeg;base64,${result.finalImage}`;
                const oldPreview = prev.find(d => d.id === id)?.preview;
                if (oldPreview && oldPreview.startsWith('blob:')) URL.revokeObjectURL(oldPreview); 
                return prev.map(doc => doc.id === id ? { ...doc, preview: newPreview, processedData: result.finalImage, processingState: null } : doc);
            });
        }

    } catch (error: any) {
        console.error("Error processing file:", error);
        setProcessingState(id, `Error: ${error.message || 'Processing failed.'}`);
    }
  };

  const handleRemoveFile = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        if (doc.preview && doc.preview.startsWith('blob:')) URL.revokeObjectURL(doc.preview);
        return { ...doc, file: null, preview: null, processedData: null, processingState: null };
      }
      return doc;
    }));
    setProcessedPdfPages(prev => { const newState = {...prev}; delete newState[id]; return newState; });
    setProcessedOcrData(prev => { const newState = {...prev}; delete newState[id]; return newState; });
    setProcessedOcrConfidence(prev => { const newState = {...prev}; delete newState[id]; return newState; });
    setDocumentWarnings(prev => { const newState = {...prev}; delete newState[id]; return newState; });
  };
  
  const handleRegenerate = (id: string) => {
    const docToRegenerate = documents.find(d => d.id === id);
    if (docToRegenerate && docToRegenerate.file) {
      setProcessedOcrData(prev => { const newState = {...prev}; delete newState[id]; return newState; });
      setProcessedOcrConfidence(prev => { const newState = {...prev}; delete newState[id]; return newState; });
      setDocumentWarnings(prev => { const newState = {...prev}; delete newState[id]; return newState; });
      if (processedPdfPages[id]) {
        setProcessedPdfPages(prev => { const newState = {...prev}; delete newState[id]; return newState; });
      }
      
      handleFileUpload(id, docToRegenerate.file);
    }
  };

  const validate = (data: FormData): FormErrors => {
    const errors: FormErrors = {};
    if (data.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
        errors.dateOfBirth = 'Date must be in YYYY-MM-DD format.';
    }
     if (data.licenceExpiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.licenceExpiryDate)) {
        errors.licenceExpiryDate = 'Date must be in YYYY-MM-DD format.';
    }
    if (data.issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.issueDate)) {
        errors.issueDate = 'Date must be in YYYY-MM-DD format.';
    }

    if (data.mobile) {
      const cleanedMobile = String(data.mobile).replace(/\D/g, '');
      if (cleanedMobile.length > 0 && cleanedMobile.length < 10) {
        errors.mobile = 'Mobile number must be 10 digits.';
      }
    }

    return errors;
  };
  
  useEffect(() => {
    setFormErrors(validate(formData));
  }, [formData]);


  const handleNext = async () => {
    if (step === 1) {
        setIsLoading(true);
        setLoadingMessage('Extracting data from documents...');
        
        try {
            if (!aiClient.current) throw new Error("AI Client not initialized");
            const ai = aiClient.current;
            const uploadedDocs = getVisibleDocuments().filter(d => d.file);
            
            const fileProcessingPromises = uploadedDocs.map(async (doc) => {
                const ocrText = (processedOcrData[doc.id] || []).map(w => w.text).join(' ');
                const isPdf = doc.file!.type === 'application/pdf';
                const fileData = isPdf 
                    ? { inlineData: { mimeType: 'image/jpeg', data: processedPdfPages[doc.id]?.[0] } }
                    : { inlineData: { mimeType: doc.file!.type, data: doc.processedData! } };
                return {
                    id: doc.id,
                    fileName: doc.file!.name,
                    ocrText: ocrText,
                    ocrConfidence: processedOcrConfidence[doc.id] || 0,
                    fileData
                };
            });

            const processedFiles = await Promise.all(fileProcessingPromises);

            const baseSchemaProperties = {
                clientName: { type: GenAiType.STRING, description: '' }, dateOfBirth: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD' },
                email: { type: GenAiType.STRING }, mobile: { type: GenAiType.STRING },
                residentialAddress: { type: GenAiType.STRING }, mailingAddress: { type: GenAiType.STRING, description: "Mailing address, if different." },
                driversLicenceNumber: { type: GenAiType.STRING }, licenceExpiryDate: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD' },
                licenceHolder: { type: GenAiType.STRING }, addressOnLicence: { type: GenAiType.STRING },
                accountHolder: { type: GenAiType.STRING }, serviceAddress: { type: GenAiType.STRING },
                issueDate: { type: GenAiType.STRING, description: 'Utility bill issue date: YYYY-MM-DD' }, abnOfProvider: { type: GenAiType.STRING },
                sourceOfFundsAccount: { type: GenAiType.STRING }, bsb: { type: GenAiType.STRING },
                accountNumber: { type: GenAiType.STRING }, statementPeriod: { type: GenAiType.STRING },
            };

            const entitySpecificProperties = {
                entityName: { type: GenAiType.STRING }, businessName: { type: GenAiType.STRING },
                abn: { type: GenAiType.STRING }, entityType: { type: GenAiType.STRING },
                isGstRegistered: { type: GenAiType.BOOLEAN }, mainBusinessLocation: { type: GenAiType.STRING },
                abnStatus: { type: GenAiType.STRING }, overallRisk: { type: GenAiType.STRING, description: "Assess risk: 'Low', 'Medium', 'High'." }
            };

            const finalSchemaProperties: { [key: string]: any } = reportType === 'individual'
                ? { ...baseSchemaProperties }
                : { ...baseSchemaProperties, ...entitySpecificProperties };
            
            finalSchemaProperties.clientName.description = reportType === 'entity' ? "Director/Trustee's full name." : "The individual's full name.";
            finalSchemaProperties.dateOfBirth.description = reportType === 'entity' ? "Director/Trustee's date of birth: YYYY-MM-DD." : "The individual's date of birth: YYYY-MM-DD.";
            
            const currentSchema = { type: GenAiType.OBJECT, properties: finalSchemaProperties };

            const extractionPrompt = `**Role:** You are a meticulous financial analyst AI specializing in Know Your Customer (KYC) data extraction.
**Primary Goal:** Populate a JSON object based on the provided schema using data from the document transcripts below.
**Critical Instructions:**
1.  **Adhere Strictly to the Schema:** Only extract the fields defined in the provided JSON schema.
2.  **Handle Missing Data:** If a piece of information cannot be found in ANY of the documents, its value in the JSON output MUST be \`null\`. Do not guess or invent data.
3.  **Use OCR Confidence:** An OCR confidence score is provided for each document. If documents contain conflicting information (e.g., slightly different address spellings), give higher priority to the data from the document with the higher confidence score.
4.  **Interpret Common Terms:** Recognize common abbreviations like 'DOB' for 'dateOfBirth'. Extract dates in YYYY-MM-DD format where possible.
**Document Mapping Guide:**
- **proofOfId**: Primary source for personal identity details (full name, date of birth, licence info).
- **proofOfResidence**: Primary source for residential/service addresses and utility provider details.
- **abnStatement**: Primary source for ABN, entity names, business location, and GST status.
- **sourceOfFunds**: Primary source for bank account details (account name, BSB, account number, statement period).
${reportType === 'entity' ? '**Risk Assessment:** Based on all provided information, assess an overall risk level (Low, Medium, High) considering document consistency, clarity, and the nature of the entity.' : ''}
**OCR Data Feeds (with confidence scores):**
${processedFiles.filter(f => f.ocrText).map(f => `--- OCR from: ${f.fileName} (Confidence: ${(f.ocrConfidence * 100).toFixed(0)}%) ---\n${f.ocrText}`).join('\n\n')}
`;

            setLoadingMessage('Analyzing documents and extracting data...');

            const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: { parts: [...processedFiles.map(f => f.fileData), { text: extractionPrompt }] },
                    config: { responseMimeType: 'application/json', responseSchema: currentSchema }
                });

            const extractedData = JSON.parse(response.text.trim());
            const fileNames = processedFiles.reduce((acc, file) => ({...acc, [`${file.id}_fileName`]: file.fileName}), {});
            const fullData = {...extractedData, ...fileNames};
            
            setFormData(fullData);
            setInitialFormData(fullData);
            setStep(2);

        } catch (error: any) {
            console.error("Error during data extraction:", error);
            alert(`An error occurred during processing: ${error.message || 'Please check the console for details.'}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    } else {
        const errors = validate(formData);
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  const handleDataChange = (field: string, value: string) => {
    if (field === 'mobile') {
      const cleaned = value.replace(/\D/g, '');
      const truncated = cleaned.substring(0, 10);
      let formatted = '';
      if (truncated.length > 7) {
          formatted = `${truncated.slice(0, 4)} ${truncated.slice(4, 7)} ${truncated.slice(7)}`;
      } else if (truncated.length > 4) {
          formatted = `${truncated.slice(0, 4)} ${truncated.slice(4)}`;
      } else {
          formatted = truncated;
      }
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({...prev, [field]: value}));
    }
  };
  
  const downloadPdf = async () => {
    setLoadingMessage("Generating PDF...");
    setIsLoading(true);
    try {
        const editedFields = Object.keys(formData).filter(key => {
            const initialValue = initialFormData[key] ?? '';
            const currentValue = formData[key] ?? '';
            return String(initialValue) !== String(currentValue);
        });

        await generateVerificationPdf(
            formData,
            reportType,
            getVisibleDocuments(),
            processedPdfPages,
            editedFields
        );
        setStep(4);
    } catch (err) {
        console.error("Error generating PDF:", err);
        alert("Could not generate PDF. See console for details.");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleStartOver = () => {
    setDocuments(DOCUMENT_TYPES.map(doc => ({ ...doc, file: null, preview: null, processingState: null, processedData: null })));
    setFormData({});
    setInitialFormData({});
    setFormErrors({});
    setProcessedPdfPages({});
    setProcessedOcrData({});
    setProcessedOcrConfidence({});
    setDocumentWarnings({});
    setViewingPdfDocId(null);
    setStep(1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <UploadStep
            reportType={reportType} setReportType={setReportType} documents={getVisibleDocuments()}
            onFileSelect={handleFileSelect} onRemoveFile={handleRemoveFile} fileInputRefs={fileInputRefs}
            onViewPdfPages={setViewingPdfDocId} processedOcrConfidence={processedOcrConfidence} documentWarnings={documentWarnings}
            onRegenerate={handleRegenerate}
          />
        );
      case 2:
        return <VerificationStep 
                  formData={formData} formErrors={formErrors} onDataChange={handleDataChange} reportType={reportType}
                  documents={getVisibleDocuments()} processedOcrData={processedOcrData} processedPdfPages={processedPdfPages}
               />;
      case 3:
        return <ReportPreview data={formData} reportType={reportType} />;
      case 4:
         return <FinalStep />;
      default:
        return null;
    }
  };

  const stepTitles: { [key: number]: string } = {
    1: 'Upload Documents', 2: 'Verify Extracted Information', 3: 'Preview Generated Report', 4: 'Process Complete'
  };

  return (
    <div className="app-container">
      <div className="dossier">
        <Header />
        <div className="dossier-content-header">
          <h2>{stepTitles[step]}</h2>
          <span className="step-indicator">Step {step} of 4</span>
        </div>
        <main className="dossier-content">
          {apiKeyMissing ? <ApiKeyErrorScreen /> : (
            <>
              {isLoading && <LoadingOverlay message={loadingMessage} />}
              {renderStep()}
              {viewingPdfDocId && processedPdfPages[viewingPdfDocId] && (
                <PdfPagesViewer
                  docName={documents.find(d => d.id === viewingPdfDocId)?.name || ''}
                  pages={processedPdfPages[viewingPdfDocId]}
                  onClose={() => setViewingPdfDocId(null)}
                />
              )}
            </>
          )}
        </main>
        <div className="dossier-footer">
          <div className="footer-checkbox">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="var(--primary-color)"/></svg>
            <span>KYC Document Pack</span>
          </div>
          <div className="logo">RPR</div>
        </div>
      </div>
      {!apiKeyMissing && (
        <Footer
          step={step} onNext={handleNext} onBack={handleBack} onDownload={downloadPdf} onStartOver={handleStartOver}
          isNextDisabled={step === 1 && (getVisibleDocuments().some(d => d.required && !d.file) || getVisibleDocuments().some(d => d.processingState !== null))}
        />
      )}
    </div>
  );
};

// --- Components ---

const RprLogo: React.FC = () => (
    <img 
      src="/rpr-logo.svg" 
      alt="RPR Logo" 
      width="200" 
      height="60"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
    />
);

const Header: React.FC = () => (
    <div className="dossier-header">
        <RprLogo />
    </div>
);

const PdfPagesViewer: React.FC<{ docName: string; pages: string[]; onClose: () => void; }> = ({ docName, pages, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pages for: {docName}</h2>
          <button onClick={onClose} className="close-btn" aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          {pages.map((pageData, index) => (
            <div key={index} className="pdf-page-image-container">
              <img src={`data:image/jpeg;base64,${pageData}`} alt={`Page ${index + 1}`} />
              <p>Page {index + 1}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
);

const UploadStep: React.FC<{ reportType: ReportType; setReportType: (type: ReportType) => void; documents: DocumentFile[]; onFileSelect: (id: string, file: File | null) => void; onRemoveFile: (id: string) => void; fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>; onViewPdfPages: (id: string) => void; processedOcrConfidence: { [docId: string]: number }; documentWarnings: { [docId: string]: string }; onRegenerate: (id: string) => void; }> = ({ reportType, setReportType, documents, onFileSelect, onRemoveFile, fileInputRefs, onViewPdfPages, processedOcrConfidence, documentWarnings, onRegenerate }) => (
    <div className="step-container upload-step">
       <div className="report-type-selector">
          <button className={reportType === 'individual' ? 'active' : ''} onClick={() => setReportType('individual')}>Individual</button>
          <button className={reportType === 'entity' ? 'active' : ''} onClick={() => setReportType('entity')}>Entity / Business</button>
      </div>
      <table className="upload-table">
        <thead><tr><th>Document Name</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {documents.map(doc => (
            <DocumentUploadRow
              key={doc.id} doc={doc} confidence={processedOcrConfidence[doc.id]} warning={documentWarnings[doc.id]}
              onFileSelect={onFileSelect} onRemoveFile={onRemoveFile} onTriggerInput={() => fileInputRefs.current[doc.id]?.click()}
              onViewPdfPages={onViewPdfPages} onRegenerate={onRegenerate}
            />
          ))}
        </tbody>
      </table>
      <div style={{display: 'none'}}>
        {documents.map(doc => (
          <input key={doc.id} type="file" ref={el => { fileInputRefs.current[doc.id] = el; }} onChange={e => onFileSelect(doc.id, e.target.files ? e.target.files[0] : null)} accept="image/*,application/pdf" />
        ))}
      </div>
    </div>
);

const DocumentUploadRow: React.FC<{ doc: DocumentFile; confidence?: number; warning?: string; onFileSelect: (id: string, file: File | null) => void; onRemoveFile: (id: string) => void; onTriggerInput: () => void; onViewPdfPages: (id: string) => void; onRegenerate: (id: string) => void; }> = ({ doc, confidence, warning, onFileSelect, onRemoveFile, onTriggerInput, onViewPdfPages, onRegenerate }) => {
  const [isDropping, setIsDropping] = useState(false);
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDropping(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDropping(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDropping(false); if (e.dataTransfer.files?.[0]) { onFileSelect(doc.id, e.dataTransfer.files[0]); } };
  
  const getConfidenceClass = (score: number) => {
    if (score >= 0.85) return 'success';
    if (score >= 0.70) return 'warning';
    return 'error';
  };
  
  const getConfidenceTooltip = (score: number) => {
    if (score >= 0.85) return "High confidence in transcription accuracy.";
    if (score >= 0.70) return "Confidence is moderate. Manual review of extracted data is recommended.";
    return "Confidence is low. Extracted data may be inaccurate. Please review carefully or upload a clearer document.";
  };

  const isError = doc.processingState?.toLowerCase().startsWith('error:');

  return (
    <tr className={`upload-row ${isDropping ? 'dropping' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <td>
        <div className="document-name">
          {doc.name} {doc.required && <span className="required-asterisk">*</span>}
          {doc.file && <span className="file-name-subtext">{doc.file.name}</span>}
        </div>
      </td>
      <td>
        <div className="status-cell">
          {doc.processingState && <ProcessingFeedback state={doc.processingState} />}
          {doc.file && !doc.processingState && typeof confidence === 'number' && (
            <div className="confidence-container">
              <span 
                className={`status-badge ${getConfidenceClass(confidence)}`}
                title={getConfidenceTooltip(confidence)}
              >
                {(confidence * 100).toFixed(0)}% Confidence
              </span>
              {(confidence < 0.70 || (warning && confidence >= 0.70)) && (
                  <div className="warning-indicator" title={warning || getConfidenceTooltip(confidence)}>⚠️</div>
              )}
            </div>
          )}
          {doc.file && !doc.processingState && typeof confidence !== 'number' && <span className="status-badge success">Uploaded</span>}
          {!doc.file && !doc.processingState && <span className="status-badge">Pending</span>}
        </div>
      </td>
      <td>
        <div className="actions-cell">
          {!doc.file && !doc.processingState && <button onClick={onTriggerInput} className="action-btn">Upload</button>}
          {doc.file && !doc.processingState && (
            <>
              {doc.file.type === 'application/pdf' && <button onClick={() => onViewPdfPages(doc.id)} className="action-btn secondary">View</button>}
              <button onClick={() => onRemoveFile(doc.id)} className="action-btn danger">Remove</button>
            </>
          )}
          {isError && (
            <>
              <button onClick={() => onRegenerate(doc.id)} className="action-btn">Regenerate</button>
              <button onClick={() => onRemoveFile(doc.id)} className="action-btn danger">Remove</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};


const ProcessingFeedback: React.FC<{ state: string }> = ({ state }) => {
  const isError = state.toLowerCase().startsWith('error:');
  if (isError) {
    const errorMessage = state.substring(6).trim();
    return (
      <div className="processing-error-feedback" title={errorMessage}>
        <span className="error-icon-small">⚠️</span>
        <span className="error-message-text">{errorMessage}</span>
      </div>
    );
  }
  return (
    <div className="processing-indicator">
      <div className="spinner-small"></div>
      <span>{state}</span>
    </div>
  );
};


const DocumentViewer: React.FC<{
    doc: DocumentFile | undefined;
    ocrWords: OcrWord[] | undefined;
    pdfPages: string[] | undefined;
    highlightBoxes: BoundingBox[];
}> = ({ doc, ocrWords, pdfPages, highlightBoxes }) => {
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number }>({ width: 0, height: 0, naturalWidth: 1, naturalHeight: 1 });

    const isPdf = doc?.file?.type === 'application/pdf';

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImgDimensions({
            width: img.offsetWidth,
            height: img.offsetHeight,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
        });
    };
    
    useEffect(() => {
        if (!imageContainerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const img = entry.target.querySelector('img');
                if (img) {
                    setImgDimensions({
                        width: img.offsetWidth,
                        height: img.offsetHeight,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                    });
                }
            }
        });
        const imgs = imageContainerRef.current.querySelectorAll('img');
        imgs.forEach(img => resizeObserver.observe(img.parentElement!));
        return () => resizeObserver.disconnect();
    }, [doc, pdfPages]);


    if (!doc) {
        return <div className="document-viewer-placeholder"><p>Focus on a field to see the source document.</p></div>;
    }

    const scaleX = imgDimensions.width / imgDimensions.naturalWidth;
    const scaleY = imgDimensions.height / imgDimensions.naturalHeight;

    const renderHighlightBoxes = (pageIndex?: number) => {
      return highlightBoxes
        // Fix: Remove `as any` cast now that BoundingBox type includes pageIndex.
        .filter(box => (pageIndex === undefined) || box.pageIndex === pageIndex)
        .map((box, i) => (
            <div
                key={i}
                className="highlight-box"
                style={{
                    left: `${box.x * scaleX}px`,
                    top: `${box.y * scaleY}px`,
                    width: `${box.width * scaleX}px`,
                    height: `${box.height * scaleY}px`,
                }}
            />
        ));
    };

    return (
        <div className="document-viewer" ref={imageContainerRef}>
            <h4>Source: {doc.name}</h4>
            <div className="document-viewer-content">
                {isPdf && pdfPages ? (
                    pdfPages.map((pageData, index) => (
                        <div key={index} className="viewer-image-container pdf-page">
                            <img src={`data:image/jpeg;base64,${pageData}`} alt={`Page ${index + 1}`} onLoad={handleImageLoad} />
                            {renderHighlightBoxes(index)}
                        </div>
                    ))
                ) : (
                    <div className="viewer-image-container">
                        <img src={doc.preview || ''} alt="Document Preview" onLoad={handleImageLoad} />
                        {renderHighlightBoxes()}
                    </div>
                )}
            </div>
        </div>
    );
};

const ConfidenceIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getConfidenceClass = (s: number) => {
    if (s >= 0.90) return 'high';
    if (s >= 0.75) return 'medium';
    return 'low';
  };
  const title = `Word Confidence: ${(score * 100).toFixed(0)}%. This is the average confidence of the specific words extracted for this field.`;
  return (
    <div className={`confidence-indicator ${getConfidenceClass(score)}`} title={title}>
      <span className="dot"></span>
      <span>{(score * 100).toFixed(0)}%</span>
    </div>
  );
};

const VerificationStep: React.FC<{
    formData: FormData;
    formErrors: FormErrors;
    onDataChange: (field: string, value: string) => void;
    reportType: ReportType;
    documents: DocumentFile[];
    processedOcrData: { [docId: string]: OcrWord[] };
    processedPdfPages: { [docId: string]: string[] };
}> = ({ formData, formErrors, onDataChange, reportType, documents, processedOcrData, processedPdfPages }) => {
    
    const [activeField, setActiveField] = useState<string | null>(null);
    const [activeDocId, setActiveDocId] = useState<string | null>(null);
    
    const fieldToDocMap = useMemo(() => ({
        clientName: 'proofOfId', dateOfBirth: 'proofOfId', email: 'proofOfId', mobile: 'proofOfId',
        residentialAddress: 'proofOfResidence', mailingAddress: 'proofOfResidence',
        driversLicenceNumber: 'proofOfId', licenceExpiryDate: 'proofOfId', licenceHolder: 'proofOfId', addressOnLicence: 'proofOfId',
        accountHolder: 'proofOfResidence', serviceAddress: 'proofOfResidence', issueDate: 'proofOfResidence', abnOfProvider: 'proofOfResidence',
        sourceOfFundsAccount: 'sourceOfFunds', bsb: 'sourceOfFunds', accountNumber: 'sourceOfFunds', statementPeriod: 'sourceOfFunds',
        entityName: 'abnStatement', businessName: 'abnStatement', abn: 'abnStatement', entityType: 'abnStatement',
        isGstRegistered: 'abnStatement', mainBusinessLocation: 'abnStatement', abnStatus: 'abnStatement', overallRisk: 'abnStatement',
    }), []);

    const fieldConfidences = useMemo(() => {
        const confidences: { [key: string]: number } = {};
        for (const fieldName in formData) {
            const fieldValue = String(formData[fieldName] || '').toLowerCase().trim().replace(/\s+/g, ' ');
            if (!fieldValue) continue;

            const docId = (fieldToDocMap as any)[fieldName];
            if (!docId || !processedOcrData[docId]) continue;

            const ocrWords = processedOcrData[docId];
            const valueWords = fieldValue.split(' ');
            
            let totalConfidence = 0;
            let matchCount = 0;

            for (let i = 0; i <= ocrWords.length - valueWords.length; i++) {
                const sequence = ocrWords.slice(i, i + valueWords.length);
                const sequenceText = sequence.map(w => w.text.toLowerCase()).join(' ');

                if (sequenceText === fieldValue) {
                    for (const word of sequence) {
                        if (typeof word.confidence === 'number') {
                            totalConfidence += word.confidence;
                            matchCount++;
                        }
                    }
                    break; 
                }
            }

            if (matchCount > 0) {
              confidences[fieldName] = totalConfidence / matchCount;
            }
        }
        return confidences;
    }, [formData, processedOcrData, fieldToDocMap]);

    const handleFocus = (fieldName: string) => {
        setActiveField(fieldName);
        const docId = (fieldToDocMap as any)[fieldName];
        const hasDoc = documents.some(d => d.id === docId && d.file);
        setActiveDocId(hasDoc ? docId : null);
    };

    const highlightBoxes = useMemo((): BoundingBox[] => {
        if (!activeField || !activeDocId || !formData[activeField]) return [];
        
        const fieldValue = String(formData[activeField]).toLowerCase().replace(/\s+/g, ' ');
        const ocrWords = processedOcrData[activeDocId];
        if (!ocrWords) return [];

        const valueWords = fieldValue.split(' ');
        const matchedBoxes: BoundingBox[] = [];
        
        for (let i = 0; i <= ocrWords.length - valueWords.length; i++) {
            const sequence = ocrWords.slice(i, i + valueWords.length);
            const sequenceText = sequence.map(w => w.text.toLowerCase()).join(' ');

            if (sequenceText === fieldValue) {
                sequence.forEach(word => matchedBoxes.push({ ...word.box, pageIndex: word.pageIndex }));
            }
        }
        return matchedBoxes;
    }, [activeField, activeDocId, formData, processedOcrData]);

    const activeDoc = documents.find(d => d.id === activeDocId);
    
    const FormField: React.FC<{ name: string, label: string, type?: string, confidence?: number }> = ({ name, label, type="text", confidence }) => (
      <div className="form-field">
        <div className="form-field-header">
          <label htmlFor={name}>{label}</label>
          {typeof confidence === 'number' && <ConfidenceIndicator score={confidence} />}
        </div>
        <input id={name} type={type} value={formData[name] || ''} 
          onChange={e => onDataChange(name, e.target.value)} 
          onFocus={() => handleFocus(name)}
          className={formErrors[name] ? 'input-error' : ''} 
          placeholder={`Enter ${label}...`} />
        {formErrors[name] && <span className="error-text">{formErrors[name]}</span>}
      </div>
    );
    const FormHeader: React.FC<{ title: string }> = ({ title }) => <h3 className="form-section-header">{title}</h3>;

    return (
        <div className="step-container verification-step-layout">
            <div className="verification-form-container">
                <div className="verification-form">
                  <p style={{ marginBottom: '1rem', color: 'var(--subtle-text-color)' }}>Focus on a field to see its source on the document.</p>
                  
                  <FormHeader title={reportType === 'entity' ? "Director / Trustee Information" : "Personal Information"} />
                  <div className="form-subgrid">
                      <FormField name="clientName" label="Full Name" confidence={fieldConfidences.clientName} />
                      <FormField name="dateOfBirth" label="Date of Birth (YYYY-MM-DD)" confidence={fieldConfidences.dateOfBirth} />
                      <FormField name="email" label="Email" type="email" confidence={fieldConfidences.email} />
                      <FormField name="mobile" label="Mobile" type="tel" confidence={fieldConfidences.mobile} />
                      <FormField name="residentialAddress" label="Residential Address" confidence={fieldConfidences.residentialAddress} />
                      <FormField name="mailingAddress" label="Mailing Address (if different)" confidence={fieldConfidences.mailingAddress} />
                  </div>

                  {reportType === 'entity' && (
                      <>
                          <FormHeader title="Business Details" />
                          <div className="form-subgrid">
                              <FormField name="entityName" label="Entity Name" confidence={fieldConfidences.entityName} />
                              <FormField name="businessName" label="Business/Trading Name" confidence={fieldConfidences.businessName} />
                              <FormField name="abn" label="ABN" confidence={fieldConfidences.abn} />
                              <FormField name="entityType" label="Entity Type" confidence={fieldConfidences.entityType} />
                              <FormField name="isGstRegistered" label="GST Registered (true/false)" confidence={fieldConfidences.isGstRegistered} />
                              <FormField name="mainBusinessLocation" label="Main Business Location" confidence={fieldConfidences.mainBusinessLocation} />
                              <FormField name="abnStatus" label="ABN Status" confidence={fieldConfidences.abnStatus} />
                          </div>
                      </>
                  )}

                  <FormHeader title="Identification Document (Proof of ID)" />
                  <div className="form-subgrid">
                      <FormField name="licenceHolder" label="Licence Holder" confidence={fieldConfidences.licenceHolder} />
                      <FormField name="driversLicenceNumber" label="Driver's Licence Number" confidence={fieldConfidences.driversLicenceNumber} />
                      <FormField name="licenceExpiryDate" label="Licence Expiry Date (YYYY-MM-DD)" confidence={fieldConfidences.licenceExpiryDate} />
                      <FormField name="addressOnLicence" label="Address on Licence" confidence={fieldConfidences.addressOnLicence} />
                  </div>

                  <FormHeader title="Proof of Address Document" />
                  <div className="form-subgrid">
                      <FormField name="accountHolder" label="Account Holder (Utility Bill)" confidence={fieldConfidences.accountHolder} />
                      <FormField name="serviceAddress" label="Service Address" confidence={fieldConfidences.serviceAddress} />
                      <FormField name="issueDate" label="Issue Date (YYYY-MM-DD)" confidence={fieldConfidences.issueDate} />
                      <FormField name="abnOfProvider" label="ABN of Provider" confidence={fieldConfidences.abnOfProvider} />
                  </div>

                  <FormHeader title="Source of Funds Document" />
                  <div className="form-subgrid">
                      <FormField name="sourceOfFundsAccount" label="Account Name" confidence={fieldConfidences.sourceOfFundsAccount} />
                      <FormField name="bsb" label="BSB" confidence={fieldConfidences.bsb} />
                      <FormField name="accountNumber" label="Account Number" confidence={fieldConfidences.accountNumber} />
                      <FormField name="statementPeriod" label="Statement Period" confidence={fieldConfidences.statementPeriod} />
                  </div>

                  {reportType === 'entity' && (
                      <>
                          <FormHeader title="Overall Risk Assessment" />
                          <div className="form-subgrid" style={{gridTemplateColumns: '1fr'}}>
                              <FormField name="overallRisk" label="Overall Risk Assessment" confidence={fieldConfidences.overallRisk} />
                          </div>
                      </>
                  )}
                </div>
            </div>
             <DocumentViewer 
                doc={activeDoc}
                ocrWords={activeDocId ? processedOcrData[activeDocId] : undefined}
                pdfPages={activeDocId ? processedPdfPages[activeDocId] : undefined}
                highlightBoxes={highlightBoxes}
            />
        </div>
    );
};


const ReportPreview: React.FC<{ data: FormData; reportType: ReportType }> = ({ data, reportType }) => {
  const Detail: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <p><strong>{label}:</strong> {value || <span className="report-placeholder">Not Provided</span>}</p>
  );

  return (
    <div className="step-container report-preview-container">
      <h2 className="report-main-title">Customer Due Diligence Report</h2>

      <div className="report-summary">
        <p><strong>CLIENT NAME:</strong> {data.clientName || <span className="report-placeholder">Not Provided</span>}</p>
        <p><strong>DATE OF BIRTH:</strong> {data.dateOfBirth || <span className="report-placeholder">Not Provided</span>}</p>
        {reportType === 'entity' && (
          <>
            <p><strong>ENTITY NAME:</strong> {data.entityName || <span className="report-placeholder">Not Provided</span>}</p>
            <p><strong>ABN:</strong> {data.abn || <span className="report-placeholder">Not Provided</span>}</p>
          </>
        )}
      </div>

      <hr className="report-divider" />

      <div className="report-section">
        <h3 className="report-section-title">Personal Details</h3>
        <div className="report-details-list">
          <Detail label="Email" value={data.email} />
          <Detail label="Mobile" value={data.mobile} />
          <Detail label="Residential Address" value={data.residentialAddress} />
          <Detail label="Mailing Address" value={data.mailingAddress} />
        </div>
      </div>

      {reportType === 'entity' && (
        <div className="report-section">
          <h3 className="report-section-title">Business Details</h3>
          <div className="report-details-list">
            <Detail label="Business/Trading Name" value={data.businessName} />
            <Detail label="Entity Type" value={data.entityType} />
            <Detail label="GST Registered" value={data.isGstRegistered?.toString()} />
            <Detail label="Main Business Location" value={data.mainBusinessLocation} />
            <Detail label="ABN Status" value={data.abnStatus} />
          </div>
        </div>
      )}

      <hr className="report-divider" />

      <div className="report-section">
        <h3 className="report-section-title">Verification Documents</h3>
        <p><strong>Proof of ID:</strong> {data.proofOfId_fileName || <span className="report-placeholder">Not Provided</span>}</p>
        <div className="report-details-list">
          <Detail label="Licence Holder" value={data.licenceHolder} />
          <Detail label="Licence Number" value={data.driversLicenceNumber} />
          <Detail label="Expiry Date" value={data.licenceExpiryDate} />
        </div>
      </div>
      
      <div className="report-section">
          <p><strong>Proof of Address:</strong> {data.proofOfResidence_fileName || <span className="report-placeholder">Not Provided</span>}</p>
        <div className="report-details-list">
          <Detail label="Service Address" value={data.serviceAddress} />
          <Detail label="Issue Date" value={data.issueDate} />
        </div>
      </div>

       {reportType === 'entity' && (
         <div className="report-section">
            <p><strong>Business Registration:</strong> {data.abnStatement_fileName || <span className="report-placeholder">Not Provided</span>}</p>
         </div>
      )}
      
      <div className="report-section">
          <p><strong>Source of Funds:</strong> {data.sourceOfFunds_fileName || <span className="report-placeholder">Not Provided</span>}</p>
        <div className="report-details-list">
            <Detail label="Account Name" value={data.sourceOfFundsAccount} />
            <Detail label="BSB" value={data.bsb} />
            <Detail label="Account Number" value={data.accountNumber} />
        </div>
      </div>

      {reportType === 'entity' && (
        <>
          <hr className="report-divider" />
          <div className="report-section">
            <h3 className="report-section-title">Risk Assessment</h3>
            <div className="report-details-list">
              <Detail label="Assessed Risk Level" value={data.overallRisk} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const FinalStep: React.FC = () => (
  <div className="step-container final-step">
    <div className="success-icon">✓</div>
    <h2>Report Generated Successfully!</h2>
    <p>Your Verified Information Report has been downloaded as a PDF.</p>
    <p>You can now close this window or start over to generate a new report.</p>
  </div>
);

const ApiKeyErrorScreen: React.FC = () => (
    <div className="step-container">
        <div className="api-key-error-screen">
            <div className="error-icon">⚠️</div>
            <h2>Configuration Error</h2>
            <p>This application requires a Google AI API key to function.</p>
            <p>Please ensure the <code>API_KEY</code> environment variable is set correctly and restart the application.</p>
        </div>
    </div>
);

const Footer: React.FC<{ step: number; onNext: () => void; onBack: () => void; onDownload: () => void; onStartOver: () => void; isNextDisabled: boolean; }> = ({ step, onNext, onBack, onDownload, onStartOver, isNextDisabled }) => {
  return (
    <footer className="app-footer">
        <div className="footer-content">
            {step > 1 && step < 4 && <button onClick={onBack} className="footer-btn secondary">Back</button>}
            <div className="footer-spacer"></div>
            {step === 1 && <button onClick={onNext} disabled={isNextDisabled} className="footer-btn primary">Next: Extract Data</button>}
            {step === 2 && <button onClick={onNext} className="footer-btn primary">Next: Preview Report</button>}
            {step === 3 && <button onClick={onDownload} className="footer-btn primary">Download Verification PDF</button>}
            {step === 4 && <button onClick={onStartOver} className="footer-btn primary">Start Over</button>}
        </div>
    </footer>
  );
};


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