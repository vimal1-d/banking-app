/* ══════════════════════════════════════════════════════
   NovaBanc Frontend — app.js
   Handles: Login, Register, Dashboard, Transfer, History
   ══════════════════════════════════════════════════════ */

// ── API Base URL ───────────────────────────────────────
// In Docker / K8s: nginx proxies /api/* to backend
// In local dev (no docker): point to localhost:5000
const API = '/api';

// ── State ──────────────────────────────────────────────
let authToken   = localStorage.getItem('nb_token') || null;
let currentUser = JSON.parse(localStorage.getItem('nb_user') || 'null');

// ── DOM Helpers ────────────────────────────────────────
const $  = id => document.getElementById(id);
const fmt = n  => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(n);

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function setMsg(id, msg, type = 'error') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `msg-box ${type}`;
  if (type === 'success') {
    setTimeout(() => { if (el) { el.textContent = ''; el.className = 'msg-box'; } }, 4000);
  }
}

function setLoading(btnId, loading, text = 'Loading...') {
  const btn = $(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${text}`;
  } else {
    btn.disabled = false;
  }
}

// ── API Fetch Wrapper ──────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
  if (body)      opts.body = JSON.stringify(body);

  const res  = await fetch(API + path, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════

function showLogin() {
  document.getElementById('main-nav').style.display = 'none';
  showPage('login-page');
  // Clear fields
  ['login-email','login-pass'].forEach(id => { if($(id)) $(id).value = ''; });
  if($('login-error')) $('login-error').textContent = '';
}

function showRegister() {
  document.getElementById('main-nav').style.display = 'none';
  showPage('register-page');
  if($('reg-message')) { $('reg-message').textContent = ''; $('reg-message').className = 'msg-box'; }
}

async function doLogin() {
  const email    = $('login-email')?.value?.trim();
  const password = $('login-pass')?.value;

  if (!email || !password) {
    return setMsg('login-error', '⚠ Please enter email and password.', 'error');
  }

  setLoading('login-btn', true, 'Signing in...');
  $('login-error').textContent = '';

  try {
    const data = await apiFetch('/auth/login', 'POST', { email, password });

    // Save token & user
    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem('nb_token', authToken);
    localStorage.setItem('nb_user',  JSON.stringify(currentUser));

    // Remember me
    if ($('remember-me')?.checked) {
      localStorage.setItem('nb_email', email);
    }

    goToDashboard();

  } catch (err) {
    setMsg('login-error', '❌ ' + err.message, 'error');
  } finally {
    if ($('login-btn')) {
      $('login-btn').disabled = false;
      $('login-btn').textContent = 'Sign In';
    }
  }
}

async function doRegister() {
  const firstName   = $('reg-fname')?.value?.trim();
  const lastName    = $('reg-lname')?.value?.trim();
  const email       = $('reg-email')?.value?.trim();
  const phone       = $('reg-phone')?.value?.trim();
  const address     = $('reg-address')?.value?.trim();
  const password    = $('reg-pass')?.value;
  const accountType = $('reg-type')?.value;

  // Validation
  if (!firstName || !lastName || !email || !phone || !address || !password) {
    return setMsg('reg-message', '⚠ Please fill all required fields.', 'error');
  }
  if (password.length < 8) {
    return setMsg('reg-message', '⚠ Password must be at least 8 characters.', 'error');
  }
  if (!email.includes('@')) {
    return setMsg('reg-message', '⚠ Please enter a valid email address.', 'error');
  }

  setLoading('reg-btn', true, 'Creating account...');

  try {
    const data = await apiFetch('/auth/register', 'POST', {
      firstName, lastName, email, phone, address, password, accountType
    });

    setMsg('reg-message',
      `✅ Account created! Your account number: ${data.accountNumber}. Redirecting to login...`,
      'success'
    );

    // Clear form
    ['reg-fname','reg-lname','reg-email','reg-phone','reg-address','reg-pass']
      .forEach(id => { if($(id)) $(id).value = ''; });

    setTimeout(showLogin, 2500);

  } catch (err) {
    setMsg('reg-message', '❌ ' + err.message, 'error');
  } finally {
    if ($('reg-btn')) {
      $('reg-btn').disabled = false;
      $('reg-btn').textContent = 'Create Account →';
    }
  }
}

function doLogout() {
  authToken   = null;
  currentUser = null;
  localStorage.removeItem('nb_token');
  localStorage.removeItem('nb_user');
  showLogin();
}

// ══════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════

function goToDashboard() {
  document.getElementById('main-nav').style.display = 'flex';
  showPage('dashboard-page');

  // Set user info
  if (currentUser) {
    $('user-name').textContent        = currentUser.firstName;
    $('user-account-no').textContent  = currentUser.accountNumber || '--';
    $('nav-username').textContent     = `${currentUser.firstName} ${currentUser.lastName}`;
    $('widget-acc-no').textContent    = currentUser.accountNumber || '--';
    $('widget-acc-type').textContent  = currentUser.accountType   || '--';
  }

  loadBalance();
  loadRecentTransactions();
}

function showDashboard() {
  showPage('dashboard-page');
  loadBalance();
  loadRecentTransactions();
}

async function loadBalance() {
  try {
    const data = await apiFetch('/account/balance');
    $('total-balance').textContent    = fmt(data.total);
    $('savings-balance').textContent  = fmt(data.savings);
    $('checking-balance').textContent = fmt(data.checking);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('token')) {
      doLogout();
    }
    $('total-balance').textContent = 'Error loading';
  }
}

async function loadRecentTransactions() {
  const list = $('txn-list');
  if (!list) return;
  list.innerHTML = '<div class="txn-loading">Loading transactions...</div>';

  try {
    const txns = await apiFetch('/transactions?limit=5');
    renderTransactions(list, txns);
  } catch (err) {
    list.innerHTML = '<div class="txn-empty">Could not load transactions</div>';
  }
}

function renderTransactions(container, txns) {
  if (!txns || txns.length === 0) {
    container.innerHTML = '<div class="txn-empty">No transactions yet. Make your first transfer!</div>';
    return;
  }
  container.innerHTML = txns.map(t => {
    const isCredit = t.type === 'credit';
    const date     = new Date(t.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    return `
      <div class="txn-item">
        <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? '↓' : '↑'}</div>
        <div class="txn-desc">
          <strong>${escHtml(t.description)}</strong>
          <span>${date}</span>
        </div>
        <div class="txn-amt ${isCredit ? 'credit' : 'debit'}">
          ${isCredit ? '+' : '-'}${fmt(t.amount)}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// TRANSFER
// ══════════════════════════════════════════════════════

function showTransfer() {
  showPage('dashboard-page');
  if ($('q-to')) $('q-to').focus();
}

async function doTransfer() {
  const toAccount = $('q-to')?.value?.trim();
  const amount    = parseFloat($('q-amount')?.value);
  const note      = $('q-note')?.value?.trim();

  if (!toAccount) return setMsg('transfer-msg', '⚠ Enter recipient account number.', 'error');
  if (!amount || amount <= 0) return setMsg('transfer-msg', '⚠ Enter a valid amount.', 'error');
  if (amount < 1) return setMsg('transfer-msg', '⚠ Minimum transfer is ₹1.', 'error');

  const btn = document.querySelector('.transfer-widget .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    const data = await apiFetch('/transactions/transfer', 'POST', { toAccount, amount, note });
    setMsg('transfer-msg', `✅ ₹${amount} sent successfully!`, 'success');
    $('q-to').value     = '';
    $('q-amount').value = '';
    $('q-note').value   = '';
    loadBalance();
    loadRecentTransactions();
  } catch (err) {
    setMsg('transfer-msg', '❌ ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Money →'; }
  }
}

// ══════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════

function showHistory() {
  showPage('history-page');
  loadAllTransactions();
}

async function loadAllTransactions() {
  const list = $('history-list');
  if (!list) return;
  list.innerHTML = '<div class="txn-loading">Loading all transactions...</div>';

  try {
    const txns = await apiFetch('/transactions?limit=100');
    if ($('txn-count')) $('txn-count').textContent = `${txns.length} transactions`;
    renderTransactions(list, txns);
  } catch (err) {
    list.innerHTML = '<div class="txn-empty">Could not load transaction history</div>';
  }
}

// ── Utility ─────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════
// INIT — Check if already logged in
// ══════════════════════════════════════════════════════
(function init() {
  // Pre-fill remembered email
  const savedEmail = localStorage.getItem('nb_email');
  if (savedEmail && $('login-email')) {
    $('login-email').value = savedEmail;
    if ($('remember-me')) $('remember-me').checked = true;
  }

  // Auto-login if valid token exists
  if (authToken && currentUser) {
    // Verify token is still valid by hitting a protected endpoint
    apiFetch('/account/balance')
      .then(() => goToDashboard())
      .catch(() => {
        // Token expired — clear and show login
        authToken = null; currentUser = null;
        localStorage.removeItem('nb_token');
        localStorage.removeItem('nb_user');
        showLogin();
      });
  } else {
    showLogin();
  }
})();
