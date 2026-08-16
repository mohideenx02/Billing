/* ==========================================================================
   Mallik Store Billing - Core Logic & Routing
   ========================================================================== */

// --- Global App State ---
let invoiceItems = [];
let invoiceHistory = [];
let currentTheme = 'dark';
let activePaymentMethod = 'card';
let clientActiveInvoice = null; // Stores invoice loaded from URL hash

// Currency symbols mapping
const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ'
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize lucide icons
  lucide.createIcons();

  // Set default dates
  setDefaultDates();

  // Load history from LocalStorage
  loadHistory();

  // Route check
  handleRouting();

  // Handle URL hash changes dynamically
  window.addEventListener('hashchange', handleRouting);

  // Set default items in editor if empty
  if (invoiceItems.length === 0) {
    addDefaultItemRows();
  }

  // Setup input card formatting for pay modal
  setupCardFormatting();
});

// Set default issue date (today) and due date (in 14 days)
function setDefaultDates() {
  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(today.getDate() + 14);

  const formatDateString = (date) => {
    return date.toISOString().split('T')[0];
  };

  const dateInput = document.getElementById('inv-date');
  const dueDateInput = document.getElementById('inv-due-date');

  if (dateInput && !dateInput.value) {
    dateInput.value = formatDateString(today);
  }
  if (dueDateInput && !dueDateInput.value) {
    dueDateInput.value = formatDateString(dueDate);
  }
  
  // Also pre-fill invoice number
  const invNum = document.getElementById('inv-number');
  if (invNum && !invNum.value) {
    invNum.value = 'INV-' + today.getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }

  // Setup input listeners to update preview in real-time
  setupFormPreviewSync();
}

// Add standard mock items so user sees something fully working
function addDefaultItemRows() {
  addItemRow({ description: 'Premium Web Development Service', price: 15000, qty: 1 });
  addItemRow({ description: 'Cloud Infrastructure Setup & Domain mapping', price: 7500, qty: 1 });
  addItemRow({ description: 'Mallik Store Custom POS Integration', price: 12500, qty: 1 });
}

// --- Routing (Client View vs Merchant Dashboard) ---
function handleRouting() {
  const hash = window.location.hash;
  const mainHeader = document.getElementById('main-header');
  const merchantWorkspace = document.getElementById('merchant-workspace');
  const clientViewContainer = document.getElementById('client-view-container');
  const adminBackBtn = document.getElementById('admin-back-btn');

  if (hash.startsWith('#invoice=')) {
    // Client View mode
    const base64Data = hash.substring(9);
    try {
      const decodedInvoice = decodeInvoice(base64Data);
      clientActiveInvoice = decodedInvoice;

      // Hide merchant workspace
      mainHeader.classList.add('hidden');
      merchantWorkspace.classList.add('hidden');
      
      // Show client workspace
      clientViewContainer.classList.remove('hidden');

      // Check if this is local admin (history has at least one entry, or came from dashboard)
      if (invoiceHistory.length > 0) {
        adminBackBtn.classList.remove('hidden');
      } else {
        adminBackBtn.classList.add('hidden');
      }

      renderClientInvoice(decodedInvoice);
      renderQRCode(window.location.href);
      document.getElementById('share-url-copy').value = window.location.href;

    } catch (e) {
      console.error("Failed to decode invoice URL payload", e);
      showToast("Error decoding invoice link.", "danger");
      clearUrlHash();
    }
  } else {
    // Merchant Dashboard mode
    mainHeader.classList.remove('hidden');
    merchantWorkspace.classList.remove('hidden');
    clientViewContainer.classList.add('hidden');
    clientActiveInvoice = null;

    // Refresh history grid
    renderHistory();
    // Refresh calculations
    updateTotals();
  }
  lucide.createIcons();
}

function clearUrlHash() {
  window.location.hash = '';
}

// --- Invoice Encoder / Decoder ---
function encodeInvoice(invoiceObj) {
  const json = JSON.stringify(invoiceObj);
  // URI-safe base64 conversion
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

function decodeInvoice(base64Str) {
  const json = decodeURIComponent(Array.prototype.map.call(atob(base64Str), (c) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(json);
}

// --- Live Form Synchronization ---
function setupFormPreviewSync() {
  const fields = [
    { id: 'inv-number', previewId: 'preview-inv-number' },
    { id: 'client-name', previewId: 'preview-client-name' },
    { id: 'client-email', previewId: 'preview-client-email' },
    { id: 'client-phone', previewId: 'preview-client-phone' },
    { id: 'client-address', previewId: 'preview-client-address' }
  ];

  fields.forEach(field => {
    const input = document.getElementById(field.id);
    const preview = document.getElementById(field.previewId);
    if (input && preview) {
      input.addEventListener('input', () => {
        preview.textContent = input.value || `[Client ${input.placeholder || 'Detail'}]`;
      });
    }
  });

  // Dates formatting preview
  const dateInput = document.getElementById('inv-date');
  const dueDateInput = document.getElementById('inv-due-date');

  const updateDatesPreview = () => {
    if (dateInput && document.getElementById('preview-inv-date')) {
      document.getElementById('preview-inv-date').textContent = formatDate(dateInput.value);
    }
    if (dueDateInput && document.getElementById('preview-inv-due-date')) {
      document.getElementById('preview-inv-due-date').textContent = formatDate(dueDateInput.value);
    }
  };

  if (dateInput) dateInput.addEventListener('change', updateDatesPreview);
  if (dueDateInput) dueDateInput.addEventListener('change', updateDatesPreview);

  // Trigger initial values preview
  setTimeout(updateDatesPreview, 100);
}

function formatDate(dateString) {
  if (!dateString) return 'Pending';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Items List Editor ---
function addItemRow(data = { description: '', price: 0, qty: 1 }) {
  const container = document.getElementById('items-list-container');
  if (!container) return;

  const id = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const row = document.createElement('div');
  row.className = 'item-row-edit';
  row.id = id;

  row.innerHTML = `
    <div class="form-group">
      <label>Description</label>
      <input type="text" class="item-desc" value="${data.description}" placeholder="Product or Service Name" required oninput="updateTotals()">
    </div>
    <div class="form-group">
      <label>Price</label>
      <input type="number" class="item-price" value="${data.price}" min="0" step="any" placeholder="0.00" required oninput="updateTotals()">
    </div>
    <div class="form-group">
      <label>Qty</label>
      <input type="number" class="item-qty" value="${data.qty}" min="1" placeholder="1" required oninput="updateTotals()">
    </div>
    <button type="button" class="btn-danger-icon" onclick="removeItemRow('${id}')" aria-label="Delete row">
      <i data-lucide="trash-2"></i>
    </button>
  `;

  container.appendChild(row);
  lucide.createIcons();

  invoiceItems.push({ id, element: row });
  updateTotals();
}

function removeItemRow(id) {
  const row = document.getElementById(id);
  if (row) {
    row.remove();
  }
  invoiceItems = invoiceItems.filter(item => item.id !== id);
  updateTotals();
}

// --- Subtotal & Totals Engine ---
function updateTotals() {
  const currencySelect = document.getElementById('inv-currency');
  const currency = currencySelect ? currencySelect.value : 'INR';
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  let subtotal = 0;
  const previewBody = document.getElementById('preview-items-body');
  if (previewBody) previewBody.innerHTML = '';

  const rows = document.querySelectorAll('.item-row-edit');
  rows.forEach(row => {
    const desc = row.querySelector('.item-desc').value || '[Item Description]';
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    const rowTotal = price * qty;
    subtotal += rowTotal;

    // Append to live preview table
    if (previewBody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${desc}</td>
        <td class="text-right">${formatCurrency(price, currency)}</td>
        <td class="text-center">${qty}</td>
        <td class="text-right">${formatCurrency(rowTotal, currency)}</td>
      `;
      previewBody.appendChild(tr);
    }
  });

  // Handle Tax and Discount
  const taxRate = parseFloat(document.getElementById('inv-tax').value) || 0;
  const discountRate = parseFloat(document.getElementById('inv-discount').value) || 0;

  const discountAmount = subtotal * (discountRate / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const grandTotal = taxableAmount + taxAmount;

  // Sync previews text
  document.getElementById('preview-subtotal').textContent = formatCurrency(subtotal, currency);
  
  const discountRow = document.getElementById('preview-discount-row');
  if (discountRate > 0) {
    discountRow.classList.remove('hidden');
    document.getElementById('preview-discount-percent').textContent = discountRate;
    document.getElementById('preview-discount-amount').textContent = `-${formatCurrency(discountAmount, currency)}`;
  } else {
    discountRow.classList.add('hidden');
  }

  document.getElementById('preview-tax-percent').textContent = taxRate;
  document.getElementById('preview-tax-amount').textContent = formatCurrency(taxAmount, currency);
  document.getElementById('preview-grand-total').textContent = formatCurrency(grandTotal, currency);
}

function formatCurrency(amount, code) {
  const symbol = CURRENCY_SYMBOLS[code] || '₹';
  return symbol + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// --- Link Generation & History Save ---
function generateBillingLink() {
  const form = document.getElementById('invoice-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Compile items array
  const items = [];
  const rows = document.querySelectorAll('.item-row-edit');
  rows.forEach(row => {
    items.push({
      description: row.querySelector('.item-desc').value,
      price: parseFloat(row.querySelector('.item-price').value) || 0,
      qty: parseInt(row.querySelector('.item-qty').value) || 1
    });
  });

  const currency = document.getElementById('inv-currency').value;

  const invoiceObj = {
    number: document.getElementById('inv-number').value,
    currency: currency,
    date: document.getElementById('inv-date').value,
    dueDate: document.getElementById('inv-due-date').value,
    clientName: document.getElementById('client-name').value,
    clientEmail: document.getElementById('client-email').value,
    clientPhone: document.getElementById('client-phone').value || '',
    clientAddress: document.getElementById('client-address').value,
    items: items,
    tax: parseFloat(document.getElementById('inv-tax').value) || 0,
    discount: parseFloat(document.getElementById('inv-discount').value) || 0,
    status: 'unpaid' // Default when generated
  };

  const payload = encodeInvoice(invoiceObj);
  const shareLink = `${window.location.origin}${window.location.pathname}#invoice=${payload}`;

  // Save to history in LocalStorage
  saveInvoiceToHistory(invoiceObj, shareLink);

  // Copy link to clipboard
  navigator.clipboard.writeText(shareLink).then(() => {
    showToast("Shareable Billing Link copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard copy failed", err);
    // Display URL fallback
    prompt("Copy invoice billing link:", shareLink);
  });

  // Auto switch to History view to show generated link
  switchTab('history');
}

// Save invoice to LocalStorage registry
function saveInvoiceToHistory(invoiceObj, link) {
  // Check if invoice # already exists, if so overwrite, else add
  invoiceHistory = invoiceHistory.filter(inv => inv.number !== invoiceObj.number);
  
  invoiceHistory.unshift({
    number: invoiceObj.number,
    clientName: invoiceObj.clientName,
    clientEmail: invoiceObj.clientEmail,
    date: invoiceObj.date,
    total: calculateInvoiceTotal(invoiceObj),
    currency: invoiceObj.currency,
    status: invoiceObj.status,
    link: link,
    payload: encodeInvoice(invoiceObj) // Store payload to reload
  });

  localStorage.setItem('mallik_store_invoices', JSON.stringify(invoiceHistory));
  renderHistory();
}

function calculateInvoiceTotal(invoice) {
  let subtotal = invoice.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = subtotal * (invoice.discount / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (invoice.tax / 100);
  return taxable + tax;
}

function loadHistory() {
  const data = localStorage.getItem('mallik_store_invoices');
  if (data) {
    try {
      invoiceHistory = JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse local invoice repository history", e);
      invoiceHistory = [];
    }
  }
}

// --- Render Invoice History ---
function renderHistory() {
  const tbody = document.getElementById('history-rows');
  const emptyState = document.getElementById('history-empty-state');
  const searchVal = document.getElementById('history-search').value.toLowerCase();

  if (!tbody) return;
  tbody.innerHTML = '';

  const filteredHistory = invoiceHistory.filter(inv => 
    inv.number.toLowerCase().includes(searchVal) ||
    inv.clientName.toLowerCase().includes(searchVal) ||
    inv.clientEmail.toLowerCase().includes(searchVal)
  );

  if (filteredHistory.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');

    filteredHistory.forEach(inv => {
      const tr = document.createElement('tr');
      const formattedTotal = formatCurrency(inv.total, inv.currency);
      const statusClass = inv.status === 'paid' ? 'badge paid' : 'badge unpaid';

      tr.innerHTML = `
        <td><strong>${inv.number}</strong></td>
        <td>
          <div class="history-client-name">${inv.clientName}</div>
          <div class="footer-small" style="font-size:11px; color:var(--text-muted);">${inv.clientEmail}</div>
        </td>
        <td>${formatDate(inv.date)}</td>
        <td><strong>${formattedTotal}</strong></td>
        <td><span class="${statusClass}">${inv.status}</span></td>
        <td class="history-actions">
          <button class="btn-secondary btn-sm" onclick="window.location.hash = 'invoice=${inv.payload}'" title="View Client Invoice">
            <i data-lucide="eye"></i> View
          </button>
          <button class="btn-secondary btn-sm" onclick="copyHistoryLink('${inv.link}')" title="Copy Link">
            <i data-lucide="copy"></i> Copy Link
          </button>
          <button class="btn-danger-icon btn-sm" style="width:32px; height:32px;" onclick="deleteHistoryInvoice('${inv.number}')" title="Delete record">
            <i data-lucide="trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  lucide.createIcons();
}

function copyHistoryLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showToast("Invoice link copied successfully!");
  });
}

function deleteHistoryInvoice(invoiceNumber) {
  if (confirm(`Are you sure you want to delete Invoice ${invoiceNumber} from history?`)) {
    invoiceHistory = invoiceHistory.filter(inv => inv.number !== invoiceNumber);
    localStorage.setItem('mallik_store_invoices', JSON.stringify(invoiceHistory));
    renderHistory();
    showToast("Invoice deleted from local record.", "warning");
  }
}

// --- Client Invoice Viewer Rendering ---
function renderClientInvoice(invoice) {
  const placeholder = document.getElementById('client-invoice-placeholder');
  if (!placeholder) return;

  const total = calculateInvoiceTotal(invoice);
  const subtotal = invoice.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = subtotal * (invoice.discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (invoice.tax / 100);

  const statusBadgeClass = invoice.status === 'paid' ? 'badge paid' : 'badge unpaid';
  const payButton = document.getElementById('pay-now-btn');

  // Disable / change payment button if already paid
  if (invoice.status === 'paid') {
    payButton.innerHTML = `<i data-lucide="check-circle"></i> Invoice Paid`;
    payButton.classList.remove('btn-primary-pulse');
    payButton.classList.add('btn-secondary');
    payButton.disabled = true;
  } else {
    payButton.innerHTML = `<i data-lucide="credit-card"></i> Pay Invoice`;
    payButton.classList.add('btn-primary-pulse');
    payButton.classList.remove('btn-secondary');
    payButton.disabled = false;
  }

  // Generate dynamic items rows HTML
  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="text-right">${formatCurrency(item.price, invoice.currency)}</td>
      <td class="text-center">${item.qty}</td>
      <td class="text-right">${formatCurrency(item.price * item.qty, invoice.currency)}</td>
    </tr>
  `).join('');

  placeholder.innerHTML = `
    <div id="invoice-sheet" class="invoice-sheet glass-panel">
      <div class="invoice-header">
        <div class="invoice-brand">
          <div class="store-symbol">MS</div>
          <div>
            <h2 class="store-name">Mallik Store</h2>
            <p class="store-tagline">Premium Retail & Services</p>
          </div>
        </div>
        <div class="invoice-meta-info">
          <h3 class="invoice-title-text">INVOICE</h3>
          <p class="invoice-num-badge">${invoice.number}</p>
          <div class="meta-dates">
            <div><strong>Date:</strong> <span>${formatDate(invoice.date)}</span></div>
            <div><strong>Due:</strong> <span>${formatDate(invoice.dueDate)}</span></div>
          </div>
        </div>
      </div>

      <div class="invoice-parties">
        <div class="party-merchant">
          <h4>From:</h4>
          <p class="party-name">Mallik Store Ltd.</p>
          <p>Dinnur main road 2nd cross</p>
        </div>
        <div class="party-client">
          <h4>Bill To:</h4>
          <p class="party-name">${invoice.clientName}</p>
          <p>${invoice.clientAddress}</p>
          <p>${invoice.clientEmail}</p>
          ${invoice.clientPhone ? `<p>${invoice.clientPhone}</p>` : ''}
        </div>
      </div>

      <div class="invoice-items-table-wrapper">
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th class="text-right">Price</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="invoice-totals-section">
        <div class="payment-terms-info">
          <h4>Payment Terms</h4>
          <p>Please pay by the due date. You can scan the QR code to make immediate payment online.</p>
          <div class="status-badge-container">
            <span class="${statusBadgeClass}">${invoice.status}</span>
          </div>
        </div>
        
        <div class="totals-table-wrapper">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">${formatCurrency(subtotal, invoice.currency)}</td>
            </tr>
            ${invoice.discount > 0 ? `
              <tr>
                <td>Discount (${invoice.discount}%):</td>
                <td class="text-right text-success">-${formatCurrency(discountAmount, invoice.currency)}</td>
              </tr>
            ` : ''}
            <tr>
              <td>Tax (${invoice.tax}%):</td>
              <td class="text-right">${formatCurrency(taxAmount, invoice.currency)}</td>
            </tr>
            <tr class="grand-total-row">
              <td>Total Amount:</td>
              <td class="text-right">${formatCurrency(total, invoice.currency)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="invoice-footer">
        <p>Thank you for shopping at Mallik Store!</p>
        <p class="footer-small">Powered by Mallik Store Secure Invoice Link Node</p>
      </div>
    </div>
  `;
}

function copyClientShareLink() {
  const shareUrl = document.getElementById('share-url-copy').value;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast("Invoice link copied successfully!");
  });
}

// --- QR Code Generator ---
function renderQRCode(url) {
  const canvas = document.getElementById('qr-code-canvas');
  if (!canvas) return;

  // Use QRious library to draw QR
  new QRious({
    element: canvas,
    value: url,
    size: 250,
    background: '#ffffff',
    foreground: '#0b0f19',
    level: 'H'
  });
}

// --- Theme Toggler ---
function toggleTheme() {
  const body = document.body;
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');

  if (body.classList.contains('dark-theme')) {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
    currentTheme = 'light';
  } else {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
    currentTheme = 'dark';
  }
}

// --- Navigation Tabs Switch ---
function switchTab(tabId) {
  const tabs = ['create', 'history'];
  tabs.forEach(id => {
    const content = document.getElementById(`tab-${id}`);
    const button = document.getElementById(`tab-${id}-btn`);
    if (content && button) {
      if (id === tabId) {
        content.classList.add('active');
        button.classList.add('active');
      } else {
        content.classList.remove('active');
        button.classList.remove('active');
      }
    }
  });

  if (tabId === 'history') {
    renderHistory();
  }
  lucide.createIcons();
}

// --- Toast Messages ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.className = 'toast'; // Reset
  
  if (type === 'success') {
    toast.style.borderColor = 'var(--success)';
  } else if (type === 'warning') {
    toast.style.borderColor = 'var(--warning)';
  } else {
    toast.style.borderColor = 'var(--danger)';
  }

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// --- Simulated Payment Modal Logic ---
function openPaymentModal() {
  if (!clientActiveInvoice) return;

  const modal = document.getElementById('payment-modal');
  const invNum = document.getElementById('modal-invoice-num');
  const invAmt = document.getElementById('modal-invoice-amount');

  invNum.textContent = clientActiveInvoice.number;
  invAmt.textContent = formatCurrency(calculateInvoiceTotal(clientActiveInvoice), clientActiveInvoice.currency);

  modal.classList.remove('hidden');
  setPaymentMethod('card'); // Reset tab
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('hidden');
}

function setPaymentMethod(method) {
  activePaymentMethod = method;
  const btnCard = document.getElementById('btn-method-card');
  const btnUpi = document.getElementById('btn-method-upi');
  const sectCard = document.getElementById('payment-section-card');
  const sectUpi = document.getElementById('payment-section-upi');

  if (method === 'card') {
    btnCard.classList.add('active');
    btnUpi.classList.remove('active');
    sectCard.classList.remove('hidden');
    sectUpi.classList.add('hidden');
  } else {
    btnUpi.classList.add('active');
    btnCard.classList.remove('active');
    sectUpi.classList.remove('hidden');
    sectCard.classList.add('hidden');
  }
}

// Card input format auto-completion helpers
function setupCardFormatting() {
  const cardNum = document.getElementById('card-num');
  const cardExpiry = document.getElementById('card-expiry');
  const cardCvv = document.getElementById('card-cvv');

  if (cardNum) {
    cardNum.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let formatted = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formatted += ' ';
        }
        formatted += value[i];
      }
      e.target.value = formatted.substring(0, 19); // 16 digits + 3 spaces
    });
  }

  if (cardExpiry) {
    cardExpiry.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      if (value.length > 2) {
        e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
      } else {
        e.target.value = value;
      }
    });
  }

  if (cardCvv) {
    cardCvv.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/gi, '').substring(0, 3);
    });
  }
}

// Process Simulated Transaction
function executePayment(event) {
  event.preventDefault();

  const spinner = activePaymentMethod === 'card' 
    ? document.getElementById('pay-spinner') 
    : document.getElementById('upi-pay-spinner');
  
  const buttonText = activePaymentMethod === 'card' 
    ? document.getElementById('pay-button-text') 
    : document.getElementById('upi-pay-button-text');

  if (spinner && buttonText) {
    spinner.classList.remove('hidden');
    buttonText.classList.add('hidden');
  }

  // Simulate gateway latency
  setTimeout(() => {
    if (spinner && buttonText) {
      spinner.classList.add('hidden');
      buttonText.classList.remove('hidden');
    }

    // Success transition
    closePaymentModal();
    
    // Trigger confetti!
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    showToast("Payment Successful! Thank you.");

    // Update active invoice state
    clientActiveInvoice.status = 'paid';
    
    // Save updated paid state back to History registry if matched
    updateHistoryInvoiceStatus(clientActiveInvoice.number, 'paid');

    // Update URL hash payload to preserve paid status if link is re-shared
    const updatedPayload = encodeInvoice(clientActiveInvoice);
    window.history.replaceState(null, null, `#invoice=${updatedPayload}`);

    // Re-render viewer with updated paid status
    renderClientInvoice(clientActiveInvoice);
    
  }, 1800);
}

function updateHistoryInvoiceStatus(number, status) {
  // Sync to history list
  invoiceHistory = invoiceHistory.map(inv => {
    if (inv.number === number) {
      inv.status = status;
      // Re-encode payload with status='paid' in history links
      const decoded = decodeInvoice(inv.payload);
      decoded.status = status;
      inv.payload = encodeInvoice(decoded);
      inv.link = `${window.location.origin}${window.location.pathname}#invoice=${inv.payload}`;
    }
    return inv;
  });
  localStorage.setItem('mallik_store_invoices', JSON.stringify(invoiceHistory));
}
