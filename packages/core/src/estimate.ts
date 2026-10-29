import { HST } from './money.js';
import { landTransferTax, type LandTransferTax } from './tax.js';
import { cmhcPremium, minimumDown, monthlyPayment } from './mortgage.js';

export type PropertyType = 'House' | 'Townhouse' | 'Condo';

/** The listing fields the estimate needs. */
export interface ListingForEstimate {
  price: number;
  city: string;
  type: PropertyType;
  /** Buyer brokerage co-op commission, as a fraction of price. */
  coop: number;
  /** Annual property tax. */
  tax: number;
  /** Monthly condo fee. */
  fee?: number;
}

/**
 * Inputs a buyer can change on "How we estimate". Defaults are the published
 * assumptions and must carry the date they were last reviewed (Launch Checklist action 4).
 */
export interface BuyerAssumptions {
  price?: number;
  /** Percent of the buyer commission returned as cash back (60–80). */
  plan?: number;
  firstTime?: boolean;
  /** Lawyer's fee before HST and disbursements. */
  lawyer?: number;
  downPct?: number;
  rate?: number;
}

export const DEFAULT_ASSUMPTIONS = {
  asOf: '2026-10-27',
  plan: 60,
  lawyerFee: 1850,
  lawyerDisbursements: 450,
  inspection: 550,
  statusCertificate: 100,
  titleInsurance: 350,
  adjustmentsHouse: 1245,
  adjustmentsCondo: 820,
  downPct: 0.2,
  rate: 0.0449,
  amortizationYears: 25,
} as const;

export interface BuyerEstimate {
  price: number; plan: number; ltt: LandTransferTax;
  lawyer: number; inspection: number; statusCertificate: number; title: number; adjustments: number;
  commission: number; cashBack: number;
  down: number; downPct: number;
  /** True when the buyer's down payment was below the minimum for this price and was raised to it. */
  downRaised: boolean;
  cmhc: number; cmhcPst: number; loan: number; rate: number; monthly: number;
  monthlyTax: number; condoFee: number;
  /** Closing costs before cash back. */ costs: number;
  /** The hero number: closing costs minus cash back. */ allIn: number;
}

export function buyerEstimate(l: ListingForEstimate, o: BuyerAssumptions = {}): BuyerEstimate {
  const d = DEFAULT_ASSUMPTIONS;
  const price = o.price ?? l.price, plan = o.plan ?? d.plan, condo = l.type === 'Condo';
  const ltt = landTransferTax(price, l.city === 'Toronto', o.firstTime !== false);
  const lawyer = Math.round((o.lawyer ?? d.lawyerFee) * HST) + d.lawyerDisbursements;
  const inspection = condo ? 0 : d.inspection, statusCertificate = condo ? d.statusCertificate : 0;
  const title = d.titleInsurance, adjustments = condo ? d.adjustmentsCondo : d.adjustmentsHouse;
  const commission = price * l.coop, cashBack = Math.round((commission * plan) / 100);
  // A chosen down payment below the legal minimum for this price is raised to the minimum.
  const wanted = o.downPct ?? d.downPct, minPct = minimumDown(price) / price;
  const downPct = Math.max(wanted, minPct), down = Math.round(price * downPct);
  const cmhc = cmhcPremium(price, downPct), cmhcPst = Math.round(cmhc * 0.08);
  const loan = price - down + cmhc, rate = o.rate ?? d.rate;
  const costs = ltt.total + lawyer + inspection + statusCertificate + title + adjustments + cmhcPst;
  return {
    price, plan, ltt, lawyer, inspection, statusCertificate, title, adjustments, commission, cashBack,
    down, downPct, downRaised: downPct > wanted, cmhc, cmhcPst, loan, rate, monthly: monthlyPayment(loan, rate, d.amortizationYears),
    monthlyTax: Math.round(l.tax / 12), condoFee: l.fee ?? 0, costs, allIn: costs - cashBack,
  };
}

export interface SellerInput {
  price: number;
  plan: 'flat' | 'percent';
  /** Co-op offered to the buyer brokerage, as a fraction of price. */
  coop: number;
  mortgageBalance: number;
  penalty?: number;
}

export const SELLER_FLAT_FEE = 999;
export const SELLER_PERCENT_FEE = 0.01;

export function sellerNet(o: SellerInput) {
  const fee = o.plan === 'flat' ? Math.round(SELLER_FLAT_FEE * HST) : Math.round(o.price * SELLER_PERCENT_FEE * HST);
  const coop = Math.round(o.price * o.coop * HST), lawyer = Math.round(1200 * HST) + 300, penalty = o.penalty ?? 0;
  return {
    price: o.price, fee, coop, lawyer, mortgage: o.mortgageBalance, penalty,
    net: o.price - fee - coop - lawyer - o.mortgageBalance - penalty,
    /** Saving against a traditional 2.5 % listing side. */
    vsTraditional: Math.round(o.price * 0.025 * HST) - fee,
  };
}

// ── Leasing ────────────────────────────────────────────────────────────────

/** Klyr's landlord fee before HST. A placeholder until pricing is decided. */
export const LANDLORD_FEE = 699;
/** Shares of one month's rent a landlord can offer the tenant's brokerage. */
export const TENANT_SIDE_CHOICES = [0, 0.5, 1] as const;
/** Ontario's rent increase guideline for rent-controlled units (Residential Tenancies Act s. 120), by calendar year. */
export const RENT_GUIDELINES: Record<number, number> = { 2023: 2.5, 2024: 2.5, 2025: 2.5, 2026: 2.1 };
export const RENT_GUIDELINE = { year: 2026, pct: 2.1 } as const;
/** The guideline for a year; years not yet announced use the latest known one. */
export const guidelineFor = (year: number) => RENT_GUIDELINES[year] ?? RENT_GUIDELINES[Math.max(...Object.keys(RENT_GUIDELINES).map(Number).filter(y => y <= year))] ?? RENT_GUIDELINE.pct;

/**
 * Interest on the last month's rent deposit (RTA s. 106): due every year on the lease anniversary, at the guideline in
 * effect that day. Lists each anniversary from the start up to the one after `today`.
 */
export function lmrInterestSchedule(deposit: number, startDate: string, today: string) {
  const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
  const out: { dueDate: string; pct: number; amount: number }[] = [];
  for (let k = 1; k <= 50; k++) {
    const due = new Date(Date.UTC(y + k, m - 1, d)).toISOString().slice(0, 10), pct = guidelineFor(y + k);
    out.push({ dueDate: due, pct, amount: Math.round((deposit * pct) / 100 * 100) / 100 });
    if (due > today) break;
  }
  return out;
}
/** Units first occupied as a residence after this date are exempt from the guideline (RTA s. 6.1). */
export const RENT_CONTROL_CUTOFF = '2018-11-15';

/** Rent control from the first-occupied date: before the cutoff, increases are capped at the guideline. */
export const rentControlled = (firstOccupied: string) => firstOccupied <= RENT_CONTROL_CUTOFF;

/** What a tenant pays to move in: first month, plus the last month's rent deposit (the only deposit Ontario allows). */
export const moveInCost = (rent: number) => ({ firstMonth: rent, lastMonth: rent, total: rent * 2 });

/** The landlord's first-year rent after Klyr's fee and the tenant-side fee they chose, both with HST. */
export function landlordNet(o: { rent: number; tenantSidePct: number; months?: number }) {
  const months = o.months ?? 12;
  const fee = Math.round(LANDLORD_FEE * HST), tenantSide = Math.round((o.rent * o.tenantSidePct * Math.round(HST * 100)) / 100);
  return { gross: o.rent * months, fee, tenantSide, net: o.rent * months - fee - tenantSide, months };
}
