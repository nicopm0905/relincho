/**
 * Validacion de identificadores fiscales espanoles: NIF de persona fisica
 * (DNI), NIE y CIF de sociedad. Un NIF mal escrito acaba en una factura que la
 * gestoria tiene que rehacer, asi que se comprueba la letra o digito de control,
 * no solo el formato.
 */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Quita espacios, guiones y puntos, y pasa a mayusculas. */
export function normalizeNif(value: string) {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

function isValidDni(value: string) {
  const match = /^(\d{8})([A-Z])$/.exec(value);
  if (!match) return false;
  return DNI_LETTERS[Number(match[1]) % 23] === match[2];
}

function isValidNie(value: string) {
  const match = /^([XYZ])(\d{7})([A-Z])$/.exec(value);
  if (!match) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[match[1] as "X" | "Y" | "Z"];
  return DNI_LETTERS[Number(prefix + match[2]) % 23] === match[3];
}

function isValidCif(value: string) {
  const match = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(value);
  if (!match) return false;
  const [, letter, digits, control] = match;

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    let n = Number(digits[i]);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const digit = (10 - (sum % 10)) % 10;
  const letterControl = "JABCDEFGHI"[digit];

  // Segun el tipo de entidad el control es letra, digito o cualquiera de los dos.
  if ("PQRSNW".includes(letter)) return control === letterControl;
  if ("ABEH".includes(letter)) return control === String(digit);
  return control === String(digit) || control === letterControl;
}

export function isValidNif(value: string) {
  const nif = normalizeNif(value);
  return isValidDni(nif) || isValidNie(nif) || isValidCif(nif);
}
