import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Aviso de que la yeguada que se esta viendo es de demostracion y no se puede
 * editar. Va dentro del panel porque es donde el visitante intenta tocar algo.
 */
export function DemoBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Eye className="mt-px h-4 w-4 shrink-0 text-primary-ink" />
        <p className="text-[13px] leading-relaxed text-foreground">
          <span className="font-semibold">Estás en la demo.</span> Puedes mirar
          todo lo que quieras; es de solo lectura. Cuando la tuya esté lista,
          creas tu cuenta y tus datos son tuyos.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/login">Crear cuenta gratis</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/demo">Ver la demo guiada</Link>
        </Button>
      </div>
    </div>
  );
}
