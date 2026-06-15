const API = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Services ──────────────────────────────────────────────────────────
async function loadServices() {
  const grid = document.getElementById('services-list');
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
    msg.textContent = 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.';
    msg.className = 'form-msg success';
    e.target.reset();
  } catch (err) {
    msg.textContent = `Ошибка: ${err.message}`;
    msg.className = 'form-msg error';
  }
});

// ── Init ──────────────────────────────────────────────────────────────
loadServices();
loadReviews();
