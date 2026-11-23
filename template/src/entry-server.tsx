import { renderToStaticMarkup, renderToString } from "react-dom/server"
import App from "./App"
import { origin } from "./business"
import { getServicePages } from "./service-pages"

export function render() {
  return renderToString(<App />)
}

export function renderServicePages(stylesheet: string) {
  return getServicePages(stylesheet).map(({ href, html }) => ({
    href,
    html: "<!doctype html>\n" + renderToStaticMarkup(html) + "\n",
  }))
}

export { origin }
