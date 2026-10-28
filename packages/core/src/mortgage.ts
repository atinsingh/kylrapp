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
