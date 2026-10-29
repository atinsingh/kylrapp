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
