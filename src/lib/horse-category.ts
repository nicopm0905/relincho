/** Por debajo de esta edad un caballo cuenta como potro o potra. */
export const YOUNG_YEARS = 3;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export type HorseCategory = "mare" | "stallion" | "gelding" | "filly" | "colt";

export function ageInYears(birthDate: Date | string, now: Date = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(birthDate).getTime()) / YEAR_MS));
}

/**
 * Lo que el criador llama a cada animal: un macho de un año es un potro, no un
 * semental. Sin fecha de nacimiento manda el sexo.
 */
export function horseCategory(
  horse: { sex: string; birthDate: Date | string | null },
  now: Date = new Date(),
): HorseCategory {
  if (horse.sex === "GELDING") return "gelding";
  const young =
    horse.birthDate !== null &&
    now.getTime() - new Date(horse.birthDate).getTime() < YOUNG_YEARS * YEAR_MS;
  if (horse.sex === "FEMALE") return young ? "filly" : "mare";
  return young ? "colt" : "stallion";
}
