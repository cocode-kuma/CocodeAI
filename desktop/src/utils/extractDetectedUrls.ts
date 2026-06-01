const URL_RE = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?[^\s"')>]*/g
const LOCAL_FILE_RE = /(?:^|\s)(\/[^\s"']+\.(?:html|md))/g
const MAX_CARDS = 3

export function extractDetectedUrls(content: string): string[] {
  const urls: string[] = []
  for (const m of content.matchAll(URL_RE)) urls.push(m[0])
  for (const m of content.matchAll(LOCAL_FILE_RE)) urls.push(`file://${m[1]}`)
  return [...new Set(urls)].slice(0, MAX_CARDS)
}
