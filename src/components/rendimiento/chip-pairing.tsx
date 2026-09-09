"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Cardholder, LinkBreak, SpinnerGap } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChipRow {
  id: string;
  chipId: string;
  kind: string;
  active: boolean;
}

/** Vincula el chip fisico del caballo con su ficha. */
export function ChipPairing({
  horseId,
  chips,
}: {
  horseId: string;
  chips: ChipRow[];
}) {
  const router = useRouter();
  const [chipId, setChipId] = useState("");
  const [kind, setKind] = useState("NFC");

  const pair = trpc.performance.pairChip.useMutation({
    onSuccess: () => {
      toast.success("Chip vinculado");
      setChipId("");
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo vincular el chip"),
  });

  const unpair = trpc.performance.unpairChip.useMutation({
    onSuccess: () => {
      toast.success("Chip desvinculado");
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo desvincular"),
  });

  const active = chips.filter((c) => c.active);

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <ul className="space-y-2">
          {active.map((chip) => (
            <li
              key={chip.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Cardholder
                  weight="duotone"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate font-mono text-[13px] font-medium text-foreground">
                  {chip.chipId}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {chip.kind}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Desvincular chip"
                disabled={unpair.isPending}
                onClick={() => unpair.mutate({ chipId: chip.chipId })}
              >
                <LinkBreak className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          El buscador ya encuentra a este caballo por el microchip de su ficha.
          Vincula un código aparte solo si usáis una numeración propia de la
          cuadra.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="chipId">Identificador del chip</Label>
          <Input
            id="chipId"
            value={chipId}
            onChange={(e) => setChipId(e.target.value)}
            placeholder="NFC-123456"
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-32">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v ?? "NFC")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NFC">NFC</SelectItem>
              <SelectItem value="RFID">RFID</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={!chipId.trim() || pair.isPending}
          onClick={() =>
            pair.mutate({
              horseId,
              chipId: chipId.trim(),
              kind: kind as "NFC" | "RFID",
            })
          }
        >
          {pair.isPending && <SpinnerGap className="animate-spin" />}
          Vincular
        </Button>
      </div>
    </div>
  );
}
