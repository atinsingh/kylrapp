type Brackets = ReadonlyArray<readonly [cap: number, rate: number]>;

const ONTARIO: Brackets = [[55_000, 0.005], [250_000, 0.01], [400_000, 0.015], [2_000_000, 0.02], [Infinity, 0.025]];
const TORONTO: Brackets = [[55_000, 0.005], [250_000, 0.01], [400_000, 0.015], [2_000_000, 0.02], [3_000_000, 0.025], [4_000_000, 0.035], [Infinity, 0.045]];

const ONTARIO_FIRST_TIME_REBATE = 4_000;
const TORONTO_FIRST_TIME_REBATE = 4_475;

function brackets(price: number, b: Brackets): number {
  let prev = 0, total = 0;
  for (const [cap, rate] of b) {
    if (price > prev) total += (Math.min(price, cap) - prev) * rate;
    prev = cap;
  }
  return Math.round(total);
}

export interface LandTransferTax {
  /** Ontario LTT before rebate. */ on: number;
  /** Ontario first-time buyer rebate. */ onR: number;
  /** Toronto municipal LTT before rebate. */ to: number;
  /** Toronto first-time buyer rebate. */ toR: number;
  total: number;
}

export function landTransferTax(price: number, toronto: boolean, firstTime: boolean): LandTransferTax {
  const on = brackets(price, ONTARIO), onR = firstTime ? Math.min(ONTARIO_FIRST_TIME_REBATE, on) : 0;
  const to = toronto ? brackets(price, TORONTO) : 0, toR = toronto && firstTime ? Math.min(TORONTO_FIRST_TIME_REBATE, to) : 0;
  return { on, onR, to, toR, total: on - onR + to - toR };
}
