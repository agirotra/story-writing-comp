// ── CONFIG ──
const RAZORPAY_KEY = 'rzp_live_RDqX2u6rbGMpdM';
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbwTZ2HTNZ87pG7yQrd3UOcXjvRlk8zN_Vgg9HlhstxvpLGigIR3kATUckCpAGKr_Hc_nw/exec';
const SHEET_TOKEN  = 'BUKMUK_STORYCOMP_2026';
const ENTRY_FEE    = 490;
const DEADLINE_ISO = '2026-08-31T23:59:59+05:30';

// Paste your GA4 Measurement ID here (looks like 'G-XXXXXXXXXX') to enable analytics.
// Left empty, no tracking script is loaded at all.
const GA4_ID = '';

const PAY_LABEL      = 'Pay ₹' + ENTRY_FEE + ' & Register →';
const PENDING_KEY    = 'bukmuk_pending_entry';
const DEADLINE_MS    = new Date(DEADLINE_ISO).getTime();

// ── ANALYTICS (no-op unless GA4_ID is set) ──
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

if (GA4_ID) {
  const ga = document.createElement('script');
  ga.async = true;
  ga.src   = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(ga);
  gtag('js', new Date());
  gtag('config', GA4_ID);
}

function track(event, params) {
  if (GA4_ID) gtag('event', event, params || {});
}

// ── MOBILE NAV ──
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// ── COUNTDOWN ──
function submissionsClosed() { return Date.now() > DEADLINE_MS; }

function updateCountdown() {
  const diff = DEADLINE_MS - Date.now();

  if (diff <= 0) {
    const el = document.querySelector('.countdown');
    if (el) el.innerHTML = '<p style="color:var(--accent-light);font-weight:800;font-size:1.1rem;">Submissions Closed</p>';
    closeRegistration();
    return;
  }

  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  document.getElementById('cd-days').textContent    = String(days).padStart(2, '0');
  document.getElementById('cd-hours').textContent   = String(hours).padStart(2, '0');
  document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
  document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');
}

// Once the deadline passes, stop taking money.
function closeRegistration() {
  const btn = document.getElementById('pay-btn');
  if (btn && !btn.dataset.closed) {
    btn.dataset.closed = '1';
    btn.disabled    = true;
    btn.textContent = 'Submissions are now closed';
  }
  const urgency = document.querySelector('.urgency-bar');
  if (urgency) urgency.innerHTML = '🔒 <span>Entries for 2026 are now closed</span> — follow @bukmuklibrary for results';
}

updateCountdown();
setInterval(updateCountdown, 1000);

// ── ACTIVE NAV ON SCROLL ──
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navAnchors.forEach(a => { a.style.color = ''; a.style.background = ''; });
    const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
    if (active) { active.style.color = 'var(--primary)'; active.style.background = 'rgba(62,35,192,0.06)'; }
  });
}, { threshold: 0.35 });

sections.forEach(s => navObserver.observe(s));

// ── FILE UPLOAD UI ──
const storyFileInput  = document.getElementById('story_file');
const uploadZone      = document.getElementById('upload-zone');
const fileNameDisplay = document.getElementById('file-name-display');

if (storyFileInput) {
  storyFileInput.addEventListener('change', () => {
    const file = storyFileInput.files[0];
    if (file) {
      uploadZone.classList.add('has-file');
      fileNameDisplay.style.display = 'block';
      fileNameDisplay.textContent   = '✓ ' + file.name;
    } else {
      uploadZone.classList.remove('has-file');
      fileNameDisplay.style.display = 'none';
    }
  });
}

// ── FORM VALIDATION ──
function val(id) { return (document.getElementById(id) || {}).value || ''; }
function checked(id) { return !!(document.getElementById(id) || {}).checked; }

function markError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('error');
  el.focus();
  setTimeout(() => el.classList.remove('error'), 2000);
}

function markConsentError(id) {
  const el  = document.getElementById(id);
  const row = el && el.closest('.consent-row');
  if (!row) return;
  row.classList.add('error');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => row.classList.remove('error'), 2500);
}

// Age band each category is open to — keyed by the category name before " (".
const CATEGORY_AGES = {
  'Whispers of the Wild': [6, 8],
  'Twisted Fairytales':   [9, 11],
  'Dystopia Hopepunk':    [12, 17],
};

function validateForm() {
  const required = [
    { id: 'child_name',  label: "Child's name" },
    { id: 'child_age',   label: "Child's age" },
    { id: 'theme',       label: 'Story category' },
    { id: 'story_title', label: 'Story title' },
    { id: 'parent_name', label: "Parent's name" },
    { id: 'mobile',      label: 'Mobile number' },
    { id: 'email',       label: 'Email address' },
    { id: 'address',     label: 'Delivery address' },
  ];

  for (const field of required) {
    if (!val(field.id).trim()) {
      markError(field.id);
      return false;
    }
  }

  const email = val('email').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    markError('email');
    return false;
  }

  const age = parseInt(val('child_age'), 10);
  if (isNaN(age) || age < 6 || age > 17) {
    markError('child_age');
    return false;
  }

  // Age must fall inside the chosen category's band.
  const categoryName = val('theme').split(' (')[0];
  const band = CATEGORY_AGES[categoryName];
  if (band && (age < band[0] || age > band[1])) {
    alert(
      'Age ' + age + ' does not match the category you picked.\n\n' +
      categoryName + ' is for ages ' + band[0] + '–' + band[1] + '.\n\n' +
      'Please choose the category that matches your age group.'
    );
    markError('theme');
    return false;
  }

  // File
  const fileInput = document.getElementById('story_file');
  if (!fileInput || !fileInput.files[0]) {
    uploadZone.style.borderColor = '#e53935';
    uploadZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => uploadZone.style.borderColor = '', 2000);
    return false;
  }

  const file = fileInput.files[0];
  if (file.size > 10 * 1024 * 1024) {
    alert('File size exceeds 10MB. Please compress your file and try again.');
    return false;
  }

  // Declarations
  if (!checked('consent_original')) { markConsentError('consent_original'); return false; }
  if (!checked('consent_publish'))  { markConsentError('consent_publish');  return false; }

  return true;
}

// ── SUBMISSION ID (one per attempt, lets the backend reject duplicates) ──
let submissionId = null;

function newSubmissionId() {
  const rand = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID().split('-')[0]
    : Math.random().toString(36).slice(2, 10);
  return 'sub_' + Date.now().toString(36) + '_' + rand;
}

// ── POST TO APPS SCRIPT ──
// Tries a readable (CORS) request so delivery can actually be confirmed. If the
// browser blocks reading the response, falls back to a blind no-cors send so the
// data still has a chance to land — the backend de-dupes on submissionId.
async function postToScript(payload) {
  const body = JSON.stringify(payload);

  try {
    const res  = await fetch(SCRIPT_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     body,
      redirect: 'follow',
    });
    const text = (await res.text()).trim();

    if (res.ok && /^(OK|DUPLICATE)/i.test(text)) return { ok: true, confirmed: true };
    return { ok: false, confirmed: true, detail: text || ('HTTP ' + res.status) };

  } catch (corsErr) {
    // Could not read the response. The request may still have been delivered.
    try {
      await fetch(SCRIPT_URL, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:    body,
      });
      return { ok: true, confirmed: false };
    } catch (blindErr) {
      return { ok: false, confirmed: false, detail: String(corsErr && corsErr.message || corsErr) };
    }
  }
}

// Retry with backoff. Duplicates are safe — the backend keys on submissionId.
async function postWithRetry(payload, attempts) {
  const delays = [0, 1500, 4000, 9000];
  const max    = attempts || delays.length;
  let last     = { ok: false, confirmed: false, detail: 'not attempted' };

  for (let i = 0; i < max; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
    last = await postToScript(payload);
    if (last.ok) return last;
  }
  return last;
}

function buildPayload(paymentId, status, file) {
  return {
    token:        SHEET_TOKEN,
    submissionId: submissionId,
    childName:    val('child_name'),
    childAge:     val('child_age'),
    theme:        val('theme'),
    storyTitle:   val('story_title'),
    parentName:   val('parent_name'),
    email:        val('email'),
    mobile:       val('mobile'),
    address:      val('address'),
    instagram:    val('instagram'),
    consentOriginal: checked('consent_original') ? 'YES' : 'NO',
    consentPublish:  checked('consent_publish')  ? 'YES' : 'NO',
    amount:       ENTRY_FEE,
    paymentId:    paymentId,
    status:       status,
    timestamp:    new Date().toISOString(),
    fileBase64:   (file && file.base64)   || null,
    fileName:     (file && file.name)     || '',
    fileMimeType: (file && file.mimeType) || '',
  };
}

// ── READ FILE AS BASE64 ──
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const parts = String(reader.result).split(',');
      parts[1] ? resolve(parts[1]) : reject(new Error('Empty file data'));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── AFTER PAYMENT: UPLOAD STORY + RECORD ENTRY ──
async function uploadAndFinish(paymentId) {
  const btn       = document.getElementById('pay-btn');
  const fileInput = document.getElementById('story_file');
  const file      = fileInput && fileInput.files[0];

  if (btn) { btn.disabled = true; btn.textContent = 'Saving your entry… please do not close this page'; }

  let filePart = null;
  if (file) {
    try {
      filePart = { base64: await readFileAsBase64(file), name: file.name, mimeType: file.type };
    } catch (readErr) {
      filePart = null; // Record the entry anyway; we ask for the file by email below.
    }
  }

  // Attempt 1: full payload including the story file.
  let result = await postWithRetry(buildPayload(paymentId, 'PAID', filePart));

  // Attempt 2: if that failed and a file was attached, the size may be the problem.
  // Save the entry without the file so the paid registration is at least on record.
  let fileLanded = result.ok;
  if (!result.ok && filePart) {
    result     = await postWithRetry(buildPayload(paymentId, 'PAID', null), 2);
    fileLanded = false;
  }

  if (result.ok) {
    localStorage.removeItem(PENDING_KEY);
    track('purchase', {
      transaction_id: paymentId,
      value: ENTRY_FEE,
      currency: 'INR',
      items: [{ item_name: val('theme').split(' (')[0] }],
    });
    showSuccess(paymentId, fileLanded ? null : 'file-missing');
    return;
  }

  // Nothing got through. Keep the details locally so a later visit can retry,
  // and tell the parent the truth.
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(buildPayload(paymentId, 'PAID', null)));
  } catch (storageErr) { /* private browsing / quota — nothing more we can do */ }

  track('submission_failed', { transaction_id: paymentId });
  showRecovery(paymentId, result.detail);
}

// ── RETRY A PREVIOUSLY STRANDED ENTRY ON NEXT VISIT ──
(async function flushPendingEntry() {
  let raw;
  try { raw = localStorage.getItem(PENDING_KEY); } catch (e) { return; }
  if (!raw) return;

  let payload;
  try { payload = JSON.parse(raw); } catch (e) { localStorage.removeItem(PENDING_KEY); return; }

  const result = await postToScript(payload);
  if (result.ok) localStorage.removeItem(PENDING_KEY);
})();

// ── RAZORPAY PAYMENT ──
function startPayment() {
  if (submissionsClosed()) { closeRegistration(); return; }
  if (!validateForm()) return;

  submissionId = newSubmissionId();

  const btn = document.getElementById('pay-btn');
  btn.disabled    = true;
  btn.textContent = 'Opening payment…';

  const categoryName = val('theme').split(' (')[0];

  track('begin_checkout', {
    value: ENTRY_FEE,
    currency: 'INR',
    items: [{ item_name: categoryName }],
  });

  const options = {
    key:         RAZORPAY_KEY,
    amount:      ENTRY_FEE * 100,
    currency:    'INR',
    name:        'Bukmuk Library & Publishing',
    description: 'Short Story Writing Competition 2026 — ' + categoryName,
    image:       'https://bukmuk.com/assets/darklogo.png',
    prefill: {
      name:    val('parent_name'),
      email:   val('email'),
      contact: val('mobile'),
    },
    notes: {
      childName:    val('child_name'),
      storyTitle:   val('story_title'),
      theme:        val('theme'),
      submissionId: submissionId,
    },
    theme: { color: '#3e23c0' },
    handler: function(response) {
      uploadAndFinish(response.razorpay_payment_id);
    },
    modal: {
      ondismiss: function() {
        btn.disabled    = false;
        btn.textContent = PAY_LABEL;
        track('checkout_abandoned', { value: ENTRY_FEE, currency: 'INR' });
      },
    },
  };

  // Log intent before the modal opens so drop-offs are captured. Fire and forget:
  // this must not delay checkout, and the backend sends no email for it directly.
  postWithRetry(buildPayload('NOT-PAID-YET', 'INTENT', null), 2);

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function() {
    btn.disabled    = false;
    btn.textContent = PAY_LABEL;
    track('payment_failed', { value: ENTRY_FEE, currency: 'INR' });
    alert('Payment failed. Please try again or contact helpdesk@bukmuk.com');
  });
  rzp.open();
}

// ── SUCCESS STATE ──
function showSuccess(paymentId, warning) {
  const childName = val('child_name');
  const form      = document.getElementById('entryForm');
  const urgency   = document.querySelector('.urgency-bar');
  if (urgency) urgency.style.display = 'none';

  const fileWarning = warning === 'file-missing' ? `
      <div class="recovery-box">
        <strong>One thing left to do</strong><br>
        Your registration and payment are confirmed, but we could not attach your story file.
        Please email it to <a href="mailto:helpdesk@bukmuk.com">helpdesk@bukmuk.com</a>
        quoting the payment ID below. Your entry is safe.
      </div>` : '';

  form.innerHTML = `
    <div class="success-state">
      <span class="success-icon">🎉</span>
      <h3>You're in, ${childName.split(' ')[0]}!</h3>
      <p>Payment of <strong>₹${ENTRY_FEE}</strong> confirmed${warning ? '' : ' and your story has been submitted'}.</p>
      <div class="payment-id-badge">Payment ID: ${paymentId}</div>
      ${fileWarning}
      <div class="email-cta-box">
        <strong>What happens next?</strong><br>
        Our literary jury will evaluate all entries. The top 10 stories in each
        category will be published in the Bukmuk Anthology — in India and internationally.<br><br>
        Follow <strong>@bukmuklibrary</strong> on Instagram for results and updates.
      </div>
      <p style="margin-top:16px;font-size:0.82rem;color:#aaa;">
        Questions? <a href="mailto:helpdesk@bukmuk.com" style="color:var(--primary);">helpdesk@bukmuk.com</a>
        · Call Shefali: <a href="tel:+918130286286" style="color:var(--primary);">+91 81302 86286</a>
      </p>
    </div>
  `;
}

// ── PAID BUT NOT RECORDED ──
function showRecovery(paymentId, detail) {
  const form    = document.getElementById('entryForm');
  const urgency = document.querySelector('.urgency-bar');
  if (urgency) urgency.style.display = 'none';

  form.innerHTML = `
    <div class="success-state">
      <span class="success-icon">⚠️</span>
      <h3>Payment received — one step left</h3>
      <p>
        Your payment of <strong>₹${ENTRY_FEE}</strong> went through, but we could not save your
        entry automatically. <strong>Your money is safe and your place is not lost.</strong>
      </p>
      <div class="recovery-box">
        <strong>Please do this now so we can confirm your entry:</strong><br>
        Email <a href="mailto:helpdesk@bukmuk.com?subject=Entry%20not%20recorded%20-%20${encodeURIComponent(paymentId)}">helpdesk@bukmuk.com</a>
        with your story file attached, or WhatsApp Shefali on
        <a href="tel:+918130286286">+91 81302 86286</a>. Quote the reference below.
        <div class="recovery-details">Payment ID: ${paymentId}
Reference: ${submissionId || 'n/a'}
Child: ${val('child_name')} · ${val('story_title')}${detail ? '\nError: ' + detail : ''}</div>
      </div>
      <p style="margin-top:16px;font-size:0.82rem;color:#aaa;">
        We will confirm by email within 24 hours. Please take a screenshot of this page.
      </p>
    </div>
  `;
}
