/** Decimal input avoids binary floating-point multiplication in import tooling. */
export function lakhToRupees(value: string): number {
  if (!/^\d+(?:\.\d{1,5})?$/.test(value)) throw new Error('Invalid lakh amount');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 100000n + BigInt(fraction.padEnd(5, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large');
  return Number(amount);
}
