/** Card network from the number's prefix — works offline. */
export function brandFromBin(bin: string) {
  const n2 = Number(bin.slice(0, 2)), n3 = Number(bin.slice(0, 3)), n4 = Number(bin.slice(0, 4)), n6 = Number(bin.slice(0, 6));
  if (bin.startsWith('4')) return 'Visa';
  if ((n2 >= 51 && n2 <= 55) || (n4 >= 2221 && n4 <= 2720)) return 'Mastercard';
  if (n2 === 34 || n2 === 37) return 'American Express';
  if (n4 === 6011 || n2 === 65 || (n3 >= 644 && n3 <= 649) || (n6 >= 622126 && n6 <= 622925)) return 'Discover';
  if (n4 >= 3528 && n4 <= 3589) return 'JCB';
  if (n2 === 36 || n2 === 38 || (n3 >= 300 && n3 <= 305)) return 'Diners Club';
  return undefined;
}


export function luhn(num: string) {
  const d = num.replace(/\D/g, '');
  if (d.length < 13) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}
