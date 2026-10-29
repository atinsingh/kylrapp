import { describe, expect, it } from 'vitest';
import { affordFromIncome, buyerEstimate, cmhcPremium, landlordNet, landTransferTax, minimumDown, money, moneyShort, moveInCost, rentControlled, sellerNet, termCost } from './index.js';

// Reference values computed with design/prototype/klyr-app.js, the source this engine was ported from.
const maple = { price: 1_150_000, city: 'Mississauga', type: 'House', coop: 0.022, tax: 6960 } as const;
const queens = { price: 689_000, city: 'Toronto', type: 'Condo', coop: 0.025, tax: 2840, fee: 712 } as const;

describe('land transfer tax', () => {
  it('applies Ontario brackets and the first-time rebate', () => {
    expect(landTransferTax(1_150_000, false, true)).toEqual({ on: 19_475, onR: 4000, to: 0, toR: 0, total: 15_475 });
  });
  it('doubles up in Toronto', () => {
    const t = landTransferTax(689_000, true, false);
    expect(t.on).toBe(10_255);
    expect(t.to).toBe(10_255);
    expect(t.total).toBe(20_510);
  });
});

describe('mortgage rules', () => {
  it('waives CMHC at 20 % down', () => expect(cmhcPremium(800_000, 0.2)).toBe(0));
  it('charges 4 % under 10 % down', () => expect(cmhcPremium(500_000, 0.05)).toBe(19_000));
  it('uses the tiered minimum down payment', () => expect(minimumDown(800_000)).toBe(55_000));
});

describe('buyer all-in', () => {
  it('matches the prototype for 41 Maple Cres', () => {
    const e = buyerEstimate(maple);
    expect(e.lawyer).toBe(2541);
    expect(e.cashBack).toBe(15_180);
    expect(e.costs).toBe(15_475 + 2541 + 550 + 350 + 1245);
    expect(e.allIn).toBe(e.costs - 15_180);
  });
  it('treats condos differently (status certificate, no inspection)', () => {
    const e = buyerEstimate(queens);
    expect(e.inspection).toBe(0);
    expect(e.statusCertificate).toBe(100);
    expect(e.condoFee).toBe(712);
  });
  it('raises a down payment below the legal minimum', () => {
    const e = buyerEstimate(maple, { downPct: 0.05 }); // $1.15M needs $25k + 10% over $500k
    expect(e.down).toBe(90_000);
    expect(e.downRaised).toBe(true);
    expect(e.cmhc).toBeGreaterThan(0);
    expect(buyerEstimate({ ...maple, price: 1_600_000 }, { downPct: 0.1 }).downPct).toBe(0.2);
    expect(buyerEstimate(maple, { downPct: 0.2 }).downRaised).toBe(false);
  });
  it('responds to assumption changes', () => {
    expect(buyerEstimate(maple, { plan: 80 }).allIn).toBeLessThan(buyerEstimate(maple).allIn);
  });
});

describe('what you can afford', () => {
  it('matches the prototype at 20% down', () => {
    expect(affordFromIncome({ income: 150_000, debts: 450, downPct: 0.2, rate: 0.0449 }).maxPrice).toBe(800_000);
  });
  it('caps by the down payment rules', () => {
    const five = affordFromIncome({ income: 300_000, debts: 450, downPct: 0.05, rate: 0.0449 });
    expect(five.maxPrice).toBe(500_000);
    expect(five.limitedByDown).toBe(true);
    expect(affordFromIncome({ income: 600_000, debts: 0, downPct: 0.15, rate: 0.0449 }).maxPrice).toBe(1_495_000);
    expect(affordFromIncome({ income: 600_000, debts: 0, downPct: 0.25, rate: 0.0449 }).limitedByDown).toBe(false);
  });
});

describe('seller net', () => {
  it('nets out fee, co-op, lawyer and mortgage', () => {
    const s = sellerNet({ price: 1_000_000, plan: 'flat', coop: 0.025, mortgageBalance: 512_750 });
    expect(s.fee).toBe(1129);
    expect(s.net).toBe(1_000_000 - 1129 - 28_250 - 1656 - 512_750);
  });
});

describe('formatting', () => {
  it('formats money', () => {
    expect(money(-4000)).toBe('−$4,000');
    expect(moneyShort(1_150_000)).toBe('$1.15M');
    expect(moneyShort(689_000)).toBe('$689K');
  });
});

describe('leasing', () => {
  it('nets the first year after fees', () => {
    expect(landlordNet({ rent: 3100, tenantSidePct: 0.5 })).toEqual({ gross: 37_200, fee: 790, tenantSide: 1752, net: 37_200 - 790 - 1752, months: 12 });
    expect(moveInCost(3100).total).toBe(6200);
  });
  it('knows rent control from the first-occupied date', () => {
    expect(rentControlled('2015-06-01')).toBe(true);
    expect(rentControlled('2019-03-01')).toBe(false);
  });
});

describe('lender quotes', () => {
  it('compares on 5-year cost, fees included', () => {
    const a = termCost(800_000, 0.0429), b = termCost(800_000, 0.0419, { fees: 2500 });
    expect(a.monthly).toBe(4335);
    expect(b.total - a.total).toBeLessThan(0);
    expect(b.total).toBe(b.interest + 2500);
    expect(a.balanceAfter).toBeLessThan(800_000);
  });
});
