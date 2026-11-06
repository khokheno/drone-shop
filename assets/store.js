import { configured, db, collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "./firebase.js";
import { esc, moneyFmt, iconFor, DEFAULT_SETTINGS, SAMPLE_PRODUCTS } from "./util.js";

const $ = s => document.querySelector(s);
let S = { ...DEFAULT_SETTINGS };
let money = moneyFmt(S.currency);
let PRODUCTS = [];
let byId = {};
let cat = "all", query = "";
let cart = {};
try { cart = JSON.parse(localStorage.getItem("pw_cart") || "{}") || {}; } catch { cart = {}; }
const saveCart = () => { try { localStorage.setItem("pw_cart", JSON.stringify(cart)); } catch {} };

async function load() {
  if (!configured) {
    // Preview mode before Firebase is set up: show sample parts.
    PRODUCTS = SAMPLE_PRODUCTS.map((p, i) => ({ id: "sample" + i, category: p.cat, name: p.name, specs: p.specs, price: p.price, stock: p.stock, visible: true, sort: i }));
    $("#grid").insertAdjacentHTML("beforebegin", `<div class="notice">Preview mode: Firebase isn't connected yet, so these are sample parts. Paste your config into <code>assets/config.js</code>.</div>`);
  } else {
    try {
      const [setSnap, prodSnap] = await Promise.all([
        getDoc(doc(db, "settings", "store")),
        getDocs(collection(db, "products"))
      ]);
      if (setSnap.exists()) S = { ...DEFAULT_SETTINGS, ...setSnap.data() };
      PRODUCTS = prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.visible !== false);
    } catch (e) {
      console.error(e);
      $("#grid").innerHTML = `<p class="empty">We couldn't load the parts list. Check your connection and refresh the page.</p>`;
      return;
    }
  }
  PRODUCTS.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name).localeCompare(b.name));
  byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  for (const k in cart) if (!byId[k] || !(byId[k].stock > 0)) delete cart[k]; else cart[k] = Math.min(cart[k], byId[k].stock);
  saveCart();
  money = moneyFmt(S.currency || "₪");
  document.title = S.name;
  $("#storeName").textContent = S.name;
  $("#tagline").textContent = S.tagline;
  $("#introText").textContent = S.intro;
  $("#waNum").textContent = "+" + S.whatsapp;
  renderCats(); renderGrid(); renderCart();
}

const catLabel = id => (S.categories.find(c => c.id === id) || {}).label || id || "Other";

function renderCats() {
  const used = S.categories.filter(c => PRODUCTS.some(p => p.category === c.id));
  const extra = [...new Set(PRODUCTS.map(p => p.category))].filter(id => !S.categories.some(c => c.id === id)).map(id => ({ id, label: id }));
  const list = [{ id: "all", label: "All parts" }, ...used, ...extra];
  $("#cats").innerHTML = list.map(c => {
    const n = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter(p => p.category === c.id).length;
    return `<button class="cat" type="button" data-cat="${esc(c.id)}" aria-pressed="${c.id === cat}">${esc(c.label)}<span>${n}</span></button>`;
  }).join("");
}

function stepper(p, q) {
  return `<div class="stepper"><button type="button" data-dec="${p.id}" aria-label="One less">−</button><output>${q}</output><button type="button" data-inc="${p.id}" aria-label="One more" ${q >= p.stock ? "disabled" : ""}>+</button></div>`;
}
function control(p) {
  const q = cart[p.id] || 0;
  if (!(p.stock > 0)) return `<button class="add" type="button" disabled>Sold out</button>`;
  return q ? stepper(p, q) : `<button class="add" type="button" data-inc="${p.id}">Add</button>`;
}
function stockText(p) {
  if (!(p.stock > 0)) return `<div class="stock low">Sold out</div>`;
  return `<div class="stock ${p.stock <= 3 ? "low" : ""}">${p.stock <= 3 ? "Only " + p.stock + " left" : p.stock + " in stock"}</div>`;
}
function thumb(p) {
  return `<span class="tag ${p.category === "dji" ? "dji" : ""}">${esc(catLabel(p.category))}</span>` +
    (p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : iconFor(p.category)) +
    (!(p.stock > 0) ? `<span class="soldout-tag">Sold out</span>` : "");
}

function renderGrid() {
  const ql = query.trim().toLowerCase();
  const list = PRODUCTS.filter(p => (cat === "all" || p.category === cat) &&
    (!ql || [p.name, ...(p.specs || []), p.description || "", catLabel(p.category)].join(" ").toLowerCase().includes(ql)));
  if (!PRODUCTS.length) { $("#grid").innerHTML = `<p class="empty">New stock is on its way. Check back soon.</p>`; return; }
  if (!list.length) { $("#grid").innerHTML = `<p class="empty">No parts match “${esc(query)}”. Try another search or category.</p>`; return; }
  $("#grid").innerHTML = list.map(p => `<article class="card">
      <button class="thumb" type="button" data-open="${p.id}" aria-label="View ${esc(p.name)}">${thumb(p)}</button>
      <div class="body">
        <h3><button type="button" data-open="${p.id}">${esc(p.name)}</button></h3>
        <div class="specs">${(p.specs || []).map(s => `<span>${esc(s)}</span>`).join("")}</div>
        <div class="row"><div><div class="price">${money(p.price)}</div>${stockText(p)}</div>${control(p)}</div>
      </div></article>`).join("");
}

function openDetail(id) {
  const p = byId[id]; if (!p) return;
  const d = $("#detail");
  d.innerHTML = `<div class="sheet-head"><h2 id="dTitle">${esc(p.name)}</h2><button class="x" type="button" data-close aria-label="Close">✕</button></div>
    <div class="d-body">
      <div class="thumb">${thumb(p)}</div>
      <div class="specs">${(p.specs || []).map(s => `<span>${esc(s)}</span>`).join("")}</div>
      ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      <div class="row"><div><div class="price">${money(p.price)}</div>${stockText(p)}</div><div data-ctl="${p.id}">${control(p)}</div></div>
    </div>`;
  d.hidden = false; $("#scrim").hidden = false;
  d.querySelector("[data-close]").focus();
}

function totals() {
  let items = 0, sum = 0;
  for (const id in cart) { items += cart[id]; sum += cart[id] * byId[id].price; }
  return { items, sum };
}

let orderNo = null;
const newOrderNo = () => "PW-" + Date.now().toString(36).slice(-5).toUpperCase();

function message() {
  const { sum } = totals();
  if (!orderNo) orderNo = newOrderNo();
  const lines = Object.keys(cart).map((id, i) => {
    const p = byId[id]; return `${i + 1}. ${p.name} × ${cart[id]} = ${money(p.price * cart[id])}`;
  });
  const name = $("#cName").value.trim(), city = $("#cCity").value.trim(), note = $("#cNote").value.trim();
  const details = [name && `Name: ${name}`, city && `City: ${city}`, note && `Notes: ${note}`].filter(Boolean);
  const out = [`Hi ${S.name}, I'd like to order (order ${orderNo}):`, "", ...lines, "", `Total: ${money(sum)}`];
  if (details.length) out.push("", ...details);
  return out.join("\n");
}

function renderCart() {
  const { items, sum } = totals();
  $("#bar").hidden = items === 0;
  $("#barCount").textContent = items;
  $("#barTotal").textContent = money(sum);
  $("#sumTotal").textContent = money(sum);
  $("#lines").innerHTML = items ? Object.keys(cart).map(id => {
    const p = byId[id], q = cart[id];
    return `<div class="line"><div class="n">${esc(p.name)}<div class="s">${money(p.price)} each</div></div><div class="p">${money(p.price * q)}</div>
      <div class="ctl">${stepper(p, q)}<button class="rm" type="button" data-rm="${id}">Remove</button></div></div>`;
  }).join("") : `<p class="note" style="padding-top:16px">Your cart is empty.</p>`;
  updateLink();
  if (!items) closeCart();
}

function updateLink() {
  const msg = message();
  $("#preview").textContent = msg;
  $("#waBtn").href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function setQty(id, q) {
  const p = byId[id]; if (!p) return;
  q = Math.max(0, Math.min(p.stock || 0, q));
  if (q) cart[id] = q; else delete cart[id];
  saveCart(); renderGrid(); renderCart();
  const slot = document.querySelector(`[data-ctl="${id}"]`);
  if (slot) slot.innerHTML = control(p);
}

function openCart() { $("#detail").hidden = true; $("#sheet").hidden = false; $("#scrim").hidden = false; $("#closeCart").focus(); }
function closeCart() { $("#sheet").hidden = true; if ($("#detail").hidden) $("#scrim").hidden = true; }
function closeAll() { $("#sheet").hidden = true; $("#detail").hidden = true; $("#scrim").hidden = true; }

document.addEventListener("click", e => {
  const t = e.target.closest("[data-inc],[data-dec],[data-rm],[data-cat],[data-open],[data-close]");
  if (!t) return;
  if (t.dataset.inc) setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1);
  else if (t.dataset.dec) setQty(t.dataset.dec, (cart[t.dataset.dec] || 0) - 1);
  else if (t.dataset.rm) setQty(t.dataset.rm, 0);
  else if (t.dataset.cat) { cat = t.dataset.cat; renderCats(); renderGrid(); }
  else if (t.dataset.open) openDetail(t.dataset.open);
  else if (t.hasAttribute("data-close")) closeAll();
});
$("#q").addEventListener("input", e => { query = e.target.value; renderGrid(); });
$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#scrim").addEventListener("click", closeAll);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
["cName", "cCity", "cNote"].forEach(id => $("#" + id).addEventListener("input", () => { $("#err").hidden = true; updateLink(); }));
$("#form").addEventListener("submit", e => e.preventDefault());

$("#waBtn").addEventListener("click", e => {
  if (!$("#cName").value.trim()) { e.preventDefault(); $("#err").hidden = false; $("#cName").focus(); return; }
  // Save a copy of the order for the admin app. WhatsApp opens regardless of whether this succeeds.
  if (configured) {
    const { sum } = totals();
    addDoc(collection(db, "orders"), {
      number: orderNo,
      items: Object.keys(cart).map(id => ({ id, name: byId[id].name, price: byId[id].price, qty: cart[id] })),
      total: sum,
      customer: { name: $("#cName").value.trim().slice(0, 120), city: $("#cCity").value.trim().slice(0, 120), note: $("#cNote").value.trim().slice(0, 1000) },
      status: "new",
      createdAt: serverTimestamp()
    }).catch(err => console.warn("Order not saved", err));
  }
  // Next cart gets a fresh order number.
  setTimeout(() => { orderNo = null; updateLink(); }, 500);
});

$("#copyBtn").addEventListener("click", () => {
  const b = $("#copyBtn"), txt = message();
  const done = ok => { b.textContent = ok ? "Copied" : "Select the text above to copy"; setTimeout(() => b.textContent = "Copy order", 2000); };
  const sel = () => { const r = document.createRange(); r.selectNodeContents($("#preview")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => done(true), () => { sel(); done(false); });
  else { sel(); done(false); }
});

load();
