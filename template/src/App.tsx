import VellumJournalTemplate from "@/components/ui/vellum-journal-template"

const contact = {
  address: "Kummalloor–Meeyanoor Road, Meeyanoor, Kollam, Kerala 691537",
  phones: ["+91 85478 75657", "+91 96332 52164"],
  email: "wildcatitsolutions@gmail.com",
  map: "https://www.google.com/maps?cid=10698942720885332175",
}

export default function App() {
  return (
    <main>
      <VellumJournalTemplate
        brand="Wildcat"
        headline={["Custom Gaming PCs", "Laptop & PC Repair"]}
        tagline="Wildcat IT Solutions · Meeyanoor, Kollam"
        aboutTitle={["Built From Scratch", "In Meeyanoor"]}
        aboutBody={[
          "Wildcat IT Solutions started from scratch in Meeyanoor, Kollam. Seven years on, we’ve sold 1,000+ custom-built PCs, including high-end gaming rigs.",
          "We’ve completed 2,000+ laptop service jobs. Tell us what’s wrong or what you want to build, and we’ll talk through the work and quote.",
        ]}
        galleryTitle={["Builds", "Repairs"]}
        galleryBody={[
          "Custom PC builds in Kollam, from everyday desktops to high-end gaming PCs. Call with your budget and what you want to run.",
          "Laptop repair and desktop PC servicing in Meeyanoor. Call to discuss the issue, upgrade options, and what to bring.",
        ]}
        shelf={["Gaming PCs", "Laptop Repair", "PC Service", "Upgrades", "Kollam"]}
        issue="A custom gaming setup at Wildcat IT Solutions, Meeyanoor."
        year="2024"
        primaryAction={{label: "Call the shop", href: "tel:+918547875657"}}
        secondaryAction={{label: "Get directions", href: contact.map}}
        contact={contact}
      />
    </main>
  )
}