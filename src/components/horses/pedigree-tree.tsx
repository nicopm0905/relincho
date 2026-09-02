"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GenderMale, GenderFemale, TreeStructure } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Ancestor = {
  id: string;
  name: string;
  sire?: { id: string; name: string } | null;
  dam?: { id: string; name: string } | null;
} | null;

interface PedigreeTreeProps {
  tenantSlug: string;
  horseName: string;
  sire: Ancestor;
  dam: Ancestor;
}

function AncestorCard({ 
  tenantSlug, 
  ancestor, 
  role, 
  className 
}: { 
  tenantSlug: string; 
  ancestor: { id: string; name: string } | null | undefined; 
  role: "sire" | "dam";
  className?: string;
}) {
  const isSire = role === "sire";
  
  if (!ancestor) {
    return (
      <div className={cn("px-4 py-2 bg-muted/20 border border-border/50 border-dashed rounded-xl text-xs text-muted-foreground/60 italic flex items-center justify-center min-w-[120px] h-[42px]", className)}>
        Desconocido
      </div>
    );
  }

  return (
    <Link 
      href={`/${tenantSlug}/caballos/${ancestor.id}`} 
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 bg-white hover:bg-muted/30 border border-border/60 rounded-xl font-semibold text-sm text-foreground transition-all shadow-sm min-w-[120px]", 
        isSire ? "hover:border-blue-200" : "hover:border-pink-200",
        className
      )}
    >
      <div className={cn(
        "h-6 w-6 rounded-full flex items-center justify-center shrink-0 border",
        isSire ? "bg-blue-50 border-blue-100 text-blue-500" : "bg-pink-50 border-pink-100 text-pink-500"
      )}>
        {isSire ? <GenderMale weight="bold" className="h-3 w-3" /> : <GenderFemale weight="bold" className="h-3 w-3" />}
      </div>
      <span className="truncate">{ancestor.name}</span>
    </Link>
  );
}

export function PedigreeTree({ tenantSlug, horseName, sire, dam }: PedigreeTreeProps) {
  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px] flex items-center justify-start p-4">
        
        {/* Generación 1: El caballo actual */}
        <div className="flex flex-col justify-center items-end relative z-10 w-[180px]">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-4 py-3 bg-primary text-primary-foreground rounded-2xl font-bold shadow-md border border-primary/20 flex items-center gap-2"
          >
            <TreeStructure weight="duotone" className="h-5 w-5" />
            <span className="truncate max-w-[120px]">{horseName}</span>
          </motion.div>
        </div>

        {/* Líneas conectoras Gen 1 -> Gen 2 */}
        <div className="flex flex-col justify-between h-[160px] w-[40px] relative">
          <div className="absolute left-0 top-1/2 w-1/2 h-px bg-border/80" />
          <div className="absolute left-1/2 top-[20px] bottom-[20px] w-px bg-border/80" />
          <div className="absolute left-1/2 top-[20px] w-1/2 h-px bg-border/80" />
          <div className="absolute left-1/2 bottom-[20px] w-1/2 h-px bg-border/80" />
        </div>

        {/* Generación 2: Padres */}
        <div className="flex flex-col justify-between h-[200px] w-[180px] py-4">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="relative">
            <p className="absolute -top-5 left-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Padre</p>
            <AncestorCard tenantSlug={tenantSlug} ancestor={sire} role="sire" className="w-full shadow-sm" />
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative">
             <p className="absolute -top-5 left-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Madre</p>
            <AncestorCard tenantSlug={tenantSlug} ancestor={dam} role="dam" className="w-full shadow-sm" />
          </motion.div>
        </div>

        {/* Líneas conectoras Gen 2 -> Gen 3 (Abuelos) */}
        <div className="flex flex-col justify-between h-[200px] w-[40px] relative">
            {/* Sire connectors */}
            <div className="absolute left-0 top-[20px] w-1/2 h-px bg-border/60" />
            <div className="absolute left-1/2 top-0 bottom-[140px] w-px bg-border/60" />
            <div className="absolute left-1/2 top-0 w-1/2 h-px bg-border/60" />
            <div className="absolute left-1/2 top-[60px] w-1/2 h-px bg-border/60" />
            
            {/* Dam connectors */}
            <div className="absolute left-0 bottom-[20px] w-1/2 h-px bg-border/60" />
            <div className="absolute left-1/2 top-[140px] bottom-0 w-px bg-border/60" />
            <div className="absolute left-1/2 bottom-[60px] w-1/2 h-px bg-border/60" />
            <div className="absolute left-1/2 bottom-0 w-1/2 h-px bg-border/60" />
        </div>

        {/* Generación 3: Abuelos */}
        <div className="flex flex-col justify-between h-[240px] w-[160px] py-0">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="h-[42px] flex items-center">
            <AncestorCard tenantSlug={tenantSlug} ancestor={sire?.sire} role="sire" />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="h-[42px] flex items-center">
            <AncestorCard tenantSlug={tenantSlug} ancestor={sire?.dam} role="dam" />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="h-[42px] flex items-center mt-4">
            <AncestorCard tenantSlug={tenantSlug} ancestor={dam?.sire} role="sire" />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="h-[42px] flex items-center">
            <AncestorCard tenantSlug={tenantSlug} ancestor={dam?.dam} role="dam" />
          </motion.div>
        </div>

      </div>
    </div>
  );
}
