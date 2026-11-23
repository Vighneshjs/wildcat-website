import { readFile, writeFile } from "node:fs/promises"
import { createServer } from "vite"

const vite = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  appType: "custom",
})
try {
  const { render } = await vite.ssrLoadModule("/src/entry-server.tsx")
  const path = new URL("./dist/index.html", import.meta.url)
  const html = (await readFile(path, "utf8")).replace(/\r+\n/g, "\n")
  await writeFile(path, html.replace("<!--app-html-->", () => render()))
} finally {
  await vite.close()
}
