import VellumJournalTemplate from "@/components/ui/vellum-journal-template"

const contact = {
  address: "Kummalloor–Meeyanoor Road, Meeyanoor, Kollam, Kerala 691537",
  phones: ["+91 85478 75657", "+91 96332 52164"],
  email: "wildcatitsolutions@gmail.com",
  map: "https://www.google.com/maps?cid=10698942720885332175",
}

export default function App() {
  return <VellumJournalTemplate contact={contact} />
}
