const API = '/api';

/* ── Inline SVG icons (no emojis) ─────────────────────────────────────── */
function icon(inner, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
const ICON = {
  camera:  '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  user:    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:   '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  box:     '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
  heart:   '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78z"/>',
  building:'<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:     '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  phone:   '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail:    '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
};

/* ── Toast ─────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

/* ── API helper ──────────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function validatePhone(phone) {
  return /^\+7[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(phone.trim());
}

/* ── Auth state ──────────────────────────────────────────────────────── */
function getSession() {
  const token = localStorage.getItem('token');
  return token ? { token, fullName: localStorage.getItem('fullName'), role: localStorage.getItem('role') } : null;
}
function saveSession({ token, fullName, role = 'client' }) {
  localStorage.setItem('token', token);
  localStorage.setItem('fullName', fullName);
  localStorage.setItem('role', role);
  updateAuthUI();
}
function clearSession() {
  ['token', 'fullName', 'role'].forEach(k => localStorage.removeItem(k));
  updateAuthUI();
}
function updateAuthUI() {
  const session = getSession();
  const greeting  = document.getElementById('user-greeting');
  const authBtn   = document.getElementById('auth-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const dashLink  = document.getElementById('dashboard-link');
  const rfWrap    = document.getElementById('review-form-wrap');

  if (session) {
    greeting.textContent = `Привет, ${session.fullName}`;
    greeting.classList.remove('hidden');
    authBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    dashLink.classList.toggle('hidden', !(session.role === 'admin' || session.role === 'employee'));
    if (session.role === 'client') loadReviewForm();
    const fbName = document.getElementById('fb-name');
    if (fbName && !fbName.value) fbName.value = session.fullName;
  } else {
    greeting.classList.add('hidden');
    authBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    dashLink.classList.add('hidden');
    if (rfWrap) rfWrap.classList.add('hidden');
  }
}

/* ── Smooth scroll ───────────────────────────────────────────────────── */
function initSmoothScroll() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('mobile-nav').classList.add('hidden');
    }
  });
}

/* ── Header scroll ───────────────────────────────────────────────────── */
function initHeaderScroll() {
  const header = document.getElementById('header');
  const update = () => header.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initBurger() {
  const burger    = document.getElementById('burger');
  const mobileNav = document.getElementById('mobile-nav');
  burger.addEventListener('click', () => mobileNav.classList.toggle('hidden'));
}

/* ── Reveal on scroll ────────────────────────────────────────────────── */
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  elements.forEach((el, i) => {
    el.style.transform = i % 2 === 0 ? 'translate(-55px, 30px)' : 'translate(55px, 30px)';
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  elements.forEach(el => observer.observe(el));
}

/* ── Animated stat counters ──────────────────────────────────────────── */
function initCounters() {
  const nums = document.querySelectorAll('.stat-num[data-count]');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const dur = 1400; const start = performance.now();
      function step(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  nums.forEach(n => obs.observe(n));
}

/* ── Lightbox ────────────────────────────────────────────────────────── */
let lbImages = [];
let lbIndex = 0;
function openLightbox(images, index = 0) {
  if (!images || !images.length) return;
  lbImages = images; lbIndex = index;
  renderLightbox();
  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function renderLightbox() {
  const img = lbImages[lbIndex];
  document.getElementById('lb-img').src = img.full;
  document.getElementById('lb-caption').textContent = img.caption || '';
  document.getElementById('lb-counter').textContent = `${lbIndex + 1} / ${lbImages.length}`;
}
function lbMove(d) { lbIndex = (lbIndex + d + lbImages.length) % lbImages.length; renderLightbox(); }
function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
}
function initLightbox() {
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', () => lbMove(-1));
  document.getElementById('lb-next').addEventListener('click', () => lbMove(1));
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lbMove(-1);
    if (e.key === 'ArrowRight') lbMove(1);
  });
}

/* ── Unsplash helpers ────────────────────────────────────────────────── */
function uPhoto(id, caption) {
  return {
    thumb: `https://images.unsplash.com/photo-${id}?w=640&q=80&auto=format&fit=crop`,
    full:  `https://images.unsplash.com/photo-${id}?w=1500&q=85&auto=format&fit=crop`,
    caption: caption || '',
  };
}

/* ── Auth modal (login + 2-step register) ────────────────────────────── */
let pendingReg = null; // { email, password, fullName }

function initAuthModal() {
  const modal     = document.getElementById('auth-modal');
  const openBtn   = document.getElementById('auth-btn');
  const closeBtn  = document.getElementById('auth-modal-close');
  const logoutBtn = document.getElementById('logout-btn');

  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const verifyForm   = document.getElementById('verify-form');

  function showForm(which) {
    loginForm.classList.toggle('hidden', which !== 'login');
    registerForm.classList.toggle('hidden', which !== 'register');
    verifyForm.classList.toggle('hidden', which !== 'verify');
  }
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    showForm(name);
  }
  function openModal(tab) { modal.classList.remove('hidden'); switchTab(tab || 'login'); }
  function closeModal()   { modal.classList.add('hidden'); }

  openBtn.addEventListener('click',  () => openModal('login'));
  closeBtn.addEventListener('click', closeModal);
  logoutBtn.addEventListener('click', () => { clearSession(); showToast('Вы вышли из системы'); });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Login
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('login-msg');
    msg.className = 'form-msg';
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({
          email:    document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value,
        }),
      });
      saveSession({ token: data.token, fullName: data.fullName, role: data.role });
      closeModal();
      loginForm.reset();
      showToast(`Добро пожаловать, ${data.fullName}!`);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  // Register step 1 → request code
  async function requestCode() {
    pendingReg = {
      fullName: document.getElementById('reg-name').value.trim(),
      email:    document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
    };
    await apiFetch('/register', { method: 'POST', body: JSON.stringify(pendingReg) });
    document.getElementById('verify-email').textContent = pendingReg.email;
    document.getElementById('verify-code').value = '';
    document.getElementById('verify-msg').textContent = '';
    showForm('verify');
  }

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('register-msg');
    msg.className = 'form-msg';
    try {
      await requestCode();
      showToast('Код отправлен на вашу почту');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  // Register step 2 → verify code
  verifyForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('verify-msg');
    msg.className = 'form-msg';
    try {
      const data = await apiFetch('/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email: pendingReg.email, code: document.getElementById('verify-code').value.trim() }),
      });
      saveSession({ token: data.token, fullName: data.fullName, role: data.role });
      closeModal();
      registerForm.reset();
      verifyForm.reset();
      pendingReg = null;
      showToast('Регистрация завершена. Добро пожаловать!');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  document.getElementById('verify-resend').addEventListener('click', async () => {
    const msg = document.getElementById('verify-msg');
    msg.className = 'form-msg';
    try { await requestCode(); showToast('Новый код отправлен'); }
    catch (err) { msg.textContent = err.message; msg.className = 'form-msg error'; }
  });
  document.getElementById('verify-back').addEventListener('click', () => switchTab('register'));
}

/* ── Booking modal ───────────────────────────────────────────────────── */
function initBookingModal() {
  const modal    = document.getElementById('booking-modal');
  const closeBtn = document.getElementById('booking-modal-close');
  const fab      = document.getElementById('fab');
  const heroCta  = document.getElementById('hero-cta');
  const aboutCta = document.getElementById('about-cta');

  function openModal() {
    modal.classList.remove('hidden');
    const session = getSession();
    if (session) {
      const nameEl = document.getElementById('client_name');
      if (nameEl && !nameEl.value) nameEl.value = session.fullName;
    }
  }
  function closeModal() { modal.classList.add('hidden'); }

  [fab, heroCta, aboutCta].forEach(btn => btn && btn.addEventListener('click', openModal));
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('booking-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('booking-msg');
    msg.className = 'form-msg';
    const name  = document.getElementById('client_name').value.trim();
    const phone = document.getElementById('client_phone').value.trim();
    const svc   = document.getElementById('service').value;
    if (!name)  { msg.textContent = 'Введите ваше имя'; msg.className = 'form-msg error'; return; }
    if (!validatePhone(phone)) { msg.textContent = 'Введите телефон: +7 (999) 000-00-00'; msg.className = 'form-msg error'; return; }
    if (!svc)   { msg.textContent = 'Выберите услугу'; msg.className = 'form-msg error'; return; }
    try {
      await apiFetch('/bookings', { method: 'POST', body: JSON.stringify({ client_name: name, client_phone: phone, service: svc }) });
      closeModal();
      e.target.reset();
      showToast('Заявка принята! Ожидайте подтверждения на email.');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

window.openBookingForService = function (name) {
  document.getElementById('booking-modal').classList.remove('hidden');
  const sel = document.getElementById('service');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === name) { sel.selectedIndex = i; break; }
  }
};

/* ── Services ────────────────────────────────────────────────────────── */
const SERVICE_ICONS = {
  'Портретная съёмка':    ICON.user,
  'Семейная фотосессия':  ICON.users,
  'Предметная съёмка':    ICON.box,
  'Свадебная фотосессия': ICON.heart,
  'Аренда помещения':     ICON.building,
};
const SERVICE_EXAMPLES = {
  'Портретная съёмка': [
    uPhoto('1531746020798-e6953c6e8e04', 'Портретная съёмка'),
    uPhoto('1506794778202-cad84cf45f1d', 'Портретная съёмка'),
    uPhoto('1524504388940-b1c1722653e1', 'Портретная съёмка'),
    uPhoto('1463453091185-61582044d556', 'Портретная съёмка'),
  ],
  'Семейная фотосессия': [
    uPhoto('1511895426328-dc8714191300', 'Семейная фотосессия'),
    uPhoto('1492725764893-90b379c2b6e7', 'Семейная фотосессия'),
    uPhoto('1609220136736-443140cffec6', 'Семейная фотосессия'),
  ],
  'Предметная съёмка': [
    uPhoto('1523275335684-37898b6baf30', 'Предметная съёмка'),
    uPhoto('1542291026-7eec264c27ff', 'Предметная съёмка'),
    uPhoto('1505740420928-5e560c06d30e', 'Предметная съёмка'),
  ],
  'Свадебная фотосессия': [
    uPhoto('1519741497674-611481863552', 'Свадебная фотосессия'),
    uPhoto('1465495976277-4387d4b0b4c6', 'Свадебная фотосессия'),
    uPhoto('1511285560929-80b456fea0bc', 'Свадебная фотосессия'),
    uPhoto('1606800052052-a08af7148866', 'Свадебная фотосессия'),
  ],
  'Аренда помещения': [
    uPhoto('1542038784456-1ea8e935640e', 'Фотостудия'),
    uPhoto('1497366216548-37526070297c', 'Фотостудия'),
    uPhoto('1497366811353-6870744d04b2', 'Фотостудия'),
  ],
};

async function loadServices() {
  const grid   = document.getElementById('services-list');
  const select = document.getElementById('service');
  try {
    const services = await apiFetch('/services');
    if (!services.length) { grid.innerHTML = '<p class="loading-text">Услуги временно недоступны</p>'; return; }
    grid.innerHTML = '';
    services.forEach(s => {
      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <div class="service-icon">${icon(SERVICE_ICONS[s.name] || ICON.camera, 30)}</div>
        <h3>${esc(s.name)}</h3>
        <div class="service-price">${s.price.toLocaleString('ru-RU')} ₽</div>
        <div class="service-duration">${icon(ICON.clock, 14)} ${s.duration} мин</div>
        <div class="service-actions">
          <button class="btn btn--sm book-btn">Записаться</button>
          <button class="btn btn--sm btn--outline service-examples-btn">Примеры работ</button>
        </div>`;
      card.querySelector('.book-btn').addEventListener('click', () => window.openBookingForService(s.name));
      card.querySelector('.service-examples-btn').addEventListener('click', () => {
        openLightbox(SERVICE_EXAMPLES[s.name] || galleryImages, 0);
      });
      grid.appendChild(card);
    });
    select.innerHTML = '<option value="">Выберите услугу</option>' +
      services.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  } catch {
    grid.innerHTML = '<p class="loading-text">Не удалось загрузить услуги</p>';
  }
}

/* ── Team 3D portrait carousel ───────────────────────────────────────── */
const ROLE_LABELS = { photographer: 'Фотограф', manager: 'Менеджер', admin: 'Администратор', stylist: 'Стилист', retoucher: 'Ретушёр' };
const TEAM_PHOTOS = [
  '1500648767791-00dcc994a43e',
  '1494790108377-be9c29b29330',
  '1507003211169-0a1dd7228f2d',
  '1438761681033-6461ffad8d80',
  '1472099645785-5658abf4ff4e',
  '1544005313-94ddf0286df2',
  '1519345182560-3f2917c472ef',
  '1573497019940-1c28c88b4f3e',
];
let teamCards = [];
let teamActive = 0;

async function loadTeam() {
  const carousel = document.getElementById('team-carousel');
  try {
    const team = await apiFetch('/team');
    if (!team.length) { carousel.innerHTML = '<p class="loading-text">Команда скоро появится</p>'; return; }
    carousel.innerHTML = '';
    teamCards = team.map((m, i) => {
      const photo = TEAM_PHOTOS[i % TEAM_PHOTOS.length];
      const card = document.createElement('div');
      card.className = 'carousel-card';
      card.innerHTML = `
        <img class="carousel-photo" src="https://images.unsplash.com/photo-${photo}?w=560&h=800&fit=crop&crop=faces&q=80" alt="${esc(m.full_name)}" />
        <div class="carousel-caption">
          <div class="carousel-name">${esc(m.full_name)}</div>
          <span class="carousel-role">${esc(ROLE_LABELS[m.employee_type] || m.employee_type || 'Сотрудник')}</span>
        </div>`;
      card.addEventListener('click', () => { if (i !== teamActive) { teamActive = i; layoutCarousel(); } });
      carousel.appendChild(card);
      return card;
    });
    teamActive = Math.floor(team.length / 2);
    layoutCarousel();
    document.getElementById('team-prev').addEventListener('click', () => moveCarousel(-1));
    document.getElementById('team-next').addEventListener('click', () => moveCarousel(1));
    window.addEventListener('resize', layoutCarousel);
  } catch {
    carousel.innerHTML = '<p class="loading-text">Не удалось загрузить команду</p>';
  }
}

function carouselSettings() {
  const w = window.innerWidth;
  if (w < 640) return { maxVisible: 1, spacing: 105, rot: 22 };
  if (w < 960) return { maxVisible: 1, spacing: 150, rot: 26 };
  return { maxVisible: 2, spacing: 165, rot: 30 };
}

function layoutCarousel() {
  const { maxVisible, spacing, rot } = carouselSettings();
  teamCards.forEach((card, i) => {
    const offset = i - teamActive;
    const abs = Math.abs(offset);
    if (abs > maxVisible) {
      card.style.opacity = '0';
      card.style.pointerEvents = 'none';
      card.style.zIndex = '0';
      card.style.transform = `translate(-50%,-50%) translateX(${Math.sign(offset) * (maxVisible + 1) * spacing}px) scale(0.5) rotateY(${-Math.sign(offset) * rot}deg)`;
      card.classList.remove('is-center');
      return;
    }
    const scale = Math.max(0.7, 1 - abs * 0.16);
    const rotateY = -Math.sign(offset) * abs * rot;
    card.style.transform = `translate(-50%,-50%) translateX(${offset * spacing}px) scale(${scale}) rotateY(${rotateY}deg)`;
    card.style.opacity = abs === 0 ? '1' : String(0.92 - abs * 0.12);
    card.style.zIndex = String(100 - abs);
    card.style.pointerEvents = 'auto';
    card.classList.toggle('is-center', offset === 0);
  });
}
function moveCarousel(dir) {
  teamActive = Math.min(teamCards.length - 1, Math.max(0, teamActive + dir));
  layoutCarousel();
}

/* ── Gallery grid + lightbox ─────────────────────────────────────────── */
const galleryImages = [
  uPhoto('1452587925148-ce544e77e70d', 'За кадром'),
  uPhoto('1519741497674-611481863552', 'Свадебная съёмка'),
  uPhoto('1531746020798-e6953c6e8e04', 'Портрет'),
  uPhoto('1542038784456-1ea8e935640e', 'Студия'),
  uPhoto('1505740420928-5e560c06d30e', 'Предметная съёмка'),
  uPhoto('1511895426328-dc8714191300', 'Семейная съёмка'),
  uPhoto('1506794778202-cad84cf45f1d', 'Мужской портрет'),
  uPhoto('1524504388940-b1c1722653e1', 'Женский портрет'),
  uPhoto('1465495976277-4387d4b0b4c6', 'Свадьба'),
  uPhoto('1492691527719-9d1e07e534b4', 'Творческое фото'),
  uPhoto('1469334031218-e382a71b716b', 'Фэшн-съёмка'),
  uPhoto('1503104834685-7205e8607eb9', 'Пара'),
  uPhoto('1488161628813-04466f872be2', 'Портрет в студии'),
  uPhoto('1529626455594-4ff0802cfb7e', 'Студийный свет'),
];
const GALLERY_LAYOUT = ['tall', '', '', 'wide', '', 'tall', '', '', 'wide', '', 'tall', '', '', ''];

function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  galleryImages.forEach((img, i) => {
    const cell = document.createElement('div');
    cell.className = `gallery-cell ${GALLERY_LAYOUT[i] || ''}`.trim();
    cell.innerHTML = `<img src="${img.thumb}" alt="${esc(img.caption)}" loading="lazy" />`;
    cell.addEventListener('click', () => openLightbox(galleryImages, i));
    grid.appendChild(cell);
  });
}

/* ── Reviews slider ──────────────────────────────────────────────────── */
let reviewsData = [];
let currentSlide = 0;

async function loadReviews() {
  const track = document.getElementById('slider-track');
  try {
    reviewsData = await apiFetch('/reviews');
    if (!reviewsData.length) {
      track.innerHTML = `<div class="review-card"><p class="loading-text">Отзывов пока нет — станьте первым!</p></div>`;
      return;
    }
    renderSlider();
  } catch {
    track.innerHTML = `<div class="review-card"><p class="loading-text">Не удалось загрузить отзывы</p></div>`;
  }
}
function renderSlider() {
  const track = document.getElementById('slider-track');
  const dots  = document.getElementById('slider-dots');
  track.innerHTML = reviewsData.map(r => `
    <div class="review-card">
      <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
      <p class="review-text">«${esc(r.text || 'Замечательная студия, всё понравилось!')}»</p>
      <div class="review-author">${esc(r.client_name)}</div>
      ${r.service ? `<div class="review-service">${esc(r.service)}</div>` : ''}
    </div>`).join('');
  dots.innerHTML = reviewsData.map((_, i) => `<div class="slider-dot${i === 0 ? ' active' : ''}" data-i="${i}"></div>`).join('');
  dots.querySelectorAll('.slider-dot').forEach(d => d.addEventListener('click', () => goToSlide(Number(d.dataset.i))));
  document.getElementById('slider-prev').addEventListener('click', () => goToSlide(currentSlide - 1));
  document.getElementById('slider-next').addEventListener('click', () => goToSlide(currentSlide + 1));
}
function goToSlide(i) {
  const n = reviewsData.length;
  currentSlide = ((i % n) + n) % n;
  document.getElementById('slider-track').style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d, idx) => d.classList.toggle('active', idx === currentSlide));
}

/* ── Review form ─────────────────────────────────────────────────────── */
async function loadReviewForm() {
  try {
    const bookings = await apiFetch('/user/confirmed-bookings');
    if (!bookings || !bookings.length) return;
    const wrap   = document.getElementById('review-form-wrap');
    const select = document.getElementById('review-booking');
    wrap.classList.remove('hidden');
    select.innerHTML = '<option value="">Выберите вашу запись</option>' +
      bookings.map(b => `<option value="${b.id}">${esc(b.service)} (${b.created_at ? b.created_at.slice(0,10) : ''})</option>`).join('');
  } catch { /* not logged in or no confirmed bookings */ }
}
function initStarRating() {
  let selected = 0;
  const stars  = document.querySelectorAll('.star');
  const hidden = document.getElementById('review-rating');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selected = Number(star.dataset.v);
      hidden.value = selected;
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.v) <= selected));
    });
    star.addEventListener('mouseover', () => {
      const v = Number(star.dataset.v);
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.v) <= v));
    });
    star.addEventListener('mouseout', () => {
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.v) <= selected));
    });
  });
  const form = document.getElementById('review-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const booking_id = document.getElementById('review-booking').value;
    const rating     = document.getElementById('review-rating').value;
    const text       = document.getElementById('review-text').value.trim();
    if (!booking_id) { showToast('Выберите запись', 'error'); return; }
    if (!rating)     { showToast('Поставьте оценку', 'error'); return; }
    try {
      await apiFetch('/reviews', { method: 'POST', body: JSON.stringify({ booking_id: Number(booking_id), rating: Number(rating), text }) });
      showToast('Отзыв отправлен! Он появится после проверки администратором.');
      form.reset();
      selected = 0;
      stars.forEach(s => s.classList.remove('active'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* ── Feedback + contact ──────────────────────────────────────────────── */
function initFeedbackForm() {
  const form = document.getElementById('feedback-form');
  const msg  = document.getElementById('feedback-msg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'form-msg form-msg--light';
    const name    = document.getElementById('fb-name').value.trim();
    const email   = document.getElementById('fb-email').value.trim();
    const message = document.getElementById('fb-message').value.trim();
    if (!name)    { msg.textContent = 'Введите имя'; msg.className = 'form-msg form-msg--light error'; return; }
    if (!message) { msg.textContent = 'Напишите сообщение'; msg.className = 'form-msg form-msg--light error'; return; }
    try {
      await apiFetch('/feedback', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      showToast('Сообщение отправлено! Ответим в течение часа.');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg form-msg--light error';
    }
  });
}
function initContactForm() {
  const form = document.getElementById('contact-form');
  const msg  = document.getElementById('contact-msg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'form-msg';
    const name    = document.getElementById('ct-name').value.trim();
    const email   = document.getElementById('ct-email').value.trim();
    const message = document.getElementById('ct-message').value.trim();
    if (!name || !message) { msg.textContent = 'Заполните все поля'; msg.className = 'form-msg error'; return; }
    try {
      await apiFetch('/contact', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      showToast('Сообщение отправлено!');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

/* ── Static chrome (icons, year) ─────────────────────────────────────── */
function initChrome() {
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('fab-icon').innerHTML = icon(ICON.camera, 20);
  document.getElementById('footer-contacts').innerHTML = `
    <div class="fc-item">${icon(ICON.pin, 17)}<span>Москва, ул. Примерная, 1</span></div>
    <div class="fc-item">${icon(ICON.phone, 17)}<span>+7 (999) 123-45-67</span></div>
    <div class="fc-item">${icon(ICON.mail, 17)}<span>info@momento.ru</span></div>`;
}

/* ── Init ────────────────────────────────────────────────────────────── */
initChrome();
updateAuthUI();
initSmoothScroll();
initHeaderScroll();
initBurger();
initReveal();
initCounters();
initLightbox();
initAuthModal();
initBookingModal();
initStarRating();
initFeedbackForm();
initContactForm();
loadServices();
loadTeam();
loadGallery();
loadReviews();
