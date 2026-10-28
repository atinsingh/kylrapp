import { describe, expect, it } from 'vitest';
import { buyerEstimate, cmhcPremium, landTransferTax, minimumDown, money, moneyShort, sellerNet } from './index.js';

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
  it('responds to assumption changes', () => {
    expect(buyerEstimate(maple, { plan: 80 }).allIn).toBeLessThan(buyerEstimate(maple).allIn);
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
