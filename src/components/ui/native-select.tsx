import * as React from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

/**
 * `<select>` nativo con la misma caja que `Input` (altura, borde, radio y
 * foco), para que en un formulario los dos queden alineados. En el móvil abre
 * el selector del sistema, que es más cómodo que un desplegable propio.
 */
function NativeSelect({
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { containerClassName?: string }) {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-10 w-full min-w-0 appearance-none truncate rounded-xl border border-input/90 bg-card py-2 pr-9 pl-3.5 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-200 outline-none hover:border-primary/35 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:opacity-50 md:text-sm dark:bg-input/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
