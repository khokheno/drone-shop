import { configured, db, collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "./firebase.js";
import { esc, moneyFmt, iconFor, DEFAULT_SETTINGS, SAMPLE_PRODUCTS } from "./util.js";
import { t, lang, catName, settingText, setLang, applyStatic } from "./i18n.js";
import { CITIES } from "./cities.js";

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
      $("#grid").innerHTML = `<p class="empty">${t("loadErr")}</p>`;
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
  $("#waNum").textContent = "+" + S.whatsapp;
  renderAll();
}

function renderAll() {
  applyStatic();
  $("#tagline").textContent = settingText("tagline", S.tagline);
  $("#introText").textContent = settingText("intro", S.intro);
  renderCities(); renderCats(); renderGrid(); renderCart();
}

const cityCol = () => ({ en: 0, he: 1, ar: 2 })[lang];
function renderCities() {
  const sel = $("#cCity"), cur = sel.value, i = cityCol();
  const opts = CITIES.map((c, n) => [n, c[i]]).sort((a, b) => a[1].localeCompare(b[1], lang));
  sel.innerHTML = `<option value="" disabled>${esc(t("chooseCity"))}</option>` +
    opts.map(([n, name]) => `<option value="${n}">${esc(name)}</option>`).join("") +
    `<option value="other">${esc(t("otherCity"))}</option>`;
  sel.value = cur;
}
const cityName = () => { const v = $("#cCity").value; return v === "other" ? t("otherCity") : v ? CITIES[v][cityCol()] : ""; };
const phoneOk = ph => /^(0\d{8,9}|972\d{8,9})$/.test(ph.replace(/\D/g, ""));

const catLabel = id => { const c = S.categories.find(c => c.id === id); return c ? catName(c) : id || catName({ id: "other", label: "Other" }); };

function renderCats() {
  const used = S.categories.filter(c => PRODUCTS.some(p => p.category === c.id));
  const extra = [...new Set(PRODUCTS.map(p => p.category))].filter(id => !S.categories.some(c => c.id === id)).map(id => ({ id, label: id }));
  const list = [{ id: "all", label: t("allParts") }, ...used, ...extra];
  $("#cats").innerHTML = list.map(c => {
    const n = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter(p => p.category === c.id).length;
    return `<button class="cat" type="button" data-cat="${esc(c.id)}" aria-pressed="${c.id === cat}">${esc(c.id === "all" ? c.label : catLabel(c.id))}<span>${n}</span></button>`;
  }).join("");
}

function stepper(p, q) {
  return `<div class="stepper"><button type="button" data-dec="${p.id}" aria-label="${t("oneLess")}">−</button><output>${q}</output><button type="button" data-inc="${p.id}" aria-label="${t("oneMore")}" ${q >= p.stock ? "disabled" : ""}>+</button></div>`;
}
function control(p) {
  const q = cart[p.id] || 0;
  if (!(p.stock > 0)) return `<button class="add" type="button" disabled>${t("soldOut")}</button>`;
  return q ? stepper(p, q) : `<button class="add" type="button" data-inc="${p.id}">${t("add")}</button>`;
}
function stockText(p) {
  if (!(p.stock > 0)) return `<div class="stock low">${t("soldOut")}</div>`;
  return `<div class="stock ${p.stock <= 3 ? "low" : ""}">${p.stock <= 3 ? t("onlyLeft", p.stock) : t("inStock", p.stock)}</div>`;
}
function thumb(p) {
  return `<span class="tag ${p.category === "dji" ? "dji" : ""}">${esc(catLabel(p.category))}</span>` +
    (p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : iconFor(p.category)) +
    (!(p.stock > 0) ? `<span class="soldout-tag">${t("soldOut")}</span>` : "");
}

function renderGrid() {
  const ql = query.trim().toLowerCase();
  const list = PRODUCTS.filter(p => (cat === "all" || p.category === cat) &&
    (!ql || [p.name, ...(p.specs || []), p.description || "", catLabel(p.category)].join(" ").toLowerCase().includes(ql)));
  if (!PRODUCTS.length) { $("#grid").innerHTML = `<p class="empty">${t("empty")}</p>`; return; }
  if (!list.length) { $("#grid").innerHTML = `<p class="empty">${t("noMatch", esc(query))}</p>`; return; }
  $("#grid").innerHTML = list.map(p => `<article class="card">
      <button class="thumb" type="button" data-open="${p.id}" aria-label="${esc(t("view", p.name))}">${thumb(p)}</button>
      <div class="body">
        <h3 dir="auto"><button type="button" data-open="${p.id}">${esc(p.name)}</button></h3>
        <div class="specs">${(p.specs || []).map(s => `<span>${esc(s)}</span>`).join("")}</div>
        <div class="row"><div><div class="price">${money(p.price)}</div>${stockText(p)}</div>${control(p)}</div>
      </div></article>`).join("");
}

function openDetail(id) {
  const p = byId[id]; if (!p) return;
  const d = $("#detail");
  d.dataset.id = id;
  d.innerHTML = `<div class="sheet-head"><h2 id="dTitle" dir="auto">${esc(p.name)}</h2><button class="x" type="button" data-close aria-label="${t("close")}">✕</button></div>
    <div class="d-body">
      <div class="thumb">${thumb(p)}</div>
      <div class="specs">${(p.specs || []).map(s => `<span>${esc(s)}</span>`).join("")}</div>
      ${p.description ? `<p dir="auto">${esc(p.description)}</p>` : ""}
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
  const name = $("#cName").value.trim(), phone = $("#cPhone").value.trim(), city = cityName(), note = $("#cNote").value.trim();
  const details = [name && `${t("mName")}: ${name}`, phone && `${t("mPhone")}: ${phone}`, city && `${t("mCity")}: ${city}`, note && `${t("mNotes")}: ${note}`].filter(Boolean);
  const out = [t("hello", S.name, orderNo), "", ...lines, "", `${t("total")}: ${money(sum)}`];
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
    return `<div class="line"><div class="n"><bdi>${esc(p.name)}</bdi><div class="s">${t("each", money(p.price))}</div></div><div class="p">${money(p.price * q)}</div>
      <div class="ctl">${stepper(p, q)}<button class="rm" type="button" data-rm="${id}">${t("remove")}</button></div></div>`;
  }).join("") : `<p class="note" style="padding-top:16px">${t("cartEmpty")}</p>`;
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
document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
  setLang(b.dataset.lang); renderAll();
  if (!$("#detail").hidden) openDetail($("#detail").dataset.id);
}));
$("#q").addEventListener("input", e => { query = e.target.value; renderGrid(); });
$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#scrim").addEventListener("click", closeAll);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
["cName", "cPhone", "cCity", "cNote"].forEach(id => $("#" + id).addEventListener("input", () => { $("#err").hidden = true; updateLink(); }));
$("#form").addEventListener("submit", e => e.preventDefault());

$("#waBtn").addEventListener("click", e => {
  const bad = !$("#cName").value.trim() ? ["cName", "nameErr"] : !phoneOk($("#cPhone").value) ? ["cPhone", "phoneErr"] : !$("#cCity").value ? ["cCity", "cityErr"] : null;
  if (bad) { e.preventDefault(); $("#err").textContent = t(bad[1]); $("#err").hidden = false; $("#" + bad[0]).focus(); return; }
  // Save a copy of the order for the admin app. WhatsApp opens regardless of whether this succeeds.
  if (configured) {
    const { sum } = totals();
    addDoc(collection(db, "orders"), {
      number: orderNo,
      items: Object.keys(cart).map(id => ({ id, name: byId[id].name, price: byId[id].price, qty: cart[id] })),
      total: sum,
      customer: { name: $("#cName").value.trim().slice(0, 120), phone: $("#cPhone").value.trim().slice(0, 30), city: cityName().slice(0, 120), note: $("#cNote").value.trim().slice(0, 1000) },
      status: "new",
      createdAt: serverTimestamp()
    }).catch(err => console.warn("Order not saved", err));
  }
  // Next cart gets a fresh order number.
  setTimeout(() => { orderNo = null; updateLink(); }, 500);
});

$("#copyBtn").addEventListener("click", () => {
  const b = $("#copyBtn"), txt = message();
  const done = ok => { b.textContent = t(ok ? "copied" : "selectCopy"); setTimeout(() => b.textContent = t("copy"), 2000); };
  const sel = () => { const r = document.createRange(); r.selectNodeContents($("#preview")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => done(true), () => { sel(); done(false); });
  else { sel(); done(false); }
});

applyStatic();
load();
