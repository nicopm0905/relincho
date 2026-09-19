"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarBlank,
  CircleNotch,
  DownloadSimple,
  Files,
  FileText,
  FilmSlate,
  Image as ImageIcon,
  MagnifyingGlass,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/react";
import { uploadFile } from "@/lib/upload-client";
import { formatDate } from "@/lib/formatters";
import { humanSize, maxBytesFor } from "@/lib/uploads";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/documents";
import { cn } from "@/lib/utils";

export interface ManagedDocument {
  id: string;
  name: string;
  kind: string;
  horseId: string | null;
  horse: { id: string; name: string } | null;
  sizeBytes: number | null;
  mimeType: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  url: string | null;
  /** Lo calcula el servidor: en el cliente, leer la fecha actual es impuro. */
  expired: boolean;
}

interface DocumentsManagerProps {
  tenantId: string;
  documents: ManagedDocument[];
  usage: { bytes: number; count: number; quotaBytes: number };
  horses: { id: string; name: string }[];
  /** En la ficha de un caballo todo se sube ya asignado a él. */
  lockedHorseId?: string;
  /** Dentro de una pestaña sobran el buscador y el consumo de espacio. */
  compact?: boolean;
}

/** Los tipos que se pueden elegir al subir, en el orden en que se usan. */
const KIND_LABEL: Record<string, string> = {
  PASSPORT: "Pasaporte",
  PEDIGREE: "Pedigrí",
  XRAY: "Radiografía",
  ANALYTICS: "Analítica",
  VACCINATION: "Vacunación",
  CONTRACT: "Contrato",
  SALE: "Carta de venta",
  INSURANCE: "Seguro",
  INVOICE: "Factura",
  PHOTO: "Foto",
  VIDEO: "Vídeo",
  OTHER: "Otro",
};

const KINDS: string[] = [...DOCUMENT_KINDS];

function kindLabel(kind: string) {
  return KIND_LABEL[kind.toUpperCase()] ?? kind;
}

function iconFor(kind: string) {
  switch (kind.toUpperCase()) {
    case "PHOTO":
      return <ImageIcon weight="duotone" />;
    case "VIDEO":
      return <FilmSlate weight="duotone" />;
    default:
      return <FileText weight="duotone" />;
  }
}

export function DocumentsManager({
  tenantId,
  documents,
  usage,
  horses,
  lockedHorseId,
  compact = false,
}: DocumentsManagerProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DocumentKind>("OTHER");
  const [horseId, setHorseId] = useState<string>(lockedHorseId ?? "none");
  const [expiresAt, setExpiresAt] = useState("");

  const [pendingDelete, setPendingDelete] = useState<ManagedDocument | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [horseFilter, setHorseFilter] = useState("ALL");
  const [expiredOnly, setExpiredOnly] = useState(false);

  const create = trpc.documents.create.useMutation();
  const remove = trpc.documents.remove.useMutation();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (kindFilter !== "ALL" && doc.kind.toUpperCase() !== kindFilter) return false;
      if (horseFilter !== "ALL") {
        if (horseFilter === "none" ? doc.horseId !== null : doc.horseId !== horseFilter)
          return false;
      }
      if (expiredOnly && !doc.expired) return false;
      if (needle && !doc.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [documents, query, kindFilter, horseFilter, expiredOnly]);

  const usedPct =
    usage.quotaBytes > 0
      ? Math.min(100, Math.round((usage.bytes / usage.quotaBytes) * 100))
      : 0;

  function resetUpload() {
    setFile(null);
    setName("");
    setKind("OTHER");
    setHorseId(lockedHorseId ?? "none");
    setExpiresAt("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Elige un archivo");
      return;
    }
    setUploading(true);
    try {
      // El protocolo vive en `@/lib/upload-client`: firma, subida y registro.
      const uploaded = await uploadFile({
        tenantId,
        file,
        folder: "documents",
        kind: "document",
      });
      if (!uploaded.ok) {
        toast.error(uploaded.error);
        return;
      }

      await create.mutateAsync({
        name: name.trim() || file.name,
        kind: kind as DocumentKind,
        horseId: horseId === "none" ? null : horseId,
        storageKey: uploaded.storageKey,
        fileUrl: uploaded.fileUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      toast.success("Documento guardado");
      setUploadOpen(false);
      resetUpload();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se ha podido guardar el documento",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: ManagedDocument) {
    setDownloading(doc.id);
    try {
      const { url } = await utils.documents.downloadUrl.fetch({ id: doc.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("El archivo de este documento no está disponible");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ id: pendingDelete.id });
      toast.success("Documento eliminado");
      setPendingDelete(null);
      router.refresh();
    } catch {
      toast.error("No se ha podido eliminar el documento");
    }
  }

  return (
    <div className="space-y-5">
      <Card
        className={cn(
          "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
          compact && "gap-3 p-3",
        )}
      >
        <div className="min-w-0">
          {compact ? (
            <p className="text-[12.5px] text-muted-foreground">
              {documents.length === 0
                ? "Sin documentos todavía"
                : `${documents.length} documento${documents.length === 1 ? "" : "s"}`}
            </p>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold text-foreground">
                {usage.count} documento{usage.count === 1 ? "" : "s"}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {humanSize(usage.bytes)} de {humanSize(usage.quotaBytes)} usados
              </p>
              <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </>
          )}
        </div>
        <Button size={compact ? "default" : "lg"} onClick={() => setUploadOpen(true)}>
          <UploadSimple weight="bold" />
          Subir documento
        </Button>
      </Card>

      {!compact && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            weight="bold"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
            className="pl-9"
          />
        </div>
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v ?? "ALL")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {kindLabel(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={horseFilter} onValueChange={(v) => setHorseFilter(v ?? "ALL")}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Caballo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los caballos</SelectItem>
            <SelectItem value="none">Sin caballo asignado</SelectItem>
            {horses.map((horse) => (
              <SelectItem key={horse.id} value={horse.id}>
                {horse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={expiredOnly ? "default" : "outline"}
          onClick={() => setExpiredOnly((v) => !v)}
        >
          <CalendarBlank weight="bold" />
          Caducados
        </Button>
      </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon={<Files weight="duotone" />}
          title="Todavía no hay documentos"
          description={
            lockedHorseId
              ? "Sube su pasaporte, una radiografía o el contrato de pupilaje y quedarán guardados en su ficha."
              : "Sube el pasaporte de un caballo, una radiografía o un contrato y quedará ligado a su ficha, sin carpetas sueltas por el ordenador."
          }
          action={
            <Button onClick={() => setUploadOpen(true)}>
              <UploadSimple weight="bold" />
              Subir el primero
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="plain"
          title="Ningún documento coincide"
          description="Prueba a quitar los filtros o a buscar por otro nombre."
        />
      ) : (
        <Card className="px-4">
          <ListRows>
            {filtered.map((doc) => {
              const expired = doc.expired;
              return (
                <div key={doc.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ListRow
                      leading={<RowIcon tone={expired ? "alert" : "neutral"}>{iconFor(doc.kind)}</RowIcon>}
                      title={doc.name}
                      subtitle={
                        <>
                          {kindLabel(doc.kind)}
                          {!lockedHorseId && doc.horse ? ` · ${doc.horse.name}` : ""}
                          {doc.sizeBytes ? ` · ${humanSize(doc.sizeBytes)}` : ""}
                        </>
                      }
                      meta={
                        <>
                          {expired && <Badge variant="warning">Caducado</Badge>}
                          {!expired && doc.expiresAt && (
                            <span className="hidden sm:inline">
                              Caduca {formatDate(doc.expiresAt)}
                            </span>
                          )}
                          <span className="hidden sm:inline">
                            {formatDate(doc.createdAt)}
                          </span>
                        </>
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Descargar ${doc.name}`}
                    disabled={!doc.url || downloading === doc.id}
                    onClick={() => handleDownload(doc)}
                  >
                    {downloading === doc.id ? (
                      <CircleNotch weight="bold" className="animate-spin" />
                    ) : (
                      <DownloadSimple weight="bold" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${doc.name}`}
                    onClick={() => setPendingDelete(doc)}
                  >
                    <Trash weight="bold" />
                  </Button>
                </div>
              );
            })}
          </ListRows>
        </Card>
      )}

      {/* Alta de documento */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUpload();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              El archivo se guarda en el almacenamiento de tu yeguada y solo se
              sirve con enlaces temporales.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">Archivo</Label>
              <Input
                id="doc-file"
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setFile(picked);
                  if (picked && !name) {
                    setName(picked.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                PDF, imagen u hoja de cálculo, hasta{" "}
                {humanSize(maxBytesFor("document"))}.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Nombre</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pasaporte Brillante III"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {kindLabel(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!lockedHorseId && (
                <div className="space-y-1.5">
                  <Label>Caballo</Label>
                  <Select value={horseId} onValueChange={(v) => setHorseId(v ?? "none")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {horses.map((horse) => (
                        <SelectItem key={horse.id} value={horse.id}>
                          {horse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-expires">Caducidad (opcional)</Label>
              <Input
                id="doc-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Para vacunaciones, coggins o seguros que hay que renovar.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? (
                <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadSimple weight="bold" className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Subiendo…" : "Guardar documento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>
              Se borrará «{pendingDelete?.name}» de la ficha y del
              almacenamiento. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              {remove.isPending && (
                <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
