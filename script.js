// ── RAZORPAY & GOOGLE SHEET CONFIG ──
const RAZORPAY_KEY = 'rzp_live_RDqX2u6rbGMpdM';
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbxUp54mGAOR8ZisItd9A5xc-WYOmgNRIS-kOCU9NKfMth5lOr7Dxzh4neMw4C2M-D-tUA/exec'; // replace after deploying appsscript.gs
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

// ── COUNTDOWN TO 30 APRIL 2026 ──
function updateCountdown() {
  const deadline = new Date('2026-04-30T23:59:59+05:30').getTime();
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

  return true;
}

// ── SEND TO GOOGLE SHEET ──
function sendToSheet(paymentId, status) {
  const payload = {
    token:      'BUKMUK2026SC',
    childName:  val('child_name'),
    childAge:   val('child_age'),
    theme:      val('theme'),
    storyTitle: val('story_title'),
    parentName: val('parent_name'),
    email:      val('email'),
    mobile:     val('mobile'),
    address:    val('address'),
    instagram:  val('instagram'),
    amount:     ENTRY_FEE,
    paymentId:  paymentId,
    status:     status,
    timestamp:  new Date().toISOString(),
  };

  fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
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
    description: 'Storywriting Competition 2026 — ' + val('theme').split(' (')[0],
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
      sendToSheet(response.razorpay_payment_id, 'PAID');
      showSuccess(response.razorpay_payment_id);
    },
    modal: {
      ondismiss: function() {
        btn.disabled = false;
        btn.textContent = 'Pay ₹490 & Register →';
      },
    },
  };

  // Log intent before opening modal — captures drop-offs too
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
  const childName  = val('child_name');
  const storyTitle = val('story_title');
  const parentEmail = val('email');

  const form = document.getElementById('entryForm');
  const urgency = document.querySelector('.urgency-bar');
  if (urgency) urgency.style.display = 'none';

  form.innerHTML = `
    <div class="success-state">
      <span class="success-icon">🎉</span>
      <h3>You're registered, ${childName.split(' ')[0]}!</h3>
      <p>Payment of <strong>₹490</strong> confirmed. The Bukmuk team will be in touch shortly.</p>
      <div class="payment-id-badge">Payment ID: ${paymentId}</div>
      <div class="email-cta-box">
        <strong>Next step:</strong> Email your story file (.docx or .pdf) to<br>
        <a href="mailto:helpdesk@bukmuk.com?subject=${encodeURIComponent(childName + ' — ' + storyTitle + ' — ' + paymentId)}"
           style="color:var(--accent-dark);font-size:1rem;">
          helpdesk@bukmuk.com
        </a><br>
        <span style="font-weight:600;opacity:0.8;font-size:0.82rem;margin-top:6px;display:block;">
          Subject line is pre-filled with your name, story title &amp; payment ID — just attach your file and send!
        </span>
      </div>
      <p style="margin-top:16px;font-size:0.82rem;color:#aaa;">
        Questions? Call Shefali: <a href="tel:+918130286286" style="color:var(--primary);">+91 81302 86286</a>
      </p>
    </div>
  `;
}
