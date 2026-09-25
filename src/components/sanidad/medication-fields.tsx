"use client";

import { useId, useState } from "react";
import { CaretDown, Info } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Datos del medicamento para el libro de tratamientos (RD 666/2023, art. 41).
 * Solo se enseñan en vacunas, desparasitaciones y tratamientos. Todos son
 * opcionales para no frenar al mozo: el libro avisa luego de lo que falte.
 */
export interface MedicationValues {
  dose: string;
  durationDays: string;
  withdrawalDays: string;
  prescriptionNumber: string;
  vetContactId: string;
  supplier: string;
  purchaseReference: string;
  batchNumber: string;
}

export const emptyMedication: MedicationValues = {
  dose: "",
  durationDays: "",
  withdrawalDays: "",
  prescriptionNumber: "",
  vetContactId: "",
  supplier: "",
  purchaseReference: "",
  batchNumber: "",
};

type Stored = {
  dose?: string | null;
  durationDays?: number | null;
  withdrawalDays?: number | null;
  prescriptionNumber?: string | null;
  vetContactId?: string | null;
  supplier?: string | null;
  purchaseReference?: string | null;
  batchNumber?: string | null;
};

export function medicationFromRecord(record: Stored): MedicationValues {
  return {
    dose: record.dose ?? "",
    durationDays: record.durationDays == null ? "" : String(record.durationDays),
    withdrawalDays: record.withdrawalDays == null ? "" : String(record.withdrawalDays),
    prescriptionNumber: record.prescriptionNumber ?? "",
    vetContactId: record.vetContactId ?? "",
    supplier: record.supplier ?? "",
    purchaseReference: record.purchaseReference ?? "",
    batchNumber: record.batchNumber ?? "",
  };
}

function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Lo que se manda al servidor. Vacío = `null`, para que al editar se pueda
 * borrar un dato. Si el tipo no es un medicamento no se manda nada.
 */
export function medicationPayload(values: MedicationValues) {
  const text = (value: string) => (value.trim() ? value.trim() : null);
  return {
    dose: text(values.dose),
    durationDays: toInt(values.durationDays),
    withdrawalDays: toInt(values.withdrawalDays),
    prescriptionNumber: text(values.prescriptionNumber),
    vetContactId: values.vetContactId || null,
    supplier: text(values.supplier),
    purchaseReference: text(values.purchaseReference),
    batchNumber: text(values.batchNumber),
  };
}

interface MedicationFieldsProps {
  values: MedicationValues;
  onChange: (next: MedicationValues) => void;
  /** El tipo elegido; las vacunas piden lote de forma destacada. */
  type: string;
  /** Todos los caballos elegidos están excluidos de consumo humano. */
  foodChainExcluded?: boolean;
}

export function MedicationFields({
  values,
  onChange,
  type,
  foodChainExcluded = false,
}: MedicationFieldsProps) {
  const id = useId();
  const hasPurchaseData = Boolean(values.supplier || values.purchaseReference);
  const [showPurchase, setShowPurchase] = useState(hasPurchaseData);

  // El veterinario externo no puede leer la agenda: sin lista, el campo no sale.
  const { data: vets } = trpc.contacts.list.useQuery(
    { kinds: ["VET"] },
    { retry: false },
  );
  const { data: suppliers } = trpc.contacts.list.useQuery(
    { kinds: ["SUPPLIER"] },
    { retry: false, enabled: showPurchase },
  );

  const set = (field: keyof MedicationValues, value: string) =>
    onChange({ ...values, [field]: value });

  const labelClass = "text-muted-foreground text-xs font-semibold tracking-wider uppercase";
  const withPrescription = values.prescriptionNumber.trim() !== "";

  return (
    <fieldset className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        Libro de tratamientos
      </legend>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-dose`} className={labelClass}>
            Cantidad
          </Label>
          <Input
            id={`${id}-dose`}
            value={values.dose}
            onChange={(e) => set("dose", e.target.value)}
            placeholder="Ej: 10 ml, 1 jeringa"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-duration`} className={labelClass}>
            Duración (días)
          </Label>
          <Input
            id={`${id}-duration`}
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={values.durationDays}
            onChange={(e) => set("durationDays", e.target.value)}
            placeholder="1"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-withdrawal`} className={labelClass}>
            Tiempo de espera (días)
          </Label>
          <Input
            id={`${id}-withdrawal`}
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            value={values.withdrawalDays}
            onChange={(e) => set("withdrawalDays", e.target.value)}
            placeholder={foodChainExcluded ? "No aplica" : "Ver prospecto"}
            aria-describedby={`${id}-withdrawal-help`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-prescription`} className={labelClass}>
            Nº de receta
          </Label>
          <Input
            id={`${id}-prescription`}
            value={values.prescriptionNumber}
            onChange={(e) => set("prescriptionNumber", e.target.value)}
            placeholder="Si la hay"
          />
        </div>
      </div>

      <p id={`${id}-withdrawal-help`} className="flex gap-2 text-xs text-muted-foreground">
        <Info weight="bold" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {foodChainExcluded
            ? "El caballo está excluido de consumo humano en el pasaporte: el tiempo de espera no le aplica, pero se puede anotar igualmente."
            : "El tiempo de espera viene en el prospecto (carne). Si es 0, escribe 0. "}
          {withPrescription && " Con nº de receta, el resto de datos ya consta en ella: guarda la copia."}
        </span>
      </p>

      {vets && vets.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-vet`} className={labelClass}>
            Veterinario que lo receta
          </Label>
          <select
            id={`${id}-vet`}
            value={values.vetContactId}
            onChange={(e) => set("vetContactId", e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          >
            <option value="">Sin indicar</option>
            {vets.map((vet) => (
              <option key={vet.id} value={vet.id}>
                {vet.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {type === "VACCINE" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-batch`} className={labelClass}>
            Lote de la vacuna
          </Label>
          <Input
            id={`${id}-batch`}
            value={values.batchNumber}
            onChange={(e) => set("batchNumber", e.target.value)}
            placeholder="Como figura en la etiqueta"
          />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowPurchase((v) => !v)}
          aria-expanded={showPurchase}
          className="flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline"
        >
          <CaretDown
            weight="bold"
            className={cn("h-3.5 w-3.5 transition-transform", showPurchase && "rotate-180")}
          />
          Datos de la compra
          {!showPurchase && !hasPurchaseData && !withPrescription && (
            <span className="font-normal text-muted-foreground"> · proveedor y factura</span>
          )}
        </button>

        {showPurchase && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor={`${id}-supplier`} className={labelClass}>
                Proveedor
              </Label>
              <Input
                id={`${id}-supplier`}
                list={`${id}-suppliers`}
                value={values.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="Nombre y dirección de la farmacia o distribuidor"
              />
              <datalist id={`${id}-suppliers`}>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.address ? `${s.name}, ${s.address}` : s.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-purchase`} className={labelClass}>
                Factura o albarán
              </Label>
              <Input
                id={`${id}-purchase`}
                value={values.purchaseReference}
                onChange={(e) => set("purchaseReference", e.target.value)}
                placeholder="Nº"
              />
            </div>
            {type !== "VACCINE" && (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-batch2`} className={labelClass}>
                  Lote
                </Label>
                <Input
                  id={`${id}-batch2`}
                  value={values.batchNumber}
                  onChange={(e) => set("batchNumber", e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </fieldset>
  );
}
