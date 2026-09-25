"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";

export function StartSeasonButton({
  season,
  count,
}: {
  season: number;
  count: number;
}) {
  const router = useRouter();
  const start = trpc.reproduction.startSeasonForAll.useMutation({
    onSuccess: ({ created }) => {
      toast.success(
        created === 1 ? "Temporada iniciada para 1 yegua" : `Temporada iniciada para ${created} yeguas`,
      );
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={start.isPending}
      onClick={() => start.mutate({ season })}
    >
      {start.isPending ? "Iniciando…" : `Iniciar temporada ${season} (${count})`}
    </Button>
  );
}
