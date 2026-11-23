import { businessName, contact, origin, serviceLinks, telHref } from "./business"

type ServicePage = {
  title: string
  description: string
  heading: string
  hero: string
  sections: readonly { title: string; body: string }[]
}

const servicePages: Record<(typeof serviceLinks)[number]["href"], ServicePage> = {
  "/laptop-repair-kollam/": {
    title: "Laptop Repair & Servicing in Kollam",
    description: "Get laptop repair and servicing from Wildcat IT Solutions in Meeyanoor, Kollam. Call with the laptop model and symptoms to ask about diagnosis and a quote.",
    heading: "Laptop repair in Kollam",
    hero: "Bring your laptop to Wildcat IT Solutions in Meeyanoor. Tell us the model and what’s going wrong so we can discuss diagnosis and repair options. Wildcat has completed over 2,000 laptop service jobs.",
    sections: [
      { title: "Tell us what you’re seeing", body: "If the laptop won’t start, shuts down during use, runs hot or keeps losing charge, tell us when the problem began and whether it happens on battery, on the charger or both." },
      { title: "What to bring", body: "Bring your laptop and charger if the problem involves power or charging. Bring a photo of any error message you can reproduce, and back up important files if the laptop still boots." },
      { title: "Before approving work", body: "Ask the shop about diagnosis, parts availability, turnaround and the quote. If repair is uneconomical, ask about our current second-hand laptop stock." },
    ],
  },
  "/computer-repair-kollam/": {
    title: "Computer Repair & Desktop PC Service in Kollam",
    description: "Desktop computer repair, PC servicing and upgrade enquiries at Wildcat IT Solutions in Meeyanoor, Kollam. Call the shop before bringing in your PC.",
    heading: "Computer repair in Kollam",
    hero: "Wildcat services desktop PCs and gaming computers in Meeyanoor, Kollam. Call with your hardware details and the fault so we can discuss what to bring and how to proceed.",
    sections: [
      { title: "Describe the desktop fault", body: "For a PC that shows no display, restarts under load or freezes in games, tell us when it happens. Mention any new components or settings changes and whether the problem affects every app or only one." },
      { title: "Plan an upgrade", body: "Share your processor, motherboard, graphics card and power supply model if you know them. Tell us what you want to run so we can discuss compatible upgrades and whether your existing parts can stay in use." },
      { title: "Arrange a drop-off", body: "Before moving the tower, ask whether the shop needs the power lead, monitor or another accessory to reproduce the problem. Confirm the scope and quote before approving work." },
    ],
  },
  "/gaming-pc-builds-kollam/": {
    title: "Custom Gaming PCs & Second-Hand Laptops in Kollam",
    description: "Buy a custom-built gaming PC, desktop computer or second-hand laptop from Wildcat IT Solutions in Meeyanoor, Kollam. Call for a build quote or current stock.",
    heading: "Custom PC builds and computer sales in Kollam",
    hero: "Wildcat has sold over 1,000 custom-built PCs, including high-end gaming systems. Talk to us in Meeyanoor about a new desktop build or ask what second-hand laptops are available.",
    sections: [
      { title: "Get a parts quote for your gaming PC", body: "Share your budget, main games, desired resolution and monitor refresh rate. Tell us if the budget includes a monitor and peripherals, and whether you’d like to reuse any parts." },
      { title: "Buy a desktop for work or home", body: "Tell us which applications you use and what accessories you already own. We can discuss a suitable configuration and give you a quote based on current parts availability." },
      { title: "Ask about second-hand laptops", body: "Stock changes. Call with your budget and intended use, then ask about the specific unit’s specifications, battery condition, charger and any warranty terms before buying." },
    ],
  },
  "/gaming-cafe-kollam/": {
    title: "Gaming Café & GTA 6 on PS5 in Kollam",
    description: "Play Grand Theft Auto VI on PS5 or ask about PC gaming at Wildcat’s gaming café in Meeyanoor, Kollam. Call for available games, session rates and a slot.",
    heading: "Gaming café in Kollam",
    hero: "Play Grand Theft Auto VI (GTA 6) on PS5 at Wildcat IT Solutions in Meeyanoor. PC gaming sessions are also available. Call the shop for session rates, game availability and a time to visit.",
    sections: [
      { title: "Play GTA VI on PlayStation 5", body: "Ask the shop for a PS5 slot and tell us how long you’d like to play. GTA VI is rated for mature audiences. Check any age or session requirements with the shop before you visit." },
      { title: "Ask about PC games", body: "Tell us which PC game you want to play and how many people are coming. We’ll confirm the current game list and available stations." },
      { title: "Check a session before travelling", body: "Call ahead to confirm the price, session length and an available time. The gaming café is at Wildcat IT Solutions on Kummalloor–Meeyanoor Road." },
    ],
  },
}

export function getServicePages(stylesheet: string) {
  return serviceLinks.map(({ href, label }) => {
    const page = servicePages[href]
    const title = page.title + " | " + businessName
    const canonical = origin + href
    return {
      href,
      html: (
        <html lang="en-IN">
          <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{title}</title>
            <meta name="description" content={page.description} />
            <link rel="canonical" href={canonical} />
            <link rel="icon" href="/media/wildcat-icon.png" type="image/png" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content={businessName} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={page.description} />
            <meta property="og:url" content={canonical} />
            <link rel="stylesheet" href={stylesheet} />
          </head>
          <body className="local-page">
            <header className="local-header"><a href="/">{businessName}</a><a href={contact.map}>Get directions</a></header>
            <main>
              <div className="local-intro">
                <p className="local-kicker">Meeyanoor, Kollam</p>
                <h1>{page.heading}</h1>
                <p>{page.hero}</p>
                <a className="local-call" href={telHref(contact.phones[0])}>Call the shop · {contact.phones[0]}</a>
              </div>
              {page.sections.map(({ title, body }) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
            </main>
            <footer>
              <address>{contact.address}</address>
              <nav aria-label="Wildcat services">
                {serviceLinks.map(link => link.href === href
                  ? <span key={link.href} aria-current="page">{label}</span>
                  : <a key={link.href} href={link.href}>{link.label}</a>)}
              </nav>
            </footer>
          </body>
        </html>
      ),
    }
  })
}
