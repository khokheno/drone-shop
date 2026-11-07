export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const slug = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
export const moneyFmt = cur => n => cur + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const DEFAULT_SETTINGS = {
  name: "PropWash Parts",
  tagline: "Brand-new FPV and DJI parts, ready to ship",
  intro: "Fill your cart, then send the order to us on WhatsApp. We confirm stock and arrange payment and delivery in the chat.",
  whatsapp: "972515100532",
  currency: "₪",
  shipping: 70,
  // Part types. Brand (and the models it fits) is a separate filter, so one category can hold parts for any brand.
  categories: [
    { id: "boards", label: "Boards & ESC" },
    { id: "sensors", label: "Sensors, vision & GPS" },
    { id: "body", label: "Body, antennas & lights" },
    { id: "cables", label: "Flex & cables" },
    { id: "motors", label: "Motors & props" },
    { id: "remote", label: "Remote controller" },
    { id: "gimbal", label: "Gimbal & camera" },
    { id: "batteries", label: "Batteries & chargers" },
    { id: "video", label: "Cameras & VTX" },
    { id: "frames", label: "Frames" },
    { id: "stack", label: "FC & ESC" },
    { id: "radio", label: "Receivers" },
    { id: "other", label: "Other" }
  ],
  // The drone brand a part is for, and that brand's models. Parts store the brand id and a list of model ids.
  brands: [
    { id: "dji", label: "DJI", models: [
      { id: "p3", label: "Phantom 3" }, { id: "p4", label: "Phantom 4" }, { id: "p4pro", label: "Phantom 4 Pro" },
      { id: "p4prov2", label: "Phantom 4 Pro V2.0" }, { id: "p4adv", label: "Phantom 4 Advanced" }, { id: "p4rtk", label: "Phantom 4 RTK" },
      { id: "fpv", label: "FPV / O4" }
    ] }
  ]
};

export const SAMPLE_PRODUCTS = [
  { cat:"motors", name:"2207 Freestyle Motor 1950KV", specs:["2207","1950KV","6S","5\""], price:85, stock:12 },
  { cat:"motors", name:"5.1×3 Tri-Blade Props, 2 sets", specs:["5.1\"","3-blade","T-mount"], price:18, stock:40 },
  { cat:"frames", name:"5\" Freestyle Frame 225mm", specs:["225mm","5mm arms","30×30"], price:220, stock:5 },
  { cat:"stack", name:"F7 Flight Controller", specs:["F722","30×30","Betaflight"], price:210, stock:6 },
  { cat:"radio", name:"ExpressLRS 2.4GHz Receiver", specs:["ELRS","2.4GHz","nano"], price:60, stock:20 },
  { cat:"batteries", name:"6S 1300mAh LiPo", specs:["6S","1300mAh","XT60"], price:150, stock:10 },
  { cat:"motors", brand:"dji", name:"DJI Mini 4 Pro Propellers", specs:["Mini 4 Pro","2 pairs"], price:45, stock:15 },
  { cat:"video", brand:"dji", models:["fpv"], name:"DJI O3 Air Unit", specs:["O3","4K/60","Digital"], price:890, stock:2 }
];

export const ICONS = {
  motors:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="5"/><path d="M32 12v8M32 44v8M12 32h8M44 32h8M18 18l5 5M41 41l5 5M46 18l-5 5M23 41l-5 5"/></svg>',
  props:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="32" cy="32" r="4"/><path d="M32 28C30 16 34 8 40 8c2 8-2 16-8 20zM35 34c11 4 15 11 12 16-8-2-13-9-12-16zM29 34c-9 7-17 8-20 3 5-6 13-8 20-3z"/></svg>',
  frames:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 14l36 36M50 14L14 50"/><rect x="24" y="24" width="16" height="16" rx="3"/><circle cx="14" cy="14" r="5"/><circle cx="50" cy="14" r="5"/><circle cx="14" cy="50" r="5"/><circle cx="50" cy="50" r="5"/></svg>',
  stack:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="14" y="14" width="36" height="36" rx="3"/><rect x="24" y="24" width="16" height="16"/><circle cx="19" cy="19" r="1.8"/><circle cx="45" cy="19" r="1.8"/><circle cx="19" cy="45" r="1.8"/><circle cx="45" cy="45" r="1.8"/><path d="M28 14V8M36 14V8M28 56v-6M36 56v-6"/></svg>',
  video:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="12" y="18" width="30" height="28" rx="4"/><circle cx="27" cy="32" r="8"/><path d="M42 26l10-5v22l-10-5"/></svg>',
  radio:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="22" y="30" width="20" height="20" rx="2"/><path d="M32 30V14"/><path d="M24 14a11 11 0 0 1 16 0M19 9a18 18 0 0 1 26 0"/></svg>',
  batteries:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="10" y="20" width="40" height="24" rx="3"/><path d="M50 28h4v8h-4M18 28v8M26 28v8M34 28v8"/></svg>',
  dji:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="24" y="26" width="16" height="12" rx="3"/><path d="M24 28L12 18M40 28l12-10M24 36L12 46M40 36l12 10"/><ellipse cx="12" cy="18" rx="8" ry="2.5"/><ellipse cx="52" cy="18" rx="8" ry="2.5"/><ellipse cx="12" cy="46" rx="8" ry="2.5"/><ellipse cx="52" cy="46" rx="8" ry="2.5"/></svg>',
  other:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22l20-10 20 10v20L32 52 12 42z"/><path d="M12 22l20 10 20-10M32 32v20"/></svg>'
};
// Part types without their own drawing borrow the closest one.
const ICON_ALIAS = { boards: "stack", sensors: "video", gimbal: "video", remote: "radio", cables: "stack", body: "dji" };
export const iconFor = cat => ICONS[cat] || ICONS[ICON_ALIAS[cat]] || ICONS.other;
