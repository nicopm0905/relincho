"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHECK_RESULTS, checkResultLabels, type CheckResult } from "@/lib/reproduction";

const METHODS = {
  NATURAL: "Monta natural",
  AI_FRESH: "IA fresca",
  AI_REFRIGERATED: "IA refrigerada",
  AI_FROZEN: "IA congelada",
  ET: "Transferencia embrionaria",
} as const;
type Method = keyof typeof METHODS;
const NONE = "__none__";

function toDateInput(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
const atNoon = (value: string) => new Date(`${value}T12:00:00`);
/** Cubriciones con hora: la ventana de inseminacion se cuenta en horas. */
function toDateTimeInput(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function errorMessage(err: { message: string; data?: { code?: string } | null }) {
  return err.data?.code === "FORBIDDEN"
    ? "No tienes permiso para cambiar esto"
    : err.message || "No se ha podido guardar";
}

/**
 * Esqueleto comun: icono de lapiz, formulario, y borrar con confirmacion en el
 * propio pie del dialogo.
 */
function EditShell({
  title,
  description,
  label,
  onSubmit,
  onDelete,
  deleteWarning,
  busy,
  open,
  setOpen,
  children,
}: {
  title: string;
  description?: string;
  label: string;
  onSubmit: () => void;
  onDelete: () => void;
  deleteWarning?: string;
  busy: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setConfirm(false);
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground" />}
      >
        <PencilSimple weight="bold" className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          {children}
          {confirm && deleteWarning && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {deleteWarning}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            {confirm ? (
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
                  Sí, eliminar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash weight="bold" />
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useDone(setOpen: (open: boolean) => void) {
  const router = useRouter();
  return (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
  };
}

export function EditCoveringDialog({
  covering,
}: {
  covering: { id: string; date: Date; method: string; stallionId: string | null };
}) {
  const [open, setOpen] = useState(false);
  const done = useDone(setOpen);
  const [date, setDate] = useState(toDateTimeInput(covering.date));
  const [method, setMethod] = useState<Method>(covering.method as Method);
  const [stallionId, setStallionId] = useState(covering.stallionId ?? NONE);

  // Solo al abrir: no carga la lista de caballos por cada cubricion pintada.
  const { data: horses } = trpc.horses.list.useQuery(undefined, { enabled: open });
  const stallions = (horses ?? []).filter((h) => h.sex === "MALE");

  const update = trpc.reproduction.updateCovering.useMutation({
    onSuccess: () => done("Cubrición actualizada"),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = trpc.reproduction.deleteCovering.useMutation({
    onSuccess: () => done("Cubrición eliminada"),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <EditShell
      title="Editar cubrición"
      label="Editar cubrición"
      open={open}
      setOpen={setOpen}
      busy={update.isPending || remove.isPending}
      deleteWarning="Se borrarán también sus ecografías y su parto."
      onDelete={() => remove.mutate({ id: covering.id })}
      onSubmit={() =>
        update.mutate({
          id: covering.id,
          date: new Date(date),
          method,
          stallionId: stallionId === NONE ? undefined : stallionId,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cov-date-${covering.id}`}>Fecha y hora</Label>
          <Input id={`cov-date-${covering.id}`} type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cov-method-${covering.id}`}>Método</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
            <SelectTrigger id={`cov-method-${covering.id}`}>
              <SelectValue>{(v: string) => METHODS[v as Method] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METHODS) as Method[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {METHODS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cov-stallion-${covering.id}`}>Semental</Label>
        <Select value={stallionId} onValueChange={(v) => setStallionId(v as string)}>
          <SelectTrigger id={`cov-stallion-${covering.id}`}>
            <SelectValue>
              {(v: string) =>
                v === NONE ? "Sin indicar" : (stallions.find((h) => h.id === v)?.name ?? "Cargando…")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin indicar</SelectItem>
            {stallions.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditShell>
  );
}

export function EditPregnancyCheckDialog({
  check,
}: {
  check: { id: string; date: Date; result: string; dayOfPregnancy: number | null };
}) {
  const [open, setOpen] = useState(false);
  const done = useDone(setOpen);
  const [date, setDate] = useState(toDateInput(check.date));
  const [result, setResult] = useState<CheckResult>(
    (CHECK_RESULTS as readonly string[]).includes(check.result) ? (check.result as CheckResult) : "POSITIVE",
  );
  const [day, setDay] = useState(check.dayOfPregnancy?.toString() ?? "");

  const update = trpc.reproduction.updatePregnancyCheck.useMutation({
    onSuccess: () => done("Ecografía actualizada"),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = trpc.reproduction.deletePregnancyCheck.useMutation({
    onSuccess: () => done("Ecografía eliminada"),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <EditShell
      title="Editar ecografía"
      label="Editar ecografía"
      open={open}
      setOpen={setOpen}
      busy={update.isPending || remove.isPending}
      onDelete={() => remove.mutate({ id: check.id })}
      onSubmit={() =>
        update.mutate({
          id: check.id,
          date: atNoon(date),
          result,
          dayOfPregnancy: day === "" ? undefined : Number(day),
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`chk-date-${check.id}`}>Fecha</Label>
          <Input id={`chk-date-${check.id}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`chk-day-${check.id}`}>Día de gestación</Label>
          <Input
            id={`chk-day-${check.id}`}
            type="number"
            min={0}
            max={400}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`chk-result-${check.id}`}>Resultado</Label>
        <Select value={result} onValueChange={(v) => setResult(v as CheckResult)}>
          <SelectTrigger id={`chk-result-${check.id}`}>
            <SelectValue>{(v: string) => checkResultLabels[v as CheckResult] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHECK_RESULTS.map((key) => (
              <SelectItem key={key} value={key}>
                {checkResultLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditShell>
  );
}

export function EditFoalingDialog({
  foaling,
}: {
  foaling: { id: string; date: Date; sex: string | null; alive: boolean; notes: string | null };
}) {
  const [open, setOpen] = useState(false);
  const done = useDone(setOpen);
  const [date, setDate] = useState(toDateInput(foaling.date));
  const [sex, setSex] = useState(foaling.sex ?? NONE);
  const [alive, setAlive] = useState(foaling.alive ? "yes" : "no");
  const [notes, setNotes] = useState(foaling.notes ?? "");

  const update = trpc.reproduction.updateFoaling.useMutation({
    onSuccess: () => done("Parto actualizado"),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = trpc.reproduction.deleteFoaling.useMutation({
    onSuccess: () => done("Parto eliminado"),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <EditShell
      title="Editar parto"
      label="Editar parto"
      open={open}
      setOpen={setOpen}
      busy={update.isPending || remove.isPending}
      onDelete={() => remove.mutate({ id: foaling.id })}
      onSubmit={() =>
        update.mutate({
          id: foaling.id,
          date: atNoon(date),
          sex: sex === "MALE" || sex === "FEMALE" ? sex : undefined,
          alive: alive === "yes",
          notes: notes.trim() || undefined,
        })
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 space-y-1.5 sm:col-span-1">
          <Label htmlFor={`foal-date-${foaling.id}`}>Fecha</Label>
          <Input id={`foal-date-${foaling.id}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`foal-sex-${foaling.id}`}>Sexo</Label>
          <Select value={sex} onValueChange={(v) => setSex(v as string)}>
            <SelectTrigger id={`foal-sex-${foaling.id}`}>
              <SelectValue>
                {(v: string) => ({ MALE: "Macho", FEMALE: "Hembra" })[v] ?? "Sin indicar"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin indicar</SelectItem>
              <SelectItem value="MALE">Macho</SelectItem>
              <SelectItem value="FEMALE">Hembra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`foal-alive-${foaling.id}`}>Estado</Label>
          <Select value={alive} onValueChange={(v) => setAlive(v as string)}>
            <SelectTrigger id={`foal-alive-${foaling.id}`}>
              <SelectValue>{(v: string) => (v === "yes" ? "Vivo" : "Fallecido")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Vivo</SelectItem>
              <SelectItem value="no">Fallecido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`foal-notes-${foaling.id}`}>Notas</Label>
        <Textarea id={`foal-notes-${foaling.id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </EditShell>
  );
}
