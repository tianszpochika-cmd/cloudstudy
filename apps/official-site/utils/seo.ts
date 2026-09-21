type SeoOptions = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  breadcrumbs?: Array<{ name: string; path: string }>;
};

function absoluteUrl(origin: string, path: string): string {
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

export function useOfficialSeo(options: SeoOptions) {
  const config = useRuntimeConfig();
  const siteUrl = String(config.public.siteUrl || "http://127.0.0.1:18182");
  const canonical = absoluteUrl(siteUrl, options.path);
  const breadcrumbItems = (options.breadcrumbs || []).map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(siteUrl, item.path),
  }));

  useSeoMeta({
    title: options.title,
    description: options.description,
    ogTitle: options.title,
    ogDescription: options.description,
    ogType: options.type || "website",
    ogUrl: canonical,
    twitterCard: "summary_large_image",
  });

  useHead({
    link: [{ rel: "canonical", href: canonical }],
    script: [
      {
        key: `jsonld-${options.path}`,
        type: "application/ld+json",
        textContent: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: options.title,
          description: options.description,
          url: canonical,
          ...(breadcrumbItems.length
            ? {
                breadcrumb: {
                  "@type": "BreadcrumbList",
                  itemListElement: breadcrumbItems,
                },
              }
            : {}),
        }),
      },
    ],
  });
}

export function absoluteSiteUrl(path: string): string {
  const config = useRuntimeConfig();
  return absoluteUrl(
    String(config.public.siteUrl || "http://127.0.0.1:18182"),
    path,
  );
}
