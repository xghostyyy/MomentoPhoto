const API = '/api';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth UI state ─────────────────────────────────────────────────────
function updateAuthUI() {
  const token    = localStorage.getItem('token');
  const fullName = localStorage.getItem('fullName');

  const greeting  = document.getElementById('user-greeting');
  const authBtn   = document.getElementById('auth-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (token && fullName) {
    greeting.textContent = `Привет, ${fullName}`;
    greeting.classList.remove('hidden');
    authBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    greeting.classList.add('hidden');
    authBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  }
}

function saveSession({ token, fullName }) {
  localStorage.setItem('token', token);
  localStorage.setItem('fullName', fullName);
  updateAuthUI();
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('fullName');
  updateAuthUI();
}

// ── Modal ─────────────────────────────────────────────────────────────
const modal   = document.getElementById('auth-modal');
const overlay = document.getElementById('modal-overlay');
const closeBtn= document.getElementById('modal-close');

function openModal(tab = 'login') {
  modal.classList.remove('hidden');
  switchTab(tab);
}
function closeModal() { modal.classList.add('hidden'); }

overlay.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
document.getElementById('auth-btn').addEventListener('click', () => openModal('login'));
document.getElementById('logout-btn').addEventListener('click', () => { clearSession(); });

// ── Tabs ──────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.getElementById('login-form').classList.toggle('hidden', name !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', name !== 'register');
}
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => switchTab(t.dataset.tab))
);

// ── Login ─────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('login-msg');
  msg.className = 'form-msg';
  msg.textContent = '';
  try {
    const data = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    saveSession({ token: data.token, fullName: data.fullName });
    closeModal();
    e.target.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
});

// ── Register ──────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('register-msg');
  msg.className = 'form-msg';
  msg.textContent = '';
  try {
    const fullName = document.getElementById('reg-name').value.trim();
    const data = await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName,
        email:    document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
      }),
    });
    saveSession({ token: data.token, fullName });
    closeModal();
    e.target.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
});

// ── Services ──────────────────────────────────────────────────────────
async function loadServices() {
  const grid   = document.getElementById('services-list');
  const select = document.getElementById('service');
  try {
    const services = await apiFetch('/services');
    if (!services.length) {
      grid.innerHTML = '<p>Услуги временно недоступны.</p>';
      return;
    }
    grid.innerHTML = services
      .map(
        (s) => `
      <div class="service-card">
        <h3>${s.name}</h3>
        <div class="price">${s.price.toLocaleString('ru-RU')} ₽</div>
        <div class="duration">${s.duration} мин</div>
      </div>`
      )
      .join('');
    select.innerHTML =
      '<option value="">Выберите услугу</option>' +
      services.map((s) => `<option value="${s.name}">${s.name}</option>`).join('');
  } catch (err) {
    grid.innerHTML = `<p>Ошибка загрузки: ${err.message}</p>`;
  }
}

// ── Reviews ───────────────────────────────────────────────────────────
async function loadReviews() {
  const grid = document.getElementById('reviews-list');
  try {
    const reviews = await apiFetch('/reviews');
    if (!reviews.length) {
      grid.innerHTML = '<p>Отзывов пока нет.</p>';
      return;
    }
    grid.innerHTML = reviews
      .map(
        (r) => `
      <div class="review-card">
        <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <p>${r.text || ''}</p>
        <div class="author">${r.client_name}</div>
      </div>`
      )
      .join('');
  } catch (err) {
    grid.innerHTML = `<p>Ошибка загрузки: ${err.message}</p>`;
  }
}

// ── Booking form ──────────────────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('booking-msg');
  msg.className = 'form-msg';
  msg.textContent = '';

  const payload = {
    client_name:  document.getElementById('client_name').value.trim(),
    client_phone: document.getElementById('client_phone').value.trim(),
    service:      document.getElementById('service').value,
  };

  try {
    await apiFetch('/bookings', { method: 'POST', body: JSON.stringify(payload) });
    msg.textContent = 'Заявка принята! Письмо отправлено менеджеру, ожидайте подтверждения.';
    msg.className = 'form-msg success';
    e.target.reset();
  } catch (err) {
    msg.textContent = `Ошибка: ${err.message}`;
    msg.className = 'form-msg error';
  }
});

// ── Init ──────────────────────────────────────────────────────────────
updateAuthUI();
loadServices();
loadReviews();
