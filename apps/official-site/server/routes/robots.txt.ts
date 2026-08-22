export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || 'http://127.0.0.1:18182').replace(/\/$/, '')

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /app',
    'Disallow: /login',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})
