"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type Ancestor = {
  id: string;
  name: string;
  coat: string | null;
  birthDate: Date | string | null;
  sire?: Ancestor;
  dam?: Ancestor;
} | null | undefined;

interface PedigreeTreeProps {
  tenantSlug: string;
  horseName: string;
  sire: Ancestor;
  dam: Ancestor;
}

/** Padres, abuelos y bisabuelos. */
const GENERATIONS = 3;
const cardWidth = ["w-52", "w-48", "w-44"] as const;

function AncestorCard({
  tenantSlug,
  ancestor,
  role,
  depth,
}: {
  tenantSlug: string;
  ancestor: Ancestor;
  role: "sire" | "dam";
  depth: number;
}) {
  const t = useTranslations("horseDetail.pedigree");
  const width = cardWidth[depth - 1];
  // Padre a la izquierda en azul, madre en ciruela: el mismo par de tonos
  // que el resto de estados, sin rosa y azul de manual.
  const accent = role === "sire" ? "border-l-state-covered" : "border-l-state-foaled";

  if (!ancestor) {
    return (
      <div
        className={cn(
          "flex h-12 items-center rounded-lg border border-dashed border-border px-3 text-caption text-muted-foreground",
          width,
        )}
      >
        {t("unknown")}
      </div>
    );
  }

  const year = ancestor.birthDate ? new Date(ancestor.birthDate).getFullYear() : null;
  const meta = [ancestor.coat, year].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/${tenantSlug}/caballos/${ancestor.id}`}
      className={cn(
        "group flex flex-col justify-center rounded-lg border border-l-[3px] border-border bg-card px-3 shadow-card transition-[border-color,box-shadow] hover:shadow-raised",
        accent,
        depth === 1 ? "min-h-16 py-2" : "min-h-12 py-1.5",
        width,
      )}
    >
      {depth === 1 && (
        <span className="text-micro font-semibold text-muted-foreground uppercase">
          {t(role)}
        </span>
      )}
      <span
        className={cn(
          "truncate font-semibold text-foreground group-hover:text-primary-ink",
          depth === 1 ? "font-serif text-heading font-medium" : "text-label",
        )}
      >
        {ancestor.name}
      </span>
      {meta && <span className="truncate text-caption text-muted-foreground">{meta}</span>}
    </Link>
  );
}

/** A pair of parents, joined to their child by a bracket. */
function Branch({
  tenantSlug,
  sire,
  dam,
  depth,
}: {
  tenantSlug: string;
  sire: Ancestor;
  dam: Ancestor;
  depth: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: depth * 0.08, duration: 0.25 }}
      className="flex flex-col"
    >
      {(["sire", "dam"] as const).map((role) => {
        const ancestor = role === "sire" ? sire : dam;
        return (
          <div key={role} className="relative flex items-center py-1.5 pl-6">
            {/* Media línea vertical hacia el centro del par y el trazo horizontal. */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 w-px bg-border",
                role === "sire" ? "top-1/2 bottom-0" : "top-0 bottom-1/2",
              )}
            />
            <span aria-hidden className="absolute top-1/2 left-0 h-px w-6 bg-border" />
            <AncestorCard tenantSlug={tenantSlug} ancestor={ancestor} role={role} depth={depth} />
            {depth < GENERATIONS && (
              <>
                <span aria-hidden className="h-px w-6 shrink-0 bg-border" />
                <Branch
                  tenantSlug={tenantSlug}
                  sire={ancestor?.sire}
                  dam={ancestor?.dam}
                  depth={depth + 1}
                />
              </>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}

/**
 * Three generations laid out like a stud-book certificate. The structure is
 * always complete (unknown ancestors keep their slot) so the brackets line up
 * whatever is missing.
 */
export function PedigreeTree({ tenantSlug, horseName, sire, dam }: PedigreeTreeProps) {
  const t = useTranslations("horseDetail.pedigree");
  const headers = [t("parents"), t("grandparents"), t("greatGrandparents")];

  return (
    <MotionConfig reducedMotion="user">
      <figure aria-label={t("label", { name: horseName })} className="overflow-x-auto pb-2">
        <div className="w-max min-w-full">
          <div aria-hidden className="mb-2 flex text-micro font-semibold text-muted-foreground uppercase">
            <span className="w-36 shrink-0" />
            {headers.map((header, index) => (
              <span key={header} className={cn("ml-12 shrink-0", cardWidth[index])}>
                {header}
              </span>
            ))}
          </div>
          <div className="flex items-center">
            <div className="flex w-36 shrink-0 items-center rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-card">
              <span className="truncate font-serif text-heading font-medium">{horseName}</span>
            </div>
            <span aria-hidden className="h-px w-6 shrink-0 bg-border" />
            <Branch tenantSlug={tenantSlug} sire={sire} dam={dam} depth={1} />
          </div>
        </div>
      </figure>
    </MotionConfig>
  );
}
