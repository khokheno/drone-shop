# Drone parts shop

A static website (no server) with a WhatsApp checkout, plus an admin app for parts, prices, stock and orders.
Data lives in **Firebase Firestore** (free Spark plan is enough). Hosting is **GitHub Pages** (free).

```
index.html          → the shop customers see
admin/index.html    → your admin app (yoursite/admin/)
assets/config.js    → paste your Firebase config here (the only file you must edit)
firestore.rules     → database security rules (paste into Firebase console)
sample-parts.csv    → example CSV for bulk import
```

## 1. Create the Firebase project (about 5 minutes)
1. Go to https://console.firebase.google.com → **Create a project** (Google Analytics: off is fine).
2. **Build → Firestore Database → Create database** → pick a location close to you (e.g. `europe-west`) → **Start in production mode**.
3. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, click **Publish**.
4. **Build → Authentication → Get started → Email/Password → Enable → Save**.
5. Authentication → **Users → Add user** → your email + a strong password. Copy the **User UID** shown in the list.
6. Back in **Firestore → Data → Start collection**: Collection ID `admins` → Document ID = **your User UID** → add field `email` (string) = your email → Save.
7. **Project settings** (gear icon) → **Your apps** → web icon `</>` → register an app (no hosting needed) → copy the `firebaseConfig` values into `assets/config.js`.
8. Authentication → **Settings → Authorized domains** → add `YOUR-GITHUB-USERNAME.github.io` once you have it.

## 2. Try it locally
```
cd ~/Developer/drone-shop
python3 -m http.server 8080
```
Open http://localhost:8080 (shop) and http://localhost:8080/admin/ (admin). Sign in with the user from step 5.

## 3. Publish on GitHub Pages
1. Create a new **public** repo on GitHub, e.g. `drone-shop`.
2. Push this folder:
   ```
   git init && git add . && git commit -m "Shop" && git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/drone-shop.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
4. After a minute the shop is at `https://YOUR-USERNAME.github.io/drone-shop/` and the admin at `.../drone-shop/admin/`.
5. Optional: buy a domain and set it under Settings → Pages → Custom domain (then add it to Firebase Authorized domains too).

## Using the admin
- **Parts**: add/edit with photo, price, stock, specs, description; tap −/+ to change stock; Hide removes a part from the shop without deleting it.
- **Import CSV**: export your spreadsheet as CSV (see `sample-parts.csv`). Specs are separated by `;`.
- **Orders**: every WhatsApp checkout is also saved here with an order number (e.g. `PW-3K9QZ`) that appears in the customer's WhatsApp message. *Mark sold* takes the quantities out of stock.
- **Settings**: store name, headline, WhatsApp number, currency, and categories.

## Free-plan limits (good to know)
Firestore free: 50,000 reads/day. Each shop visit reads every part once, so ~100 parts handles ~500 visits a day.
Photos are resized to ~100–200 KB and stored inside each part (no paid Storage needed).
