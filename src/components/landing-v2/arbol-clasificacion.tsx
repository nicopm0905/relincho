"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { motion, useReducedMotion } from "framer-motion";

type NodeId =
  | "raiz"
  | "sanidad"
  | "reproduccion"
  | "sanidadDetalle"
  | "reproduccionDetalle"
  | "pupilaje"
  | "pupilajeDetalle";

interface NodeProps {
  children: ReactNode;
  delay: number;
  active: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Pildora glass en cursiva: los niveles de categoria del arbol. */
function NodoA({ children, delay, active, ref }: NodeProps) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={active ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className="inline-block font-heading text-base text-white italic backdrop-blur-[20px]"
      style={{
        borderRadius: 9999,
        border: "1px solid rgba(255,255,255,0.25)",
        backgroundColor: "rgba(255,255,255,0.10)",
        padding: "10px 20px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </motion.div>
  );
}

/** Tarjeta blanca de detalle: las hojas del arbol. */
function NodoB({ children, delay, active, ref }: NodeProps) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={active ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className="inline-block font-sans text-xs font-normal"
      style={{
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: "10px 16px",
        color: "rgba(0,0,0,0.75)",
        lineHeight: 1.5,
        maxWidth: 160,
      }}
    >
      {children}
    </motion.div>
  );
}

/** Punto de anclaje de un nodo, en coordenadas locales del contenedor. */
interface Anchor {
  topX: number;
  topY: number;
  botX: number;
  botY: number;
}

const CONNECTIONS: { from: NodeId; to: NodeId; delay: number }[] = [
  { from: "raiz", to: "sanidad", delay: 0.25 },
  { from: "raiz", to: "reproduccion", delay: 0.4 },
  { from: "sanidad", to: "sanidadDetalle", delay: 0.6 },
  { from: "reproduccion", to: "reproduccionDetalle", delay: 0.78 },
  { from: "raiz", to: "pupilaje", delay: 0.95 },
  { from: "pupilaje", to: "pupilajeDetalle", delay: 1.15 },
];

export interface ArbolLabels {
  raiz: string;
  sanidad: string;
  sanidadDetalle: string;
  reproduccion: string;
  reproduccionDetalle: string;
  pupilaje: string;
  pupilajeDetalle: string;
}

interface ArbolProps {
  labels: ArbolLabels;
  active: boolean;
}

export function ArbolClasificacion({ labels, active }: ArbolProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<NodeId, HTMLDivElement | null>());
  const [anchors, setAnchors] = useState<Partial<Record<NodeId, Anchor>>>({});
  const [size, setSize] = useState({ width: 0, height: 0 });

  const setNodeRef = useCallback(
    (id: NodeId) => (element: HTMLDivElement | null) => {
      nodeRefs.current.set(id, element);
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const base = container.getBoundingClientRect();
    const next: Partial<Record<NodeId, Anchor>> = {};

    nodeRefs.current.forEach((element, id) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const centerX = rect.left - base.left + rect.width / 2;
      next[id] = {
        topX: centerX,
        topY: rect.top - base.top,
        botX: centerX,
        botY: rect.bottom - base.top,
      };
    });

    setAnchors(next);
    setSize({ width: base.width, height: base.height });
  }, []);

  useLayoutEffect(() => {
    measure();

    const container = containerRef.current;
    const observer = new ResizeObserver(measure);
    if (container) observer.observe(container);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.width > 0 && (
        <svg
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-[1]"
          width={size.width}
          height={size.height}
        >
          {CONNECTIONS.map((connection, i) => {
            const from = anchors[connection.from];
            const to = anchors[connection.to];
            if (!from || !to) return null;

            const x1 = from.botX;
            const y1 = from.botY;
            const x2 = to.topX;
            const y2 = to.topY;
            const midY = (y1 + y2) / 2;
            const pathId = `rlv2-path-${i}`;

            return (
              <g key={pathId}>
                <motion.path
                  id={pathId}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={active ? { pathLength: 1, opacity: 1 } : undefined}
                  transition={{ duration: 0.5, delay: connection.delay, ease: "easeOut" }}
                />
                <motion.circle
                  cx={x2}
                  cy={y2}
                  r={2.5}
                  fill="rgba(255,255,255,0.9)"
                  initial={{ opacity: 0 }}
                  animate={active ? { opacity: 1 } : undefined}
                  transition={{ duration: 0.3, delay: connection.delay + 0.5 }}
                />
                {!reduceMotion && (
                  <motion.circle
                    r={3}
                    fill="#fff"
                    style={{ filter: "drop-shadow(0 0 4px rgba(163,184,70,0.9))" }}
                    initial={{ opacity: 0 }}
                    animate={active ? { opacity: [0, 1, 1, 0] } : undefined}
                    transition={{
                      duration: 2.4,
                      delay: connection.delay + 0.6,
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      ease: "easeInOut",
                      times: [0, 0.1, 0.9, 1],
                    }}
                  >
                    <animateMotion
                      dur="2.4s"
                      repeatCount="indefinite"
                      begin={`${connection.delay + 0.6}s`}
                    >
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </motion.circle>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <div className="relative z-[2] flex flex-col items-center gap-[18px]">
        <NodoA ref={setNodeRef("raiz")} delay={0} active={active}>
          {labels.raiz}
        </NodoA>

        <div className="flex gap-4">
          <NodoA ref={setNodeRef("sanidad")} delay={0.18} active={active}>
            {labels.sanidad}
          </NodoA>
          <NodoA ref={setNodeRef("reproduccion")} delay={0.36} active={active}>
            {labels.reproduccion}
          </NodoA>
        </div>

        <div className="flex items-start gap-4">
          <NodoB ref={setNodeRef("sanidadDetalle")} delay={0.54} active={active}>
            {labels.sanidadDetalle}
          </NodoB>
          <NodoB ref={setNodeRef("reproduccionDetalle")} delay={0.72} active={active}>
            {labels.reproduccionDetalle}
          </NodoB>
        </div>

        <NodoA ref={setNodeRef("pupilaje")} delay={0.9} active={active}>
          {labels.pupilaje}
        </NodoA>

        <NodoB ref={setNodeRef("pupilajeDetalle")} delay={1.08} active={active}>
          {labels.pupilajeDetalle}
        </NodoB>
      </div>
    </div>
  );
}
