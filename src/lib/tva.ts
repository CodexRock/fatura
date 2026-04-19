import type { InvoiceLine, Payment } from '../types';

/**
 * Validates a Moroccan TVA rate.
 * The strict legal brackets for TVA correspond to: 0% (exonéré), 7%, 10%, 14%, 20%
 */
export function validateTVARate(rate: number): boolean {
  const validRates = [0, 7, 10, 14, 20];
  return validRates.includes(rate);
}

/**
 * Transforms nominal MAD presentation value directly into precise database centimes.
 * @param mad floating point representation of dirhams (e.g. 50.00)
 */
export function madToCentimes(mad: number): number {
  return Math.round(mad * 100);
}

/**
 * Transforms precise database centimes into nominal MAD floating value.
 * @param centimes integers representation (e.g. 5000)
 */
export function centimesToMAD(centimes: number): number {
  return centimes / 100;
}

/**
 * Properly localizes and structures physical money representations.
 * @param centimes Base integer currency calculation
 * @param locale 'fr' for standard accounting formatting (4 500,00 MAD), 'ar' for arabic numbering (٤٬٥٠٠٫٠٠ د.م.)
 */
export function formatMAD(centimes: number, locale: 'fr' | 'ar' = 'fr'): string {
  const mad = centimes / 100;
  // Intl format handles proper digit grouping and fractional constraints perfectly
  const formatter = new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(mad);
}

/**
 * Calculates raw integer parameters explicitly mapped to centimes structure for invoice rows.
 * Disclosures apply percentage/fixed discounts chronologically onto base HT totals first, prior to TVA calculation.
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number, // Must be in centimes
  tvaRate: number,
  discount?: { type: 'percentage' | 'fixed'; value: number }
) {
  const totalHT = Math.round(quantity * unitPrice);
  
  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = Math.round((totalHT * discount.value) / 100);
    } else {
      // Fixed discount is strictly formatted in centimes
      discountAmount = discount.value;
    }
  }

  // Prevent massive discounts accidentally rolling negatively
  discountAmount = Math.min(discountAmount, totalHT);
  
  const taxableBase = totalHT - discountAmount;
  const totalTVA = Math.round((taxableBase * tvaRate) / 100);
  const totalTTC = taxableBase + totalTVA;

  return { totalHT, discountAmount, taxableBase, totalTVA, totalTTC };
}

/**
 * Accumulates lines via strict integer operations mapping the discrete tva breakages.
 */
export function calculateInvoiceTotals(lines: InvoiceLine[]) {
  let invoiceTotalHT = 0;
  let invoiceTotalTVA = 0;
  let invoiceTotalTTC = 0;
  
  const tvaBreakdownMap = new Map<number, { rate: number; base: number; amount: number }>();

  for (const line of lines) {
    const { taxableBase, totalTVA, totalTTC } = calculateLineTotal(
      line.quantity,
      line.unitPrice,
      line.tvaRate,
      line.discount
    );

    // HT mapped via line totals BEFORE discount is not traditionally what is summed at base.
    // Sum is based on taxonomic aggregate.
    // However, if we sum total items, invoiceTotalHT represents exactly the post-discount taxonomy:
    invoiceTotalHT += taxableBase; 
    invoiceTotalTVA += totalTVA;
    invoiceTotalTTC += totalTTC;
    
    const existing = tvaBreakdownMap.get(line.tvaRate) || { rate: line.tvaRate, base: 0, amount: 0 };
    existing.base += taxableBase;
    existing.amount += totalTVA;
    tvaBreakdownMap.set(line.tvaRate, existing);
  }

  const tvaBreakdown = Array.from(tvaBreakdownMap.values()).sort((a, b) => a.rate - b.rate);

  return {
    totalHT: invoiceTotalHT,
    tvaBreakdown,
    totalTVA: invoiceTotalTVA,
    totalTTC: invoiceTotalTTC
  };
}

/**
 * Maps raw totals directly into payment arrays assessing overall remaining debt values safely via absolute boundaries.
 */
export function calculatePaymentBalance(totalTTC: number, payments: Payment[]) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totalTTC - totalPaid);
  const isFullyPaid = totalPaid >= totalTTC;
  const isOverpaid = totalPaid > totalTTC;

  return { totalPaid, remaining, isFullyPaid, isOverpaid };
}


// ============================================================================
// COMPREHENSIVE UNIT TEST EXAMPLES (Manual Execution Guide)
// ============================================================================

/*
  1) Line with 20% TVA, no discount
  const out1 = calculateLineTotal(2, 5000, 20); // 100.00 MAD
  // expected: HT 10000, TVA 2000, TTC 12000

  2) Line with 14% TVA, 10% percentage discount
  const out2 = calculateLineTotal(1, 10000, 14, { type: 'percentage', value: 10 }); // 100.00 MAD line
  // expected: 
  // HT: 10000
  // Discount: Math.round(10000 * 10 / 100) = 1000
  // taxableBase: 9000
  // TVA: Math.round(9000 * 14 / 100) = 1260
  // TTC: 10260

  3) Line with mixed rates across multiple lines
  const lines: InvoiceLine[] = [
    { ..., quantity: 2, unitPrice: 5000, tvaRate: 20 },
    { ..., quantity: 1, unitPrice: 10000, tvaRate: 14, discount: { type: 'percentage', value: 10 } }
  ];
  const totalBreakdown = calculateInvoiceTotals(lines);
  // expected:
  // tvaBreakdown[0]: rate 14, base 9000, amount 1260
  // tvaBreakdown[1]: rate 20, base 10000, amount 2000
  // totalHT: 19000 (taxable bases)
  // totalTVA: 3260
  // totalTTC: 22260

  4) Rounding Edge Cases (33.33 MAD x 3 Qty -> 3333 centimes)
  const roundTest = calculateLineTotal(3, 3333, 20); // 33.33 * 3 = 99.99!
  // expected:
  // HT: 9999
  // TVA: Math.round(9999 * 20 / 100) = Math.round(1999.8) = 2000
  // TTC: 9999 + 2000 = 11999

  5) Zero-rated Line
  const zeroTest = calculateLineTotal(1, 50000, 0); 
  // expected:
  // TVA: 0, TTC: 50000
*/
