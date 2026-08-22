import { publicRoutes } from '~/utils/site-content.mjs'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || 'http://127.0.0.1:18182').replace(/\/$/, '')
  const urls = publicRoutes
    .map((path) => `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc><changefreq>weekly</changefreq></url>`)
    .join('\n')
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n')

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return xml
})
