export const origin = "https://wildcatdesk.shop"
export const businessName = "Wildcat IT Solutions"

export const contact = {
  address: "Kummalloor–Meeyanoor Road, Meeyanoor, Kollam, Kerala 691537",
  phones: ["+91 85478 75657", "+91 96332 52164"],
  email: "wildcatitsolutions@gmail.com",
  map: "https://www.google.com/maps?cid=10698942720885332175",
}

export const telHref = (phone: string) => "tel:+" + phone.replace(/\D/g, "")

export const serviceLinks = [
  { href: "/laptop-repair-kollam/", label: "Laptop repair" },
  { href: "/computer-repair-kollam/", label: "Desktop PC repair" },
  { href: "/gaming-pc-builds-kollam/", label: "PC builds & sales" },
  { href: "/gaming-cafe-kollam/", label: "Gaming café" },
] as const
