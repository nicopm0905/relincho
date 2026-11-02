import { getFormatter, getTranslations } from "next-intl/server";
import { Barbell, Heartbeat, Horse, Hammer, Note } from "@phosphor-icons/react/dist/ssr";
import { feedByDay, type FeedItem } from "@/lib/horse-feed";

export const FEED_DAYS = 14;

type Item = FeedItem & { authorName: string | null };

/**
 * Feed de actividad en la ficha del caballo (E6): lo de cada día, del más
 * reciente al más antiguo, con quién lo hizo. Los datos ya vienen filtrados
 * por `feed.forHorse` (el propietario no recibe lo interno ni las notas).
 */
export async function HorseActivityFeed({ items, now = new Date() }: { items: Item[]; now?: Date }) {
  const [t, format] = await Promise.all([getTranslations("horseFeed"), getFormatter()]);
  const days = feedByDay(items, { now, days: FEED_DAYS }).filter((d) => !d.empty);
  const all = feedByDay([], { now, days: 2 });
  const [today, yesterday] = [all[0]?.day, all[1]?.day];
  const dayLabel = (day: string) =>
    day === today
      ? t("today")
      : day === yesterday
        ? t("yesterday")
        : format.dateTime(new Date(`${day}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const time = (d: Date) => format.dateTime(d, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const icon = (i: Item) =>
    i.source === "training" ? <Barbell /> : i.kind === "FARRIER" ? <Hammer /> : i.source === "health" ? <Heartbeat /> : i.kind === "NOTE" ? <Note /> : <Horse />;

  return (
    <section aria-labelledby="horse-feed" className="space-y-3">
      <h2 id="horse-feed" className="text-heading font-semibold text-foreground">
        {t("title")}
      </h2>
      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty", { days: FEED_DAYS })}</p>
      ) : (
        <ol className="space-y-4">
          {days.map((d) => (
            <li key={d.day} className="space-y-1.5">
              <h3 className="text-label font-semibold text-muted-foreground first-letter:uppercase">{dayLabel(d.day)}</h3>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
                {d.items.map((i) => (
                  <li key={`${i.source}-${i.id}`} className="flex items-start gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:h-5 [&>svg]:w-5"
                    >
                      {icon(i)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {[i.kind === "HEALTH" ? i.title : t(`kinds.${i.kind}`), i.kind === "HEALTH" ? null : i.title]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[i.source === "health" ? null : time(i.at), i.durationMin ? t("minutes", { minutes: i.durationMin }) : null, i.authorName ? t("by", { name: i.authorName }) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {i.note && <p className="mt-1 text-sm text-foreground">{i.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
