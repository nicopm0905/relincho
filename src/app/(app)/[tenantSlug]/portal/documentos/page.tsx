import { createServerCaller } from "@/lib/trpc/server";
import { formatDate } from "@/lib/formatters";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Files,
  FilmSlate,
  Image as ImageIcon,
  FileText,
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Documentos — ${tenantSlug}` };
}

const MEDIA_KINDS = new Set(["VIDEO", "PHOTO", "FOTO"]);

function iconFor(kind: string) {
  const k = kind.toUpperCase();
  if (k === "VIDEO") return <FilmSlate weight="duotone" className="h-4 w-4" />;
  if (MEDIA_KINDS.has(k)) return <ImageIcon weight="duotone" className="h-4 w-4" />;
  return <FileText weight="duotone" className="h-4 w-4" />;
}

export default async function PortalDocumentosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const documents = await caller.portal.myDocuments();

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Documentación vinculada a tus caballos.
        </p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={<Files weight="duotone" />}
          title="Sin documentos"
          description="Aquí verás los documentos que la yeguada asocie a tus caballos."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border/50">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {iconFor(doc.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {doc.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.kind}
                      {doc.horse ? ` · ${doc.horse.name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(doc.createdAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
