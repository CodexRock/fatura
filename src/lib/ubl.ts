/**
 * =============================================================================
 * UBL 2.1 Invoice XML Generator — Moroccan DGI Compliance
 * =============================================================================
 *
 * Generates valid UBL 2.1 (Universal Business Language) Invoice XML documents
 * conforming to OASIS UBL 2.1 specification and adapted for Moroccan DGI
 * (Direction Générale des Impôts) electronic invoicing requirements.
 *
 * Key DGI Requirements addressed:
 * - ICE (Identifiant Commun de l'Entreprise) as primary tax identifier
 * - IF (Identifiant Fiscal) for supplementary tax identification
 * - RC (Registre de Commerce) for legal entity validation
 * - TVA rates: 0%, 7%, 10%, 14%, 20% (Moroccan fiscal brackets)
 * - Currency: MAD (Moroccan Dirham) — ISO 4217
 * - All monetary values stored internally as centimes (integer arithmetic)
 *
 * Reference: https://docs.oasis-open.org/ubl/UBL-2.1.html
 * =============================================================================
 */

import type { Invoice, Client, Business, InvoiceLine, InvoiceType, ProductUnit } from '../types';
import { centimesToMAD } from './tva';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * UBL 2.1 XML Namespaces — Required for standards-compliant document parsing.
 *
 * - Default namespace: UBL Invoice schema
 * - cac: Common Aggregate Components (complex nested structures like parties, addresses)
 * - cbc: Common Basic Components (simple elements like ID, Name, Amount)
 */
const UBL_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

/**
 * UBL Invoice Type Codes (UN/CEFACT 1001 subset)
 *
 * DGI mapping:
 *  - 380: Commercial Invoice (Facture)
 *  - 381: Credit Note (Avoir) — corrective document referencing original invoice
 *  - 325: Proforma Invoice — not legally binding, used for quotes and customs
 *  - 310: Offer/Quote (Devis) — pre-contractual commercial proposal
 */
const INVOICE_TYPE_CODES: Record<InvoiceType, string> = {
  facture: '380',
  avoir: '381',
  proforma: '325',
  devis: '310',
};

/**
 * UBL Invoice Type Names — French labels for document title rendering.
 */
const INVOICE_TYPE_NAMES: Record<InvoiceType, string> = {
  facture: 'FACTURE',
  avoir: 'AVOIR',
  proforma: 'FACTURE PROFORMA',
  devis: 'DEVIS',
};

/**
 * UN/ECE Recommendation 20 — Unit of Measure codes
 *
 * Maps internal ProductUnit labels to standardized UBL unit codes.
 * Required for cross-border interoperability and DGI machine-readability.
 */
const UNIT_CODES: Record<ProductUnit, string> = {
  unit: 'EA',     // Each (individual units)
  hour: 'HUR',    // Hour
  day: 'DAY',     // Day
  kg: 'KGM',      // Kilogram
  m2: 'MTK',      // Square Metre
  forfait: 'LS',  // Lump Sum
  lot: 'LO',      // Lot
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Converts centimes to MAD string with exactly 2 decimal places.
 * UBL requires all monetary amounts to use fixed 2-decimal precision.
 *
 * @param centimes - Integer value in centimes (e.g., 450000 = 4500.00 MAD)
 * @returns Formatted string with 2 decimal places (e.g., "4500.00")
 */
function formatAmount(centimes: number): string {
  return centimesToMAD(centimes).toFixed(2);
}

/**
 * Converts a Firebase Timestamp or Date-like object to ISO date string (YYYY-MM-DD).
 * UBL date elements require ISO 8601 format without time component.
 *
 * @param dateField - Firebase Timestamp, Date, or object with toDate() method
 * @returns ISO date string (e.g., "2026-01-15")
 */
function toISODate(dateField: unknown): string {
  if (!dateField) return new Date().toISOString().split('T')[0];

  // Firebase Timestamp with toDate() method
  if (typeof dateField === 'object' && dateField !== null && 'toDate' in dateField) {
    return (dateField as { toDate: () => Date }).toDate().toISOString().split('T')[0];
  }

  // Native Date
  if (dateField instanceof Date) {
    return dateField.toISOString().split('T')[0];
  }

  // Fallback: try parsing as string
  if (typeof dateField === 'string') {
    return new Date(dateField).toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Escapes special XML characters to prevent injection and malformed documents.
 * Critical for user-supplied content (business names, descriptions, notes).
 *
 * @param str - Raw string to sanitize
 * @returns XML-safe string with entities escaped
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Maps product unit types to UBL-compliant UN/ECE Rec 20 unit codes.
 * Defaults to "EA" (Each) for unmapped or missing units.
 */
function getUnitCode(line: InvoiceLine): string {
  // InvoiceLine doesn't carry a `unit` field directly, default to EA
  return 'EA';
}

/**
 * Determines the UBL Tax Category ID based on TVA rate.
 *
 * UBL Tax Category codes (UNCL5305):
 *  - "S" : Standard rate (any rate > 0%)
 *  - "Z" : Zero rated
 *  - "E" : Exempt from tax
 *
 * DGI Context: Moroccan exonéré (exempt) status is different from zero-rated.
 * For simplicity, we map 0% → "E" (Exempt). If you need to distinguish
 * zero-rated from exempt, extend this with the business's tvaRegime.
 */
function getTaxCategoryId(tvaRate: number): string {
  if (tvaRate === 0) return 'E';
  return 'S';
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generates a complete UBL 2.1 Invoice XML document.
 *
 * This function produces a standards-compliant XML string that can be:
 * - Submitted to the DGI for electronic validation
 * - Attached to PDF invoices as structured data
 * - Exchanged with business partners via EDI
 * - Archived for the mandatory 10-year retention period (Code Général des Impôts, Art. 211)
 *
 * @param invoice - The invoice document with all line items, totals, and metadata
 * @param business - The supplier/issuer business entity (émetteur)
 * @param client - The customer/buyer entity (destinataire)
 * @returns Complete UBL 2.1 Invoice XML string
 */
export function generateUBL(invoice: Invoice, business: Business, client: Client): string {
  const issueDate = toISODate(invoice.issueDate);
  const dueDate = toISODate(invoice.dueDate);
  const typeCode = INVOICE_TYPE_CODES[invoice.type] || '380';
  const typeName = INVOICE_TYPE_NAMES[invoice.type] || 'FACTURE';

  // =========================================================================
  // XML Declaration & Root Element
  // =========================================================================
  // The XML declaration specifies version 1.0 and UTF-8 encoding, mandatory
  // for all UBL documents per the OASIS specification.
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_NS}"
         xmlns:cac="${CAC_NS}"
         xmlns:cbc="${CBC_NS}">

  <!-- ===================================================================== -->
  <!-- DOCUMENT IDENTIFICATION                                                -->
  <!-- Unique identification of this invoice within the DGI compliance chain  -->
  <!-- ===================================================================== -->

  <!-- UBL Version: Must be 2.1 for DGI e-invoicing compatibility -->
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>

  <!-- Customization ID: Identifies the business rules applied to this document.
       Using the European EN 16931 norm extended with Factur-X profile,
       which is the closest standardized profile for Franco-Moroccan trade. -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fatura.ma:1p0:extended</cbc:CustomizationID>

  <!-- Profile ID: Identifies the business process context -->
  <cbc:ProfileID>urn:fatura.ma:billing:1.0</cbc:ProfileID>

  <!-- Invoice Number: Unique sequential identifier as per DGI Art. 145 CGI.
       Format: F-YYYY-NNNN (e.g., F-2026-0001)
       Must be sequential, non-duplicated, and non-modifiable once issued. -->
  <cbc:ID>${escapeXml(invoice.number)}</cbc:ID>

  <!-- Issue Date: Date the invoice was legally issued (Format: YYYY-MM-DD)
       DGI Requirement: Must match the date printed on the PDF. -->
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>

  <!-- Due Date: Payment deadline calculated from payment terms.
       DGI: Required for tracking overdue invoices (délai de paiement). -->
  <cbc:DueDate>${dueDate}</cbc:DueDate>

  <!-- Invoice Type Code (UN/CEFACT 1001):
       380 = Facture (Commercial Invoice)
       381 = Avoir (Credit Note)
       325 = Proforma
       310 = Devis (Offer/Quote) -->
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>

  <!-- Document Type Name: Human-readable label in French for Moroccan context -->
  <cbc:Note>${escapeXml(typeName)} - ${escapeXml(invoice.number)}</cbc:Note>

  <!-- Document Currency Code: ISO 4217 currency for all monetary amounts.
       MAD = Moroccan Dirham. All amounts in this document are in MAD. -->
  <cbc:DocumentCurrencyCode>MAD</cbc:DocumentCurrencyCode>

  <!-- Tax Currency Code: Currency used for tax reporting to DGI.
       Always MAD for domestic Moroccan invoices. -->
  <cbc:TaxCurrencyCode>MAD</cbc:TaxCurrencyCode>`;

  // =========================================================================
  // Additional Notes (if present)
  // =========================================================================
  if (invoice.notes) {
    xml += `

  <!-- Additional free-text notes visible on the invoice -->
  <cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>`;
  }

  // =========================================================================
  // ACCOUNTING SUPPLIER PARTY (Émetteur / Business)
  // =========================================================================
  // DGI Art. 145 CGI: Every invoice must identify the supplier with:
  // - Full legal name (raison sociale)
  // - ICE (15-digit Identifiant Commun de l'Entreprise) — mandatory since 2019
  // - IF (Identifiant Fiscal) — tax registration number
  // - RC (Registre de Commerce) — commercial registry number
  // - Full postal address
  // - Contact details (phone, email)
  xml += `

  <!-- ===================================================================== -->
  <!-- SUPPLIER PARTY (Émetteur)                                              -->
  <!-- DGI Art. 145 CGI: Mandatory supplier identification fields             -->
  <!-- ===================================================================== -->
  <cac:AccountingSupplierParty>
    <cac:Party>

      <!-- Legal Entity Name: Official name registered at the RC -->
      <cac:PartyName>
        <cbc:Name>${escapeXml(business.legalName)}</cbc:Name>
      </cac:PartyName>

      <!-- Postal Address: Required by DGI for tax jurisdiction determination -->
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(business.address?.street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(business.address?.city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(business.address?.postalCode || '')}</cbc:PostalZone>
        <cac:Country>
          <!-- ISO 3166-1 alpha-2: MA = Morocco -->
          <cbc:IdentificationCode>MA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>

      <!-- Tax Registration: ICE is the primary DGI identifier since 2019 -->
      <cac:PartyTaxScheme>
        <!-- ICE: 15-character alphanumeric code, mandatory on all commercial documents -->
        <cbc:CompanyID schemeID="ICE">${escapeXml(business.ice || '')}</cbc:CompanyID>
        <cac:TaxScheme>
          <!-- TVA = Taxe sur la Valeur Ajoutée (Moroccan VAT equivalent) -->
          <cbc:ID>TVA</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>

      <!-- Legal Entity: Additional legal identifiers required by DGI -->
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(business.legalName)}</cbc:RegistrationName>
        <!-- IF (Identifiant Fiscal): Tax registration number at DGI -->
        <cbc:CompanyID schemeID="IF">${escapeXml(business.identifiantFiscal || '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>`;

  // RC (Registre de Commerce) — included if available
  if (business.registreCommerce) {
    xml += `

      <!-- RC (Registre de Commerce): Commercial registry registration -->
      <cac:PartyIdentification>
        <cbc:ID schemeID="RC">${escapeXml(business.registreCommerce)}</cbc:ID>
      </cac:PartyIdentification>`;
  }

  // CNSS — included if available
  if (business.cnss) {
    xml += `

      <!-- CNSS: Social security registration number -->
      <cac:PartyIdentification>
        <cbc:ID schemeID="CNSS">${escapeXml(business.cnss)}</cbc:ID>
      </cac:PartyIdentification>`;
  }

  // Contact information
  xml += `

      <!-- Supplier Contact Information -->
      <cac:Contact>
        ${business.phone ? `<cbc:Telephone>${escapeXml(business.phone)}</cbc:Telephone>` : ''}
        ${business.email ? `<cbc:ElectronicMail>${escapeXml(business.email)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>

    </cac:Party>
  </cac:AccountingSupplierParty>`;

  // =========================================================================
  // ACCOUNTING CUSTOMER PARTY (Client / Destinataire)
  // =========================================================================
  // DGI requires customer identification on all invoices.
  // ICE is mandatory for B2B transactions > 10,000 MAD.
  xml += `

  <!-- ===================================================================== -->
  <!-- CUSTOMER PARTY (Client / Destinataire)                                 -->
  <!-- DGI: ICE mandatory for B2B transactions above 10,000 MAD              -->
  <!-- ===================================================================== -->
  <cac:AccountingCustomerParty>
    <cac:Party>

      <!-- Client Legal Name -->
      <cac:PartyName>
        <cbc:Name>${escapeXml(client.name)}</cbc:Name>
      </cac:PartyName>

      <!-- Client Postal Address -->
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(client.address?.street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(client.address?.city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(client.address?.postalCode || '')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(client.address?.country || 'MA')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>`;

  // Client ICE — included if available (mandatory for B2B > 10,000 MAD)
  if (client.ice) {
    xml += `

      <!-- Client ICE: Required for B2B invoices exceeding 10,000 MAD -->
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="ICE">${escapeXml(client.ice)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>TVA</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`;
  }

  xml += `

      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>

      <!-- Client Contact -->
      <cac:Contact>
        ${client.contactPerson ? `<cbc:Name>${escapeXml(client.contactPerson)}</cbc:Name>` : ''}
        ${client.phone ? `<cbc:Telephone>${escapeXml(client.phone)}</cbc:Telephone>` : ''}
        ${client.email ? `<cbc:ElectronicMail>${escapeXml(client.email)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>

    </cac:Party>
  </cac:AccountingCustomerParty>`;

  // =========================================================================
  // PAYMENT MEANS
  // =========================================================================
  // Indicates acceptable payment methods. DGI tracks payment methods for
  // tax audit purposes (cash transactions > 20,000 MAD require bank transfer).
  if (business.bankDetails) {
    xml += `

  <!-- ===================================================================== -->
  <!-- PAYMENT MEANS                                                          -->
  <!-- DGI: Cash payments > 20,000 MAD must use bank transfer (Art. 193 CGI) -->
  <!-- ===================================================================== -->
  <cac:PaymentMeans>
    <!-- Payment Means Code 42 = Bank transfer (virement bancaire) -->
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <!-- RIB: Relevé d'Identité Bancaire (24-digit Moroccan bank account) -->
      <cbc:ID>${escapeXml(business.bankDetails.rib || '')}</cbc:ID>
      ${business.bankDetails.bankName ? `<cbc:Name>${escapeXml(business.bankDetails.bankName)}</cbc:Name>` : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`;
  }

  // =========================================================================
  // PAYMENT TERMS
  // =========================================================================
  xml += `

  <!-- Payment Terms: Default payment period in days -->
  <cac:PaymentTerms>
    <cbc:Note>Paiement à ${business.defaultPaymentTermsDays || 30} jours</cbc:Note>
  </cac:PaymentTerms>`;

  // =========================================================================
  // TAX TOTAL — Aggregated TVA breakdown
  // =========================================================================
  // DGI requires itemized TVA breakdown per rate bracket.
  // Each distinct TVA rate used in the invoice generates a separate TaxSubtotal.
  // This enables DGI to verify correct tax collection per fiscal bracket.
  const tvaBreakdown = invoice.totals.tvaBreakdown || [];
  const totalTVA = invoice.totals.totalTVA || 0;

  xml += `

  <!-- ===================================================================== -->
  <!-- TAX TOTAL                                                              -->
  <!-- DGI: Itemized TVA breakdown per rate bracket (Art. 145 CGI)           -->
  <!-- Moroccan TVA rates: 0%, 7%, 10%, 14%, 20%                            -->
  <!-- ===================================================================== -->
  <cac:TaxTotal>
    <!-- Total tax amount across all brackets -->
    <cbc:TaxAmount currencyID="MAD">${formatAmount(totalTVA)}</cbc:TaxAmount>`;

  // Generate one TaxSubtotal per distinct TVA rate
  for (const bracket of tvaBreakdown) {
    const categoryId = getTaxCategoryId(bracket.rate);

    xml += `

    <!-- TVA Bracket: ${bracket.rate}% -->
    <cac:TaxSubtotal>
      <!-- Taxable Base: Sum of all line totals HT at this rate -->
      <cbc:TaxableAmount currencyID="MAD">${formatAmount(bracket.base)}</cbc:TaxableAmount>
      <!-- Tax Amount: base × rate -->
      <cbc:TaxAmount currencyID="MAD">${formatAmount(bracket.amount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <!-- Tax Category: S=Standard, E=Exempt, Z=Zero-rated -->
        <cbc:ID>${categoryId}</cbc:ID>
        <cbc:Percent>${bracket.rate}</cbc:Percent>
        <cac:TaxScheme>
          <!-- TVA = Taxe sur la Valeur Ajoutée -->
          <cbc:ID>TVA</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
  }

  xml += `
  </cac:TaxTotal>`;

  // =========================================================================
  // LEGAL MONETARY TOTAL
  // =========================================================================
  // DGI Art. 145 CGI mandates these totals on every invoice:
  // - Total HT (Hors Taxe): Sum of all line amounts before tax
  // - Total TVA: Aggregate tax
  // - Total TTC (Toutes Taxes Comprises): Final payable amount
  const totalHT = invoice.totals.totalHT || 0;
  const totalTTC = invoice.totals.totalTTC || 0;

  // Calculate amount already paid (for partially paid invoices)
  const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const payableAmount = Math.max(0, totalTTC - totalPaid);

  xml += `

  <!-- ===================================================================== -->
  <!-- LEGAL MONETARY TOTAL                                                   -->
  <!-- DGI Art. 145 CGI: Mandatory financial summary fields                  -->
  <!-- All amounts in MAD, converted from centimes (÷100)                    -->
  <!-- ===================================================================== -->
  <cac:LegalMonetaryTotal>
    <!-- LineExtensionAmount: Sum of all invoice line net amounts (total HT) -->
    <cbc:LineExtensionAmount currencyID="MAD">${formatAmount(totalHT)}</cbc:LineExtensionAmount>

    <!-- TaxExclusiveAmount: Total before tax (equals LineExtensionAmount when no charges/allowances) -->
    <cbc:TaxExclusiveAmount currencyID="MAD">${formatAmount(totalHT)}</cbc:TaxExclusiveAmount>

    <!-- TaxInclusiveAmount: Grand total including all taxes (Total TTC) -->
    <cbc:TaxInclusiveAmount currencyID="MAD">${formatAmount(totalTTC)}</cbc:TaxInclusiveAmount>

    <!-- PrepaidAmount: Amount already paid by the customer -->
    <cbc:PrepaidAmount currencyID="MAD">${formatAmount(totalPaid)}</cbc:PrepaidAmount>

    <!-- PayableAmount: Remaining amount due (TTC - Prepaid) -->
    <cbc:PayableAmount currencyID="MAD">${formatAmount(payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;

  // =========================================================================
  // INVOICE LINES
  // =========================================================================
  // Each line item represents a product or service sold.
  // DGI requires: description, quantity, unit price, TVA rate, and line total.
  const lines = invoice.lines || [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const unitCode = getUnitCode(line);
    const categoryId = getTaxCategoryId(line.tvaRate);

    // Calculate line-level tax for UBL (line totalTVA)
    const lineTaxAmount = line.totalTVA || 0;
    const lineNetAmount = line.totalHT || 0;

    xml += `

  <!-- ===================================================================== -->
  <!-- INVOICE LINE ${lineNumber}                                                     -->
  <!-- ===================================================================== -->
  <cac:InvoiceLine>
    <!-- Sequential line identifier (1-based) -->
    <cbc:ID>${lineNumber}</cbc:ID>

    <!-- Quantity invoiced with UN/ECE Rec 20 unit code -->
    <cbc:InvoicedQuantity unitCode="${unitCode}">${line.quantity}</cbc:InvoicedQuantity>

    <!-- Line Extension Amount: Net line total HT (quantity × price - discount) -->
    <cbc:LineExtensionAmount currencyID="MAD">${formatAmount(lineNetAmount)}</cbc:LineExtensionAmount>`;

    // Line-level discount (if applicable)
    if (line.discount && line.discount.value > 0) {
      const rawTotal = Math.round(line.quantity * line.unitPrice);
      let discountAmount: number;
      let discountReason: string;

      if (line.discount.type === 'percentage') {
        discountAmount = Math.round((rawTotal * line.discount.value) / 100);
        discountReason = `Remise ${line.discount.value}%`;
      } else {
        discountAmount = line.discount.value;
        discountReason = `Remise fixe`;
      }

      xml += `

    <!-- Line-level Allowance (Discount) -->
    <cac:AllowanceCharge>
      <!-- ChargeIndicator false = Allowance/Discount -->
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>${escapeXml(discountReason)}</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="MAD">${formatAmount(discountAmount)}</cbc:Amount>
    </cac:AllowanceCharge>`;
    }

    xml += `

    <!-- Item Description and Tax Classification -->
    <cac:Item>
      <cbc:Description>${escapeXml(line.description)}</cbc:Description>
      <cbc:Name>${escapeXml(line.description)}</cbc:Name>

      <!-- Tax Category for this line item -->
      <cac:ClassifiedTaxCategory>
        <!-- S=Standard rated, E=Exempt, Z=Zero-rated -->
        <cbc:ID>${categoryId}</cbc:ID>
        <!-- TVA rate applied to this line (Moroccan fiscal bracket) -->
        <cbc:Percent>${line.tvaRate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>TVA</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>

    <!-- Unit Price (before quantity multiplication and discounts) -->
    <cac:Price>
      <!-- Price per unit in MAD, converted from centimes -->
      <cbc:PriceAmount currencyID="MAD">${formatAmount(line.unitPrice)}</cbc:PriceAmount>
      <cbc:BaseQuantity unitCode="${unitCode}">1</cbc:BaseQuantity>
    </cac:Price>
  </cac:InvoiceLine>`;
  }

  // =========================================================================
  // CLOSE ROOT ELEMENT
  // =========================================================================
  xml += `
</Invoice>`;

  return xml;
}


// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates UBL 2.1 XML structural integrity and DGI compliance.
 *
 * Performs the following checks:
 * 1. XML declaration present
 * 2. Root Invoice element with correct namespaces
 * 3. Required UBL elements present (ID, IssueDate, InvoiceTypeCode, etc.)
 * 4. Supplier and Customer parties defined
 * 5. At least one invoice line exists
 * 6. Tax total and legal monetary total present
 * 7. ICE identifier present for supplier (DGI mandate)
 *
 * Note: This is a structural validator, not a full XSD schema validator.
 * For production DGI submission, use the official DGI validation endpoint.
 *
 * @param xml - UBL XML string to validate
 * @returns Object with `valid` boolean and array of error messages
 */
export function validateUBL(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
    return { valid: false, errors: ['Le document XML est vide'] };
  }

  // 1. XML Declaration
  if (!xml.startsWith('<?xml')) {
    errors.push('Déclaration XML manquante (<?xml version="1.0" encoding="UTF-8"?>)');
  }

  // 2. Root element with UBL namespace
  if (!xml.includes('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2')) {
    errors.push('Namespace UBL 2.1 manquant sur l\'élément racine <Invoice>');
  }

  // 3. Required document identification elements
  const requiredElements: { tag: string; label: string }[] = [
    { tag: '<cbc:UBLVersionID>', label: 'UBL Version ID' },
    { tag: '<cbc:ID>', label: 'Numéro de facture (ID)' },
    { tag: '<cbc:IssueDate>', label: 'Date d\'émission (IssueDate)' },
    { tag: '<cbc:InvoiceTypeCode>', label: 'Code type de document (InvoiceTypeCode)' },
    { tag: '<cbc:DocumentCurrencyCode>', label: 'Code devise (DocumentCurrencyCode)' },
  ];

  for (const el of requiredElements) {
    if (!xml.includes(el.tag)) {
      errors.push(`Élément obligatoire manquant: ${el.label}`);
    }
  }

  // 4. Supplier Party (Émetteur)
  if (!xml.includes('<cac:AccountingSupplierParty>')) {
    errors.push('Partie émetteur manquante (AccountingSupplierParty) — DGI Art. 145 CGI');
  }

  // 5. Customer Party (Client)
  if (!xml.includes('<cac:AccountingCustomerParty>')) {
    errors.push('Partie client manquante (AccountingCustomerParty) — DGI Art. 145 CGI');
  }

  // 6. Tax Total
  if (!xml.includes('<cac:TaxTotal>')) {
    errors.push('Total TVA manquant (TaxTotal) — requis pour la ventilation fiscale');
  }

  // 7. Legal Monetary Total
  if (!xml.includes('<cac:LegalMonetaryTotal>')) {
    errors.push('Total monétaire légal manquant (LegalMonetaryTotal)');
  }

  // 8. At least one Invoice Line
  if (!xml.includes('<cac:InvoiceLine>')) {
    errors.push('Aucune ligne de facture trouvée (InvoiceLine) — minimum 1 requise');
  }

  // 9. DGI: ICE must be present for supplier
  if (!xml.includes('schemeID="ICE"')) {
    errors.push('ICE du fournisseur manquant — obligatoire depuis 2019 (DGI)');
  }

  // 10. Currency must be MAD
  if (xml.includes('<cbc:DocumentCurrencyCode>') && !xml.includes('<cbc:DocumentCurrencyCode>MAD</cbc:DocumentCurrencyCode>')) {
    errors.push('La devise du document doit être MAD (Dirham Marocain)');
  }

  // 11. Due Date check
  if (!xml.includes('<cbc:DueDate>')) {
    errors.push('Date d\'échéance manquante (DueDate) — requis pour le suivi des paiements');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


// =============================================================================
// DOWNLOAD
// =============================================================================

/**
 * Triggers a browser download of the UBL XML file.
 *
 * Creates a temporary Blob URL and programmatically clicks a hidden anchor
 * element to initiate the download. The Blob URL is revoked after download
 * to prevent memory leaks.
 *
 * @param xml - The complete UBL XML string
 * @param filename - Output filename (e.g., "F-2026-0001.xml")
 */
export function downloadUBL(xml: string, filename: string): void {
  // Encode as UTF-8 text/xml for proper character handling (Arabic, French accents)
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Create ephemeral anchor element for download trigger
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xml') ? filename : `${filename}.xml`;
  link.style.display = 'none';

  // Append, click, and clean up
  document.body.appendChild(link);
  link.click();

  // Revoke the Blob URL after a short delay to ensure download initiates
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
}
