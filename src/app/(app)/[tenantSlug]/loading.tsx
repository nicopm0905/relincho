import { PageSkeleton } from "@/components/ui/page-skeleton";

/**
 * Red de seguridad para las rutas del panel sin `loading.tsx` propio (ajustes,
 * kiosko, entrenamiento, escaner, portal). Sin ella, el clic en el menu no
 * muestra nada hasta que el servidor termina y la app parece colgada.
 */
export default function Loading() {
  return <PageSkeleton rows={5} />;
}
