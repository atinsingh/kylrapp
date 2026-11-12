/** Formats whole dollars the way the app shows them: "$1,150,000", "−$4,000". */
export const money = (n: number): string =>
  (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-CA');

/** Dollars and cents, for small exact amounts like deposit interest: "$65.10". */
export const moneyCents = (n: number): string =>
  (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Short form for pins and chips: "$1.15M", "$689K". */
export const moneyShort = (n: number): string =>
  n >= 1e6
    ? '$' + (n / 1e6).toFixed(n % 1e6 ? 2 : 1).replace(/\.?0+$/, '') + 'M'
    : '$' + Math.round(n / 1000) + 'K';

export const HST = 1.13;
