/** Quita espacios y pasa a mayusculas: "es91 2100..." -> "ES912100...". */
export function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** "ES9121000418450200051332" -> "ES91 2100 0418 4502 0005 1332". */
export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * IBAN espanol (ES + 22 digitos) con su digito de control (mod 97). Solo se
 * admiten cuentas espanolas: es lo que emite una yeguada andaluza.
 */
export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^ES\d{22}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}
