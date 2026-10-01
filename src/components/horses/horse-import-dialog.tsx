"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DownloadSimple,
  FileXls,
  UploadSimple,
  CircleNotch,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/react";

type Sex = "MALE" | "FEMALE" | "GELDING";
type Status = "ACTIVE" | "IN_TRAINING" | "SOLD" | "RETIRED" | "DEAD";

const SEX_LABEL: Record<Sex, string> = {
  MALE: "Semental",
  FEMALE: "Yegua",
  GELDING: "Castrado",
};
const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "Activo",
  IN_TRAINING: "En doma",
  SOLD: "Vendido",
  RETIRED: "Retirado",
  DEAD: "Fallecido",
};

interface ParsedHorse {
  name: string;
  sex: Sex;
  status: Status;
  breed?: string;
  coat?: string;
  birthDate?: string;
  uelnCode?: string;
  lgNumber?: string;
  microchip?: string;
  hierro?: string;
  boxLocation?: string;
}

interface RowError {
  row: number;
  messages: string[];
}

interface Preview {
  valid: ParsedHorse[];
  errors: RowError[];
  unmappedColumns: string[];
  truncatedRows: number;
  totalRows: number;
}

export function HorseImportDialog({ triggerVariant }: { triggerVariant?: "outline" | "ghost" }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const bulkImport = trpc.horses.bulkImport.useMutation();

  function reset() {
    setPreview(null);
    setFileName(null);
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setParsing(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/horses/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se ha podido leer el archivo");
        setFileName(null);
        return;
      }
      setPreview(data as Preview);
    } catch {
      toast.error("No se ha podido leer el archivo");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.valid.length === 0) return;
    try {
      const result = await bulkImport.mutateAsync({
        rows: preview.valid.map((h) => ({
          ...h,
          birthDate: h.birthDate ? new Date(h.birthDate) : undefined,
        })),
      });
      const parts = [`${result.created} caballo${result.created === 1 ? "" : "s"} importado${result.created === 1 ? "" : "s"}`];
      if (result.skipped > 0) parts.push(`${result.skipped} ya existían`);
      toast.success(parts.join(", "));
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error al importar los caballos");
    }
  }

  return (
    <>
      <Button
        variant={triggerVariant ?? "outline"}
        size="lg"
        onClick={() => setOpen(true)}
      >
        <FileXls weight="bold" />
        Importar desde Excel o CSV
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar caballos desde Excel o CSV</DialogTitle>
            <DialogDescription>
              Sube el Excel o CSV que ya usas, o descarga nuestra plantilla. Revisaremos
              los datos antes de importar; no se guarda nada hasta que confirmes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/horses/import-template" download>
                  <DownloadSimple weight="bold" className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </a>
              </Button>
              <span className="text-xs text-muted-foreground">
                Excel .xlsx o CSV · hasta 1.000 filas · nombre y sexo obligatorios
              </span>
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
              >
                {parsing ? (
                  <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadSimple weight="bold" className="mr-2 h-4 w-4" />
                )}
                {parsing ? "Leyendo…" : "Subir archivo"}
              </Button>
              {fileName && (
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {fileName}
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            {preview && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                    <CheckCircle weight="fill" className="h-4 w-4" />
                    {preview.valid.length} listo
                    {preview.valid.length === 1 ? "" : "s"} para importar
                  </span>
                  {preview.errors.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
                      <Warning weight="fill" className="h-4 w-4" />
                      {preview.errors.length} fila
                      {preview.errors.length === 1 ? "" : "s"} con errores (se
                      omiten)
                    </span>
                  )}
                </div>

                {preview.totalRows > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se han revisado {preview.totalRows} filas: {preview.valid.length} se importarán y {preview.errors.length} se omitirán por errores.
                  </p>
                )}

                {preview.truncatedRows > 0 && (
                  <p className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                    El archivo contiene más filas de las permitidas: {preview.truncatedRows} filas al final no se revisaron ni se importarán. Divide el archivo y vuelve a intentarlo.
                  </p>
                )}

                {preview.unmappedColumns.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                    <p className="font-semibold">Estas columnas no se importarán</p>
                    <p className="mt-1">{preview.unmappedColumns.join(", ")}</p>
                    <p className="mt-1 text-amber-900">No se han reconocido automáticamente. Revisa la vista previa antes de confirmar.</p>
                  </div>
                )}

                {preview.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                    {preview.errors.map((err) => (
                      <div key={err.row} className="py-0.5">
                        <span className="font-medium">Fila {err.row}:</span>{" "}
                        {err.messages.join(" ")}
                      </div>
                    ))}
                  </div>
                )}

                {preview.valid.length > 0 && (
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Sexo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Raza</TableHead>
                          <TableHead>Libro PRE</TableHead>
                          <TableHead>Nacimiento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.valid.slice(0, 50).map((h, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{h.name}</TableCell>
                            <TableCell>{SEX_LABEL[h.sex] ?? h.sex}</TableCell>
                            <TableCell>
                              {STATUS_LABEL[h.status] ?? h.status}
                            </TableCell>
                            <TableCell>{h.breed ?? "—"}</TableCell>
                            <TableCell>{h.lgNumber ?? "—"}</TableCell>
                            <TableCell>
                              {h.birthDate
                                ? new Date(h.birthDate).toLocaleDateString("es-ES")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {preview.valid.length > 50 && (
                      <p className="border-t p-2 text-center text-xs text-muted-foreground">
                        … y {preview.valid.length - 50} más
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                !preview ||
                preview.valid.length === 0 ||
                preview.truncatedRows > 0 ||
                bulkImport.isPending
              }
            >
              {bulkImport.isPending && (
                <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
              )}
              {preview?.truncatedRows
                ? "Divide el archivo para importarlo"
                : preview && preview.valid.length > 0
                  ? `Importar ${preview.valid.length} caballo${
                      preview.valid.length === 1 ? "" : "s"
                    }`
                  : "Importar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
