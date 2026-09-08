import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaretRight, Horse } from "@phosphor-icons/react/dist/ssr";

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
  };
  tenantSlug: string;
}

export function HorseCard({ horse, tenantSlug }: HorseCardProps) {
  const age = horse.birthDate ? ageInYears(horse.birthDate) : null;

  return (
    <Link
      href={`/${tenantSlug}/caballos/${horse.id}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-0 py-0 transition-colors duration-200 group-hover:border-foreground/20">
        {/* Photo / placeholder */}
        <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-muted">
          {horse.photoUrl ? (
            <Image
              src={horse.photoUrl}
              alt={horse.name}
              fill
              sizes="(min-width: 1280px) 18rem, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15">
              <Horse weight="duotone" className="h-16 w-16 text-primary/25" />
            </div>
          )}
          <div className="absolute top-2.5 right-2.5">
            <Badge
              variant={statusBadgeVariant[horse.status] ?? "secondary"}
              className="bg-card/95 shadow-xs backdrop-blur-md"
            >
              {statusLabels[horse.status] ?? horse.status}
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-2 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-foreground">
              {horse.name}
            </h3>
            <CaretRight
              weight="bold"
              className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            />
          </div>

          {/* One quiet metadata line instead of a stack of chips. */}
          <p className="truncate text-[12px] text-muted-foreground">
            {[
              sexLabels[horse.sex] ?? horse.sex,
              horse.breed,
              age !== null ? `${age} ${age === 1 ? "año" : "años"}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
