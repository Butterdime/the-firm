// This combines the restoration of the full app with the new iterative enhancement feature.

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type as GenAiType, Modality } from '@google/genai';

// --- Type Definitions ---
declare global {
  interface Window {
    pdfjsLib: any;
    jspdf: any;
  }
}

export type ReportType = 'individual' | 'entity'; // Exported for use in other modules

export interface DocumentFile { // Exported for use in other modules
  id: string;
  name: string;
  required: boolean;
  file: File | null;
  preview: string | null;
  processingState: string | null;
  processedData: string | null;
  pages?: string[]; // Added to store processed PDF pages as base64 images
}

export type FormData = { [key: string]: string }; // Exported for use in other modules
type FormErrors = { [key: string]: string };

const DOCUMENT_TYPES: Omit<DocumentFile, 'file' | 'preview' | 'processingState' | 'processedData' | 'pages'>[] = [
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
    DOCUMENT_TYPES.map(doc => ({
      ...doc,
      file: null,
      preview: null,
      processingState: null,
      processedData: null,
      pages: [],
    }))
  );
  const [processedPdfPages, setProcessedPdfPages] = useState<{ [docId: string]: string[] }>({});
  const [processedOcrText, setProcessedOcrText] = useState<{ [docId: string]: string }>({});
  const [formData, setFormData] = useState<FormData>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [theme, setTheme] = useState('light');
  const [reportTemplate, setReportTemplate] = useState('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
  const aiClient = useRef<GoogleGenAI | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    // Configure PDF.js worker
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    // API Key Check & Client Initialization
    if (process.env.API_KEY) {
      aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.error("API_KEY environment variable not set.");
      setApiKeyMissing(true);
    }

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const templatePath = reportType === 'individual'
      ? '/CDD_Report_Individual.md'
      : '/CDD_Report_Entity.md';
    fetch(templatePath)
      .then(res => res.text())
      .then(text => setReportTemplate(text))
      .catch(err => console.error("Failed to load report template:", err));
  }, [reportType]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getVisibleDocuments = () => {
    let visibleDocs = documents;
    if (reportType === 'individual') {
      visibleDocs = visibleDocs.filter(doc => doc.id !== 'abnStatement');
    }
    // Always show photo analysis regardless of report type
    return visibleDocs;
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
  
  const enhanceImage = async (base64Image: string, prompt: string): Promise<string> => {
    if (!aiClient.current) throw new Error("AI Client not initialized");
    const response = await aiClient.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return base64Image;
  };

  const performGeminiOcr = async (base64Image: string): Promise<string> => {
    if (!aiClient.current) throw new Error("AI Client not initialized");
    const response = await aiClient.current.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Act as a specialized OCR engine. Transcribe all text, including handwritten text, from this document image. Preserve the layout and structure as best as possible. Be meticulous with numbers and dates." },
        ]
      },
    });
    return response.text;
  };
  
  const analyzePhoto = async (base64Image: string): Promise<string> => {
    if (!aiClient.current) throw new Error("AI Client not initialized");
    const response = await aiClient.current.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Describe this image in detail. What are the key objects, setting, and any notable features?" },
        ]
      },
    });
    return response.text;
  };


  const applySuperResolution = async (base64Image: string): Promise<string> => {
    if (!aiClient.current) throw new Error("AI Client not initialized");
    const prompt = "Act as a photo restoration expert specializing in super-resolution. Upscale this document image, intelligently reconstructing details to make blurry or pixelated text sharp and clear. The goal is to produce a high-resolution version of the original without altering any content.";
    
    const response = await aiClient.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return base64Image; // Fallback
  };


  const iterativeImageEnhancement = async (
    docId: string,
    base64Image: string,
    currentStep: number,
    totalSteps: number,
  ): Promise<string> => {
    let bestImage = base64Image;
    let highestOcrCharCount = 0;

    const enhancementStrategies = [
      "Enhance this document image. Improve contrast, sharpen text, and ensure it's clear and readable, as if it were a high-quality scan. Do not add, remove, or alter any of the original content.",
      "You are a professional document restoration specialist. This image suffers from severe lighting problems. Your primary task is to aggressively neutralize all glare and deep shadows. The final output must be a flat, evenly lit document with high contrast and sharp text, as if it were a perfect studio scan. All text must be equally legible. Do not alter, add, or remove any of the original text content."
    ];

    for (let i = 0; i < enhancementStrategies.length; i++) {
      setProcessingState(docId, `(${currentStep}/${totalSteps}) Enhancing Image (Attempt ${i + 1}/${enhancementStrategies.length})...`);
      try {
        const enhancedImage = await enhanceImage(base64Image, enhancementStrategies[i]);
        
        const ocrText = await performGeminiOcr(enhancedImage);
        
        if (ocrText.length > highestOcrCharCount) {
            highestOcrCharCount = ocrText.length;
            bestImage = enhancedImage;
        }

        if (ocrText.length > 50) {
          return enhancedImage; 
        }

      } catch (error) {
        console.error(`Enhancement attempt ${i + 1} failed:`, error);
      }
    }
    
    return bestImage;
  };


  const smartCropImage = async (base64Image: string): Promise<string> => {
      if (!aiClient.current) throw new Error("AI Client not initialized");
      const response = await aiClient.current.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this image and provide the bounding box coordinates of the document. The coordinates should be in the format { \"x\": number, \"y\": number, \"width\": number, \"height\": number }. Only provide the JSON object." },
        ] },
        config: { responseMimeType: 'application/json' }
      });

      try {
        const coords = JSON.parse(response.text.trim());
        const { x, y, width, height } = coords;
        
        if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number') {
            const img = new Image();
            img.src = `data:image/jpeg;base64,${base64Image}`;
            await new Promise(resolve => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
              return canvas.toDataURL('image/jpeg').split(',')[1];
            }
        }
        return base64Image;
      } catch (e) {
        console.error("Failed to parse coordinates or crop image:", e);
        return base64Image; 
      }
  };

  const processPdf = async (id: string, file: File) => {
    try {
        setProcessingState(id, '(1/2) Reading PDF...');
        const fileAsBase64 = await fileToBase64(file);
        const pdf = await window.pdfjsLib.getDocument({ data: atob(fileAsBase64) }).promise;
        const numPages = pdf.numPages;
        const totalSteps = numPages + 1;

        const pageProcessingPromises = Array.from({ length: numPages }, (_, i) => i + 1).map(async pageNum => {
            setProcessingState(id, `(${pageNum + 1}/${totalSteps}) Processing page ${pageNum}...`);
            const page = await pdf.getPage(pageNum);
            
            const originalViewport = page.getViewport({ scale: 1 });
            const MAX_DIMENSION = 2000;
            const scale = Math.min(MAX_DIMENSION / originalViewport.width, MAX_DIMENSION / originalViewport.height, 2);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const context = canvas.getContext('2d')!;
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const imageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
            const enhancedBase64 = await enhanceImage(imageBase64, "Enhance this document image. Improve contrast, sharpen text, and ensure it's clear and readable, as if it were a high-quality scan.");
            const ocrText = await performGeminiOcr(enhancedBase64);
            return { enhancedBase64, ocrText };
        });

        const processedPages = await Promise.all(pageProcessingPromises);
        const combinedOcrText = processedPages.map((p, i) => `--- Page ${i + 1} ---\n${p.ocrText}`).join('\n\n');
        const pageImages = processedPages.map(p => p.enhancedBase64);
        
        setProcessedPdfPages(prev => ({ ...prev, [id]: pageImages }));
        setProcessedOcrText(prev => ({ ...prev, [id]: combinedOcrText }));

        const firstPagePreview = `data:image/jpeg;base64,${pageImages[0]}`;
        setDocuments(prev => {
          const oldPreview = prev.find(d => d.id === id)?.preview;
          if (oldPreview) URL.revokeObjectURL(oldPreview);
          return prev.map(doc => doc.id === id ? { ...doc, preview: firstPagePreview, processingState: null, pages: pageImages } : doc);
        });

    } catch (error) {
        console.error("Error processing PDF:", error);
        setProcessingState(id, 'Error: Failed to process PDF. Please try a different file.');
    }
  };

  const handleFileUpload = async (id: string, file: File) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, file, preview: URL.createObjectURL(file), processingState: 'Starting...' } : doc));
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (id === 'photoAnalysis' && isImage) {
        try {
            setProcessingState(id, '(1/1) Analyzing photo...');
            const finalBase64 = await fileToBase64(file);
            // In this simplified flow, we are not storing the analysis text yet,
            // as the main extraction happens in handleNext. We just prepare the image.
            setDocuments(prev => {
                const newPreview = `data:image/jpeg;base64,${finalBase64}`;
                const oldPreview = prev.find(d => d.id === id)?.preview;
                if (oldPreview) URL.revokeObjectURL(oldPreview); 
                return prev.map(doc => doc.id === id ? { ...doc, preview: newPreview, processedData: finalBase64, processingState: null, pages: [finalBase64] } : doc);
            });
        } catch (error) {
            console.error("Error processing photo for analysis:", error);
            setProcessingState(id, 'Error: Photo processing failed.');
        }

    } else if (isImage) {
      try {
        let finalBase64 = await fileToBase64(file);
        
        setProcessingState(id, '(1/4) Assessing image quality...');
        const initialOcrText = await performGeminiOcr(finalBase64);
        
        let processedBase64 = finalBase64;
        let step = 2;
        const totalSteps = initialOcrText.length < 100 ? 4 : 3;

        if (initialOcrText.length < 100) {
            setProcessingState(id, `(2/${totalSteps}) Low quality. Applying super-resolution...`);
            processedBase64 = await applySuperResolution(processedBase64);
            step++;
        }

        const enhancedImageBase64 = await iterativeImageEnhancement(id, processedBase64, step++, totalSteps);
        
        setProcessingState(id, `(${step++}/${totalSteps}) Smart Cropping...`);
        finalBase64 = await smartCropImage(enhancedImageBase64);
        
        const finalOcr = await performGeminiOcr(finalBase64);
        setProcessedOcrText(prev => ({ ...prev, [id]: finalOcr }));
        
        setDocuments(prev => {
          const newPreview = `data:image/jpeg;base64,${finalBase64}`;
          const oldPreview = prev.find(d => d.id === id)?.preview;
          if (oldPreview) URL.revokeObjectURL(oldPreview); 
          return prev.map(doc => doc.id === id ? { ...doc, preview: newPreview, processedData: finalBase64, processingState: null, pages: [finalBase64] } : doc);
        });

      } catch (error) {
        console.error("Error processing file:", error);
        setProcessingState(id, 'Error: Image processing failed. Please try again.');
      }
    } else if (isPdf) {
      await processPdf(id, file);
    } else {
       setProcessingState(id, 'Error: Unsupported file type.');
    }
  };

  const handleRemoveFile = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        if (doc.preview) URL.revokeObjectURL(doc.preview);
        return { ...doc, file: null, preview: null, processedData: null, pages: [] };
      }
      return doc;
    }));
    setProcessedPdfPages(prev => {
        const newState = {...prev};
        delete newState[id];
        return newState;
    });
    setProcessedOcrText(prev => {
        const newState = {...prev};
        delete newState[id];
        return newState;
    });
  };

  const validate = (data: FormData): FormErrors => {
    const errors: FormErrors = {};
    Object.keys(data).forEach(key => {
        if (!data[key]) {
            errors[key] = 'This field is required.';
        }
    });

    if (data.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
        errors.dateOfBirth = 'Date must be in YYYY-MM-DD format.';
    }
     if (data.licenceExpiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.licenceExpiryDate)) {
        errors.licenceExpiryDate = 'Date must be in YYYY-MM-DD format.';
    }
    if (data.issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.issueDate)) {
        errors.issueDate = 'Date must be in YYYY-MM-DD format.';
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
            const uploadedDocs = getVisibleDocuments().filter(d => d.file);
            
            const fileProcessingPromises = uploadedDocs.map(async (doc) => {
                const isPdf = doc.file!.type === 'application/pdf';
                const isPhotoAnalysis = doc.id === 'photoAnalysis';

                if (isPdf) {
                    const firstPageImage = processedPdfPages[doc.id]?.[0];
                    return {
                        id: doc.id,
                        name: doc.name,
                        fileName: doc.file!.name,
                        ocrText: processedOcrText[doc.id] || '',
                        fileData: { 
                          inlineData: { mimeType: 'image/jpeg', data: firstPageImage }
                        }
                    };
                } else { // It's an image
                     return {
                        id: doc.id,
                        name: doc.name,
                        fileName: doc.file!.name,
                        ocrText: isPhotoAnalysis ? null : (processedOcrText[doc.id] || null), 
                        fileData: {
                            inlineData: { mimeType: doc.file!.type, data: doc.processedData! }
                        }
                    };
                }
            });

            const processedFiles = await Promise.all(fileProcessingPromises);

            const individualSchema = {
                type: GenAiType.OBJECT,
                properties: {
                    clientName: { type: GenAiType.STRING, nullable: true },
                    dateOfBirth: { type: GenAiType.STRING, description: 'Format: YYYY-MM-DD', nullable: true },
                    driversLicenceNumber: { type: GenAiType.STRING, nullable: true },
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
                    photoDescription: { type: GenAiType.STRING, description: 'A detailed description of the uploaded photo for analysis.', nullable: true },
                }
            };

            const entitySchema = {
                ...individualSchema.properties,
                abn: { type: GenAiType.STRING, nullable: true },
                entityName: { type: GenAiType.STRING, nullable: true },
                trusteeName: { type: GenAiType.STRING, description: "If applicable", nullable: true },
                tradingName: { type: GenAiType.STRING, description: "The trading name from the ABN statement, if applicable.", nullable: true },
                overallRisk: { type: GenAiType.STRING, description: "Assess the overall risk based on documents. E.g., 'Low', 'Medium', 'High'.", nullable: true}
            };

            const extractionPrompt = `
              Act as a compliance analyst. Extract information from the provided documents.
              The document's purpose is indicated by its name.
              - Proof of ID: For name, DOB, licence details.
              - Proof of Residence: For service address and utility provider details.
              - ABN Statement: For ABN, Entity Name, and Trading Name.
              - Source of Funds: For bank account details.
              - Photo for Analysis: This is a general photograph. Analyze it visually and provide a detailed description in the 'photoDescription' field. Do not perform OCR on it.
              ${reportType === 'entity' ? '- Assess an overall risk level (Low, Medium, High) based on document consistency, clarity, and information provided.' : ''}

              Here is the OCR text from the documents (except for the photo):
              ${processedFiles.filter(f => f.ocrText).map(f => `--- OCR from ${f.name} (${f.fileName}) ---\n${f.ocrText}`).join('\n')}
            `;

            setLoadingMessage('Extracting data from documents...');

            const response = await aiClient.current.models.generateContent({
              model: 'gemini-2.5-pro',
              contents: { parts: [
                  ...processedFiles.map(f => f.fileData),
                  { text: extractionPrompt }
              ] },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: GenAiType.OBJECT,
                  properties: reportType === 'individual' ? individualSchema.properties : entitySchema,
                }
              }
            });

            const extractedData = JSON.parse(response.text.trim());
            const fileNames = processedFiles.reduce((acc, file) => ({
                ...acc,
                [`${file.id}_fileName`]: file.fileName
            }), {});
            setFormData({...extractedData, ...fileNames});
            
            setStep(2);
        } catch (error) {
            console.error("Error processing documents:", error);
            alert("An error occurred during processing. Please check the console for details.");
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
    setFormData(prev => ({...prev, [field]: value}));
  };
  
  const downloadPdf = async () => {
    setLoadingMessage("Generating PDF...");
    setIsLoading(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 15;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      const checkPageBreak = (height: number) => {
          if (y + height > pageHeight - margin) {
              doc.addPage();
              y = margin;
          }
      };
      
      const parsedTemplate = parseMarkdownTemplate(reportTemplate, formData);

      for (const item of parsedTemplate) {
        // Strip warning markers for PDF generation
        if (item.content) item.content = item.content.replace(/__WARN_START__|__WARN_END__/g, '');
        if (item.items) item.items.forEach((li: any) => li.content = li.content.replace(/__WARN_START__|__WARN_END__/g, ''));
        if (item.rows) item.rows.forEach((row: string[]) => row.forEach((cell, i) => row[i] = cell.replace(/__WARN_START__|__WARN_END__/g, '')));


        switch(item.type) {
            case 'h1':
                checkPageBreak(12);
                doc.setFontSize(22).setFont(undefined, 'bold');
                doc.text(item.content, margin, y);
                y += 12;
                break;
            case 'h2':
                 checkPageBreak(10);
                doc.setFontSize(16).setFont(undefined, 'bold');
                doc.text(item.content, margin, y);
                y += 10;
                break;
            case 'p':
                 checkPageBreak(7);
                doc.setFontSize(11).setFont(undefined, 'normal');
                if (item.isBold) doc.setFont(undefined, 'bold');
                const splitText = doc.splitTextToSize(item.content, doc.internal.pageSize.width - margin * 2);
                doc.text(splitText, margin, y);
                y += (splitText.length * 5);
                if (item.isBold) doc.setFont(undefined, 'normal');
                break;
            case 'hr':
                 checkPageBreak(8);
                doc.setDrawColor(theme === 'dark' ? 80: 200);
                doc.line(margin, y, doc.internal.pageSize.width - margin, y);
                y += 8;
                break;
            case 'list':
                checkPageBreak(item.items.length * 6);
                item.items.forEach((li: any) => {
                    doc.setFontSize(11).setFont(undefined, 'normal');
                    doc.text(`${' '.repeat(li.indent * 2)}- ${li.content}`, margin + 5, y);
                    y += 6;
                });
                break;
             case 'table':
                checkPageBreak(10 + item.rows.length * 7);
                (doc as any).autoTable({
                    startY: y,
                    head: [item.headers],
                    body: item.rows,
                    theme: 'grid',
                    styles: { fontSize: 10, cellPadding: 2 },
                    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
                });
                y = (doc as any).lastAutoTable.finalY + 10;
                break;
        }
      }

      // Append images
      for (const document of getVisibleDocuments()) {
        if (document.file) {
            const pdfPages = document.pages; // Use document.pages which is now updated
            const imagesToAppend = pdfPages ? pdfPages.map(p => `data:image/jpeg;base64,${p}`) : (document.preview ? [document.preview] : []);

            for (const imgData of imagesToAppend) {
              doc.addPage();
              y = margin;
              doc.setFontSize(16).setFont(undefined, 'bold');
              doc.text(`Attachment: ${document.name}`, margin, y);
              y += 15;
              
              const img = new Image();
              img.src = imgData;
              await new Promise(resolve => img.onload = resolve);
              
              const imgProps = doc.getImageProperties(imgData);
              const pdfWidth = doc.internal.pageSize.getWidth() - margin * 2;
              const pdfHeight = doc.internal.pageSize.getHeight() - y - margin;
              const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
              const imgWidth = imgProps.width * ratio;
              const imgHeight = imgProps.height * ratio;
              
              doc.addImage(imgData, 'JPEG', margin, y, imgWidth, imgHeight);
            }
        }
      }

      doc.save('CDD_Report.pdf');
      setStep(4);
    } catch(err) {
      console.error("Error generating PDF:", err);
      alert("Could not generate PDF. See console for details.");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleStartOver = () => {
    setDocuments(DOCUMENT_TYPES.map(doc => ({ ...doc, file: null, preview: null, processingState: null, processedData: null, pages: [] })));
    setFormData({});
    setFormErrors({});
    setProcessedPdfPages({});
    setProcessedOcrText({});
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
            onFileSelect={handleFileSelect}
            onRemoveFile={handleRemoveFile}
            fileInputRefs={fileInputRefs}
          />
        );
      case 2:
        return (
          <VerificationStep
            formData={formData}
            formErrors={formErrors}
            onDataChange={handleDataChange}
          />
        );
      case 3:
        return (
          <GeneratedDocument 
            template={reportTemplate} 
            data={formData} 
            theme={theme}
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
        <main className="main-content">
          <ApiKeyErrorScreen />
        </main>
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

// --- Helper Functions ---
const parseMarkdownTemplate = (template: string, data: FormData): any[] => {
    let processedTemplate = template;

    const replacer = (match: string, key: string) => {
        const value = data[key.trim()];
        if (value === null || value === undefined) {
            return ''; // Return empty string for missing values to hide them
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    };


    // Handle special warning placeholders first
    processedTemplate = processedTemplate.replace(/{{!!(.*?)!!}}/g, (_, key) => {
        return `__WARN_START__${replacer(_, key)}__WARN_END__`;
    });
    
    // Handle regular placeholders
    processedTemplate = processedTemplate.replace(/{{(.*?)}}/g, replacer);

    const lines = processedTemplate.split('\n');
    const elements: any[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('# ')) {
            elements.push({ type: 'h1', content: line.substring(2) });
        } else if (line.startsWith('## ')) {
            elements.push({ type: 'h2', content: line.substring(3) });
        } else if (line.startsWith('---') && !(lines[i-1] && lines[i-1].includes('|'))) {
            // Only add HR if the content around it is not empty, preventing extra lines from hidden fields
            const prevLine = lines[i-1] || '';
            const nextLine = lines[i+1] || '';
            if(prevLine.trim() !== '' && nextLine.trim() !== '') {
               elements.push({ type: 'hr' });
            }
        } else if (line.startsWith('- ')) {
            const lastElement = elements[elements.length - 1];
            if (lastElement?.type === 'list') {
                lastElement.items.push({ content: line.substring(2), indent: 0 });
            } else {
                elements.push({ type: 'list', items: [{ content: line.substring(2), indent: 0 }] });
            }
        } else if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i+1].includes('---')) {
             const headers = line.split('|').map(s => s.trim()).filter(Boolean);
             const rows = [];
             let j = i + 2;
             while(j < lines.length && lines[j].trim().startsWith('|')) {
                 rows.push(lines[j].split('|').map(s => s.trim()).filter(Boolean));
                 j++;
             }
             elements.push({type: 'table', headers, rows});
             i = j - 1;
        } else if (line.trim()) {
            const isBold = line.startsWith('**') && line.includes('**:');
            let content = line.replace(/\*\*/g, '');
            // Do not render headers if their content is empty
            if( (line.startsWith('## ') || line.startsWith('# ')) && content.trim() === '') {
                continue;
            }
             elements.push({ type: 'p', content, isBold });
        }
    }
    return elements;
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
  fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
}> = ({ reportType, setReportType, documents, onFileSelect, onRemoveFile, fileInputRefs }) => {
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
    const isError = state.toLowerCase().includes('error') || state.toLowerCase().includes('failed');
    
    const progressMatch = state.match(/\((\d+)\/(\d+)\)/);
    const hasProgress = progressMatch !== null;
    
    const progress = hasProgress ? (parseInt(progressMatch[1], 10) / parseInt(progressMatch[2], 10)) * 100 : 0;
    const message = state.replace(/\(\d+\/\d+\)\s*/, '');

    if (isError) {
        return (
            <>
                <div className="error-icon">⚠️</div>
                <p>{message}</p>
            </>
        );
    }

    if (hasProgress) {
        return (
            <>
                <div className="progress-bar-container">
                    <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                </div>
                <p>{message}</p>
            </>
        );
    }

    // Fallback for simple messages without progress
    return (
        <>
            <div className="spinner"></div>
            <p>{state}</p>
        </>
    );
};

const DocumentUploadItem: React.FC<{
  doc: DocumentFile;
  onFileSelect: (id: string, file: File | null) => void;
  onRemoveFile: (id: string) => void;
  onClick: () => void;
}> = ({ doc, onFileSelect, onRemoveFile, onClick }) => {
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
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
            {doc.processingState && (
              <div className={`processing-overlay ${doc.processingState.toLowerCase().includes('error') ? 'error' : ''}`}>
                <ProcessingFeedback state={doc.processingState} />
              </div>
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
            rows={5}
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
        {formData.trusteeName && <FormField name="trusteeName" label="Trustee Name" />}
        {formData.tradingName && <FormField name="tradingName" label="Trading Name" />}
        
        <h3 style={{gridColumn: '1 / -1', marginTop: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Identification Details</h3>
        <FormField name="licenceHolder" label="Licence Holder" />
        <FormField name="driversLicenceNumber" label="Driver's Licence Number" />
        <FormField name="licenceExpiryDate" label="Licence Expiry Date (YYYY-MM-DD)" />
        <FormField name="addressOnLicence" label="Address on Licence" />
        
        <h3 style={{gridColumn: '1 / -1', marginTop: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Proof of Address Details</h3>
        <FormField name="accountHolder" label="Account Holder (Utility Bill)" />
        <FormField name="serviceAddress" label="Service Address" />
        <FormField name="issueDate" label="Issue Date (YYYY-MM-DD)" />
        <FormField name="abnOfProvider" label="ABN of Provider" />

        <h3 style={{gridColumn: '1 / -1', marginTop: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Source of Funds Details</h3>
        <FormField name="sourceOfFundsAccount" label="Account Name" />
        <FormField name="bsb" label="BSB" />
        <FormField name="accountNumber" label="Account Number" />
        <FormField name="statementPeriod" label="Statement Period" />

        {formData.photoDescription && (
            <>
                <h3 style={{gridColumn: '1 / -1', marginTop: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Photo Analysis</h3>
                <FormField name="photoDescription" label="AI Description of Photo" type="textarea" />
            </>
        )}


        {formData.overallRisk && <FormField name="overallRisk" label="Overall Risk Assessment" />}
      </div>
    </div>
  );
};

const GeneratedDocument: React.FC<{ template: string; data: FormData, theme: string }> = ({ template, data }) => {
  const parsed = parseMarkdownTemplate(template, data);

  // Unified helper to safely convert any value to a renderable string for JSX or dangerouslySetInnerHTML.
  const toRenderableString = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Helper for dangerouslySetInnerHTML, which also handles the warning markers.
  const toHtml = (value: any) => {
    const stringContent = toRenderableString(value);
    return stringContent.replace(/__WARN_START__(.*?)__WARN_END__/g, '<span class="warning-text">$1</span>');
  };

  const renderContent = (item: any, index: number) => {
    // Do not render empty content to avoid blank spaces
    if (!item.content && (!item.items || item.items.length === 0) && (!item.rows || item.rows.length === 0)) {
        // If a header has no content and the next element is a horizontal rule, hide the rule too
        if (item.type.startsWith('h') && elements[index + 1]?.type === 'hr') {
            return null; // This logic needs to be inside the map
        }
        return null;
    }

    switch (item.type) {
      case 'h1': return <h1 key={index} className="doc-h1">{toRenderableString(item.content)}</h1>;
      case 'h2': return <h2 key={index} className="doc-h2">{toRenderableString(item.content)}</h2>;
      case 'p': return <p key={index} className={`doc-p ${item.isBold ? 'bold' : ''}`} dangerouslySetInnerHTML={{ __html: toHtml(item.content) }} />;
      case 'hr': return <hr key={index} className="doc-hr" />;
      case 'list': return <ul key={index} className="doc-list">{item.items.map((li: any, i: number) => <li key={i} dangerouslySetInnerHTML={{ __html: toHtml(li.content) }} />)}</ul>;
      case 'table': return (
          <table key={index} className="doc-table">
              <thead>
                  <tr>{item.headers.map((h: string, i: number) => <th key={i}>{toRenderableString(h)}</th>)}</tr>
              </thead>
              <tbody>
                  {item.rows.map((row: string[], i: number) => (
                      <tr key={i}>{row.map((cell, j) => <td key={j} dangerouslySetInnerHTML={{ __html: toHtml(cell) }} />)}</tr>
                  ))}
              </tbody>
          </table>
      );
      default: return null;
    }
  };
  
  // Filter out empty headers and their subsequent HRs before rendering
  const elements = parseMarkdownTemplate(template, data);
  const visibleElements = elements.filter((item, index) => {
    if ((item.type === 'h1' || item.type === 'h2') && !item.content.trim()) {
      return false; // Hide empty header
    }
    if (item.type === 'hr') {
      // Check if the section before this HR is now completely empty
      let previousContentExists = false;
      for (let i = index - 1; i >= 0; i--) {
        const prevItem = elements[i];
        if (prevItem.type.startsWith('h')) break; // Stop at the previous header
        if (prevItem.content || (prevItem.items && prevItem.items.length > 0)) {
            previousContentExists = true;
            break;
        }
      }
      return previousContentExists;
    }
    if(item.type === 'p' && !item.content.trim()) return false; // Hide empty paragraphs

    return true;
  });


  return (
    <div className="step-container">
        <h2>3. Preview Report</h2>
        <div className="generated-doc">
            {visibleElements.map(renderContent)}
        </div>
    </div>
  );
};

const FinalStep: React.FC = () => (
  <div className="step-container final-step">
    <div className="success-icon">✓</div>
    <h2>Report Generated Successfully!</h2>
    <p>Your Customer Information Sheet has been downloaded as a PDF.</p>
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

const Footer: React.FC<{
  step: number;
  onNext: () => void;
  onBack: () => void;
  onDownload: () => void;
  onStartOver: () => void;
  isNextDisabled: boolean;
}> = ({ step, onNext, onBack, onDownload, onStartOver, isNextDisabled }) => {
  return (
    <footer className="app-footer">
      {step > 1 && step < 4 && (
        <button onClick={onBack}>Back</button>
      )}
      <div className="footer-spacer"></div>
      {step === 1 && (
        <button onClick={onNext} disabled={isNextDisabled}>Next: Extract Data</button>
      )}
      {step === 2 && (
        <button onClick={onNext}>Next: Preview Report</button>
      )}
      {step === 3 && (
        <button onClick={onDownload}>Download PDF</button>
      )}
      {step === 4 && (
        <button onClick={onStartOver}>Start Over</button>
      )}
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