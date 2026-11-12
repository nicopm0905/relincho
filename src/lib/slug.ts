/**
 * Identificador de URL de un centro a partir de su nombre. Motor puro: lo usa
 * el formulario de alta.
 */
export const MAX_SLUG_LENGTH = 40;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * El identificador mientras se escribe el nombre: lo sigue letra a letra
 * mientras sea el generado (o esté vacío). Si el usuario lo ha cambiado a
 * mano, se respeta.
 */
export function slugFollowingName(o: { previousName: string; name: string; slug: string }): string {
  const untouched = o.slug === "" || o.slug === slugify(o.previousName);
  return untouched ? slugify(o.name) : o.slug;
}
