// Public identity and metadata are built into HTML, not added after JavaScript runs.
export const site = {
  origin: "https://oh.io.vn",
  name: "oh.io.vn",
  image: "/social-card.png",
  imageAlt: "oh.io.vn - Rút gọn link miễn phí. Chuyển thẳng đến địa chỉ đích.",
};

export const pagePath = (name) => (name === "index" ? "/" : `/${name}/`);
const isIndexable = (page) => page.indexable === true && !page.private;
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

export function structuredData(name, page) {
  if (!isIndexable(page)) return null;
  const url = site.origin + pagePath(name);
  const graph = [
    {
      "@type":
        name === "about"
          ? "AboutPage"
          : name === "report"
            ? "ContactPage"
            : "WebPage",
      "@id": url + "#webpage",
      url,
      name: `${page.title} - ${site.name}`,
      description: page.description,
      inLanguage: "vi",
      isPartOf: { "@id": site.origin + "/#website" },
      ...(name === "index" || name === "about"
        ? { about: { "@id": site.origin + "/#application" } }
        : {}),
    },
  ];
  if (name === "index")
    graph.push(
      {
        "@type": "WebSite",
        "@id": site.origin + "/#website",
        name: site.name,
        url: site.origin + "/",
        inLanguage: "vi",
      },
      {
        "@type": "WebApplication",
        "@id": site.origin + "/#application",
        name: site.name,
        url: site.origin + "/",
        description: page.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        inLanguage: "vi",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0 },
        browserRequirements: "Cần bật JavaScript để tạo và quản lý link.",
      },
    );
  return { "@context": "https://schema.org", "@graph": graph };
}

export function renderMetadata(name, page) {
  const title = escapeHtml(`${page.title} - ${site.name}`);
  const description = escapeHtml(page.description);
  const basic = `<title>${title}</title><meta name="description" content="${description}">`;
  if (!isIndexable(page))
    return basic + '<meta name="robots" content="noindex,nofollow">';
  const url = site.origin + pagePath(name);
  // Escaping '<' prevents page text from ending a JSON-LD script element.
  const json = JSON.stringify(structuredData(name, page)).replace(
    /</g,
    "\\u003c",
  );
  return `${basic}<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="${site.name}"><meta property="og:title" content="${title}">
<meta property="og:description" content="${description}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${site.origin}${site.image}"><meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(site.imageAlt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${site.origin}${site.image}">
<meta name="twitter:image:alt" content="${escapeHtml(site.imageAlt)}">
<script type="application/ld+json">${json}</script>`;
}

export function renderSitemap(pages) {
  const urls = Object.entries(pages)
    .filter(([, page]) => isIndexable(page))
    .map(([name]) => `  <url><loc>${site.origin}${pagePath(name)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
