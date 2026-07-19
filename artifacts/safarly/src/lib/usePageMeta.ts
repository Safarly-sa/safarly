/**
 * usePageMeta — sets per-page <title>, description, OG and Twitter card tags.
 * Call once per page component.  Updates imperatively so it works in a Vite SPA
 * without react-helmet.
 */
import { useEffect } from "react";

const SITE_NAME   = "Safarly — Travel Companion";
const OG_IMAGE    = "/og-image.svg";
const OG_IMAGE_ALT = "Safarly — Your Saudi Journey, Intelligently Crafted";

function setMeta(
  key: string,
  value: string,
  attr: "name" | "property" = "name",
) {
  let el = document.querySelector(
    `meta[${attr}="${key}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    // Document title
    document.title = `${title} — ${SITE_NAME}`;

    // Standard
    setMeta("description", description);

    // Open Graph
    setMeta("og:title",       title,        "property");
    setMeta("og:description", description,  "property");
    setMeta("og:image",       OG_IMAGE,     "property");
    setMeta("og:image:width", "1200",       "property");
    setMeta("og:image:height","630",        "property");
    setMeta("og:image:alt",   OG_IMAGE_ALT, "property");
    setMeta("og:site_name",   SITE_NAME,    "property");

    // Twitter card
    setMeta("twitter:title",       title);
    setMeta("twitter:description", description);
    setMeta("twitter:image",       OG_IMAGE);
    setMeta("twitter:image:alt",   OG_IMAGE_ALT);
  }, [title, description]);
}
