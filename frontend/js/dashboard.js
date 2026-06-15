const API = '/api';
let currentUser = null;
let lastCheckTs = Date.now();

function token() { return localStorage.getItem('token'); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts.headers },
    ...opts,
  });
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('fullName');
  location.href = '/';
}

// ── Toast ─────────────────────────────────────────────────────────────
function showToast(msg, duration = 4000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Tabs ──────────────────────────────────────────────────────────────
const tabTitles = { bookings: 'Заявки', users: 'Пользователи', reviews: 'Отзывы' };

function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  document.getElementById('tab-title').textContent = tabTitles[name] || name;

  if (name === 'bookings') loadBookings();
  if (name === 'users')    loadUsers();
  if (name === 'reviews')  loadAdminReviews();
}

document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

// ── Status badge ──────────────────────────────────────────────────────
const statusLabel = { pending: 'Ожидает', confirmed: 'Подтверждена', done: 'Завершена', cancelled: 'Отменена' };
const statusClass = { pending: 'badge-pending', confirmed: 'badge-confirmed', done: 'badge-done', cancelled: 'badge-cancelled' };

function badge(status) {
  return `<span class="badge ${statusClass[status] || ''}">${statusLabel[status] || status}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso.includes('T') ? iso : iso + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Bookings ──────────────────────────────────────────────────────────
async function loadBookings() {
  const tbody = document.getElementById('bookings-body');
  try {
    const list = await apiFetch('/dashboard/bookings');
    if (!list) return;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="loading">Заявок нет</td></tr>'; return; }
    tbody.innerHTML = list.map(b => `
      <tr>
        <td>${b.id}</td>
        <td>${esc(b.client_name)}</td>
        <td>${esc(b.client_phone)}</td>
        <td>${esc(b.service)}</td>
        <td>${fmtDate(b.created_at)}</td>
        <td>${badge(b.status)}</td>
        <td>${b.status === 'pending' ? `<button class="btn-action btn-confirm" onclick="confirmBooking(${b.id}, this)">Подтвердить</button>` : '—'}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">Ошибка: ${esc(err.message)}</td></tr>`;
  }
}

async function confirmBooking(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch(`/bookings/${id}/confirm`, { method: 'PUT' });
    showToast(`Заявка #${id} подтверждена`);
    loadBookings();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
    btn.disabled = false;
  }
}
window.confirmBooking = confirmBooking;

// ── Users (admin) ─────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-body');
  try {
    const list = await apiFetch('/admin/users');
    if (!list) return;
    const roles = ['client', 'employee', 'admin'];
    tbody.innerHTML = list.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${esc(u.full_name)}</td>
        <td>${esc(u.email)}</td>
        <td>
          <select class="role-select" onchange="changeRole(${u.id}, this.value)" ${u.id === currentUser.id ? 'disabled' : ''}>
            ${roles.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </td>
        <td>${u.employee_type || '—'}</td>
        <td>${u.id !== currentUser.id
          ? `<button class="btn-action btn-delete" onclick="deleteUser(${u.id}, this)">Удалить</button>`
          : '<span style="color:var(--muted)">Вы</span>'}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Ошибка: ${esc(err.message)}</td></tr>`;
  }
}

async function changeRole(userId, newRole) {
  try {
    await apiFetch('/admin/users/change-role', { method: 'POST', body: JSON.stringify({ userId, newRole }) });
    showToast('Роль обновлена');
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
    loadUsers();
  }
}
window.changeRole = changeRole;

async function deleteUser(id, btn) {
  if (!confirm('Удалить пользователя?')) return;
  btn.disabled = true;
  try {
    await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
    showToast('Пользователь удалён');
    loadUsers();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
    btn.disabled = false;
  }
}
window.deleteUser = deleteUser;

// ── Reviews (admin) ───────────────────────────────────────────────────
async function loadAdminReviews() {
  const tbody = document.getElementById('reviews-body');
  try {
    const list = await apiFetch('/admin/reviews');
    if (!list) return;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="loading">Отзывов нет</td></tr>'; return; }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${esc(r.client_name)}</td>
        <td>${esc(r.service || '—')}</td>
        <td class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
        <td>${esc(r.text || '—')}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td><span class="badge ${r.is_published ? 'badge-published' : 'badge-pending-rev'}">${r.is_published ? 'Опубл.' : 'Скрыт'}</span></td>
        <td>${!r.is_published
          ? `<button class="btn-action btn-publish" onclick="publishReview(${r.id}, this)">Опубликовать</button>`
          : `<button class="btn-action btn-delete" onclick="unpublishReview(${r.id}, this)">Скрыть</button>`}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Ошибка: ${esc(err.message)}</td></tr>`;
  }
}

async function publishReview(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch('/admin/reviews/publish', { method: 'POST', body: JSON.stringify({ reviewId: id, is_published: true }) });
    showToast('Отзыв опубликован');
    loadAdminReviews();
  } catch (err) { showToast(`Ошибка: ${err.message}`); btn.disabled = false; }
}
async function unpublishReview(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch('/admin/reviews/publish', { method: 'POST', body: JSON.stringify({ reviewId: id, is_published: false }) });
    showToast('Отзыв скрыт');
    loadAdminReviews();
  } catch (err) { showToast(`Ошибка: ${err.message}`); btn.disabled = false; }
}
window.publishReview = publishReview;
window.unpublishReview = unpublishReview;

// ── Polling ───────────────────────────────────────────────────────────
async function pollNewBookings() {
  try {
    const data = await apiFetch(`/dashboard/new-bookings-count?lastCheck=${lastCheckTs}`);
    if (data && data.count > 0) {
      showToast(`🔔 Новых заявок: ${data.count}!`);
      loadBookings();
    }
    lastCheckTs = Date.now();
  } catch { /* ignore polling errors */ }
}

// ── Escape HTML ───────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  if (!token()) { location.href = '/'; return; }

  const me = await apiFetch('/me');
  if (!me) return;
  if (me.role !== 'admin' && me.role !== 'employee') { location.href = '/'; return; }

  currentUser = me;
  document.getElementById('user-name').textContent = me.full_name;
  document.getElementById('user-role').textContent = me.role === 'admin' ? 'Администратор' : `Сотрудник (${me.employee_type || ''})`;
  document.getElementById('logout-btn').addEventListener('click', logout);

  if (me.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  switchTab('bookings');
  setInterval(pollNewBookings, 10000);
}

init();
