import { useRef, useState } from "react"

type Contact = { address: string; phones: string[]; email: string; map: string }
const images = [
  ["wildcat-gaming-pc-kollam", "Custom gaming setup at the Wildcat shop in Meeyanoor"],
  ["detail-01", "Red-lit gaming tower at Wildcat"],
  ["detail-04", "The Wildcat emblem on the shop wall"],
  ["detail-15", "Desktop and monitor at the Wildcat shop"],
  ["hardware-10", "Desktop graphics card and liquid cooler"],
  ["hardware-05", "A technician working on a laptop motherboard"],
  ["hardware-09", "The internal components of an open laptop"],
  ["hardware-03", "Illuminated desktop cooling fans"],
  ["hardware-06", "Desktop tower with illuminated memory"],
  ["hardware-07", "Graphics card and cooling hardware"],
  ["detail-08", "Hands inspecting a circuit board"],
  ["hardware-02", "Precision tools at a workbench"],
  ["hardware-11", "Close-up of tools beside a circuit board"],
  ["hardware-12", "Memory modules in a gaming PC"],
  ["hardware-13", "Graphics card and radiator in a desktop"],
  ["hardware-14", "Gaming computer with a liquid cooling loop"],
  ["hardware-16", "Processor cooler with temperature display"],
] as const

const services = [
  { title: "Custom gaming PCs", detail: "Tell us your budget, the games you play and the screen you use. We’ll put together a build and quote the parts.", image: 4 },
  { title: "Laptop repair", detail: "Tell us the model and what happens when you use it. We’ll help you decide what to bring in for a diagnosis.", image: 5 },
  { title: "Desktop service & upgrades", detail: "Bring us your current specifications and what you’d like to improve. We’ll discuss compatible upgrades or repairs.", image: 8 },
]
const photo = (n: number) => "/media/" + images[n][0] + ".webp"
const telephone = (number: string) => "tel:+" + number.replace(/\D/g, "")

export default function VellumJournalTemplate({ contact }: { contact: Contact }) {
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  function openPhoto(n: number, opener: HTMLAnchorElement) {
    trigger.current = opener
    setIndex(n)
    dialog.current?.showModal()
  }
  function turn(direction: number) {
    setIndex((n) => (n + direction + images.length) % images.length)
  }
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="mast">
        <div className="wrap mast-inner">
          <a href="#top" className="brand" aria-label="Wildcat IT Solutions home"><img src="/media/wildcat-icon.png" alt="Wildcat IT Solutions" width="96" height="25" /></a>
          <nav aria-label="Main navigation"><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
        </div>
      </header>
      <main id="content">
        <section id="top" className="cover wrap" aria-labelledby="cover-title">
          <div className="cover-copy">
            <p className="location">Meeyanoor, Kollam</p>
            <h1 id="cover-title">Custom gaming PCs.<br />Laptop &amp; PC repair.</h1>
            <p className="intro">From choosing parts for a new gaming rig to getting your laptop running again, talk to the team at Wildcat IT Solutions.</p>
            <div className="actions"><a className="button" href={telephone(contact.phones[0])}>Call the shop <span aria-hidden="true">↗</span></a><a className="text-link" href={contact.map}>Get directions <span aria-hidden="true">↗</span></a></div>
          </div>
          <figure id="feature" className="cover-photo">
            <a href={photo(0)} onClick={e => { e.preventDefault(); openPhoto(0, e.currentTarget) }} aria-label="Enlarge the photograph of the Wildcat shop">
              <img src={photo(0)} width="1280" height="960" alt={images[0][1]} />
              <span className="enlarge" aria-hidden="true">⤢</span>
            </a>
            <figcaption><span>Inside the shop</span><span>Meeyanoor, Kerala</span></figcaption>
          </figure>
        </section>
        <section id="about" className="story" aria-labelledby="about-title">
          <div className="wrap story-layout">
            <div><h2 id="about-title">Built from scratch in Meeyanoor.</h2><p>Seven years ago, we started Wildcat IT Solutions here in Kollam. Today we build PCs for local players and keep laptops and desktops in service.</p></div>
            <dl className="figures"><div><dt>Custom PCs sold</dt><dd>1,000+</dd></div><div><dt>Laptop service jobs</dt><dd>2,000+</dd></div></dl>
          </div>
        </section>
        <section className="wrap services" id="services" aria-labelledby="services-title">
          <h2 id="services-title">Builds &amp; repairs</h2>
          <div className="service-list">{services.map((s) => <article className="service" key={s.title}>
            <a href={photo(s.image)} aria-label={"Enlarge photo: " + images[s.image][1]} onClick={e => { e.preventDefault(); openPhoto(s.image, e.currentTarget) }}><img src={photo(s.image)} alt={images[s.image][1]} width="160" height="112" loading="lazy" /></a>
            <h3>{s.title}</h3><p>{s.detail}</p>
          </article>)}</div>
        </section>
      </main>
      <footer id="contact">
        <div className="wrap">
          <div className="contact-grid">
            <div><h2>Visit the shop</h2><address>{contact.address}</address><a className="text-link" href={contact.map}>Open in Google Maps <span aria-hidden="true">↗</span></a></div>
            <div className="contact-lines"><h3>Speak to Wildcat</h3>{contact.phones.map(n => <a key={n} href={telephone(n)}>{n}</a>)}<a className="email" href={"mailto:" + contact.email}>{contact.email}</a></div>
          </div>
          <div className="terms"><details id="terms"><summary>Service terms</summary><p>Confirm the scope, INR quote, timing and any cancellation or refund terms with the shop before approving work. For an existing booking, share your booking or receipt reference.</p></details><details id="privacy"><summary>Privacy</summary><p>For questions about information you share by phone, email or in person, <a href={"mailto:" + contact.email}>email the shop</a>.</p></details></div>
        </div>
      </footer>
      <dialog ref={dialog} aria-label="Photo gallery" onClose={() => trigger.current?.focus({preventScroll:true})} onClick={e => { if (e.target === dialog.current) dialog.current.close() }} onKeyDown={e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); turn(e.key === "ArrowLeft" ? -1 : 1) }
      }}>
        <div className="viewer">
          <div className="viewer-bar"><span>{index < 4 ? "Shop photographs" : "Hardware photographs"}</span><button type="button" onClick={() => dialog.current?.close()}>Close ×</button></div>
          <img key={index} src={photo(index)} alt={images[index][1]} />
          <div className="viewer-foot"><p aria-live="polite"><small>{index + 1} / {images.length}</small>{images[index][1]}</p><div><button type="button" aria-label="Previous photo" onClick={() => turn(-1)}>←</button><button type="button" aria-label="Next photo" onClick={() => turn(1)}>→</button></div></div>
        </div>
      </dialog>
    </>
  )
}
