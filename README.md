# Mallik Store | Billing Link Generator

A premium, serverless, client-side Invoice and Billing Link generator designed for **Mallik Store**. This self-contained web application allows merchants to generate invoices, view billing history, and create shareable checkout links containing the full billing data. 

When a customer opens a billing link, they see a beautiful invoice preview and can scan a QR code to pay, print/save the invoice as a PDF, or settle the bill via a secure simulated payment modal.

---

## Key Features

- **Interactive Invoice Creator**: Dynamic additions of line items, real-time recalculations of subtotal, tax rates, discounts, and currency changes (INR, USD, EUR, GBP, AED).
- **Zero-Server Shareable Links**: Encodes the entire invoice payload (items, totals, dates, customer data) into a URI-safe Base64 hash in the URL. Shareable via Email, WhatsApp, or SMS with no backend database dependency.
- **Client-Facing Invoice Viewer**: Automatically detects and loads into client view when accessed via a billing link. Hides all creator controls and displays a professional, clean invoice sheet.
- **Simulated Payment Gateway**: Supports simulated card checkouts and UPI checkouts. Complete with loading states, payment status badges, and canvas-confetti payment success.
- **Local History Registry**: Saves generated invoices locally to merchant dashboard's `localStorage` for easy record-keeping. Merchants can search, copy, view, or delete entries.
- **QR Code Auto-Generation**: Automatically generates a high-definition QR code for client scanning to facilitate mobile payment or print invoice sharing.
- **Print Optimization**: Configured with `@media print` style sheets to strip out all web UI wrappers and print a clean, high-resolution A4 invoice.

---

## File Structure

- [index.html](file:///c:/Users/mohid/OneDrive/Desktop/Billing/Billing/index.html) - Main layout, navigation, grids, modals, and CDN integration (Outfit font, Lucide icons, QRious QR generator, Canvas Confetti).
- [style.css](file:///c:/Users/mohid/OneDrive/Desktop/Billing/Billing/style.css) - Global styling, glassmorphic themes (dark mode default + light toggle), interactive components, and print queries.
- [app.js](file:///c:/Users/mohid/OneDrive/Desktop/Billing/Billing/app.js) - Core client-side router, item lists compiler, math calculator, URL encoding, LocalStorage, and payment controller.

---

## Running Locally

Because this application is built using vanilla HTML, CSS, and Javascript, it has **zero dependencies** and does not require Node.js, compilation, or web servers!

1. Open the project directory on your machine.
2. Double-click [index.html](file:///c:/Users/mohid/OneDrive/Desktop/Billing/Billing/index.html) to run it directly in any modern browser (Chrome, Edge, Safari, Firefox).
3. Alternatively, if you want a local dev server, run:
   ```bash
   npx serve -s .
   ```
   and navigate to `http://localhost:3000`.

---

## How to Generate & Share a Billing Link

1. Under the **Create Bill** tab, enter the invoice number, dates, client details, and items. Adjust tax or discount rates.
2. Click **Generate Billing Link**.
3. The shareable link will be copied directly to your clipboard (a success toast will appear).
4. Share the link with your client.
5. In your local session, you can view the newly added record under the **History** tab.