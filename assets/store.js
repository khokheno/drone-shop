import { configured, db, collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "./firebase.js";
import { esc, moneyFmt, iconFor, DEFAULT_SETTINGS, SAMPLE_PRODUCTS } from "./util.js";
import { t, lang, catName, settingText, setLang, applyStatic } from "./i18n.js";

const $ = s => document.querySelector(s);
let S = { ...DEFAULT_SETTINGS };
let money = moneyFmt(S.currency);
let PRODUCTS = [];
let byId = {};
// Filters: part type (cat), drone brand and model. They combine, and are kept in the page link (?cat=&brand=&model=).
const URLQ = new URLSearchParams(location.search);
let cat = URLQ.get("cat") || "all", brand = URLQ.get("brand") || "all", model = URLQ.get("model") || "all", query = "";
let cart = {};
try { cart = JSON.parse(localStorage.getItem("pw_cart") || "{}") || {}; } catch { cart = {}; }
const saveCart = () => { try { localStorage.setItem("pw_cart", JSON.stringify(cart)); } catch {} };

// Cart keys are "productId" or, for a part with options (e.g. CW / CCW), "productId~optionId".
const hasOpts = p => (p.options || []).length > 0;
const keyOf = (p, o) => o ? p.id + "~" + o.id : p.id;
function parseKey(k) {
  const [pid, oid] = k.split("~"), p = byId[pid];
  const o = p && oid ? (p.options || []).find(x => x.id === oid) : null;
  return { p, o, ok: !!p && (oid ? !!o : !hasOpts(p)) };
}
const stockOf = k => { const { p, o } = parseKey(k); return (o ? o.stock : p?.stock) || 0; };
const isUsed = p => p.condition === "used";
// Name and description in the shop language when a translation is saved (p.tr.ar / p.tr.he), else as written.
const nameOf = p => p.tr?.[lang]?.name || p.name;
const descOf = p => p.tr?.[lang]?.description || p.description || "";
// local: the customer's language for the cart; the order and WhatsApp message keep the name as written, so the owner can match it.
const itemName = (k, local) => { const { p, o } = parseKey(k); const n = local ? nameOf(p) : p.name; return (o ? `${n} — ${o.label}` : n) + (isUsed(p) ? ` (${t("used")})` : ""); };

async function load() {
  if (!configured) {
    // Preview mode before Firebase is set up: show sample parts.
    PRODUCTS = SAMPLE_PRODUCTS.map((p, i) => ({ id: "sample" + i, category: p.cat, brand: p.brand, models: p.models, name: p.name, specs: p.specs, price: p.price, stock: p.stock, visible: true, sort: i }));
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
  for (const k in cart) if (!parseKey(k).ok || !(stockOf(k) > 0)) delete cart[k]; else cart[k] = Math.min(cart[k], stockOf(k));
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
  // The default footer says every part is new; once used parts are listed, say each one is marked.
  if (PRODUCTS.some(isUsed)) document.querySelector("footer.site").textContent = t("footerMixed");
  renderCats(); renderGrid(); renderCart();
}

const phoneOk = ph => /^(0\d{8,9}|972\d{8,9})$/.test(ph.replace(/\D/g, ""));
const catLabel = id => { const c = S.categories.find(c => c.id === id); return c ? catName(c) : id || catName({ id: "other", label: "Other" }); };

const brands = () => S.brands || [];
const brandOf = id => brands().find(b => b.id === id);
const modelLabels = p => (p.models || []).map(m => brandOf(p.brand)?.models?.find(x => x.id === m)?.label).filter(Boolean);
const inCat = p => cat === "all" || p.category === cat;
const inBrand = p => brand === "all" || p.brand === brand;
const inModel = p => model === "all" || (p.models || []).includes(model);
// The model row belongs to the chosen brand, or to the only brand when there is just one.
const brandsInUse = () => brands().filter(b => PRODUCTS.some(p => p.brand === b.id));
const modelBrand = () => brand !== "all" ? brandOf(brand) : brandsInUse().length === 1 ? brandsInUse()[0] : null;

// Choices with nothing left under the other filters are left out. A chosen brand or model shows ✕ and turns off with another tap.
function chip(attr, id, label, n, on) {
  if (!n && !on) return "";
  const x = on && id !== "all" && attr !== "data-cat" ? `<i aria-hidden="true">✕</i>` : "";
  return `<button class="cat" type="button" ${attr}="${esc(id)}" aria-pressed="${on}" dir="auto">${esc(label)}<span>${n}</span>${x}</button>`;
}
const rowLabel = key => `<span class="rowlbl">${t(key)}:</span>`;
// Each row counts what the other filters leave, so the numbers always match what a tap shows.
// A row with only one choice is left out.
function renderCats() {
  // A link may name a filter that no longer exists; fall back to everything.
  if (cat !== "all" && !PRODUCTS.some(p => p.category === cat)) cat = "all";
  if (brand !== "all" && !brandOf(brand)) brand = model = "all";
  if (model !== "all" && !PRODUCTS.some(p => (p.models || []).includes(model))) model = "all";
  const used = S.categories.filter(c => PRODUCTS.some(p => p.category === c.id));
  const extra = [...new Set(PRODUCTS.map(p => p.category))].filter(id => !S.categories.some(c => c.id === id)).map(id => ({ id, label: id }));
  const forCats = PRODUCTS.filter(p => inBrand(p) && inModel(p));
  $("#cats").innerHTML = chip("data-cat", "all", t("allParts"), forCats.length, cat === "all") +
    [...used, ...extra].map(c => chip("data-cat", c.id, catLabel(c.id), forCats.filter(p => p.category === c.id).length, c.id === cat)).join("");

  const inUse = brandsInUse(), forBrands = PRODUCTS.filter(inCat);
  $("#brands").hidden = inUse.length < 2;
  $("#brands").innerHTML = inUse.length < 2 ? "" : rowLabel("brandsLabel") + chip("data-brand", "all", t("allBrands"), forBrands.length, brand === "all") +
    inUse.map(b => chip("data-brand", b.id, b.label, forBrands.filter(p => p.brand === b.id).length, b.id === brand)).join("");

  const mb = modelBrand(), forModels = PRODUCTS.filter(p => inCat(p) && p.brand === mb?.id);
  const models = (mb?.models || []).filter(m => PRODUCTS.some(p => p.brand === mb.id && (p.models || []).includes(m.id)));
  $("#models").hidden = models.length < 2;
  $("#models").innerHTML = models.length < 2 ? "" : rowLabel("modelsLabel") + chip("data-model", "all", t("allModels", mb.label), forModels.length, model === "all") +
    models.map(m => chip("data-model", m.id, m.label, forModels.filter(p => (p.models || []).includes(m.id)).length, m.id === model)).join("");
}
function syncURL() {
  const u = new URL(location.href);
  for (const [k, v] of [["cat", cat], ["brand", brand], ["model", model]]) v === "all" ? u.searchParams.delete(k) : u.searchParams.set(k, v);
  history.replaceState(null, "", u);
}

function stepper(k, q) {
  return `<div class="stepper"><button type="button" data-dec="${esc(k)}" aria-label="${t("oneLess")}">−</button><output>${q}</output><button type="button" data-inc="${esc(k)}" aria-label="${t("oneMore")}" ${q >= stockOf(k) ? "disabled" : ""}>+</button></div>`;
}
function control(k) {
  const q = cart[k] || 0;
  if (!(stockOf(k) > 0)) return `<button class="add" type="button" disabled>${t("soldOut")}</button>`;
  return q ? stepper(k, q) : `<button class="add" type="button" data-inc="${esc(k)}">${t("add")}</button>`;
}
// On a card, a part with options opens its page so the customer picks one first.
function cardControl(p) {
  if (!hasOpts(p)) return control(p.id);
  if (!(p.stock > 0)) return `<button class="add" type="button" disabled>${t("soldOut")}</button>`;
  return `<button class="add" type="button" data-open="${p.id}">${t("choose")}</button>`;
}
function stockText(n) {
  if (!(n > 0)) return `<div class="stock low">${t("soldOut")}</div>`;
  // Customers only see the exact count when it runs low.
  return `<div class="stock ${n <= 3 ? "low" : ""}">${n <= 3 ? t("onlyLeft", n) : t("inStock")}</div>`;
}
const camera = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
function overlays(p) {
  return `<span class="tag ${p.brand === "dji" || p.category === "dji" ? "dji" : ""}">${esc(catLabel(p.category))}</span>` +
    (isUsed(p) ? `<span class="used-tag">${t("used")}</span>` : "") +
    (!(p.stock > 0) ? `<span class="soldout-tag">${t("soldOut")}</span>` : "");
}
function thumb(p) {
  return overlays(p) + (p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : iconFor(p.category)) +
    (p.photoCount > 0 ? `<span class="pcount">${camera}${p.photoCount + 1}</span>` : "");
}

// Cards show the first few specs; the part page shows them all (and search uses them all).
const CARD_SPECS = 3;
const cardSpecs = specs => specs.slice(0, CARD_SPECS).map(s => `<span dir="auto">${esc(s)}</span>`).join("") +
  (specs.length > CARD_SPECS ? `<span class="more" dir="ltr">+${specs.length - CARD_SPECS}</span>` : "");

function renderGrid() {
  const ql = query.trim().toLowerCase();
  const list = PRODUCTS.filter(p => inCat(p) && inBrand(p) && inModel(p) &&
    (!ql || [p.name, ...Object.values(p.tr || {}).flatMap(x => [x.name, x.description]), isUsed(p) ? t("used") + " used" : "", ...(p.specs || []), ...(p.options || []).map(o => o.label), p.description || "", catLabel(p.category), brandOf(p.brand)?.label || "", ...modelLabels(p)].join(" ").toLowerCase().includes(ql)));
  if (!PRODUCTS.length) { $("#grid").innerHTML = `<p class="empty">${t("empty")}</p>`; return; }
  if (!list.length) { $("#grid").innerHTML = `<p class="empty">${t("noMatch", esc(query))}</p>`; return; }
  $("#grid").innerHTML = list.map(p => `<article class="card">
      <button class="thumb" type="button" data-open="${p.id}" aria-label="${esc(t("view", nameOf(p)))}">${thumb(p)}</button>
      <div class="body">
        <h3 dir="auto"><button type="button" data-open="${p.id}">${esc(nameOf(p))}</button></h3>
        <div class="specs">${cardSpecs(p.specs || [])}</div>
        <div class="row"><div><div class="price">${money(p.price)}</div>${stockText(p.stock)}</div>${cardControl(p)}</div>
      </div></article>`).join("");
}

// ───────── Part page: photo gallery + option picker ─────────
const photoCache = {};
const chosen = {}; // productId → selected optionId

async function photosOf(p) {
  if (!p.image) return [];
  if (!(p.photoCount > 0) || !configured) return [p.image];
  if (!photoCache[p.id]) {
    photoCache[p.id] = getDocs(collection(db, "products", p.id, "photos"))
      .then(s => [p.image, ...s.docs.map(d => d.data()).sort((a, b) => a.i - b.i).map(x => x.data)])
      .catch(e => { console.warn(e); delete photoCache[p.id]; return [p.image]; });
  }
  return photoCache[p.id];
}

function galleryHTML(p, photos) {
  if (photos.length < 2) return `<div class="thumb">${thumb(p)}</div>`;
  return `<div class="gallery">${overlays(p)}
    <div class="slides" id="gSlides">${photos.map((src, i) => `<div class="slide"><img src="${esc(src)}" alt="${esc(t("photo", i + 1))}" ${i ? 'loading="lazy"' : ""}></div>`).join("")}</div>
    <button class="gnav prev" type="button" data-g="-1" aria-label="${t("prevPhoto")}">‹</button>
    <button class="gnav next" type="button" data-g="1" aria-label="${t("nextPhoto")}">›</button>
    <div class="dots">${photos.map((_, i) => `<button type="button" data-dot="${i}" aria-label="${esc(t("photo", i + 1))}" ${i ? "" : 'aria-current="true"'}></button>`).join("")}</div>
  </div>`;
}
const slideIndex = el => Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
function goSlide(i) {
  const el = $("#gSlides"); if (!el) return;
  const s = el.children[Math.max(0, Math.min(el.children.length - 1, i))];
  el.scrollBy({ left: s.getBoundingClientRect().left - el.getBoundingClientRect().left, behavior: "smooth" });
}

function buyHTML(p) {
  let k = p.id, stock = p.stock;
  let opts = "";
  if (hasOpts(p)) {
    let sel = p.options.find(o => o.id === chosen[p.id]) || p.options.find(o => o.stock > 0) || p.options[0];
    chosen[p.id] = sel.id; k = keyOf(p, sel); stock = sel.stock;
    opts = `<div class="opts" role="group" aria-label="${esc(t("pickOption"))}"><span class="note">${t("pickOption")}</span>
      ${p.options.map(o => `<button type="button" class="opt" data-opt="${esc(o.id)}" aria-pressed="${o.id === sel.id}" ${o.stock > 0 ? "" : "disabled"}>${esc(o.label)}${o.stock > 0 ? "" : ` · ${t("soldOut")}`}</button>`).join("")}</div>`;
  }
  return `${opts}<div class="row"><div><div class="price">${money(p.price)}</div>${stockText(stock)}</div><div>${control(k)}</div></div>`;
}

async function openDetail(id, keepGallery) {
  const p = byId[id]; if (!p) return;
  const d = $("#detail");
  if (keepGallery && d.dataset.id === id && !d.hidden) { $("#dBuy").innerHTML = buyHTML(p); return; }
  d.dataset.id = id;
  d.innerHTML = `<div class="sheet-head"><h2 id="dTitle" dir="auto">${esc(nameOf(p))}</h2><button class="x" type="button" data-close aria-label="${t("close")}">✕</button></div>
    <div class="d-body">
      <div id="dGallery">${galleryHTML(p, p.image ? [p.image] : [])}</div>
      ${modelLabels(p).length ? `<div class="fits"><b>${t("fits")}</b> <span dir="ltr">${esc([brandOf(p.brand).label, ...modelLabels(p)].join(" · "))}</span></div>` : ""}
      <div class="specs">${(p.specs || []).map(s => `<span dir="auto">${esc(s)}</span>`).join("")}</div>
      ${descOf(p) ? `<p dir="auto">${esc(descOf(p))}</p>` : ""}
      <div id="dBuy" class="buy">${buyHTML(p)}</div>
    </div>`;
  d.hidden = false; $("#scrim").hidden = false;
  d.querySelector("[data-close]").focus();
  const photos = await photosOf(p);
  if (photos.length > 1 && d.dataset.id === id && !d.hidden) {
    $("#dGallery").innerHTML = galleryHTML(p, photos);
    const el = $("#gSlides");
    el.addEventListener("scroll", () => {
      const i = slideIndex(el);
      d.querySelectorAll("[data-dot]").forEach(b => b.toggleAttribute("aria-current", +b.dataset.dot === i));
    }, { passive: true });
  }
}

// ───────── Cart + checkout ─────────
// Shipping is one flat price per order for now (Settings → Shipping); later it can depend on the city.
function totals() {
  let items = 0, sum = 0;
  for (const k in cart) { items += cart[k]; sum += cart[k] * parseKey(k).p.price; }
  const shipping = items ? Number(S.shipping) || 0 : 0;
  return { items, sum, shipping, total: sum + shipping };
}

let orderNo = null;
const newOrderNo = () => "PW-" + Date.now().toString(36).slice(-5).toUpperCase();

function message() {
  const { sum, shipping, total } = totals();
  if (!orderNo) orderNo = newOrderNo();
  const lines = Object.keys(cart).map((k, i) => `${i + 1}. ${itemName(k)} × ${cart[k]} = ${money(parseKey(k).p.price * cart[k])}`);
  const name = $("#cName").value.trim(), phone = $("#cPhone").value.trim(), city = $("#cCity").value.trim(), addr = $("#cAddr").value.trim(), note = $("#cNote").value.trim();
  const details = [name && `${t("mName")}: ${name}`, phone && `${t("mPhone")}: ${phone}`, city && `${t("mCity")}: ${city}`, addr && `${t("mAddress")}: ${addr}`, note && `${t("mNotes")}: ${note}`].filter(Boolean);
  const out = [t("hello", S.name, orderNo), "", ...lines, "", `${t("subtotal")}: ${money(sum)}`, `${t("shipping")}: ${money(shipping)}`, `${t("total")}: ${money(total)}`];
  if (details.length) out.push("", ...details);
  return out.join("\n");
}

function renderCart() {
  const { items, sum, shipping, total } = totals();
  $("#bar").hidden = items === 0;
  $("#barCount").textContent = items;
  $("#barTotal").textContent = money(sum);
  $("#subTotal").textContent = money(sum);
  $("#shipCost").textContent = money(shipping);
  $("#sumTotal").textContent = money(total);
  $("#lines").innerHTML = items ? Object.keys(cart).map(k => {
    const p = parseKey(k).p, q = cart[k];
    return `<div class="line"><div class="n"><bdi>${esc(itemName(k, true))}</bdi><div class="s">${t("each", money(p.price))}</div></div><div class="p">${money(p.price * q)}</div>
      <div class="ctl">${stepper(k, q)}<button class="rm" type="button" data-rm="${esc(k)}">${t("remove")}</button></div></div>`;
  }).join("") : `<p class="note" style="padding-top:16px">${t("cartEmpty")}</p>`;
  updateLink();
  if (!items) closeCart();
}

function updateLink() {
  const msg = message();
  $("#preview").textContent = msg;
  $("#waBtn").href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function setQty(k, q) {
  const { p, ok } = parseKey(k); if (!ok) return;
  q = Math.max(0, Math.min(stockOf(k), q));
  if (q) cart[k] = q; else delete cart[k];
  saveCart(); renderGrid(); renderCart();
  if (!$("#detail").hidden && $("#detail").dataset.id === p.id) openDetail(p.id, true);
}

function openCart() { $("#detail").hidden = true; $("#sheet").hidden = false; $("#scrim").hidden = false; $("#closeCart").focus(); }
function closeCart() { $("#sheet").hidden = true; if ($("#detail").hidden) $("#scrim").hidden = true; }
function closeAll() { $("#sheet").hidden = true; $("#detail").hidden = true; $("#scrim").hidden = true; }

document.addEventListener("click", e => {
  const t = e.target.closest("[data-inc],[data-dec],[data-rm],[data-cat],[data-brand],[data-model],[data-open],[data-close],[data-opt],[data-g],[data-dot]");
  if (!t) return;
  if (t.dataset.inc) setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1);
  else if (t.dataset.dec) setQty(t.dataset.dec, (cart[t.dataset.dec] || 0) - 1);
  else if (t.dataset.rm) setQty(t.dataset.rm, 0);
  else if (t.dataset.cat) { cat = t.dataset.cat; syncURL(); renderCats(); renderGrid(); }
  else if (t.dataset.brand) { brand = t.dataset.brand === brand ? "all" : t.dataset.brand; model = "all"; syncURL(); renderCats(); renderGrid(); }
  else if (t.dataset.model) { model = t.dataset.model === model ? "all" : t.dataset.model; syncURL(); renderCats(); renderGrid(); }
  else if (t.dataset.open) openDetail(t.dataset.open);
  else if (t.dataset.opt) { const id = $("#detail").dataset.id; chosen[id] = t.dataset.opt; openDetail(id, true); }
  else if (t.dataset.g) goSlide(slideIndex($("#gSlides")) + Number(t.dataset.g));
  else if (t.dataset.dot) goSlide(+t.dataset.dot);
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
["cName", "cPhone", "cCity", "cAddr", "cNote"].forEach(id => $("#" + id).addEventListener("input", () => { $("#err").hidden = true; updateLink(); }));
$("#form").addEventListener("submit", e => e.preventDefault());

$("#waBtn").addEventListener("click", e => {
  const bad = !$("#cName").value.trim() ? ["cName", "nameErr"] : !phoneOk($("#cPhone").value) ? ["cPhone", "phoneErr"] : !$("#cCity").value.trim() ? ["cCity", "cityErr"] : !$("#cAddr").value.trim() ? ["cAddr", "addressErr"] : null;
  if (bad) { e.preventDefault(); $("#err").textContent = t(bad[1]); $("#err").hidden = false; $("#" + bad[0]).focus(); return; }
  // Save a copy of the order for the admin app. WhatsApp opens regardless of whether this succeeds.
  if (configured) {
    const { sum, shipping, total } = totals();
    addDoc(collection(db, "orders"), {
      number: orderNo,
      items: Object.keys(cart).map(k => {
        const { p, o } = parseKey(k);
        return { id: p.id, ...(o ? { option: o.id } : {}), ...(isUsed(p) ? { used: true } : {}), name: itemName(k), price: p.price, qty: cart[k] };
      }),
      subtotal: sum, shipping, total,
      customer: { name: $("#cName").value.trim().slice(0, 120), phone: $("#cPhone").value.trim().slice(0, 30), city: $("#cCity").value.trim().slice(0, 120), address: $("#cAddr").value.trim().slice(0, 200), note: $("#cNote").value.trim().slice(0, 1000) },
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
