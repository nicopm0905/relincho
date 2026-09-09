"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "ALL", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ISSUED", label: "Pendiente" },
  { value: "PAID", label: "Cobrada" },
  { value: "OVERDUE", label: "Vencida" },
  { value: "CANCELLED", label: "Anulada" },
];

export function InvoiceStatusFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") params.delete("status");
    else params.set("status", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current ?? "ALL"} onValueChange={onChange}>
      <SelectTrigger className="w-48 rounded-full bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
