/** Monthly payment on a Canadian mortgage (interest compounded semi-annually). */
export function monthlyPayment(loan: number, rate: number, years: number): number {
  const r = Math.pow(1 + rate / 2, 1 / 6) - 1, n = years * 12;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

/** CMHC default insurance premium; zero at 20 % down or for homes at $1.5M and above. */
export function cmhcPremium(price: number, downPct: number): number {
  if (downPct >= 0.2 || price >= 1_500_000) return 0;
  const rate = downPct >= 0.15 ? 0.028 : downPct >= 0.1 ? 0.031 : 0.04;
  return Math.round(price * (1 - downPct) * rate);
}

/** Minimum down payment for an insured or uninsured purchase. */
export function minimumDown(price: number): number {
  return price <= 500_000 ? price * 0.05 : price < 1_500_000 ? 25_000 + (price - 500_000) * 0.1 : price * 0.2;
}

export interface AffordInput { income: number; rate: number; down: number; tax: number; debts: number }

/** Maximum price under the stress test (GDS 39 % / TDS 44 %, qualifying rate max(rate + 2 %, 5.25 %)). */
export function affordability(o: AffordInput) {
  const q = Math.max(o.rate + 0.02, 0.0525), monthlyIncome = o.income / 12, heat = 100;
  const room = Math.min(monthlyIncome * 0.39 - o.tax - heat, monthlyIncome * 0.44 - o.tax - heat - o.debts);
  const r = Math.pow(1 + q / 2, 1 / 6) - 1, n = 25 * 12;
  const loan = (room * (1 - Math.pow(1 + r, -n))) / r;
  return { max: Math.round((loan + o.down) / 1000) * 1000, loan: Math.round(loan), qualifyingRate: q };
}

export interface AffordFromIncomeInput {
  /** Gross household income per year. */ income: number;
  /** Other monthly debt payments. */ debts: number;
  downPct: number;
  rate: number;
  /** Monthly property tax used in the test; $500 by default, as in App Core. */ monthlyTax?: number;
}

/**
 * "What you can afford": the stress-test limit from income, then capped by the down-payment rules
 * (5% only up to $500K, 10% on the part above, no insured mortgage at $1.5M and up).
 */
export function affordFromIncome(o: AffordFromIncomeInput) {
  const a = affordability({ income: o.income, rate: o.rate, down: 0, tax: o.monthlyTax ?? 500, debts: o.debts });
  const byIncome = Math.max(0, Math.round(a.loan / (1 - o.downPct) / 5000) * 5000);
  let byDown = Infinity;
  if (o.downPct < 0.1) byDown = Math.floor(25_000 / (0.1 - o.downPct) / 5000) * 5000;
  if (o.downPct < 0.2) byDown = Math.min(byDown, 1_495_000);
  const maxPrice = Math.min(byIncome, byDown);
  const down = Math.round(maxPrice * o.downPct), cmhc = cmhcPremium(maxPrice, o.downPct);
  return {
    maxPrice, down, minDown: Math.round(minimumDown(maxPrice)), cmhc, cmhcPst: Math.round(cmhc * 0.08),
    monthly: Math.round(monthlyPayment(maxPrice - down + cmhc, o.rate, 25)),
    qualifyingRate: a.qualifyingRate,
    /** True when the down payment, not income, sets the limit. */
    limitedByDown: byDown < byIncome,
  };
}

/**
 * What a mortgage costs over its term (5 years by default): interest paid plus fees. Lender quotes are
 * compared on this, never on the headline rate alone.
 */
export function termCost(loan: number, rate: number, o: { years?: number; termMonths?: number; fees?: number } = {}) {
  const years = o.years ?? 25, months = o.termMonths ?? 60, fees = o.fees ?? 0;
  const r = Math.pow(1 + rate / 2, 1 / 6) - 1, p = monthlyPayment(loan, rate, years);
  let balance = loan, interest = 0;
  for (let i = 0; i < months; i++) { const due = balance * r; interest += due; balance -= p - due; }
  return { monthly: Math.round(p), interest: Math.round(interest), fees, total: Math.round(interest + fees), balanceAfter: Math.round(balance) };
}
