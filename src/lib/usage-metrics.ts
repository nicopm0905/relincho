export interface InvitedMember {
  membershipId: string;
  role: string;
  invitedAt: Date;
}
export interface UsageDay {
  membershipId: string;
  day: string;
}
export interface Rate {
  eligible: number;
  active: number;
  rate: number | null;
}
export function usageDays(_opens: { membershipId: string; at: Date }[]): UsageDay[] {
  throw new Error("no implementado");
}
export function activation(_members: InvitedMember[], _days: UsageDay[]): Rate {
  throw new Error("no implementado");
}
export function retentionWeek4(_members: InvitedMember[], _days: UsageDay[]): Rate {
  throw new Error("no implementado");
}
