# 🛒 ShopSuite

<p align="center">
  <strong>A polished, offline-first Progressive Web App for professional small-business management.</strong>
  <br><br>
  Track sales, inventory, suppliers, customer credit, expenses and reports — all in one clean, modern app.
</p>

<p align="center">

![Version](https://img.shields.io/badge/version-v3.1.0-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-success)
![Offline](https://img.shields.io/badge/Offline-First-success)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/License-MIT-green)

</p>

---

## ✨ Overview

**ShopSuite** is a generic, professional small-business management system designed for daily shop use. It works for grocery shops, convenience stores, mini markets, snack shops, hardware stores, clothing shops, electronics shops, egg shops, and many other small-business types.

It helps shop owners manage:

- 📦 **Products & Inventory** — full CRUD, opening stock, reorder thresholds, low-stock alerts, stock movement history
- 🛒 **Sales** — multi-line transactions, automatic profit calculation, stock deduction
- 🚚 **Suppliers** — contacts, multi-line purchases, partial payments, outstanding balances
- 👥 **Customer Credit** — multi-line credit sales, partial payments, active/paid history
- 💰 **Profit** — daily, monthly and yearly reports with gross and net profit
- 🧾 **Expenses** — operating costs with daily and monthly breakdowns
- 📊 **Reports** — daily, monthly and printable PDF reports with section selection
- 🔒 **Security** — App Lock with PIN + biometric authentication
- 🎨 **Themes** — 6 professional themes + 6 background styles
- 💱 **Multi-Currency** — LKR, USD, EUR, GBP, INR, AUD, CAD, JPY, SGD
- 📱 **PWA** — installable, fully offline, install-to-home-screen

Everything works **completely offline**, making it perfect for everyday shop use in areas with unreliable connectivity.

---

## 🆕 What's New in v3.1

- 🏠 **Landing Page** — beautiful hero section introducing ShopSuite before onboarding
- 🔒 **App Lock** — PIN + biometric (WebAuthn) protection for app access
- 🎨 **Theme System** — 6 professional themes (Classic Blue, Emerald, Graphite, Indigo, Modern Dark, Light Professional)
- 🖼️ **Background Themes** — 6 background styles (Default, Soft Gradient, Glass, Minimal, Neutral, Dark)
- 💱 **Multi-Currency** — 9 international currencies with proper symbols and decimals
- 🏪 **Business Types** — 9 business type presets (Grocery, Convenience, Mini Market, Snack, Hardware, Clothing, Electronics, Egg, Other)
- 📊 **Quick Actions Panel** — one-tap access to New Sale, Add Stock, Supplier Purchase, Collect Credit, Add Expense, Generate Report
- 📈 **Enhanced Business Health** — today vs yesterday + month vs last month with amounts AND percentages
- 📄 **PDF Report Redesign** — section selection dialog, professional layout, page numbers, business header
- 📤 **CSV Export** — export Sales, Inventory, Expenses, Credits, Supplier Purchases as CSV (Excel-compatible)
- 💾 **Improved Backup** — daily/weekly/manual auto-backup frequency, backup size display, latest 5 kept
- 🔍 **SEO** — complete metadata, OpenGraph, Twitter cards, structured data, robots.txt, sitemap.xml
- 🧭 **History API** — real URL-based routing with browser back/forward support
- 🎨 **UI Polish** — tighter spacing, better hierarchy, cleaner cards across all screens

---

## 🚀 Features

| Module | Description |
|--------|-------------|
| 🏠 Landing Page | Hero section, feature cards, privacy/offline/PWA sections, CTA |
| 📊 Dashboard | Quick Actions, Cash Available, Gross/Net Profit, Supplier/Customer Due, Stock Alerts, Business Health, Monthly Comparison, Top Product |
| 🛒 Sales | Multi-line sales, automatic profit calc, stock validation, price sessions, damage recording |
| 📦 Inventory | Full product CRUD, opening stock, reorder thresholds, low-stock warnings, movement history, CSV export |
| 🚚 Suppliers | Summary cards (Total Suppliers, Outstanding, Paid/Purchases This Month), multi-line purchases, partial payments, CSV export |
| 👥 Credit | Multi-line credit sales, partial payments, active/paid history, CSV export |
| 💰 Reports | Daily (with CSV export), monthly, PDF reports with section selection |
| 🧾 Expenses | 5 categories, 7-day breakdown chart, monthly totals, net profit, CSV export |
| 💥 Damaged Stock | Damage/loss tracking with auto inventory deduction and profit impact |
| 🔒 App Lock | PIN (4-8 digits) + biometric (WebAuthn) protection |
| 🎨 Themes | 6 professional themes + 6 background styles |
| 💱 Currency | 9 international currencies with proper formatting |
| 📱 PWA | Installable, offline-first, install on Android/iOS/desktop |
| 🔒 Privacy | All data stored locally on device — no servers, no tracking |

---

## 🛠 Tech Stack

- **Next.js 16** (App Router, webpack production build)
- **TypeScript 5** (strict)
- **Tailwind CSS v4** (custom glassmorphism design system with 6 themes)
- **Framer Motion 12** (animations)
- **Recharts 2** (charts)
- **IndexedDB** via `idb` (local offline storage)
- **Service Worker** (PWA offline support)
- **WebAuthn** (biometric app lock)

---

## 📦 Installation

```bash
git clone https://github.com/dumzvybez/Egg-Shop-Management-App.git

cd Egg-Shop-Management-App

npm install

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production build

```bash
npm run build
npm start
```

---

## 📱 Progressive Web App

ShopSuite is fully installable as a Progressive Web App.

Features:
- ✅ Offline support (works without internet)
- ✅ Install on Android (Chrome / Edge)
- ✅ Install on iOS (Safari → Share → Add to Home Screen)
- ✅ Install on Desktop (Chrome / Edge)
- ✅ Local data storage (survives app close and phone restart)
- ✅ Fast loading
- ✅ Theme persistence
- ✅ Real URL navigation (browser back/forward works)
- ✅ Maskable icons for Android adaptive icons
- ✅ App shortcuts (Dashboard, Sales, Inventory)

---

## 🔒 Security & Privacy

### App Lock
- **PIN Protection**: Set a 4-8 digit numeric PIN
- **Biometric Unlock**: Use fingerprint/face authentication via WebAuthn (where supported)
- **Route Protection**: All app screens are blocked until unlocked
- **Auto-Lock**: App locks on every app open or refresh

### Privacy
**All your data stays on your device.** ShopSuite does NOT:
- Send any data to any server
- Use analytics or tracking
- Require an account or login
- Make any network calls (except for Google Fonts on first load)

### Backup Security
- Exported backup files are **NOT** PIN-protected
- Store exported backups securely
- Auto-backups (stored on-device) are protected by App Lock

---

## 🎨 Themes & Backgrounds

### Themes (6)
- **Modern Dark** (default) — amber accent on deep stone
- **Classic Blue** — blue accent on midnight
- **Emerald** — green accent on deep forest
- **Graphite** — neutral zinc accent on pure dark
- **Indigo** — purple accent on deep indigo
- **Light Professional** — amber on warm cream

### Backgrounds (6)
- **Default** — warm radial gradient
- **Soft Gradient** — indigo/purple gradient
- **Glass** — colorful blur circles
- **Minimal** — solid dark
- **Neutral** — zinc gradient
- **Dark** — pure black

---

## 💱 Currency Support

ShopSuite supports 9 international currencies:

| Code | Symbol | Name |
|------|--------|------|
| LKR | Rs | Sri Lankan Rupee |
| USD | $ | US Dollar |
| EUR | € | Euro |
| GBP | £ | British Pound |
| INR | ₹ | Indian Rupee |
| AUD | A$ | Australian Dollar |
| CAD | C$ | Canadian Dollar |
| JPY | ¥ | Japanese Yen (0 decimals) |
| SGD | S$ | Singapore Dollar |

Currency is stored separately from values. Changing currency instantly updates formatting everywhere.

---

## 📂 Project Structure

```
shopsuite/
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── google53e23fb6a2391241.html  (Search Console verification)
│   └── icons/
├── src/
│   ├── app/
│   │   ├── globals.css         # Tailwind v4 design system
│   │   ├── layout.tsx          # Root layout, SEO metadata, theme bootstrap
│   │   └── page.tsx            # URL-routed SPA shell + landing + app lock
│   ├── lib/
│   │   ├── db.ts               # IndexedDB data layer + CSV export
│   │   ├── i18n.ts             # English-only dictionary
│   │   ├── sinhala.ts          # Date/number/currency formatters
│   │   ├── themes.ts           # 6 themes + 6 backgrounds
│   │   ├── currencies.ts       # 9 currency definitions
│   │   ├── business-types.ts   # 9 business type presets
│   │   ├── use-data.ts         # React hooks for data
│   │   ├── use-theme.ts        # Theme + background sync
│   │   ├── i18n-context.tsx    # I18n provider
│   │   ├── data-hooks.ts       # Re-export hub
│   │   └── data-hooks-adapter.ts
│   └── components/
│       ├── landing-page.tsx
│       ├── app-lock.tsx
│       ├── setup-wizard.tsx
│       ├── dashboard.tsx
│       ├── profit-calculator-screen.tsx
│       ├── inventory-screen.tsx
│       ├── suppliers-screen.tsx
│       ├── supplier-profile-screen.tsx
│       ├── credit-screen.tsx
│       ├── expense-screen.tsx
│       ├── daily-reports-screen.tsx
│       ├── monthly-reports-screen.tsx
│       ├── pdf-report-screen.tsx
│       ├── backup-screen.tsx
│       ├── settings-screen.tsx
│       ├── edit-history-screen.tsx
│       ├── bottom-nav.tsx
│       ├── footer.tsx
│       ├── toast-provider.tsx
│       ├── missed-days-modal.tsx
│       └── month-end-reminder-modal.tsx
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

---

## 🌐 Developer

**Dumindu Wanasinghe** — Founder & Developer

[![GitHub](https://img.shields.io/badge/GitHub-dumzvybez-black?logo=github)](https://github.com/dumzvybez)
[![Portfolio](https://img.shields.io/badge/Portfolio-dumindu.vercel.app-blue?logo=vercel)](https://dumindu.vercel.app)
[![YouTube](https://img.shields.io/badge/YouTube-@DuminduWanasinghe-red?logo=youtube)](https://www.youtube.com/@DuminduWanasinghe)

Repository: [github.com/dumzvybez/Egg-Shop-Management-App](https://github.com/dumzvybez/Egg-Shop-Management-App)

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%" align="center"><b>Landing Page</b></td>
    <td width="50%" align="center"><b>Dashboard with Quick Actions</b></td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/fbbf24?text=ShopSuite%0A%0ALanding%20Page%0A%0AHero%20%2B%20Features%0A%2B%20CTA&font=montserrat" alt="Landing" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/3b82f6?text=Dashboard%0A%0AQuick%20Actions%0ACash%20%2B%20Profit%0ADues%20%2B%20Alerts&font=montserrat" alt="Dashboard" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center"><b>App Lock</b></td>
    <td width="50%" align="center"><b>Settings (8 sections)</b></td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/10b981?text=App%20Lock%0A%0APIN%20%2B%20Biometric%0AProtected%20access&font=montserrat" alt="App Lock" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/818cf8?text=Settings%0A%0AGeneral%0AAppearance%0ASecurity%0ACurrency%0ABusiness%0ABackup%0ADeveloper%0AAbout&font=montserrat" alt="Settings" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center"><b>Themes (6)</b></td>
    <td width="50%" align="center"><b>PDF Report (section picker)</b></td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/a1a1aa?text=Themes%0A%0ABlue%20%C2%B7%20Emerald%0AGraphite%20%C2%B7%20Indigo%0AModern%20Dark%0ALight%20Pro&font=montserrat" alt="Themes" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <img src="https://placehold.co/600x1200/0c0a09/ef4444?text=PDF%20Report%0A%0ASection%20picker%0ABusiness%20header%0APage%20numbers&font=montserrat" alt="PDF" width="100%" />
    </td>
  </tr>
</table>

> Replace the placeholder images above with real screenshots of your deployed app.

---

## ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.

---

## 📄 License

MIT License — free for personal and commercial use.
