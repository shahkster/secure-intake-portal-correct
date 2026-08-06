export const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export function cleanName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : "";
}

export function validDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1900 && date.getTime() <= Date.now();
}

export function validRouting(value) {
  const routing = digitsOnly(value);
  if (routing.length !== 9) return false;
  const d = routing.split("").map(Number);
  const checksum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return checksum % 10 === 0;
}
