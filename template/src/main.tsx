import { createRoot, hydrateRoot } from "react-dom/client"
import App from "./App"
import "@fontsource/barlow-condensed/latin-500.css"
import "@fontsource/source-sans-3/latin-400.css"
import "@fontsource/source-sans-3/latin-600.css"
import "./index.css"

const root = document.getElementById("root")!
if (root.querySelector("main")) {
  hydrateRoot(root, <App />)
} else {
  createRoot(root).render(<App />)
}
