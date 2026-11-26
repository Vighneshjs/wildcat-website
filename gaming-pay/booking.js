"use strict";

const bookingForm = document.querySelector("#booking-request");
const bookingStatus = document.querySelector("#booking-status");
const indiaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
});

const today = indiaDate.format(new Date());
bookingForm.elements.date.min = today < "2026-12-01" ? "2026-12-01" : today;
bookingForm.hidden = false;

bookingForm.addEventListener("submit", event => {
  event.preventDefault();
  const details = new FormData(bookingForm);
  const name = details.get("customer").trim();
  const start = new Date(details.get("date") + "T" + details.get("time") + ":00+05:30");
  if (!name || !Number.isFinite(start.getTime()) || start <= new Date()) {
    bookingStatus.textContent = "Enter your name and choose a future date and time.";
    return;
  }
  const slot = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short"
  }).format(start);
  const message = [
    "Hi Wildcat IT Solutions, I would like to request a gaming session.",
    "Name: " + name,
    "Preferred slot: " + slot + " IST",
    "Session: " + details.get("duration"),
    "Please confirm availability. I will pay at the shop."
  ].join("\n");
  location.assign("https://wa.me/918547875657?text=" + encodeURIComponent(message));
});
