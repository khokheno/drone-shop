// Shop translations. Arabic is the default, then Hebrew, then English.
import { DEFAULT_SETTINGS } from "./util.js";

export const LANGS = [
  { id: "ar", label: "عربي", dir: "rtl" },
  { id: "he", label: "עברית", dir: "rtl" },
  { id: "en", label: "EN", dir: "ltr" }
];

const T = {
  ar: {
    subtotal: "المجموع الفرعي", shipping: "التوصيل", address: "الشارع ورقم البيت", mAddress: "العنوان", addressErr: "اكتب عنوان التوصيل (الشارع ورقم البيت).",
    choose: "اختر", pickOption: "اختر النوع:", prevPhoto: "الصورة السابقة", nextPhoto: "الصورة التالية", photo: n => `صورة ${n}`,
    phone: "رقم الهاتف", mPhone: "الهاتف",
    phoneErr: "أدخل رقم هاتف صحيح، مثل 050-1234567.", cityErr: "اكتب مدينتك أو بلدتك.",
    sub: "FPV · DJI · قطع غيار", used: "مستعمل", footerMixed: "كل قطعة مكتوب عليها إن كانت جديدة أو مستعملة. يتم ترتيب الدفع والتوصيل عبر واتساب.",
    searchPh: "ابحث: 2207، ELRS، Avata…", searchLabel: "ابحث عن قطع", catsLabel: "الفئات", langLabel: "اللغة",
    tagline: "قطع FPV و DJI جاهزة للشحن",
    intro: "املأ السلة، ثم أرسل الطلب إلينا عبر واتساب. نؤكد توفر القطع ونرتب الدفع والتوصيل في المحادثة.",
    how1: "1 · أضف القطع", how2: "2 · راجع السلة", how3: "3 · أرسل عبر واتساب",
    footer: "جميع القطع جديدة وغير مستعملة. يتم ترتيب الدفع والتوصيل عبر واتساب.",
    viewCart: "عرض السلة", cart: "السلة", yourCart: "سلتك", closeCart: "إغلاق السلة", close: "إغلاق", total: "المجموع",
    yourName: "اسمك", city: "المدينة / البلدة", forDelivery: "(للتوصيل)", notes: "ملاحظات", optional: "(اختياري)",
    notesPh: "أسئلة عن قطعة، أوقات مناسبة للتوصيل…", nameErr: "أضف اسمك لنعرف ممن الطلب.",
    sendWa: "أرسل الطلب عبر واتساب", waNote: "سيفتح واتساب والطلب مكتوب جاهزًا. فقط اضغط إرسال. رقمنا:",
    fallback: "لم يفتح واتساب؟ انسخ الطلب وأرسله إلى الرقم أعلاه.",
    copy: "نسخ الطلب", copied: "تم النسخ", selectCopy: "حدّد النص أعلاه لنسخه",
    allParts: "كل القطع", oneLess: "واحدة أقل", oneMore: "واحدة أخرى", soldOut: "نفدت الكمية", add: "أضف",
    onlyLeft: n => `بقي ${n} فقط`, inStock: n => `متوفر: ${n}`, view: n => `عرض ${n}`,
    empty: "بضاعة جديدة في الطريق. عُد لزيارتنا قريبًا.",
    noMatch: q => `لا توجد قطع تطابق «${q}». جرّب بحثًا أو فئة أخرى.`,
    loadErr: "تعذّر تحميل قائمة القطع. تحقق من الاتصال وحدّث الصفحة.",
    each: p => `${p} للقطعة`, remove: "إزالة", cartEmpty: "سلتك فارغة.",
    hello: (s, no) => `مرحبًا ${s}، أود أن أطلب (طلب رقم ${no}):`, mName: "الاسم", mCity: "المدينة", mNotes: "ملاحظات",
    cats: { motors: "محركات", props: "مراوح", frames: "هياكل", stack: "متحكم طيران و ESC", video: "كاميرات و VTX", radio: "مستقبلات", batteries: "بطاريات", other: "أخرى" }
  },
  he: {
    subtotal: "סכום ביניים", shipping: "משלוח", address: "רחוב ומספר בית", mAddress: "כתובת", addressErr: "כתבו כתובת למשלוח (רחוב ומספר בית).",
    choose: "בחירה", pickOption: "בחרו סוג:", prevPhoto: "התמונה הקודמת", nextPhoto: "התמונה הבאה", photo: n => `תמונה ${n}`,
    phone: "מספר טלפון", mPhone: "טלפון",
    phoneErr: "הזינו מספר טלפון תקין, למשל 050-1234567.", cityErr: "כתבו את העיר או היישוב שלכם.",
    sub: "FPV · DJI · חלקי חילוף", used: "משומש", footerMixed: "ליד כל חלק מצוין אם הוא חדש או משומש. תשלום ומשלוח מתואמים בוואטסאפ.",
    searchPh: "חיפוש: 2207, ELRS, Avata…", searchLabel: "חיפוש חלקים", catsLabel: "קטגוריות", langLabel: "שפה",
    tagline: "חלקי FPV ו-DJI מוכנים למשלוח",
    intro: "מלאו את העגלה ושלחו לנו את ההזמנה בוואטסאפ. נאשר מלאי ונתאם תשלום ומשלוח בצ'אט.",
    how1: "1 · הוסיפו חלקים", how2: "2 · בדקו את העגלה", how3: "3 · שלחו בוואטסאפ",
    footer: "כל החלקים חדשים ולא משומשים. תשלום ומשלוח מתואמים בוואטסאפ.",
    viewCart: "לעגלה", cart: "עגלה", yourCart: "העגלה שלך", closeCart: "סגירת העגלה", close: "סגירה", total: "סה״כ",
    yourName: "השם שלך", city: "עיר / יישוב", forDelivery: "(למשלוח)", notes: "הערות", optional: "(לא חובה)",
    notesPh: "שאלות על חלק, שעות נוחות למשלוח…", nameErr: "הוסיפו את השם כדי שנדע ממי ההזמנה.",
    sendWa: "שליחת ההזמנה בוואטסאפ", waNote: "וואטסאפ ייפתח עם ההזמנה כתובה. רק ללחוץ שליחה. המספר שלנו:",
    fallback: "וואטסאפ לא נפתח? העתיקו את ההזמנה ושלחו אותה למספר שלמעלה.",
    copy: "העתקת ההזמנה", copied: "הועתק", selectCopy: "סמנו את הטקסט למעלה כדי להעתיק",
    allParts: "כל החלקים", oneLess: "אחד פחות", oneMore: "עוד אחד", soldOut: "אזל מהמלאי", add: "הוספה",
    onlyLeft: n => `נשארו רק ${n}`, inStock: n => `במלאי: ${n}`, view: n => `צפייה: ${n}`,
    empty: "מלאי חדש בדרך. חזרו לבקר בקרוב.",
    noMatch: q => `אין חלקים שתואמים ל„${q}”. נסו חיפוש או קטגוריה אחרת.`,
    loadErr: "לא הצלחנו לטעון את רשימת החלקים. בדקו את החיבור ורעננו את הדף.",
    each: p => `${p} ליחידה`, remove: "הסרה", cartEmpty: "העגלה ריקה.",
    hello: (s, no) => `היי ${s}, אני רוצה להזמין (הזמנה ${no}):`, mName: "שם", mCity: "עיר", mNotes: "הערות",
    cats: { motors: "מנועים", props: "פרופלורים", frames: "שלדות", stack: "בקר טיסה ו-ESC", video: "מצלמות ו-VTX", radio: "מקלטים", batteries: "סוללות", other: "אחר" }
  },
  en: {
    subtotal: "Subtotal", shipping: "Shipping", address: "Street and house number", mAddress: "Address", addressErr: "Add the delivery address (street and house number).",
    choose: "Choose", pickOption: "Choose a type:", prevPhoto: "Previous photo", nextPhoto: "Next photo", photo: n => `Photo ${n}`,
    phone: "Phone number", mPhone: "Phone",
    phoneErr: "Enter a valid phone number, e.g. 050-1234567.", cityErr: "Write your city or town.",
    sub: "FPV · DJI · parts", used: "Used", footerMixed: "Each part is marked new or used. Payment and delivery are arranged on WhatsApp.",
    searchPh: "Search 2207, ELRS, Avata…", searchLabel: "Search parts", catsLabel: "Categories", langLabel: "Language",
    tagline: "FPV and DJI parts, ready to ship", intro: DEFAULT_SETTINGS.intro,
    how1: "1 · Add parts", how2: "2 · Review cart", how3: "3 · Send on WhatsApp",
    footer: "All parts are new and unused. Payment and delivery are arranged on WhatsApp.",
    viewCart: "View cart", cart: "Cart", yourCart: "Your cart", closeCart: "Close cart", close: "Close", total: "Total",
    yourName: "Your name", city: "City / town", forDelivery: "(for delivery)", notes: "Notes", optional: "(optional)",
    notesPh: "Questions about a part, best times for delivery…", nameErr: "Add your name so we know who the order is from.",
    sendWa: "Send order on WhatsApp", waNote: "WhatsApp opens with your order written out. Just press send. Our number:",
    fallback: "WhatsApp didn't open? Copy the order and send it to the number above.",
    copy: "Copy order", copied: "Copied", selectCopy: "Select the text above to copy",
    allParts: "All parts", oneLess: "One less", oneMore: "One more", soldOut: "Sold out", add: "Add",
    onlyLeft: n => `Only ${n} left`, inStock: n => `${n} in stock`, view: n => `View ${n}`,
    empty: "New stock is on its way. Check back soon.",
    noMatch: q => `No parts match “${q}”. Try another search or category.`,
    loadErr: "We couldn't load the parts list. Check your connection and refresh the page.",
    each: p => `${p} each`, remove: "Remove", cartEmpty: "Your cart is empty.",
    hello: (s, no) => `Hi ${s}, I'd like to order (order ${no}):`, mName: "Name", mCity: "City", mNotes: "Notes",
    cats: {}
  }
};

const pick = () => {
  const want = [new URLSearchParams(location.search).get("lang")];
  try { want.push(localStorage.getItem("pw_lang")); } catch {}
  return want.find(l => T[l]) || LANGS[0].id;
};
export let lang = pick();

export const t = (key, ...args) => { const v = T[lang][key] ?? T.en[key]; return typeof v === "function" ? v(...args) : v; };

// Default category names are translated; names the owner changed in Settings are shown as written.
export function catName(c) {
  const def = DEFAULT_SETTINGS.categories.find(d => d.id === c.id);
  return def && def.label === c.label ? T[lang].cats[c.id] || c.label : c.label;
}
// Same for the headline and intro text from Settings.
export const settingText = (key, value) => !value || value === DEFAULT_SETTINGS[key] ? t(key) : value;

export function setLang(l) {
  if (!T[l]) return;
  lang = l;
  try { localStorage.setItem("pw_lang", l); } catch {}
  applyStatic();
}

export function applyStatic(root = document) {
  const L = LANGS.find(x => x.id === lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = L.dir;
  root.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  root.querySelectorAll("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
  root.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  root.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
}
