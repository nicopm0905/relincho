import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  SOLD: "Vendido",
  DEAD: "Fallecido",
  RETIRED: "Retirado",
  IN_TRAINING: "En doma",
};

const sexLabels: Record<string, string> = {
  MALE: "Semental",
  FEMALE: "Yegua",
  GELDING: "Castrado",
};

const statusBadgeVariant: Record<
  string,
  "success" | "secondary" | "destructive" | "outline" | "info" | "warning"
> = {
  ACTIVE: "success",
  SOLD: "secondary",
  DEAD: "destructive",
  RETIRED: "outline",
  IN_TRAINING: "info",
};

function ageInYears(birthDate: Date) {
  const ms = Date.now() - new Date(birthDate).getTime();
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)));
}

interface HorseCardProps {
  horse: {
    id: string;
    name: string;
    sex: string;
    status: string;
    breed: string | null;
    coat: string | null;
    birthDate: Date | null;
    photoUrl: string | null;
    uelnCode: string | null;
    boxLocation?: string | null;
  };
  tenantSlug: string;
}

export function HorseCard({ horse, tenantSlug }: HorseCardProps) {
  const age = horse.birthDate ? ageInYears(horse.birthDate) : null;
  // "Activo" es lo normal: solo se marca lo que se sale de ahi.
  const showStatus = horse.status !== "ACTIVE";

  return (
    <Link
      href={`/${tenantSlug}/caballos/${horse.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-bento outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/15 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {horse.photoUrl ? (
          <Image
            src={horse.photoUrl}
            alt={horse.name}
            fill
            sizes="(min-width: 1280px) 18rem, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // Sin foto, el nombre hace de retrato: distingue mejor que un icono
          // repetido en toda la cuadricula.
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-primary/[0.07]"
          >
            <span className="text-5xl font-bold text-primary-ink/35 transition-colors group-hover:text-primary-ink/50">
              {horse.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {showStatus && (
          <Badge
            variant={statusBadgeVariant[horse.status] ?? "secondary"}
            className="absolute top-2.5 left-2.5 shadow-xs"
          >
            {statusLabels[horse.status] ?? horse.status}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3.5 py-3">
        <h3 className="truncate text-[15px] font-semibold text-foreground">
          {horse.name}
        </h3>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {[
            sexLabels[horse.sex] ?? horse.sex,
            age !== null ? `${age} ${age === 1 ? "año" : "años"}` : null,
            horse.coat,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {horse.boxLocation && (
          <p className="mt-auto truncate pt-1 text-[12px] font-medium text-foreground/70">
            {horse.boxLocation}
          </p>
        )}
      </div>
    </Link>
  );
}
