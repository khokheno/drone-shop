import {
  configured, db, auth, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, limit, writeBatch, increment, serverTimestamp, onSnapshot,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "./firebase.js";
import { esc, slug, moneyFmt, iconFor, DEFAULT_SETTINGS, SAMPLE_PRODUCTS } from "./util.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const views = ["vSetup", "vLogin", "vNoAdmin", "vApp"];
const show = v => views.forEach(id => $("#" + id).hidden = id !== v);

let S = structuredClone(DEFAULT_SETTINGS);
let money = moneyFmt(S.currency);
let products = [];
let orders = [];
let unsub = [];

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600);
}
const fail = (e, what) => { console.error(e); toast(`${what} didn't save: ${e.code === "permission-denied" ? "this account isn't an admin" : (e.message || e)}`); };

// ───────── Auth ─────────
if (!configured) show("vSetup");
else {
  onAuthStateChanged(auth, async user => {
    unsub.forEach(u => u()); unsub = [];
    if (!user) { show("vLogin"); return; }
    try {
      const a = await getDoc(doc(db, "admins", user.uid));
      if (!a.exists()) { $("#myUid").textContent = user.uid; show("vNoAdmin"); return; }
    } catch (e) { $("#myUid").textContent = user.uid; show("vNoAdmin"); return; }
    show("vApp");
    start();
  });
}

$("#loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#lErr"); err.hidden = true;
  const email = $("#lEmail").value.trim(), pass = $("#lPass").value;
  if (!email || !pass) { err.textContent = "Enter your email and password."; err.hidden = false; return; }
  $("#lBtn").disabled = true;
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch (ex) {
    err.textContent = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(ex.code)
      ? "That email and password don't match. Try again or reset your password." : "Couldn't sign in: " + ex.message;
    err.hidden = false;
  } finally { $("#lBtn").disabled = false; }
});
$("#lReset")?.addEventListener("click", async () => {
  const email = $("#lEmail").value.trim(), err = $("#lErr");
  if (!email) { err.textContent = "Type your email first, then tap Forgot password."; err.hidden = false; return; }
  try { await sendPasswordResetEmail(auth, email); err.textContent = "Reset link sent. Check your email."; err.hidden = false; }
  catch (ex) { err.textContent = "Couldn't send reset email: " + ex.message; err.hidden = false; }
});
document.addEventListener("click", e => { if (e.target.closest("[data-signout]")) signOut(auth); });
$("#copyUid")?.addEventListener("click", () => navigator.clipboard?.writeText($("#myUid").textContent).then(() => toast("Copied")));

// ───────── Start ─────────
async function start() {
  try {
    const s = await getDoc(doc(db, "settings", "store"));
    if (s.exists()) S = { ...structuredClone(DEFAULT_SETTINGS), ...s.data() };
    else await setDoc(doc(db, "settings", "store"), S); // first run: save defaults
  } catch (e) { fail(e, "Settings"); }
  applySettings();
  unsub.push(onSnapshot(collection(db, "products"), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    products.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name).localeCompare(b.name));
    renderParts();
  }, e => fail(e, "Parts list")));
  unsub.push(onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(300)), snap => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrders();
  }, e => fail(e, "Orders list")));
}

function applySettings() {
  money = moneyFmt(S.currency || "₪");
  $("#aStore").textContent = S.name;
  const opts = S.categories.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
  $("#pCat").innerHTML = `<option value="all">All categories</option>` + opts;
  $("#eCat").innerHTML = opts;
  fillSettingsForm();
}
const catLabel = id => (S.categories.find(c => c.id === id) || {}).label || id || "—";

// ───────── Tabs ─────────
$$("[data-tab]").forEach(b => b.addEventListener("click", () => {
  $$("[data-tab]").forEach(x => x.setAttribute("aria-pressed", x === b));
  $("#tParts").hidden = b.dataset.tab !== "parts";
  $("#tOrders").hidden = b.dataset.tab !== "orders";
  $("#tSettings").hidden = b.dataset.tab !== "settings";
}));

// ───────── Parts list ─────────
["#pSearch", "#pCat", "#pShow"].forEach(s => $(s).addEventListener("input", renderParts));

function renderParts() {
  const units = products.reduce((n, p) => n + (p.stock || 0), 0);
  const value = products.reduce((n, p) => n + (p.stock || 0) * (p.price || 0), 0);
  const low = products.filter(p => p.stock > 0 && p.stock <= 3).length;
  const out = products.filter(p => !(p.stock > 0)).length;
  $("#stats").innerHTML = `<div><b>${products.length}</b><span>Parts</span></div><div><b>${units}</b><span>Units in stock</span></div>
    <div><b>${money(value)}</b><span>Stock value</span></div><div class="${low + out ? "warn" : ""}"><b>${low} / ${out}</b><span>Low / sold out</span></div>`;

  const q = $("#pSearch").value.trim().toLowerCase(), c = $("#pCat").value, f = $("#pShow").value;
  const list = products.filter(p =>
    (c === "all" || p.category === c) &&
    (f === "all" || (f === "low" && p.stock > 0 && p.stock <= 3) || (f === "out" && !(p.stock > 0)) || (f === "hidden" && p.visible === false)) &&
    (!q || [p.name, ...(p.specs || [])].join(" ").toLowerCase().includes(q)));

  if (!products.length) {
    $("#pList").innerHTML = `<div class="panel" style="width:100%"><h1 style="font-size:20px">No parts yet</h1>
      <p>Add your first part, import a CSV from a spreadsheet, or load a few sample parts to see how the shop looks.</p>
      <div class="savebar"><button class="primary" type="button" data-new>+ Add part</button><button class="ghost" type="button" id="loadSamples">Add sample parts</button></div></div>`;
    $("#loadSamples").onclick = loadSamples;
    return;
  }
  if (!list.length) { $("#pList").innerHTML = `<p class="empty">No parts match these filters.</p>`; return; }
  $("#pList").innerHTML = list.map(p => {
    const pill = p.visible === false ? `<span class="pill hid">Hidden</span>` : !(p.stock > 0) ? `<span class="pill out">Sold out</span>` : p.stock <= 3 ? `<span class="pill low">Low</span>` : "";
    return `<div class="prow ${p.visible === false ? "off" : ""}">
      <div class="pt">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : iconFor(p.category)}</div>
      <div class="pn"><b>${esc(p.name)}</b><small>${esc(catLabel(p.category))}${(p.specs || []).length ? " · " + esc(p.specs.join(" · ")) : ""}</small> ${pill}</div>
      <div class="pp">${money(p.price)}</div>
      <div class="acts">
        ${(p.options || []).length ? `<div class="ostk">${p.options.map(o => `<span>${esc(o.label)}</span>${stockStepper(p, o)}`).join("")}</div>` : stockStepper(p)}
        <button class="ghost" type="button" data-vis="${p.id}">${p.visible === false ? "Show" : "Hide"}</button>
        <button class="ghost" type="button" data-edit="${p.id}">Edit</button>
      </div></div>`;
  }).join("");
}

function stockStepper(p, o) {
  const n = (o ? o.stock : p.stock) || 0, opt = o ? ` data-opt="${esc(o.id)}"` : "";
  return `<div class="stepper sm" title="Stock"><button type="button" data-stock="-1" data-id="${p.id}"${opt} aria-label="Stock down" ${n > 0 ? "" : "disabled"}>−</button><output>${n}</output><button type="button" data-stock="1" data-id="${p.id}"${opt} aria-label="Stock up">+</button></div>`;
}
// Parts with options keep stock per option; the part's own stock is always their total.
const sumStock = opts => opts.reduce((n, o) => n + (o.stock || 0), 0);

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-stock],[data-vis],[data-edit],[data-new]");
  if (!t) return;
  if (t.dataset.stock) {
    const p = products.find(x => x.id === t.dataset.id), d = Number(t.dataset.stock);
    let data;
    if (t.dataset.opt) {
      const options = p.options.map(o => o.id === t.dataset.opt ? { ...o, stock: Math.max(0, (o.stock || 0) + d) } : o);
      data = { options, stock: sumStock(options) };
    } else data = { stock: Math.max(0, (p.stock || 0) + d) };
    updateDoc(doc(db, "products", p.id), { ...data, updatedAt: serverTimestamp() }).catch(er => fail(er, "Stock"));
  } else if (t.dataset.vis) {
    const p = products.find(x => x.id === t.dataset.vis);
    updateDoc(doc(db, "products", p.id), { visible: p.visible === false, updatedAt: serverTimestamp() })
      .then(() => toast(p.visible === false ? "Now showing in shop" : "Hidden from shop")).catch(er => fail(er, "Visibility"));
  } else if (t.dataset.edit) openEditor(products.find(x => x.id === t.dataset.edit));
  else if (t.hasAttribute("data-new")) openEditor(null);
});
$("#addBtn").addEventListener("click", () => openEditor(null));

async function loadSamples() {
  const b = writeBatch(db);
  SAMPLE_PRODUCTS.forEach((p, i) => b.set(doc(collection(db, "products")), {
    name: p.name, category: p.cat, specs: p.specs, price: p.price, stock: p.stock, description: "", image: "", visible: true, sort: i, updatedAt: serverTimestamp()
  }));
  try { await b.commit(); toast("Sample parts added. Edit or delete them any time."); } catch (e) { fail(e, "Sample parts"); }
}

// ───────── Editor ─────────
// The cover photo lives on the part itself (the shop grid needs only that); the other photos are
// stored one per document in products/{id}/photos and loaded when a customer opens the part.
const MAX_PHOTOS = 6;
let editing = null, photos = [], opts = [];
async function openEditor(p) {
  editing = p; photos = p?.image ? [p.image] : [];
  opts = (p?.options || []).map(o => ({ ...o }));
  $("#eTitle").textContent = p ? "Edit part" : "Add part";
  $("#eName").value = p?.name || "";
  $("#eCat").value = p?.category || S.categories[0]?.id || "other";
  $("#ePrice").value = p?.price ?? "";
  $("#eStock").value = p?.stock ?? 1;
  $("#eSort").value = p?.sort ?? 0;
  $("#eSpecs").value = (p?.specs || []).join(", ");
  $("#eDesc").value = p?.description || "";
  $("#eVisible").checked = p ? p.visible !== false : true;
  $("#eDelete").hidden = !p; disarm();
  $("#eErr").hidden = true;
  drawOpts();
  $("#editor").hidden = false; $("#scrim").hidden = false;
  setTimeout(() => $("#eName").focus(), 50);
  if (p?.photoCount > 0) {
    $("#eSave").disabled = true; drawPhotos(true);
    try {
      const snap = await getDocs(collection(db, "products", p.id, "photos"));
      if (editing === p) photos = [p.image, ...snap.docs.map(d => d.data()).sort((a, b) => a.i - b.i).map(x => x.data)];
    } catch (e) { fail(e, "Photos"); }
    if (editing === p) $("#eSave").disabled = false;
  }
  drawPhotos();
}
function closeEditor() { $("#editor").hidden = true; $("#importer").hidden = true; $("#scrim").hidden = true; }
function drawPhotos(loading) {
  $("#ePhotos").innerHTML = (photos.length ? photos : [""]).map((src, i) => src ? `<div class="ph"><img src="${src}" alt="">
      ${i ? "" : `<span class="cover">Cover</span>`}
      <div class="pa"><button type="button" data-pmove="${i}" data-d="-1" aria-label="Move earlier" ${i ? "" : "disabled"}>‹</button>
      <button type="button" data-pdel="${i}" aria-label="Remove photo">✕</button>
      <button type="button" data-pmove="${i}" data-d="1" aria-label="Move later" ${i < photos.length - 1 ? "" : "disabled"}>›</button></div></div>`
    : `<div class="ph">${iconFor($("#eCat").value)}</div>`).join("") +
    (loading ? `<div class="ph loading">Loading photos…</div>` : photos.length < MAX_PHOTOS
      ? `<label class="ph add" for="eFile">+ Add photo${photos.length ? "s" : ""}<input id="eFile" type="file" accept="image/*" multiple></label>` : "");
  $("#eFile")?.addEventListener("change", addPhotos);
}
$("#ePhotos").addEventListener("click", e => {
  const m = e.target.closest("[data-pmove]"), d = e.target.closest("[data-pdel]");
  if (m) { const i = +m.dataset.pmove, j = i + +m.dataset.d; [photos[i], photos[j]] = [photos[j], photos[i]]; drawPhotos(); }
  if (d) { photos.splice(+d.dataset.pdel, 1); drawPhotos(); }
});
$("#eCat").addEventListener("change", () => { if (!photos.length) drawPhotos(); });
$$("[data-closeed]").forEach(b => b.addEventListener("click", closeEditor));
$("#scrim").addEventListener("click", closeEditor);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeEditor(); });

async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const max = 800, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    let q = 0.82, data = c.toDataURL("image/jpeg", q);
    while (data.length > 200000 && q > 0.4) { q -= 0.08; data = c.toDataURL("image/jpeg", q); }
    return data;
  } finally { URL.revokeObjectURL(url); }
}
async function addPhotos(e) {
  const files = [...e.target.files], room = MAX_PHOTOS - photos.length;
  let bad = 0;
  for (const f of files.slice(0, room)) { try { photos.push(await resizeImage(f)); } catch { bad++; } }
  drawPhotos();
  const msg = [bad && "Some files couldn't be read as photos. Try JPG or PNG.", files.length > room && `Only ${MAX_PHOTOS} photos per part; the extra ones were skipped.`].filter(Boolean).join(" ");
  $("#eErr").textContent = msg; $("#eErr").hidden = !msg;
}

// Options (e.g. CW / CCW), each with its own stock.
function drawOpts() {
  $("#eOpts").innerHTML = opts.map((o, i) => `<div class="optrow">
    <input data-olabel="${i}" value="${esc(o.label)}" placeholder="${i ? "CCW" : "CW"}" aria-label="Option name" maxlength="40">
    <input data-ostock="${i}" value="${o.stock ?? 0}" type="number" min="0" step="1" inputmode="numeric" aria-label="Stock for this option">
    <button type="button" data-odelopt="${i}" aria-label="Remove option">✕</button></div>`).join("");
  syncStock();
}
function syncStock() {
  const on = opts.length > 0;
  $("#eStock").disabled = on; $("#eStockNote").hidden = !on;
  if (on) $("#eStock").value = sumStock(opts.map(o => ({ stock: parseInt(o.stock, 10) || 0 })));
}
$("#eOpts").addEventListener("input", e => {
  const l = e.target.dataset.olabel, n = e.target.dataset.ostock;
  if (l !== undefined) opts[l].label = e.target.value;
  if (n !== undefined) { opts[n].stock = e.target.value; syncStock(); }
});
$("#eOpts").addEventListener("click", e => { const d = e.target.closest("[data-odelopt]"); if (d) { opts.splice(+d.dataset.odelopt, 1); drawOpts(); } });
$("#eAddOpt").addEventListener("click", () => {
  // The first option inherits the part's current stock so nothing is lost.
  opts.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label: "", stock: opts.length ? 0 : parseInt($("#eStock").value, 10) || 0 });
  drawOpts(); $(`[data-olabel="${opts.length - 1}"]`).focus();
});

$("#eForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#eErr"); err.hidden = true;
  const name = $("#eName").value.trim(), price = parseFloat($("#ePrice").value);
  const options = opts.map(o => ({ id: o.id, label: o.label.trim(), stock: parseInt(o.stock, 10) }));
  const stock = options.length ? sumStock(options) : parseInt($("#eStock").value, 10);
  const say = m => { err.textContent = m; err.hidden = false; };
  if (!name) return say("Give the part a name.");
  if (!(price >= 0)) return say("Enter a price (0 or more).");
  if (options.some(o => !o.label)) return say("Give every option a name, or remove the empty one.");
  if (new Set(options.map(o => o.label.toLowerCase())).size !== options.length) return say("Two options have the same name.");
  if (options.some(o => !(o.stock >= 0))) return say("Enter the stock for every option (0 or more).");
  if (!(stock >= 0)) return say("Enter how many are in stock (0 or more).");
  const ref = editing ? doc(db, "products", editing.id) : doc(collection(db, "products"));
  const oldCount = editing?.photoCount || 0, newCount = Math.max(0, photos.length - 1);
  const b = writeBatch(db);
  b.set(ref, {
    name, price, stock, options,
    category: $("#eCat").value,
    sort: parseInt($("#eSort").value, 10) || 0,
    specs: $("#eSpecs").value.split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 12),
    description: $("#eDesc").value.trim(),
    visible: $("#eVisible").checked,
    image: photos[0] || "",
    photoCount: newCount,
    updatedAt: serverTimestamp()
  }, { merge: true });
  photos.slice(1).forEach((data, j) => b.set(doc(ref, "photos", String(j + 1)), { i: j + 1, data }));
  for (let j = newCount + 1; j <= oldCount; j++) b.delete(doc(ref, "photos", String(j)));
  $("#eSave").disabled = true;
  try {
    await b.commit();
    toast(editing ? "Part saved" : "Part added");
    closeEditor();
  } catch (ex) { fail(ex, "Part"); }
  finally { $("#eSave").disabled = false; }
});

let armed = false;
function disarm() { armed = false; $("#eDelete").classList.remove("armed"); $("#eDelete").textContent = "Delete"; }
$("#eDelete").addEventListener("click", async () => {
  if (!armed) { armed = true; $("#eDelete").classList.add("armed"); $("#eDelete").textContent = "Tap again to delete"; setTimeout(disarm, 4000); return; }
  const ref = doc(db, "products", editing.id), b = writeBatch(db);
  for (let j = 1; j <= (editing.photoCount || 0); j++) b.delete(doc(ref, "photos", String(j)));
  b.delete(ref);
  try { await b.commit(); toast("Part deleted"); closeEditor(); } catch (e) { fail(e, "Delete"); }
});

// ───────── Orders ─────────
// New → Pending takes the stock out right away so the shop can't oversell it.
// Pending → Sold is final. Pending → Cancelled (or deleting a pending order) puts the stock back.
// stockApplied on an order means its quantities are currently out of stock.
$("#oShow").addEventListener("input", renderOrders);
const fmtDate = ts => ts?.toDate ? ts.toDate().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "just now";
const STATUS = { new: "New", pending: "Pending", confirmed: "Confirmed", done: "Sold", cancelled: "Cancelled" };
const OPEN = ["new", "pending", "confirmed"];

function renderOrders() {
  const n = orders.filter(o => o.status === "new").length;
  $("#newCount").hidden = !n; $("#newCount").textContent = n;
  const f = $("#oShow").value;
  const list = orders.filter(o => f === "all" || (f === "open" ? OPEN.includes(o.status) : o.status === f));
  if (!list.length) { $("#oList").innerHTML = `<p class="empty">${orders.length ? "No orders with this status." : "No orders yet. They'll appear here when customers send their cart on WhatsApp."}</p>`; return; }
  $("#oList").innerHTML = list.map(o => {
    const c = o.customer || {};
    const acts = [], btn = (cls, attrs, label) => acts.push(`<button class="${cls}" type="button" ${attrs} data-oid="${o.id}">${label}</button>`);
    if (o.status === "new") {
      btn("primary", `data-oact="hold"`, "Pending · hold stock");
      btn("ghost", `data-oact="sold"`, "Mark sold");
      btn("ghost", `data-oact="cancel"`, "Cancel");
    } else if (o.status === "pending" || o.status === "confirmed") {
      btn("primary", `data-oact="sold"`, "Mark sold · final");
      btn("ghost", `data-oact="cancel"`, o.stockApplied ? "Cancel · return stock" : "Cancel");
    } else if (o.status === "cancelled" && !o.stockApplied) btn("ghost", `data-oact="reopen"`, "Reopen");
    if (o.status !== "cancelled") btn("ghost", `data-print`, "🖨 Print label");
    btn("ghost", `data-oact="delete"`, "Delete");
    const note = o.stockApplied ? (o.status === "done" ? "Sold · stock taken out." : "Stock is held for this order.") : "";
    return `<article class="order s-${esc(o.status)}">
      <div class="oh"><b>${esc(o.number || o.id.slice(0, 6))}</b><span class="st ${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span><span class="note">${fmtDate(o.createdAt)}</span><span class="t">${money(o.total)}</span></div>
      <div class="who">${esc(c.name || "—")}${c.phone ? ` <span>· <a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a></span>` : ""}${c.city ? ` <span>· ${esc(c.city)}</span>` : ""}${c.address ? `<br><span dir="auto">${esc(c.address)}, ${esc(c.city || "")}</span>` : ""}${c.note ? `<br><span>“${esc(c.note)}”</span>` : ""}</div>
      <table>${(o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td class="n">× ${i.qty}</td><td class="n">${money(i.price * i.qty)}</td></tr>`).join("")}${o.shipping ? `<tr><td>Shipping</td><td></td><td class="n">${money(o.shipping)}</td></tr>` : ""}</table>
      ${note ? `<span class="note">${note}</span>` : ""}
      <div class="oa">${acts.join("")}</div></article>`;
  }).join("");
}

// Adds the stock changes for an order to a batch: sign -1 takes stock out, +1 puts it back.
// Items of the same part (e.g. CW and CCW) are combined into one update.
function stockChanges(b, o, sign) {
  const next = {}, missing = [];
  for (const i of o.items || []) {
    const p = next[i.id] || (() => { const x = products.find(x => x.id === i.id); return x && { ...x, options: (x.options || []).map(o => ({ ...o })) }; })();
    if (!p) { missing.push(i.name); continue; }
    next[i.id] = p;
    if (i.option) {
      const op = p.options.find(x => x.id === i.option);
      if (!op) { missing.push(i.name); continue; }
      op.stock = Math.max(0, (op.stock || 0) + sign * i.qty);
    } else if (p.options.length) missing.push(i.name); // ordered before the part had options
    else p.stock = Math.max(0, (p.stock || 0) + sign * i.qty);
  }
  for (const p of Object.values(next)) {
    const stock = p.options.length ? sumStock(p.options) : p.stock;
    b.update(doc(db, "products", p.id), { stock, ...(p.options.length ? { options: p.options } : {}), updatedAt: serverTimestamp() });
  }
  return missing;
}

const armedDel = new Set();
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-oact]"); if (!t) return;
  const o = orders.find(x => x.id === t.dataset.oid), act = t.dataset.oact, ref = doc(db, "orders", o.id);
  try {
    if (act === "delete" && !armedDel.has(o.id)) {
      armedDel.add(o.id); t.textContent = "Tap again to delete"; t.classList.add("danger");
      setTimeout(() => { armedDel.delete(o.id); renderOrders(); }, 4000); return;
    }
    const b = writeBatch(db);
    let missing = [], msg;
    if (act === "hold") {
      missing = stockChanges(b, o, -1); b.update(ref, { status: "pending", stockApplied: true }); msg = "Pending · stock held";
    } else if (act === "sold") {
      if (!o.stockApplied) missing = stockChanges(b, o, -1);
      b.update(ref, { status: "done", stockApplied: true }); msg = "Marked sold";
    } else if (act === "cancel") {
      if (o.stockApplied) missing = stockChanges(b, o, 1);
      b.update(ref, { status: "cancelled", stockApplied: false }); msg = o.stockApplied ? "Cancelled · stock returned" : "Order cancelled";
    } else if (act === "reopen") {
      b.update(ref, { status: "new" }); msg = "Order reopened";
    } else if (act === "delete") {
      // A pending order's held stock goes back; a sold order's stays out.
      if (o.stockApplied && o.status !== "done") missing = stockChanges(b, o, 1);
      b.delete(ref); msg = "Order deleted";
    }
    await b.commit();
    toast(missing.length ? `${msg}. Not in catalog anymore: ${missing.join(", ")}` : msg);
    if (act === "hold" && labelPrefs().auto) printLabel(o);
  } catch (ex) { fail(ex, "Order"); }
});

// ───────── Shipping labels ─────────
// Printed through the browser's print dialog, so any printer the phone or computer can reach works
// (AirPrint, network printers, label printers with a driver). Size and auto-print are per device.
const PAGE = { "100x150": "size:100mm 150mm;margin:0", a6: "size:A6;margin:0", a4: "size:A4;margin:10mm" };
function labelPrefs() {
  let size = "100x150", auto = true;
  try { size = localStorage.getItem("pw_label_size") || size; auto = localStorage.getItem("pw_label_auto") !== "0"; } catch {}
  return { size: PAGE[size] ? size : "100x150", auto };
}
function labelHTML(o) {
  const c = o.customer || {}, items = o.items || [], shown = items.slice(0, 9);
  const pieces = items.reduce((n, i) => n + (i.qty || 0), 0);
  const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
  return `<div class="label">
    <div class="lh"><div><b>${esc(S.name)}</b><small class="from">${esc("+" + (S.whatsapp || ""))}</small></div>
      <div class="no">${esc(o.number || o.id.slice(0, 6))}<small>${date.toLocaleDateString("en-GB")}</small></div></div>
    <div class="to"><span class="k">To · אל · إلى</span>
      <span class="nm" dir="auto">${esc(c.name || "—")}</span>
      ${c.phone ? `<span class="tel" dir="ltr">${esc(c.phone)}</span>` : ""}
      ${c.address ? `<span class="ad" dir="auto">${esc(c.address)}</span>` : ""}
      <span class="ct" dir="auto">${esc(c.city || "")}</span></div>
    <div class="items"><span class="k">Contents · ${pieces} pcs</span>
      ${shown.map(i => `<div dir="auto">${i.qty} × ${esc(i.name)}</div>`).join("")}
      ${items.length > shown.length ? `<div>+ ${items.length - shown.length} more</div>` : ""}</div>
    ${c.note ? `<div class="note-l" dir="auto">${esc(c.note.slice(0, 160))}</div>` : ""}
    <div class="lf"><span>${esc(S.name)} · ${esc("+" + (S.whatsapp || ""))}</span><span class="big">${esc(o.number || "")}</span></div>
  </div>`;
}
function printLabel(o) {
  $("#printArea").innerHTML = labelHTML(o);
  let st = $("#pageSize");
  if (!st) { st = document.createElement("style"); st.id = "pageSize"; document.head.append(st); }
  st.textContent = `@media print{@page{${PAGE[labelPrefs().size]}}}`;
  // Give the browser a moment to lay out the label (and load fonts) before the dialog opens.
  document.fonts.ready.then(() => setTimeout(() => window.print(), 50));
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-print]"); if (!b) return;
  const o = orders.find(x => x.id === b.dataset.oid); if (o) printLabel(o);
});
$("#lSize").addEventListener("change", e => { try { localStorage.setItem("pw_label_size", e.target.value); } catch {} });
$("#lAuto").addEventListener("change", e => { try { localStorage.setItem("pw_label_auto", e.target.checked ? "1" : "0"); } catch {} });
$("#lTest").addEventListener("click", () => printLabel({
  id: "test", number: "PW-TEST1", items: [{ name: "2207 Freestyle Motor 1950KV", qty: 4 }, { name: "Propeller Mounting Plate Kit — CW", qty: 1 }],
  customer: { name: "خالد سباعي", phone: "050-123-4567", address: "شارع الجبل 12", city: "حيفا", note: "" }
}));

// ───────── Settings ─────────
let catDraft = [];
function fillSettingsForm() {
  $("#sName").value = S.name; $("#sTag").value = S.tagline || ""; $("#sIntro").value = S.intro || "";
  $("#sWa").value = S.whatsapp || ""; $("#sCur").value = S.currency || "₪"; $("#sShip").value = S.shipping ?? 70;
  const lp = labelPrefs(); $("#lSize").value = lp.size; $("#lAuto").checked = lp.auto;
  catDraft = S.categories.map(c => ({ ...c }));
  renderCats();
}
function renderCats() {
  $("#catRows").innerHTML = catDraft.map((c, i) => {
    const n = products.filter(p => p.category === c.id).length;
    return `<div class="catrow"><button type="button" data-up="${i}" aria-label="Move up" ${i ? "" : "disabled"}>↑</button>
      <input id="cat_${esc(c.id)}" value="${esc(c.label)}" data-ci="${i}" aria-label="Category name">
      <small title="parts in this category">${n}</small>
      <button type="button" data-delcat="${i}" aria-label="Remove category" ${n ? "disabled title='Move its parts to another category first'" : ""}>✕</button></div>`;
  }).join("");
}
$("#catRows").addEventListener("input", e => { if (e.target.dataset.ci) catDraft[e.target.dataset.ci].label = e.target.value; });
$("#catRows").addEventListener("click", e => {
  const up = e.target.closest("[data-up]"), del = e.target.closest("[data-delcat]");
  if (up) { const i = +up.dataset.up; [catDraft[i - 1], catDraft[i]] = [catDraft[i], catDraft[i - 1]]; renderCats(); }
  if (del) { catDraft.splice(+del.dataset.delcat, 1); renderCats(); }
});
$("#addCat").addEventListener("click", () => {
  let id = "cat-" + Date.now().toString(36);
  catDraft.push({ id, label: "New category" }); renderCats();
  $(`#cat_${id}`)?.select();
});
$("#sForm").addEventListener("submit", async e => {
  e.preventDefault();
  const wa = $("#sWa").value.replace(/\D/g, "").replace(/^0+/, "");
  if (!$("#sName").value.trim()) { $("#sMsg").textContent = "Store name can't be empty."; return; }
  if (wa.length < 8) { $("#sMsg").textContent = "Enter the WhatsApp number with country code, e.g. 972515100532."; return; }
  const next = {
    name: $("#sName").value.trim(), tagline: $("#sTag").value.trim(), intro: $("#sIntro").value.trim(),
    whatsapp: wa, currency: $("#sCur").value.trim() || "₪", shipping: Math.max(0, parseFloat($("#sShip").value) || 0),
    categories: catDraft.map(c => ({ id: c.id, label: c.label.trim() || c.id }))
  };
  try { await setDoc(doc(db, "settings", "store"), next); S = next; applySettings(); $("#sMsg").textContent = ""; toast("Settings saved"); }
  catch (ex) { fail(ex, "Settings"); }
});

// ───────── CSV import ─────────
let parsed = [];
$("#importBtn").addEventListener("click", () => { $("#importer").hidden = false; $("#scrim").hidden = false; });
$$("[data-closeim]").forEach(b => b.addEventListener("click", closeEditor));
$("#iFile").addEventListener("change", async e => { const f = e.target.files[0]; if (f) { $("#iText").value = await f.text(); preview(); } });
$("#iText").addEventListener("input", preview);

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  const delim = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function preview() {
  const err = $("#iErr"); err.hidden = true; parsed = [];
  const rows = parseCSV($("#iText").value.replace(/^﻿/, ""));
  if (rows.length < 2) { $("#iPreview").textContent = ""; $("#iGo").disabled = true; return; }
  const h = rows[0].map(x => x.trim().toLowerCase());
  const col = k => h.findIndex(x => x === k || x.startsWith(k));
  const ix = { name: col("name"), category: col("cat"), price: col("price"), stock: Math.max(col("stock"), col("qty"), col("quantity")), specs: col("spec"), description: col("desc") };
  if (ix.name < 0 || ix.price < 0) { err.textContent = "The first row needs at least a “name” and a “price” column."; err.hidden = false; $("#iGo").disabled = true; return; }
  let bad = 0;
  for (const r of rows.slice(1)) {
    const name = (r[ix.name] || "").trim(), price = parseFloat(String(r[ix.price] || "").replace(/[^\d.]/g, ""));
    if (!name || !(price >= 0)) { bad++; continue; }
    parsed.push({
      name, price,
      stock: ix.stock >= 0 ? Math.max(0, parseInt(r[ix.stock], 10) || 0) : 1,
      catLabel: ix.category >= 0 ? (r[ix.category] || "").trim() : "",
      specs: ix.specs >= 0 ? (r[ix.specs] || "").split(/[;|]/).map(s => s.trim()).filter(Boolean) : [],
      description: ix.description >= 0 ? (r[ix.description] || "").trim() : ""
    });
  }
  $("#iPreview").innerHTML = `Ready to import <b>${parsed.length}</b> part${parsed.length === 1 ? "" : "s"}${bad ? ` · ${bad} row${bad === 1 ? "" : "s"} skipped (missing name or price)` : ""}.` +
    (parsed.length ? `<br>First: ${esc(parsed[0].name)} · ${money(parsed[0].price)} · ${parsed[0].stock} in stock` : "");
  $("#iGo").disabled = !parsed.length;
}
$("#iGo").addEventListener("click", async () => {
  $("#iGo").disabled = true;
  const cats = S.categories.map(c => ({ ...c }));
  const resolve = label => {
    if (!label) return "other";
    const l = label.toLowerCase();
    let c = cats.find(c => c.id === l || c.label.toLowerCase() === l);
    if (!c) { c = { id: slug(label), label }; if (cats.some(x => x.id === c.id)) c.id += "-" + cats.length; cats.push(c); }
    return c.id;
  };
  if (!cats.some(c => c.id === "other")) cats.push({ id: "other", label: "Other" });
  try {
    for (let i = 0; i < parsed.length; i += 400) {
      const b = writeBatch(db);
      parsed.slice(i, i + 400).forEach((p, j) => b.set(doc(collection(db, "products")), {
        name: p.name, price: p.price, stock: p.stock, category: resolve(p.catLabel), specs: p.specs.slice(0, 12),
        description: p.description, image: "", visible: true, sort: products.length + i + j, updatedAt: serverTimestamp()
      }));
      await b.commit();
    }
    if (cats.length !== S.categories.length) { S = { ...S, categories: cats }; await setDoc(doc(db, "settings", "store"), S); applySettings(); }
    toast(`Imported ${parsed.length} parts`);
    $("#iText").value = ""; $("#iFile").value = ""; preview(); closeEditor();
  } catch (e) { fail(e, "Import"); $("#iGo").disabled = false; }
});
