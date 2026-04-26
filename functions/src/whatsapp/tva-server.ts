import { InvoiceLine } from '../../../src/types';

/**
 * Calculates raw integer parameters explicitly mapped to centimes structure for invoice rows.
 * Disclosures apply percentage/fixed discounts chronologically onto base HT totals first, prior to TVA calculation.
 */
export function calculateLineTotals(
  unitPrice: number, // Must be in centimes
  quantity: number,
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
export function calculateInvoiceTotals(lines: any[]) {
  let invoiceTotalHT = 0;
  let invoiceTotalTVA = 0;
  let invoiceTotalTTC = 0;
  
  const tvaBreakdownMap = new Map<number, { rate: number; base: number; amount: number }>();

  for (const line of lines) {
    const { taxableBase, totalTVA, totalTTC } = calculateLineTotals(
      line.unitPrice,
      line.quantity,
      line.tvaRate,
      line.discount
    );

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
