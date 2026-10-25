/** Accepts 5'10", 5'10, 5 10, 5ft 10in, 5.10, 70, 70in, 178cm. Returns inches. */
export function heightInches(h?: string | null): number | null {
  if (!h) return null;
  const s = h.toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').trim();
  let m = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (m) return Number(m[1]) / 2.54;
  m = s.match(/^(\d)\s*(?:'|ft|feet|-|\s)\s*(\d{1,2}(?:\.\d+)?)?\s*(?:"|''|in|inches)?$/);
  if (m) return Number(m[1]) * 12 + Number(m[2] || 0);
  m = s.match(/^(\d)\.(\d{1,2})$/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  m = s.match(/^(\d{2}(?:\.\d+)?)\s*(?:"|in|inches)?$/);
  if (m && Number(m[1]) >= 40 && Number(m[1]) <= 96) return Number(m[1]);
  return null;
}

/** Accepts 180, 180 lbs, 82 kg. Returns pounds. */
export function weightPounds(w?: string | null): number | null {
  if (!w) return null;
  const m = w.toLowerCase().match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  const lb = /kg|kilo/.test(w.toLowerCase()) ? n * 2.20462 : n;
  return lb >= 50 && lb <= 900 ? lb : null;
}

export function bmi(h?: string | null, w?: string | null) {
  const inches = heightInches(h);
  const lb = weightPounds(w);
  if (!inches || !lb) return null;
  const v = (703 * lb) / (inches * inches);
  const label = v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy weight' : v < 30 ? 'Overweight'
    : v < 35 ? 'Obesity, class 1' : v < 40 ? 'Obesity, class 2' : 'Obesity, class 3';
  const tone = v < 18.5 ? 'amber' : v < 25 ? 'green' : v < 30 ? 'blue' : v < 35 ? 'amber' : 'red';
  return { value: Math.round(v * 10) / 10, label, tone, inches: Math.round(inches), lb: Math.round(lb) };
}
