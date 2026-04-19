// npm install jspdf jspdf-autotable
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { formatMAD, centimesToMAD } from './tva';
import type { Invoice, Business, Client } from '../types';

/**
 * Uploads a generated PDF Blob to Firebase Storage
 * @returns The public download URL for the invoice
 */
export const uploadInvoicePDF = async (businessId: string, invoiceId: string, blob: Blob): Promise<string> => {
  const filePath = `businesses/${businessId}/invoices/${invoiceId}.pdf`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
  return getDownloadURL(storageRef);
};

/**
 * Helper to trigger a local browser download from a Blob / URL
 */
export const downloadPDF = (urlOrBlobUrl: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = urlOrBlobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Promise-wrapped image loader for jsPDF
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Generates a compliant Moroccan Invoice PDF using jsPDF
 */
export const generateInvoicePDF = async (invoice: Invoice, business: Business, client: Client): Promise<Blob> => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const primaryColor = business.brandColor || '#1B4965';

  // Helper to convert hex to RGB for jsPDF
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 27, g: 73, b: 101 }; // fallback to #1B4965
  };

  const primaryRgb = hexToRgb(primaryColor);
  const margin = 15;
  const pageWidth = doc.internal.pageSize.width;
  let currentY = margin;

  // -------------------------------------------------------------------------
  // HEADER AREA
  // -------------------------------------------------------------------------

  // Logo integration
  if (business.logoUrl) {
    try {
      const img = await loadImage(business.logoUrl);
      const imgWidth = 40;
      const ratio = img.height / img.width;
      const imgHeight = imgWidth * ratio;
      // Depending on the image format you might want to switch 'PNG' to a dynamic extraction
      doc.addImage(img, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += Math.max(imgHeight, 15) + 5;
    } catch (e) {
      console.warn("Could not load logo for PDF", e);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(business.tradeName || business.legalName, margin, currentY + 10);
      currentY += 20;
    }
  } else {
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(business.tradeName || business.legalName, margin, currentY + 10);
    currentY += 20;
  }

  // Right Side Header (Title & Meta)
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const typeText = invoice.type.toUpperCase();
  doc.text(typeText, pageWidth - margin, margin + 10, { align: 'right' });
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° : ${invoice.number}`, pageWidth - margin, margin + 18, { align: 'right' });
  
  const issueDate = invoice.issueDate.toDate().toLocaleDateString('fr-FR');
  const dueDate = invoice.dueDate.toDate().toLocaleDateString('fr-FR');
  
  doc.text(`Date d'émission : ${issueDate}`, pageWidth - margin, margin + 24, { align: 'right' });
  doc.text(`Date d'échéance : ${dueDate}`, pageWidth - margin, margin + 30, { align: 'right' });

  // Baseline to ensure Parties section doesn't overlap header
  currentY = Math.max(currentY, margin + 40);

  // -------------------------------------------------------------------------
  // PARTIES (Émetteur & Client)
  // -------------------------------------------------------------------------

  const leftColX = margin;
  const rightColX = pageWidth / 2 + 10;
  
  // Emetteur (Left)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text("Émetteur :", leftColX, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let emitterY = currentY + 6;
  doc.text(business.legalName, leftColX, emitterY);
  emitterY += 5;
  doc.text(business.address.street, leftColX, emitterY);
  emitterY += 5;
  doc.text(`${business.address.postalCode || ''} ${business.address.city}`, leftColX, emitterY);
  emitterY += 5;
  if (business.phone) { doc.text(`Tél: ${business.phone}`, leftColX, emitterY); emitterY += 5; }
  if (business.email) { doc.text(`Email: ${business.email}`, leftColX, emitterY); emitterY += 5; }
  
  const legalStr = [];
  if (business.ice) legalStr.push(`ICE: ${business.ice}`);
  if (business.identifiantFiscal) legalStr.push(`IF: ${business.identifiantFiscal}`);
  if (business.registreCommerce) legalStr.push(`RC: ${business.registreCommerce}`);
  if (legalStr.length > 0) {
    doc.text(legalStr.join(' | '), leftColX, emitterY);
  }

  // Client (Right)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text("Client :", rightColX, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let clientY = currentY + 6;
  doc.text(client.name, rightColX, clientY);
  clientY += 5;
  
  if (client.address.street) { doc.text(client.address.street, rightColX, clientY); clientY += 5; }
  if (client.address.city) { doc.text(`${client.address.postalCode || ''} ${client.address.city}`, rightColX, clientY); clientY += 5; }
  if (client.phone) { doc.text(`Tél: ${client.phone}`, rightColX, clientY); clientY += 5; }
  if (client.email) { doc.text(`Email: ${client.email}`, rightColX, clientY); clientY += 5; }
  if (client.ice) { doc.text(`ICE: ${client.ice}`, rightColX, clientY); }

  currentY = Math.max(emitterY, clientY) + 15;

  // -------------------------------------------------------------------------
  // LINE ITEMS TABLE
  // -------------------------------------------------------------------------
  
  const tableData = invoice.lines.map((line, index) => {
    let desc = line.description;
    if (line.discount && line.discount.value > 0) {
      const discText = line.discount.type === 'percentage' 
        ? `Remise de ${line.discount.value}%` 
        : `Remise de ${centimesToMAD(line.discount.value)} MAD`;
      desc += `\n(${discText})`;
    }
    
    return [
      (index + 1).toString(),
      desc,
      line.quantity.toString(),
      formatMAD(line.unitPrice),
      `${line.tvaRate}%`,
      formatMAD(line.totalHT)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Désignation', 'Qté', 'Prix unit. HT', 'TVA', 'Total HT']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'right', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  // Calculate new Y offset after table
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Manage pagination before totals if remaining vertical space is too short
  // Usually need at least ~60mm for the totals & notes box
  if (currentY + 60 > doc.internal.pageSize.height - margin * 2) {
    doc.addPage();
    currentY = margin + 10;
  }

  // -------------------------------------------------------------------------
  // TOTALS BOX
  // -------------------------------------------------------------------------

  const totalsBoxWidth = 80;
  const totalsStartX = pageWidth - margin - totalsBoxWidth;
  
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  
  // Dynamic height calculation based on amount of TVA subdivisions
  const validTvaBreakdowns = invoice.totals.tvaBreakdown.filter(tva => tva.amount > 0);
  const totalsCount = 2 + validTvaBreakdowns.length; 
  const boxHeight = totalsCount * 8 + 10;
  
  doc.roundedRect(totalsStartX, currentY, totalsBoxWidth, boxHeight, 2, 2, 'FD');
  
  let totalY = currentY + 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  
  // Total HT
  doc.text("Total HT", totalsStartX + 5, totalY);
  doc.text(formatMAD(invoice.totals.totalHT), pageWidth - margin - 5, totalY, { align: 'right' });
  
  // TVA lines breakdown
  validTvaBreakdowns.forEach(tva => {
    totalY += 8;
    doc.text(`TVA ${tva.rate}%`, totalsStartX + 5, totalY);
    doc.text(formatMAD(tva.amount), pageWidth - margin - 5, totalY, { align: 'right' });
  });

  // TTC line
  totalY += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsStartX + 5, totalY, pageWidth - margin - 5, totalY);
  
  totalY += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.text("TOTAL TTC", totalsStartX + 5, totalY);
  doc.text(`${formatMAD(invoice.totals.totalTTC)}`, pageWidth - margin - 5, totalY, { align: 'right' });

  // -------------------------------------------------------------------------
  // NOTES & PAYMENT TERMS
  // -------------------------------------------------------------------------
  
  const notesY = currentY;

  const getNotes = () => {
    const combined = [];
    if (invoice.notes) combined.push(invoice.notes);
    if (client.paymentTermsDays) combined.push(`Conditions de paiement: Paiement à ${client.paymentTermsDays} jours.`);
    else if (business.defaultPaymentTermsDays) combined.push(`Conditions de paiement: Paiement à ${business.defaultPaymentTermsDays} jours.`);
    return combined.join("\n\n");
  };

  const finalNotes = getNotes();

  if (finalNotes) {
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(220, 220, 220);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const splitNotes = doc.splitTextToSize(finalNotes, pageWidth - margin * 2 - totalsBoxWidth - 10);
    
    const notesHeight = splitNotes.length * 5 + 10;
    doc.roundedRect(margin, notesY, pageWidth - margin * 2 - totalsBoxWidth - 10, Math.max(notesHeight, boxHeight), 2, 2, 'FD');
    doc.text(splitNotes, margin + 5, notesY + 8);
  }

  // -------------------------------------------------------------------------
  // MULTIPAGE FOOTER
  // -------------------------------------------------------------------------
  
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 20;
    
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    
    if (business.bankDetails?.bankName && business.bankDetails?.rib) {
      doc.text(
        `Règlement par virement: ${business.bankDetails.bankName} — RIB: ${business.bankDetails.rib}`,
        pageWidth / 2, 
        footerY, 
        { align: 'center' }
      );
    }
    
    const footerLegal = [];
    if (business.ice) footerLegal.push(`ICE: ${business.ice}`);
    if (business.identifiantFiscal) footerLegal.push(`IF: ${business.identifiantFiscal}`);
    if (business.registreCommerce) footerLegal.push(`RC: ${business.registreCommerce}`);
    
    doc.text(footerLegal.join(' | '), pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text("Facture conforme à l'article 145-9 du CGI", pageWidth / 2, footerY + 10, { align: 'center' });
    
    doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, footerY + 10, { align: 'right' });
  }

  // Produce the blob
  return doc.output('blob');
};
