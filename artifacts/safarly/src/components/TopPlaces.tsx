/**
 * Top-rated places, aggregated from the POI ids stories are anchored to.
 *
 * Only possible because a story tags real POI ids rather than freeform
 * location text — otherwise "top place in Riyadh" would mean clustering
 * strings like "the old town" and "Al Balad" and hoping.
 *
 * `storyCount` is shown rather than hidden: with no minimum-story floor on the
 * server (a floor renders the section empty on a young dataset), the reader
 * should be able to see that a ranking rests on two stories rather than fifty.
 */
import { MapPin, Heart } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { Badge } from "@/components/ui/badge";
import type { TopPlace } from "@/lib/posts-api";

export function TopPlaces({ places }: { places: TopPlace[] }) {
  const { t } = useTranslation();

  if (places.length === 0) return null;

  return (
    <section className="mb-10" data-testid="top-places">
      <h2 className="text-lg font-semibold mb-1">{t("stories.top_places")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("stories.top_places_note")}</p>

      <ol className="grid gap-2 sm:grid-cols-2">
        {places.map((place, index) => (
          <li
            key={place.poiId}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">{index + 1}</span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/*
                  POI names are translated via the same key-echo fallback the
                  itinerary uses: t() returns the key itself when a translation
                  is missing, so fall back to the server's name rather than
                  rendering a raw `poi.*.name` key.
                */}
                <span className="text-sm font-medium truncate">
                  {t(`poi.${place.poiId}.name`) === `poi.${place.poiId}.name`
                    ? place.name
                    : t(`poi.${place.poiId}.name`)}
                </span>
                {!place.verified && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {t("stories.place_estimated")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {/*
                  t() takes a key and nothing else — there is no interpolation
                  in this app's i18n — so the count is composed here.
                  Singular/plural is picked explicitly for the same reason.
                  This covers the one-vs-many split only: Arabic's dual and
                  Russian's paucal forms are not modelled, and would need a real
                  plural-rules layer rather than a second key.
                */}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden />
                  {place.storyCount}{" "}
                  {t(place.storyCount === 1 ? "stories.place_story" : "stories.place_stories")}
                </span>
                {place.score > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3" aria-hidden />
                    {place.score}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
