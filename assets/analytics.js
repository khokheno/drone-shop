// Visitor analytics through Microsoft Clarity, loaded only when a project id is set in config.js.
// Typed text (names, phones, addresses) is masked by Clarity; the checkout form is also marked to be masked.
import { clarityId } from "./config.js?v=20261107190111";

if (clarityId) {
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
  const s = document.createElement("script");
  s.async = true; s.src = "https://www.clarity.ms/tag/" + encodeURIComponent(clarityId);
  document.head.appendChild(s);
}

// Named steps (open a part, add to cart, send the order) show up as filters in the Clarity dashboard.
export const track = (event, tags = {}) => {
  if (!window.clarity) return;
  for (const [k, v] of Object.entries(tags)) window.clarity("set", k, String(v));
  window.clarity("event", event);
};
