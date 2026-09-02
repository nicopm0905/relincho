import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
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
  return (
    <Link href={`/${tenantSlug}/caballos/${horse.id}`} className="group block h-full">
      <Card className="transition-all duration-300 hover:shadow-bento hover:scale-[1.02] hover:-translate-y-1 h-full bg-white border border-border/40">
        {/* Horse Photo / Placeholder */}
        <div className="aspect-[16/10] bg-gray-50 relative rounded-t-3xl overflow-hidden border-b border-border/30">
          {horse.photoUrl ? (
            <Image
              src={horse.photoUrl}
              alt={horse.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
              <Horse weight="duotone" className="h-16 w-16 text-primary/20" />
            </div>
          )}
          {/* Status Badge overlaid */}
          <div className="absolute top-4 right-4">
            <Badge variant={statusBadgeVariant[horse.status] ?? "secondary"} className="shadow-sm backdrop-blur-md bg-white/90">
              {statusLabels[horse.status] ?? horse.status}
            </Badge>
          </div>
        </div>

        <CardContent className="pt-5 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[17px] tracking-tight text-foreground truncate pr-2">
              {horse.name}
            </h3>
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <CaretRight weight="bold" className="h-3.5 w-3.5 text-foreground" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-[8px] bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {sexLabels[horse.sex] ?? horse.sex}
            </span>
            {horse.breed && (
              <span className="inline-flex items-center rounded-[8px] bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {horse.breed}
              </span>
            )}
          </div>

          {horse.birthDate && (
            <p className="text-[13px] font-medium text-muted-foreground">
              Nacido el {formatDate(horse.birthDate)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
