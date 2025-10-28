// --- Type Definitions ---
// These types are shared with the main application logic. In a larger app,
// they would live in a dedicated types file (e.g., src/types.ts).

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

// Make jsPDF available from the global scope where it's loaded via script tag
declare global {
  interface Window {
    jspdf: any;
  }
}

// --- PDF Generation Helpers ---

/**
 * Calculates the total height a form field will occupy in the PDF.
 * This function is crucial for handling multi-line text gracefully. It uses the PDF document's
 * font metrics to accurately predict the space needed for wrapped text, ensuring the field's
 * bounding box is always large enough.
 * @param doc The jsPDF instance.
 * @param value The text content of the field.
 * @param colWidth The width of the column the field will be rendered in.
 * @returns The total required height for the field, including margins and padding.
 */
const calculateFieldHeight = (doc: any, value: any, colWidth: number): number => {
    const FONT_SIZE = 10;
    const PADDING_X = 3; // Horizontal padding inside the box
    const PADDING_Y = 5; // Vertical padding inside the box
    const MIN_BOX_HEIGHT = 22; // Ensures short fields are not too small
    const TOP_MARGIN = 4;

    const displayValue = (value === null || value === undefined || value === '') ? '' : String(value);
    
    // Set the font size to match what will be used for rendering to get accurate measurements.
    doc.setFont('helvetica', 'normal').setFontSize(FONT_SIZE);
    
    // Split the text into lines based on the available width within the field box.
    const textLines = doc.splitTextToSize(displayValue, colWidth - (PADDING_X * 2));
    
    // Use jsPDF's built-in line height (fontSize * 1.15), which matches the default rendering spacing.
    // This ensures our height calculation is consistent with how the text is actually drawn.
    const textBlockHeight = textLines.length * (FONT_SIZE * 1.15);

    // The box must be tall enough for the text block plus vertical padding.
    const boxHeight = Math.max(MIN_BOX_HEIGHT, textBlockHeight + (PADDING_Y * 2));
    
    // The total component height includes the margin above the box.
    return boxHeight + TOP_MARGIN;
};


// Calculates the height of a two-column row, determined by the taller of the two fields.
const calculateRowHeight = (doc: any, fields: { name: string; label: string }[], formData: FormData, colWidth: number): number => {
    if (fields.length === 0) return 0;
    const h1 = calculateFieldHeight(doc, formData[fields[0].name], colWidth);
    const h2 = fields.length > 1 ? calculateFieldHeight(doc, formData[fields[1].name], colWidth) : 0;
    return Math.max(h1, h2);
};

/**
 * Draws a section header and implements "orphan prevention".
 * Before drawing, it calculates if the header and the first row of its content will fit on the
 * current page. If not, it inserts a page break, preventing the header from being stranded
 * alone at the bottom of a page.
 * @returns The new Y position after drawing the header.
 */
const drawSectionHeader = (
    doc: any,
    currentY: number,
    title: string,
    config: { margin: number; pageHeight: number },
    nextSectionFields: { name: string; label: string }[] = [],
    formData: FormData = {},
    colWidth: number = 0
): number => {
    let y = currentY;
    const headerHeight = 30; // Approx. height for header text, line, and spacing.
    const fieldsToRender = nextSectionFields.filter(field => formData[field.name] !== null && formData[field.name] !== undefined && formData[field.name] !== '');
    const firstRowHeight = calculateRowHeight(doc, fieldsToRender.slice(0, 2), formData, colWidth);

    // Orphan Prevention Check: If the header and the first row of content don't fit
    // on the current page, create a new page for the whole section.
    if (y + headerHeight + firstRowHeight > config.pageHeight - config.margin) {
        doc.addPage();
        y = config.margin;
    }
    
    doc.setFontSize(13).setFont('helvetica', 'bold');
    doc.text(title, config.margin, y);
    y += 8;
    doc.setDrawColor(220);
    doc.line(config.margin, y, doc.internal.pageSize.width - config.margin, y);
    y += 15;
    return y;
};

// Draws a single styled form field with a label and value.
const drawFormField = (
    doc: any,
    y: number,
    label: string,
    value: any,
    x: number,
    colWidth: number,
    isEdited: boolean
): void => {
    const displayValue = (value === null || value === undefined || value === '') ? '' : String(value);
    doc.setFontSize(9).setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text(label, x, y);

    const fieldHeight = calculateFieldHeight(doc, value, colWidth);
    const boxHeight = fieldHeight - 4; // Subtract top margin

    if (isEdited) {
        doc.setDrawColor(220).setFillColor(255, 252, 224); // Subtle yellow for edited fields
    } else {
        doc.setDrawColor(220).setFillColor(248, 249, 250); // Default light gray
    }
    doc.rect(x, y + 4, colWidth, boxHeight, 'FD'); // Draw the field box

    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(20, 20, 20);
    const textLines = doc.splitTextToSize(displayValue, colWidth - 6);
    // The y-position 'y + 11' provides consistent top-alignment for the text baseline.
    doc.text(textLines, x + 3, y + 11); 
};

/**
 * Renders a set of fields in a two-column layout for a given section.
 * @param doc jsPDF instance
 * @param currentY The starting Y position
 * @param fields Array of field definitions for the section
 * @param formData The data object
 * @param config The layout configuration object
 * @param editedFields An array of keys for fields that have been manually edited.
 * @returns The new Y position after rendering the section
 */
const renderSection = (
    doc: any,
    currentY: number,
    fields: { name: string; label: string }[],
    formData: FormData,
    config: any,
    editedFields: string[]
): number => {
    let yPos = currentY;
    const fieldsToRender = fields.filter(field => formData[field.name] !== null && formData[field.name] !== undefined && formData[field.name] !== '');
    for (let i = 0; i < fieldsToRender.length; i += 2) {
        const rowFields = fieldsToRender.slice(i, i + 2);
        const rowHeight = calculateRowHeight(doc, rowFields, formData, config.colWidth);
        
        if (yPos + rowHeight + config.fieldGap > config.pageHeight - config.margin) {
            doc.addPage();
            yPos = config.margin;
        }
        
        const isField1Edited = editedFields.includes(rowFields[0].name);
        drawFormField(doc, yPos, rowFields[0].label, formData[rowFields[0].name], config.col1X, config.colWidth, isField1Edited);
        
        if (rowFields[1]) {
            const isField2Edited = editedFields.includes(rowFields[1].name);
            drawFormField(doc, yPos, rowFields[1].label, formData[rowFields[1].name], config.col2X, config.colWidth, isField2Edited);
        }
        yPos += rowHeight + config.fieldGap;
    }
    return yPos;
};


/**
 * The core PDF generation engine. It uses a data-driven approach based on a layout configuration
 * to produce a fully formatted PDF document.
 */
export const generateVerificationPdf = async (
    formData: FormData,
    reportType: ReportType,
    visibleDocuments: DocumentFile[],
    processedPdfPages: { [docId: string]: string[] },
    editedFields: string[]
) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 30;

    const config = {
        margin: 20,
        pageHeight: doc.internal.pageSize.height,
        col1X: 20,
        col2X: doc.internal.pageSize.width / 2 + 5,
        colWidth: (doc.internal.pageSize.width / 2) - 20 - 2.5,
        fieldGap: 12,
    };

    const formLayout = [
        {
            title: (rt: ReportType) => rt === 'entity' ? "Director / Trustee Information" : "Personal Information",
            appliesTo: ['individual', 'entity'],
            fields: [
                { name: 'clientName', label: 'Full Name' }, { name: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)' },
                { name: 'email', label: 'Email' }, { name: 'mobile', label: 'Mobile' },
                { name: 'residentialAddress', label: 'Residential Address' }, { name: 'mailingAddress', label: 'Mailing Address (if different)' },
            ]
        },
        {
            title: () => 'Business Details',
            appliesTo: ['entity'],
            fields: [
                { name: 'entityName', label: 'Entity Name' }, { name: 'businessName', label: 'Business/Trading Name' },
                { name: 'abn', label: 'ABN' }, { name: 'entityType', label: 'Entity Type' },
                { name: 'isGstRegistered', label: 'GST Registered' }, { name: 'mainBusinessLocation', label: 'Main Business Location' },
                { name: 'abnStatus', label: 'ABN Status' },
            ]
        },
        {
            title: () => 'Identification Document (Proof of ID)',
            appliesTo: ['individual', 'entity'],
            fields: [
                { name: 'licenceHolder', label: 'Licence Holder' }, { name: 'driversLicenceNumber', label: "Driver's Licence Number" },
                { name: 'licenceExpiryDate', label: 'Licence Expiry Date (YYYY-MM-DD)' }, { name: 'addressOnLicence', label: 'Address on Licence' },
            ]
        },
        {
            title: () => 'Proof of Address Document',
            appliesTo: ['individual', 'entity'],
            fields: [
                { name: 'accountHolder', label: 'Account Holder (Utility Bill)' }, { name: 'serviceAddress', label: 'Service Address' },
                { name: 'issueDate', label: 'Issue Date (YYYY-MM-DD)' }, { name: 'abnOfProvider', label: 'ABN of Provider' },
            ]
        },
        {
            title: () => 'Source of Funds Document',
            appliesTo: ['individual', 'entity'],
            fields: [
                { name: 'sourceOfFundsAccount', label: 'Account Name' }, { name: 'bsb', label: 'BSB' },
                { name: 'accountNumber', label: 'Account Number' }, { name: 'statementPeriod', label: 'Statement Period' },
            ]
        },
        {
            title: () => 'Overall Risk Assessment',
            appliesTo: ['entity'],
            fields: [{ name: 'overallRisk', label: 'Overall Risk Assessment' }]
        },
    ];

    // --- PDF Header ---
    doc.setFontSize(18).setFont('helvetica', 'bold').text('2. Verify Extracted Information', config.margin, y);
    y += 10;
    doc.setFontSize(10).setFont('helvetica', 'normal').text('Please review the information extracted from your documents. Correct any errors before proceeding.', config.margin, y);
    y += 10;
    
    // --- Legend for Edited Fields ---
    if (editedFields.length > 0) {
      doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(150);
      doc.setFillColor(255, 252, 224); // Subtle yellow
      doc.rect(config.margin, y, 4, 4, 'F'); // Draw a small colored box
      doc.text('Indicates a field that was manually edited by the user.', config.margin + 6, y + 3.5);
      doc.setTextColor(20, 20, 20); // Reset text color
    }
    y += 15;


    // --- Data-Driven Section Rendering ---
    for (const section of formLayout) {
        if (!section.appliesTo.includes(reportType)) {
            continue;
        }

        const hasData = section.fields.some(field => formData[field.name] !== null && formData[field.name] !== undefined && formData[field.name] !== '');
        if (!hasData) {
            continue;
        }
        
        y = drawSectionHeader(doc, y, section.title(reportType), config, section.fields, formData, config.colWidth);
        y = renderSection(doc, y, section.fields, formData, config, editedFields);
    }

    // --- Attachments Section ---
    const attachments = visibleDocuments
        .filter(doc => doc.file)
        .map(doc => {
            const isPdf = processedPdfPages[doc.id] && processedPdfPages[doc.id].length > 0;
            const imageData = isPdf
                ? `data:image/jpeg;base64,${processedPdfPages[doc.id][0]}`
                : doc.preview;
            return { name: doc.name, data: imageData };
        })
        .filter((att): att is { name: string; data: string } => !!att.data);

    if (attachments.length > 0) {
        y = drawSectionHeader(doc, y, 'Document Attachments', config);

        const THUMB_WIDTH = 55;
        const THUMB_HEIGHT = 70;
        const TEXT_HEIGHT = 5;
        const ROW_SPACING = 10;
        const TOTAL_ROW_HEIGHT = THUMB_HEIGHT + TEXT_HEIGHT + ROW_SPACING;
        const THUMBS_PER_ROW = 3;

        const totalWidth = doc.internal.pageSize.width - config.margin * 2;
        const GAP = (totalWidth - (THUMBS_PER_ROW * THUMB_WIDTH)) / (THUMBS_PER_ROW - 1);
        
        let currentX = config.margin;
        let thumbCountInRow = 0;

        for (const attachment of attachments) {
            if (thumbCountInRow === 0) {
                if (y + TOTAL_ROW_HEIGHT > config.pageHeight - config.margin) {
                    doc.addPage();
                    y = config.margin;
                }
            }

            const img = new Image();
            img.src = attachment.data;
            await new Promise(resolve => (img.onload = resolve));

            const props = doc.getImageProperties(attachment.data);
            const ratio = Math.min(THUMB_WIDTH / props.width, THUMB_HEIGHT / props.height);
            const imgWidth = props.width * ratio;
            const imgHeight = props.height * ratio;

            const imgX = currentX + (THUMB_WIDTH - imgWidth) / 2;
            const imgY = y + (THUMB_HEIGHT - imgHeight) / 2;

            doc.addImage(attachment.data, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            doc.setDrawColor(220);
            doc.rect(currentX, y, THUMB_WIDTH, THUMB_HEIGHT);

            doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100);
            const textLines = doc.splitTextToSize(attachment.name, THUMB_WIDTH);
            doc.text(textLines, currentX + THUMB_WIDTH / 2, y + THUMB_HEIGHT + 4, { align: 'center' });

            thumbCountInRow++;
            if (thumbCountInRow >= THUMBS_PER_ROW) {
                y += TOTAL_ROW_HEIGHT;
                currentX = config.margin;
                thumbCountInRow = 0;
            } else {
                currentX += THUMB_WIDTH + GAP;
            }
        }
    }

    doc.save('Verified_Information_Report.pdf');
};