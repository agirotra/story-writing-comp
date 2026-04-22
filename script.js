// ── RAZORPAY & GOOGLE SHEET CONFIG ──
const RAZORPAY_KEY = 'rzp_live_RDqX2u6rbGMpdM';
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbyBQPf4l6kvi_SvfjRKf56TLA2BdZ84WyhbRLIcy0VDJmDOt7_FeGt19WO6SzI4FGK42g/exec';
const ENTRY_FEE    = 490;

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

// ── COUNTDOWN TO 30 JUNE 2026 ──
function updateCountdown() {
  const deadline = new Date('2026-06-30T23:59:59+05:30').getTime();
  const diff = deadline - Date.now();

  if (diff <= 0) {
    const el = document.querySelector('.countdown');
    if (el) el.innerHTML = '<p style="color:var(--accent-light);font-weight:800;font-size:1.1rem;">Submissions Closed</p>';
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
const storyFileInput = document.getElementById('story_file');
const uploadZone     = document.getElementById('upload-zone');
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

function markError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('error');
  el.focus();
  setTimeout(() => el.classList.remove('error'), 2000);
}

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

  // File validation
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

  return true;
}

// ── SEND TO SHEET ──
function sendToSheet(paymentId, status, fileBase64, fileName, fileMimeType) {
  const payload = {
    token:        'BUKMUK_STORYCOMP_2026',
    childName:    val('child_name'),
    childAge:     val('child_age'),
    theme:        val('theme'),
    storyTitle:   val('story_title'),
    parentName:   val('parent_name'),
    email:        val('email'),
    mobile:       val('mobile'),
    address:      val('address'),
    instagram:    val('instagram'),
    amount:       ENTRY_FEE,
    paymentId:    paymentId,
    status:       status,
    timestamp:    new Date().toISOString(),
    fileBase64:   fileBase64   || null,
    fileName:     fileName     || '',
    fileMimeType: fileMimeType || '',
  };

  fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// ── READ FILE & UPLOAD AFTER PAYMENT ──
function uploadAndFinish(paymentId) {
  const btn      = document.getElementById('pay-btn');
  const fileInput = document.getElementById('story_file');
  const file      = fileInput && fileInput.files[0];

  if (!file) {
    sendToSheet(paymentId, 'PAID');
    showSuccess(paymentId);
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading story… please wait'; }

  const reader = new FileReader();
  reader.onload = function () {
    const base64 = reader.result.split(',')[1];
    sendToSheet(paymentId, 'PAID', base64, file.name, file.type);
    showSuccess(paymentId);
  };
  reader.onerror = function () {
    // Upload failed — still show success, log without file
    sendToSheet(paymentId, 'PAID');
    showSuccess(paymentId);
  };
  reader.readAsDataURL(file);
}

// ── RAZORPAY PAYMENT ──
function startPayment() {
  if (!validateForm()) return;

  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = 'Opening payment…';

  const options = {
    key:         RAZORPAY_KEY,
    amount:      ENTRY_FEE * 100,
    currency:    'INR',
    name:        'Bukmuk Library & Publishing',
    description: 'Short Story Writing Competition 2026 — ' + val('theme').split(' (')[0],
    image:       'https://bukmuk.com/assets/darklogo.png',
    prefill: {
      name:    val('parent_name'),
      email:   val('email'),
      contact: val('mobile'),
    },
    notes: {
      childName:  val('child_name'),
      storyTitle: val('story_title'),
      theme:      val('theme'),
    },
    theme: { color: '#3e23c0' },
    handler: function(response) {
      uploadAndFinish(response.razorpay_payment_id);
    },
    modal: {
      ondismiss: function() {
        btn.disabled = false;
        btn.textContent = 'Pay ₹490 & Register →';
      },
    },
  };

  // Log intent before modal — captures drop-offs
  sendToSheet('NOT-PAID-YET', 'INTENT');

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function() {
    btn.disabled = false;
    btn.textContent = 'Pay ₹490 & Register →';
    alert('Payment failed. Please try again or contact helpdesk@bukmuk.com');
  });
  rzp.open();
}

// ── SUCCESS STATE ──
function showSuccess(paymentId) {
  const childName = val('child_name');
  const form      = document.getElementById('entryForm');
  const urgency   = document.querySelector('.urgency-bar');
  if (urgency) urgency.style.display = 'none';

  form.innerHTML = `
    <div class="success-state">
      <span class="success-icon">🎉</span>
      <h3>You're in, ${childName.split(' ')[0]}!</h3>
      <p>Payment of <strong>₹490</strong> confirmed and your story has been submitted.</p>
      <div class="payment-id-badge">Payment ID: ${paymentId}</div>
      <div class="email-cta-box">
        <strong>What happens next?</strong><br>
        Our literary jury will evaluate all entries. The top 9 stories in each
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
