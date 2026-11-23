import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "vite"

const vite = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  appType: "custom",
})
try {
  const { render, renderServicePages, origin } = await vite.ssrLoadModule("/src/entry-server.tsx")
  const dist = new URL("./dist/", import.meta.url)
  const path = new URL("index.html", dist)
  const html = (await readFile(path, "utf8")).replace(/\r+\n/g, "\n")
  const stylesheet = html.match(/<link rel="stylesheet"[^>]* href="([^"]+)"/)?.[1]
  if (!stylesheet) throw new Error("Vite did not emit the shared site stylesheet")
  await writeFile(path, html.replace("<!--app-html-->", () => render()))
  const pages = renderServicePages(stylesheet)
  for (const { href, html: serviceHtml } of pages) {
    const folder = new URL("." + href, dist)
    await mkdir(folder, { recursive: true })
    await writeFile(new URL("index.html", folder), serviceHtml)
  }
  const urls = ["/", ...pages.map(({ href }) => href)]
  await writeFile(new URL("sitemap.xml", dist), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((href) => "  <url><loc>" + origin + href + "</loc></url>"),
    "</urlset>",
    "",
  ].join("\n"))
} finally {
  await vite.close()
}
