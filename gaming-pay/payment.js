"use strict";

async function showCheckout(token) {
  const checkout = document.querySelector("#checkout");
  const summary = document.querySelector("#summary");
  const button = document.querySelector("#pay");
  const status = document.querySelector("#status");
  document.querySelector("#gaming-information").hidden = true;
  document.querySelector("#shop-information").hidden = true;
  document.title = "Pay for your gaming session | Wildcat IT Solutions";
  checkout.hidden = false;
  status.textContent = "Loading your payment link…";

  async function request(path, fields = {}) {
    const response = await fetch("https://pay.wildcatdesk.shop/" + path, {
      method: "POST",
      credentials: "omit",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token, ...fields})
    });
    if (response.status >= 500) throw new Error("The shop's payment service is offline. Ask staff to check the connection.");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }

  function loadRazorpay() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Razorpay could not load."));
      document.head.append(script);
    });
  }

  function stopped(message) {
    status.textContent = message;
    button.disabled = false;
  }

  try {
    const details = await request("details");
    const amount = new Intl.NumberFormat("en-IN", {style: "currency", currency: details.currency});
    summary.textContent = `Timed gaming session · ${details.seconds / 60} minutes · ${amount.format(details.amount / 100)}`;
    if (details.settled) {
      status.textContent = "This order has already been paid. Please see the shop staff.";
      return;
    }
    status.textContent = details.test_mode ? "Razorpay Test Mode. No money will be collected." : "";
    button.hidden = false;
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = "Opening Razorpay…";
      try {
        await loadRazorpay();
        const order = await request("start");
        const razorpay = new window.Razorpay({
          key: order.key_id,
          order_id: order.order_id,
          currency: order.currency,
          amount: order.amount,
          name: "Wildcat IT Solutions",
          description: "Timed gaming session",
          retry: {enabled: false},
          timeout: 300,
          modal: {ondismiss() {
            stopped("Checkout closed. If your bank shows a debit, ask shop staff to check the payment before retrying.");
          }},
          async handler(payment) {
            button.disabled = true;
            status.textContent = "Checking your payment…";
            try {
              await request("confirm", {
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature
              });
              button.hidden = true;
              status.textContent = "Payment confirmed. Please see the shop staff to start your session.";
            } catch {
              status.textContent = "The shop could not confirm the payment yet. Ask staff to check it before paying again.";
            }
          }
        });
        razorpay.on("payment.failed", () => {
          stopped("Razorpay reported a failed payment. Ask shop staff to check the payment before retrying.");
        });
        razorpay.open();
      } catch (error) {
        stopped(error.message || "Could not open Razorpay. Please ask the shop to check your link.");
      }
    };
    await button.onclick();
  } catch (error) {
    status.textContent = error.message === "Failed to fetch"
      ? "The shop's payment service is unavailable. Please ask the shop staff for help."
      : error.message;
  }
}

const token = location.hash.slice(1);
if (/^[A-Za-z0-9_-]{43}$/.test(token)) showCheckout(token);
