/**
 * Unified billboard pricing logic — Single Source of Truth
 * Used by both the UI cards (SelectedBillboardsCard) and the save path (ContractEdit).
 */

export interface BillboardPricingInput {
  billboardId: string;
  baseRentalPrice: number;       // from calculateBillboardPrice()
  installationPrice: number;     // from installationDetails
  printCost: number;             // from printCostDetails
  isSingleFace: boolean;
}

export interface BillboardPricingOptions {
  totalDiscount: number;
  printCostEnabled: boolean;
  includePrintInPrice: boolean;
  installationEnabled: boolean;
  includeInstallationInPrice: boolean;
}

export interface BillboardPricingResult {
  billboardId: string;
  baseRentalPrice: number;
  installationPrice: number;       // adjusted for single face
  printCost: number;               // adjusted for single face
  includedPrintCost: number;
  includedInstallCost: number;
  netRentalBeforeDiscount: number;
  rawDiscountPerBillboard: number;
  discountPerBillboard: number;
  netRentalAfterDiscount: number;
  extraPrintCost: number;
  extraInstallCost: number;
  totalForBoard: number;           // final price shown on card
}

/**
 * Smart rounding to "clean" numbers — matches the card display logic exactly.
 * New logic: >5000 → nearest 500, >1000 → nearest 100, >100 → nearest 50, else → nearest 10
 */
export function roundToClean(value: number): number {
  if (value <= 0) return 0;
  if (value > 5000) return Math.round(value / 500) * 500;
  if (value > 1000) return Math.round(value / 100) * 100;
  if (value > 100) return Math.round(value / 50) * 50;
  return Math.round(value / 10) * 10;
}

/**
 * Calculate pricing for all billboards at once, with proper discount distribution
 * and rounding that matches the UI cards exactly.
 */
export function calculateAllBillboardPrices(
  inputs: BillboardPricingInput[],
  options: BillboardPricingOptions
): BillboardPricingResult[] {
  const { totalDiscount, printCostEnabled, includePrintInPrice, installationEnabled, includeInstallationInPrice } = options;

  // Step 1: Adjust for single face and compute net rental before discount
  const intermediate = inputs.map(inp => {
    const installPrice = inp.isSingleFace ? Math.round(inp.installationPrice / 2) : inp.installationPrice;
    const printPrice = inp.isSingleFace ? Math.round(inp.printCost / 2) : inp.printCost;

    const includedPrint = (printCostEnabled && includePrintInPrice) ? printPrice : 0;
    const includedInstall = (installationEnabled && includeInstallationInPrice) ? installPrice : 0;
    const netRentalBeforeDiscount = inp.baseRentalPrice - includedPrint - includedInstall;

    const extraPrint = (printCostEnabled && !includePrintInPrice) ? printPrice : 0;
    const extraInstall = (installationEnabled && !includeInstallationInPrice) ? installPrice : 0;

    return {
      billboardId: inp.billboardId,
      baseRentalPrice: inp.baseRentalPrice,
      installationPrice: installPrice,
      printCost: printPrice,
      includedPrintCost: includedPrint,
      includedInstallCost: includedInstall,
      netRentalBeforeDiscount,
      extraPrintCost: extraPrint,
      extraInstallCost: extraInstall,
    };
  });

  // Step 2: Total net rental for proportional discount distribution
  const totalNetRental = intermediate.reduce((s, i) => s + i.netRentalBeforeDiscount, 0);

  // Step 3: Try rounding each billboard total to clean numbers
  const prelimResults = intermediate.map(item => {
    const proportion = totalNetRental > 0 ? item.netRentalBeforeDiscount / totalNetRental : 0;
    const rawDiscount = totalDiscount * proportion;
    const rawNetAfterDiscount = Math.max(0, item.netRentalBeforeDiscount - rawDiscount);
    const rawTotal = rawNetAfterDiscount + item.includedInstallCost + item.includedPrintCost + item.extraInstallCost + item.extraPrintCost;
    const roundedTotal = totalDiscount > 0 ? roundToClean(rawTotal) : rawTotal;

    return { ...item, rawDiscount, rawTotal, roundedTotal };
  });

  // Step 4: Try clean-number mode against the exact contract total first
  const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const totalExtras = intermediate.reduce(
    (s, i) => s + i.includedInstallCost + i.includedPrintCost + i.extraInstallCost + i.extraPrintCost,
    0
  );
  const expectedContractTotal = roundMoney(Math.max(0, totalNetRental - totalDiscount) + totalExtras);

  const sumOfRounded = prelimResults.reduce((s, r) => s + r.roundedTotal, 0);
  const gap = roundMoney(sumOfRounded - expectedContractTotal);

  let useRounded = totalDiscount > 0;

  if (gap !== 0 && totalDiscount > 0) {
    // Group boards by their roundedTotal so identical boards stay uniform
    const groupMap = new Map<number, number[]>();
    prelimResults.forEach((r, i) => {
      const key = r.roundedTotal;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(i);
    });

    const groupEntries = Array.from(groupMap.entries()); // [roundedTotal, indices[]]

    // For each group, generate clean candidates (current ± 1-2 clean steps)
    const getCleanStep = (val: number): number => {
      if (val > 5000) return 500;
      if (val > 1000) return 100;
      if (val > 100) return 50;
      return 10;
    };

    const groupCandidates: { value: number; count: number }[][] = groupEntries.map(([total, indices]) => {
      const step = getCleanStep(total);
      const candidates = new Set<number>();
      candidates.add(total);
      for (let d = 1; d <= 2; d++) {
        const up = roundToClean(total + step * d);
        const down = roundToClean(total - step * d);
        if (up > 0) candidates.add(up);
        if (down > 0) candidates.add(down);
      }
      return Array.from(candidates).map(v => ({ value: v, count: indices.length }));
    });

    // Brute-force search for combination with smallest gap
    let bestCombo: number[] | null = null;
    let bestGap = Infinity;

    const search = (gi: number, currentSum: number, chosen: number[]) => {
      if (bestGap === 0) return; // found perfect match
      if (gi === groupCandidates.length) {
        const g = Math.abs(roundMoney(currentSum - expectedContractTotal));
        if (g < bestGap) {
          bestGap = g;
          bestCombo = [...chosen];
        }
        return;
      }
      for (const cand of groupCandidates[gi]) {
        search(gi + 1, currentSum + cand.value * cand.count, [...chosen, cand.value]);
      }
    };

    search(0, 0, []);

    if (bestCombo && bestGap < 0.5) {
      // Apply the best combination back to prelimResults
      groupEntries.forEach(([, indices], gi) => {
        const newVal = bestCombo![gi];
        for (const idx of indices) {
          prelimResults[idx].roundedTotal = newVal;
        }
      });
    } else {
      useRounded = false;
    }
  }

  // Step 5: Build final results
  const results: BillboardPricingResult[] = prelimResults.map(item => {
    const useTotal = useRounded ? item.roundedTotal : item.rawTotal;
    const adjustedDiscount = totalDiscount > 0
      ? item.rawDiscount + (item.rawTotal - useTotal)
      : 0;
    const netAfterDiscount = Math.max(0, item.netRentalBeforeDiscount - adjustedDiscount);
    const finalTotal = netAfterDiscount + item.includedInstallCost + item.includedPrintCost + item.extraInstallCost + item.extraPrintCost;

    return {
      billboardId: item.billboardId,
      baseRentalPrice: item.baseRentalPrice,
      installationPrice: item.installationPrice,
      printCost: item.printCost,
      includedPrintCost: item.includedPrintCost,
      includedInstallCost: item.includedInstallCost,
      netRentalBeforeDiscount: item.netRentalBeforeDiscount,
      rawDiscountPerBillboard: item.rawDiscount,
      discountPerBillboard: adjustedDiscount,
      netRentalAfterDiscount: netAfterDiscount,
      extraPrintCost: item.extraPrintCost,
      extraInstallCost: item.extraInstallCost,
      totalForBoard: finalTotal,
    };
  });

  return results;
}
