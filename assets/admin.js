import {
  configured, db, auth, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, writeBatch, increment, serverTimestamp, onSnapshot,
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
        <div class="stepper sm" title="Stock"><button type="button" data-stock="-1" data-id="${p.id}" aria-label="Stock down" ${!(p.stock > 0) ? "disabled" : ""}>−</button><output>${p.stock || 0}</output><button type="button" data-stock="1" data-id="${p.id}" aria-label="Stock up">+</button></div>
        <button class="ghost" type="button" data-vis="${p.id}">${p.visible === false ? "Show" : "Hide"}</button>
        <button class="ghost" type="button" data-edit="${p.id}">Edit</button>
      </div></div>`;
  }).join("");
}

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-stock],[data-vis],[data-edit],[data-new]");
  if (!t) return;
  if (t.dataset.stock) {
    const p = products.find(x => x.id === t.dataset.id);
    const next = Math.max(0, (p.stock || 0) + Number(t.dataset.stock));
    updateDoc(doc(db, "products", p.id), { stock: next, updatedAt: serverTimestamp() }).catch(er => fail(er, "Stock"));
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
let editing = null, photo = "";
function openEditor(p) {
  editing = p; photo = p?.image || "";
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
  $("#eErr").hidden = true; $("#eFile").value = "";
  drawPhoto();
  $("#editor").hidden = false; $("#scrim").hidden = false;
  setTimeout(() => $("#eName").focus(), 50);
}
function closeEditor() { $("#editor").hidden = true; $("#importer").hidden = true; $("#scrim").hidden = true; }
function drawPhoto() {
  $("#ePhoto").innerHTML = photo ? `<img src="${photo}" alt="">` : iconFor($("#eCat").value);
  $("#eRemovePhoto").hidden = !photo;
}
$("#eCat").addEventListener("change", () => { if (!photo) drawPhoto(); });
$$("[data-closeed]").forEach(b => b.addEventListener("click", closeEditor));
$("#scrim").addEventListener("click", closeEditor);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeEditor(); });
$("#eRemovePhoto").addEventListener("click", () => { photo = ""; drawPhoto(); });

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
$("#eFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try { photo = await resizeImage(f); drawPhoto(); }
  catch { $("#eErr").textContent = "That file couldn't be read as a photo. Try a JPG or PNG."; $("#eErr").hidden = false; }
});

$("#eForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#eErr"); err.hidden = true;
  const name = $("#eName").value.trim(), price = parseFloat($("#ePrice").value), stock = parseInt($("#eStock").value, 10);
  if (!name) { err.textContent = "Give the part a name."; err.hidden = false; return; }
  if (!(price >= 0)) { err.textContent = "Enter a price (0 or more)."; err.hidden = false; return; }
  if (!(stock >= 0)) { err.textContent = "Enter how many are in stock (0 or more)."; err.hidden = false; return; }
  const data = {
    name, price, stock,
    category: $("#eCat").value,
    sort: parseInt($("#eSort").value, 10) || 0,
    specs: $("#eSpecs").value.split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 12),
    description: $("#eDesc").value.trim(),
    visible: $("#eVisible").checked,
    image: photo,
    updatedAt: serverTimestamp()
  };
  $("#eSave").disabled = true;
  try {
    if (editing) await setDoc(doc(db, "products", editing.id), data, { merge: true });
    else await addDoc(collection(db, "products"), data);
    toast(editing ? "Part saved" : "Part added");
    closeEditor();
  } catch (ex) { fail(ex, "Part"); }
  finally { $("#eSave").disabled = false; }
});

let armed = false;
function disarm() { armed = false; $("#eDelete").classList.remove("armed"); $("#eDelete").textContent = "Delete"; }
$("#eDelete").addEventListener("click", async () => {
  if (!armed) { armed = true; $("#eDelete").classList.add("armed"); $("#eDelete").textContent = "Tap again to delete"; setTimeout(disarm, 4000); return; }
  try { await deleteDoc(doc(db, "products", editing.id)); toast("Part deleted"); closeEditor(); } catch (e) { fail(e, "Delete"); }
});

// ───────── Orders ─────────
$("#oShow").addEventListener("input", renderOrders);
const fmtDate = ts => ts?.toDate ? ts.toDate().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "just now";
const STATUS = { new: "New", confirmed: "Confirmed", done: "Completed", cancelled: "Cancelled" };

function renderOrders() {
  const n = orders.filter(o => o.status === "new").length;
  $("#newCount").hidden = !n; $("#newCount").textContent = n;
  const f = $("#oShow").value;
  const list = orders.filter(o => f === "all" || (f === "open" ? ["new", "confirmed"].includes(o.status) : o.status === f));
  if (!list.length) { $("#oList").innerHTML = `<p class="empty">${orders.length ? "No orders with this status." : "No orders yet. They'll appear here when customers send their cart on WhatsApp."}</p>`; return; }
  $("#oList").innerHTML = list.map(o => {
    const c = o.customer || {};
    const acts = [];
    if (o.status === "new") acts.push(`<button class="primary" type="button" data-ost="confirmed" data-oid="${o.id}">Confirm</button>`);
    if (["new", "confirmed"].includes(o.status)) {
      acts.push(`<button class="primary" type="button" data-sold="${o.id}">Mark sold · take from stock</button>`);
      acts.push(`<button class="ghost" type="button" data-ost="cancelled" data-oid="${o.id}">Cancel</button>`);
    }
    if (["done", "cancelled"].includes(o.status) && !o.stockApplied) acts.push(`<button class="ghost" type="button" data-ost="new" data-oid="${o.id}">Reopen</button>`);
    acts.push(`<button class="ghost" type="button" data-odel="${o.id}">Delete</button>`);
    return `<article class="order s-${esc(o.status)}">
      <div class="oh"><b>${esc(o.number || o.id.slice(0, 6))}</b><span class="st ${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span><span class="note">${fmtDate(o.createdAt)}</span><span class="t">${money(o.total)}</span></div>
      <div class="who">${esc(c.name || "—")}${c.city ? ` <span>· ${esc(c.city)}</span>` : ""}${c.note ? `<br><span>“${esc(c.note)}”</span>` : ""}</div>
      <table>${(o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td class="n">× ${i.qty}</td><td class="n">${money(i.price * i.qty)}</td></tr>`).join("")}</table>
      ${o.stockApplied ? `<span class="note">Stock already taken for this order.</span>` : ""}
      <div class="oa">${acts.join("")}</div></article>`;
  }).join("");
}

const armedDel = new Set();
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-ost],[data-sold],[data-odel]"); if (!t) return;
  try {
    if (t.dataset.ost) { await updateDoc(doc(db, "orders", t.dataset.oid), { status: t.dataset.ost }); toast("Order " + STATUS[t.dataset.ost].toLowerCase()); }
    else if (t.dataset.sold) {
      const o = orders.find(x => x.id === t.dataset.sold);
      const b = writeBatch(db);
      const missing = [];
      for (const i of o.items || []) {
        const p = products.find(x => x.id === i.id);
        if (!p) { missing.push(i.name); continue; }
        b.update(doc(db, "products", p.id), { stock: Math.max(0, (p.stock || 0) - i.qty), updatedAt: serverTimestamp() });
      }
      b.update(doc(db, "orders", o.id), { status: "done", stockApplied: true });
      await b.commit();
      toast(missing.length ? `Marked sold. Not in catalog anymore: ${missing.join(", ")}` : "Marked sold and stock updated");
    } else if (t.dataset.odel) {
      const id = t.dataset.odel;
      if (!armedDel.has(id)) { armedDel.add(id); t.textContent = "Tap again to delete"; t.classList.add("danger"); setTimeout(() => { armedDel.delete(id); renderOrders(); }, 4000); return; }
      await deleteDoc(doc(db, "orders", id)); toast("Order deleted");
    }
  } catch (ex) { fail(ex, "Order"); }
});

// ───────── Settings ─────────
let catDraft = [];
function fillSettingsForm() {
  $("#sName").value = S.name; $("#sTag").value = S.tagline || ""; $("#sIntro").value = S.intro || "";
  $("#sWa").value = S.whatsapp || ""; $("#sCur").value = S.currency || "₪";
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
    whatsapp: wa, currency: $("#sCur").value.trim() || "₪",
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
