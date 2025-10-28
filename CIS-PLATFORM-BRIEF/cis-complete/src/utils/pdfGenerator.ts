// Fix: Import types from the centralized documentProcessor module.
import { DocumentFile, FormData, ReportType } from '../server/documentProcessor';
import { getReportHtml } from './reportTemplate';

declare global {
  interface Window {
    jspdf: any;
  }
}

export const generateVerificationPdf = async (
    formData: FormData,
    reportType: ReportType,
    visibleDocuments: DocumentFile[],
    editedFields: string[], // List of fields that were manually edited
    // Fix: Add the 'originalData' parameter to the function signature.
    originalData: FormData
) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    });

    // Fix: Pass all required arguments to getReportHtml.
    const htmlString = getReportHtml(formData, reportType, visibleDocuments, editedFields, originalData);
    
    // Define standard margins for content
    const margin = 40; // Left, Right
    const topMargin = 60; // Space for header (adjusted for the report content itself)
    const bottomMargin = 40; // Space for footer
    const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;

    // This options object is for the initial HTML rendering
    const options = {
        callback: async (doc: any) => {
            // After HTML has been rendered, initialReportPageCount will be accurate for HTML content
            const initialReportPageCount = doc.internal.getNumberOfPages();

            // Function to apply consistent headers and footers
            const applyPageDecorations = (
              currentPageNum: number, 
              finalTotalPages: number, 
              isAttachment: boolean = false, 
              attachmentDocName?: string, 
              pageNumInAttachment?: number, 
              totalPagesInAttachment?: number
            ) => {
                doc.setPage(currentPageNum);
                doc.setFont('helvetica', 'normal'); // Reset font for general text

                // Header
                doc.setFontSize(10).setTextColor(100); // Subtle text color
                const headerText = `Customer Information Report - ${reportType === 'individual' ? 'Individual' : 'Entity'}`;
                doc.text(headerText, margin, 30);
                doc.setDrawColor(200); // Light gray line
                doc.line(margin, 35, doc.internal.pageSize.getWidth() - margin, 35);

                // Attachment Title (only for attachment pages)
                if (isAttachment && attachmentDocName) {
                    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(51); // Darker color for main title
                    let attachmentTitle = `Attachment: ${attachmentDocName}`;
                    const subTitle = (pageNumInAttachment !== undefined && totalPagesInAttachment !== undefined && totalPagesInAttachment > 1) ? ` (Page ${pageNumInAttachment} of ${totalPagesInAttachment})` : '';
                    attachmentTitle += subTitle;
                    doc.text(attachmentTitle, margin, 65); // Positioned below the standard header
                }

                // Footer
                doc.setFontSize(8).setTextColor(150); // Lighter text color for footer
                const footerY = doc.internal.pageSize.getHeight() - 25;
                
                // Page number
                doc.text(`Page ${currentPageNum} of ${finalTotalPages}`, doc.internal.pageSize.getWidth() - margin, footerY, { align: 'right' });
                
                // Generation date
                const generationDate = new Date().toLocaleDateString('en-AU', {
                    year: 'numeric', month: 'short', day: '2-digit',
                }) + ' ' + new Date().toLocaleTimeString('en-AU');
                doc.text(`Generated: ${generationDate}`, margin, footerY);

                // "Document Attachment" indicator
                if (isAttachment) {
                    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(80); // Slightly darker for prominence
                    doc.text('Document Attachment', doc.internal.pageSize.getWidth() / 2, footerY, { align: 'center' });
                }
            };

            // Append document images
            for (const document of visibleDocuments) {
                if (document.file && document.processingResult && document.processingResult.pages.length > 0) {
                    const imagesToAppend = document.processingResult.pages;
                    
                    for (const [index, imgData] of imagesToAppend.entries()) {
                        doc.addPage(); // Add a new page for each image

                        try {
                            // Step 1: Validate that the image can be loaded by the browser environment.
                            // This checks for corrupt data or unsupported formats before passing to jsPDF.
                            await new Promise<void>((resolve, reject) => {
                                const img = new Image();
                                img.onload = () => resolve();
                                img.onerror = () => reject(new Error('Image data is invalid or could not be loaded by the browser.'));
                                img.src = `data:image/jpeg;base64,${imgData}`;
                                if (img.complete) resolve(); // Handle cached images
                            });

                            // Step 2: If the image is valid, attempt to add it to the PDF.
                            const imgProps = doc.getImageProperties(`data:image/jpeg;base64,${imgData}`);
                            
                            // Calculate available space for image (subtracting header/footer/attachment title space)
                            const attachmentHeaderSpace = 80;
                            const availableWidth = doc.internal.pageSize.getWidth() - margin * 2;
                            const availableHeight = doc.internal.pageSize.getHeight() - attachmentHeaderSpace - bottomMargin;

                            const ratio = Math.min(availableWidth / imgProps.width, availableHeight / imgProps.height);
                            
                            const imgWidth = imgProps.width * ratio;
                            const imgHeight = imgProps.height * ratio;
                            
                            // Center image horizontally and vertically within the available space
                            const x = margin + (availableWidth - imgWidth) / 2;
                            const y = attachmentHeaderSpace + (availableHeight - imgHeight) / 2;

                            doc.addImage(`data:image/jpeg;base64,${imgData}`, 'JPEG', x, y, imgWidth, imgHeight);

                        } catch (error) {
                            // This single catch block handles both browser loading errors and jsPDF rendering errors.
                            console.error(`Failed to process and add attachment image for ${document.name}, page ${index + 1}:`, error);
                            
                            // Add a placeholder text to the PDF page to inform the user.
                            doc.setFontSize(12).setTextColor(200, 0, 0); // Red color for error
                            doc.text('Error: This attachment page could not be loaded or rendered.', margin, 80);
                        }
                    }
                }
            }

            // After all HTML and images are added, get the final total page count
            const finalTotalPages = doc.internal.getNumberOfPages();
            
            // Apply decorations to all pages with the final total page count
            let currentGlobalPage = 1;
            
            // First apply to initial report pages
            for (let i = 1; i <= initialReportPageCount; i++) {
                applyPageDecorations(currentGlobalPage++, finalTotalPages, false);
            }

            // Then apply to attachment pages
            for (const docFile of visibleDocuments) {
                if (docFile.processingResult && docFile.processingResult.pages.length > 0) {
                    const docPageCount = docFile.processingResult.pages.length;
                    for (let i = 1; i <= docPageCount; i++) {
                        applyPageDecorations(currentGlobalPage++, finalTotalPages, true, docFile.name, i, docPageCount);
                    }
                }
            }

            doc.save('Verified_Information_Report.pdf');
        },
        margin: [topMargin, margin, bottomMargin, margin], // top, right, bottom, left in points (for initial HTML render)
        autoPaging: 'text',
        html2canvas: {
            scale: 0.75, // Lower scale can help with large HTML, adjust as needed
            useCORS: true,
            windowWidth: 1000, 
        },
        width: contentWidth, // Use calculated content width
    };

    await doc.html(htmlString, options);
};