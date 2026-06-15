const API = '/api';

// ── Toast ─────────────────────────────────────────────────────────────
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

// ── API helper ────────────────────────────────────────────────────────
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

// ── XSS protection ────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Phone validation ──────────────────────────────────────────────────
function validatePhone(phone) {
  return /^\+7[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(phone.trim());
}

// ── Auth state ────────────────────────────────────────────────────────
function getSession() {
  const token = localStorage.getItem('token');
  const fullName = localStorage.getItem('fullName');
  const role = localStorage.getItem('role');
  return token ? { token, fullName, role } : null;
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
    if (session.role === 'admin' || session.role === 'employee') {
      dashLink.classList.remove('hidden');
    } else {
      dashLink.classList.add('hidden');
    }
    if (session.role === 'client') loadReviewForm();
    // prefill feedback name
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

// ── Smooth scroll (anchor links) ──────────────────────────────────────
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

// ── Header scroll effect ──────────────────────────────────────────────
function initHeaderScroll() {
  const header = document.getElementById('header');
  const update = () => header.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ── Burger (mobile nav) ───────────────────────────────────────────────
function initBurger() {
  const burger    = document.getElementById('burger');
  const mobileNav = document.getElementById('mobile-nav');
  burger.addEventListener('click', () => mobileNav.classList.toggle('hidden'));
}

// ── Reveal on scroll (Intersection Observer) ──────────────────────────
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  // Alternate left/right slide for odd/even sections
  elements.forEach((el, i) => {
    el.style.transform = i % 2 === 0 ? 'translateX(-60px)' : 'translateX(60px)';
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

// ── Auth modal ────────────────────────────────────────────────────────
function initAuthModal() {
  const modal     = document.getElementById('auth-modal');
  const openBtn   = document.getElementById('auth-btn');
  const closeBtn  = document.getElementById('auth-modal-close');
  const logoutBtn = document.getElementById('logout-btn');

  function openModal(tab) { modal.classList.remove('hidden'); switchTab(tab || 'login'); }
  function closeModal()   { modal.classList.add('hidden'); }

  openBtn.addEventListener('click',  () => openModal('login'));
  closeBtn.addEventListener('click', closeModal);
  logoutBtn.addEventListener('click', () => { clearSession(); showToast('Вы вышли из системы'); });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.getElementById('login-form').classList.toggle('hidden', name !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', name !== 'register');
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  document.getElementById('login-form').addEventListener('submit', async e => {
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
      e.target.reset();
      showToast(`Добро пожаловать, ${data.fullName}!`);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('register-msg');
    msg.className = 'form-msg';
    const fullName = document.getElementById('reg-name').value.trim();
    try {
      const data = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email:    document.getElementById('reg-email').value.trim(),
          password: document.getElementById('reg-password').value,
        }),
      });
      saveSession({ token: data.token, fullName, role: data.role });
      closeModal();
      e.target.reset();
      showToast('Добро пожаловать! Регистрация прошла успешно.');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

// ── Booking modal ─────────────────────────────────────────────────────
function initBookingModal() {
  const modal     = document.getElementById('booking-modal');
  const closeBtn  = document.getElementById('booking-modal-close');
  const fab       = document.getElementById('fab');
  const heroCta   = document.getElementById('hero-cta');
  const aboutCta  = document.getElementById('about-cta');

  function openModal() {
    modal.classList.remove('hidden');
    const session = getSession();
    if (session) {
      const nameEl = document.getElementById('client_name');
      if (nameEl && !nameEl.value) nameEl.value = session.fullName;
    }
  }
  function closeModal() { modal.classList.add('hidden'); }

  [fab, heroCta, aboutCta].forEach(btn => btn.addEventListener('click', openModal));
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('booking-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg   = document.getElementById('booking-msg');
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

// ── Open booking modal pre-selecting a service ────────────────────────
window.openBookingForService = function (name) {
  document.getElementById('booking-modal').classList.remove('hidden');
  const sel = document.getElementById('service');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === name) { sel.selectedIndex = i; break; }
  }
};

// ── Services ──────────────────────────────────────────────────────────
const SERVICE_ICONS = {
  'Портретная съёмка':   '🎭',
  'Семейная фотосессия': '👨‍👩‍👧',
  'Предметная съёмка':   '📦',
  'Свадебная фотосессия':'💍',
  'Аренда помещения':    '🏛️',
};

async function loadServices() {
  const grid   = document.getElementById('services-list');
  const select = document.getElementById('service');
  try {
    const services = await apiFetch('/services');
    if (!services.length) { grid.innerHTML = '<p class="loading-text">Услуги временно недоступны</p>'; return; }
    grid.innerHTML = services.map(s => `
      <div class="service-card">
        <div class="service-icon">${SERVICE_ICONS[s.name] || '📷'}</div>
        <h3>${esc(s.name)}</h3>
        <div class="service-price">${s.price.toLocaleString('ru-RU')} ₽</div>
        <div class="service-duration">⏱ ${s.duration} мин</div>
        <button class="btn btn--sm" onclick="openBookingForService('${esc(s.name)}')">Записаться</button>
      </div>
    `).join('');
    select.innerHTML = '<option value="">Выберите услугу</option>' +
      services.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  } catch {
    grid.innerHTML = '<p class="loading-text">Не удалось загрузить услуги</p>';
  }
}

// ── Team ──────────────────────────────────────────────────────────────
const ROLE_LABELS = { photographer: 'Фотограф', manager: 'Менеджер', admin: 'Администратор' };

async function loadTeam() {
  const scroll = document.getElementById('team-scroll');
  try {
    const team = await apiFetch('/team');
    if (!team.length) { scroll.innerHTML = '<p class="loading-text">Команда скоро появится</p>'; return; }
    scroll.innerHTML = team.map(m => `
      <div class="team-card">
        <img class="team-avatar"
          src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name)}&background=4d6bfe&color=fff&size=120&rounded=true"
          alt="${esc(m.full_name)}" />
        <div class="team-name">${esc(m.full_name)}</div>
        <span class="team-role">${esc(ROLE_LABELS[m.employee_type] || m.employee_type || 'Сотрудник')}</span>
      </div>
    `).join('');
    initTeamWheel();
  } catch {
    scroll.innerHTML = '<p class="loading-text">Не удалось загрузить команду</p>';
  }
}

function initTeamWheel() {
  const el = document.getElementById('team-scroll');
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY * 0.9;
    }
  }, { passive: false });
}

// ── Gallery (carousel + wheel) ────────────────────────────────────────
const GALLERY_IMGS = [
  { src: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&q=80', alt: 'Камера' },
  { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80', alt: 'Свадебная съёмка' },
  { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80', alt: 'Портрет' },
  { src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80', alt: 'Студия' },
  { src: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80', alt: 'Предметная съёмка' },
  { src: 'https://images.unsplash.com/photo-1551843073-4a9a5b6fcd5f?w=600&q=80', alt: 'Семейная фотосессия' },
  { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', alt: 'Арт-портрет' },
  { src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&q=80', alt: 'Пейзаж' },
];

function initGallery() {
  const scroll   = document.getElementById('gallery-scroll');
  const stopBtn  = document.getElementById('gallery-stop');
  const startBtn = document.getElementById('gallery-start');

  scroll.innerHTML = GALLERY_IMGS.map(img =>
    `<div class="gallery-item"><img src="${img.src}" alt="${img.alt}" loading="lazy" /></div>`
  ).join('');

  let timer = null;
  const STEP = 316;
  const DELAY = 3000;

  function tick() {
    const max = scroll.scrollWidth - scroll.clientWidth;
    if (scroll.scrollLeft >= max - 4) {
      scroll.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      scroll.scrollBy({ left: STEP, behavior: 'smooth' });
    }
  }

  function start() {
    if (!timer) {
      timer = setInterval(tick, DELAY);
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    }
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    stopBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
  }

  stopBtn.addEventListener('click',  stop);
  startBtn.addEventListener('click', start);

  scroll.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      stop();
      scroll.scrollLeft += e.deltaY * 0.9;
    }
  }, { passive: false });

  // Start immediately — stop button visible by default
  startBtn.classList.add('hidden');
  start();
}

// ── Reviews slider ────────────────────────────────────────────────────
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
    </div>
  `).join('');

  dots.innerHTML = reviewsData.map((_, i) =>
    `<div class="slider-dot${i === 0 ? ' active' : ''}" data-i="${i}"></div>`
  ).join('');
  dots.querySelectorAll('.slider-dot').forEach(d =>
    d.addEventListener('click', () => goToSlide(Number(d.dataset.i)))
  );

  document.getElementById('slider-prev').addEventListener('click', () => goToSlide(currentSlide - 1));
  document.getElementById('slider-next').addEventListener('click', () => goToSlide(currentSlide + 1));
}

function goToSlide(i) {
  const n = reviewsData.length;
  currentSlide = ((i % n) + n) % n;
  document.getElementById('slider-track').style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d, idx) => d.classList.toggle('active', idx === currentSlide));
}

// ── Review form (clients with confirmed bookings) ─────────────────────
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

// ── Feedback form ─────────────────────────────────────────────────────
function initFeedbackForm() {
  const form = document.getElementById('feedback-form');
  const msg  = document.getElementById('feedback-msg');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'form-msg';
    const name    = document.getElementById('fb-name').value.trim();
    const email   = document.getElementById('fb-email').value.trim();
    const message = document.getElementById('fb-message').value.trim();
    if (!name)    { msg.textContent = 'Введите имя'; msg.className = 'form-msg error'; return; }
    if (!message) { msg.textContent = 'Напишите сообщение'; msg.className = 'form-msg error'; return; }
    try {
      await apiFetch('/feedback', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      showToast('Сообщение отправлено! Ответим в течение часа.');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

// ── Contact form (footer) ─────────────────────────────────────────────
function initContactForm() {
  const form = document.getElementById('contact-form');
  const msg  = document.getElementById('contact-msg');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'form-msg form-msg--light';
    const name    = document.getElementById('ct-name').value.trim();
    const email   = document.getElementById('ct-email').value.trim();
    const message = document.getElementById('ct-message').value.trim();
    if (!name || !message) { msg.textContent = 'Заполните все поля'; msg.className = 'form-msg form-msg--light error'; return; }
    try {
      await apiFetch('/contact', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      showToast('Сообщение отправлено!');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg form-msg--light error';
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────
updateAuthUI();
initSmoothScroll();
initHeaderScroll();
initBurger();
initReveal();
initAuthModal();
initBookingModal();
initStarRating();
initFeedbackForm();
initContactForm();
loadServices();
loadTeam();
initGallery();
loadReviews();
