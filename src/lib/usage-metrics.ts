/**
 * Métricas de uso de la app del cliente para validar H3 (identidad §10):
 * "al menos el 50 % la abre en la primera semana y el 30 % sigue activo a las
 * 4 semanas". Motor puro sobre la traza `UsageDay` (E8a-2): un registro por
 * miembro y día, nunca por apertura. Las métricas salen de días de uso, no de
 * impresiones.
 */

export interface InvitedMember {
  membershipId: string;
  role: string;
  invitedAt: Date;
}

/** Un día de uso de un miembro: `day` es `YYYY-MM-DD` en hora de Madrid. */
export interface UsageDay {
  membershipId: string;
  day: string;
}

export interface Rate {
  eligible: number;
  active: number;
  /** `null` si no hay nadie elegible: no se inventa un 0 %. */
  rate: number | null;
}

/** Roles del centro: no son clientes y no cuentan en H3. */
const STAFF_ROLES = new Set(["OWNER", "MANAGER", "GROOM", "INSTRUCTOR"]);

const madridDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);

/** Días entre dos fechas de calendario `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Aperturas → días de uso únicos por miembro. Abrir 20 veces un día es un día. */
export function usageDays(opens: { membershipId: string; at: Date }[]): UsageDay[] {
  const seen = new Map<string, UsageDay>();
  for (const o of opens) {
    const day = madridDay(o.at);
    seen.set(`${o.membershipId}|${day}`, { membershipId: o.membershipId, day });
  }
  return [...seen.values()].sort(
    (a, b) => a.membershipId.localeCompare(b.membershipId) || a.day.localeCompare(b.day),
  );
}

/** Proporción de clientes con algún día de uso cuyo desfase respecto a la invitación cae en [from, to). */
function rateInWindow(members: InvitedMember[], days: UsageDay[], from: number, to: number): Rate {
  const eligible = members.filter((m) => !STAFF_ROLES.has(m.role));
  const active = eligible.filter((m) => {
    const invited = madridDay(m.invitedAt);
    return days.some((d) => {
      if (d.membershipId !== m.membershipId) return false;
      const offset = daysBetween(invited, d.day);
      return offset >= from && offset < to;
    });
  }).length;
  return { eligible: eligible.length, active, rate: eligible.length ? active / eligible.length : null };
}

/** Activación: usa la app en los 7 días siguientes a la invitación (día 0 a día 6). */
export function activation(members: InvitedMember[], days: UsageDay[]): Rate {
  return rateInWindow(members, days, 0, 7);
}

/** Retención a 4 semanas: usa la app en la semana 4 tras la invitación (días 21 a 27). */
export function retentionWeek4(members: InvitedMember[], days: UsageDay[]): Rate {
  return rateInWindow(members, days, 21, 28);
}
