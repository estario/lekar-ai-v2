const URL = "https://lekari-ai-bulgaria.lovable.app/";
const IMG = "https://lekari-ai-bulgaria.lovable.app/og-lekar-ai-v2-20261005.png";
const TITLE = "Lekar AI — Demo";
const DESC = "Bulgarian/English medical scribe demo: record a fictional consultation, get an AI report and review it. Fictional data only.";
const ALT = "Lekar AI — Medical Scribe Demo, BG / EN, fictional data only";

/** Shared site/home social metadata; identical in root and "/" so SSR emits one consistent set. */
export const BRAND_META = [
  { title: TITLE },
  { name: "description", content: DESC },
  { property: "og:site_name", content: "Lekar AI" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: URL },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESC },
  { property: "og:image", content: IMG },
  { property: "og:image:secure_url", content: IMG },
  { property: "og:image:type", content: "image/png" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "628" },
  { property: "og:image:alt", content: ALT },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: TITLE },
  { name: "twitter:description", content: DESC },
  { name: "twitter:image", content: IMG },
  { name: "twitter:image:alt", content: ALT },
];
