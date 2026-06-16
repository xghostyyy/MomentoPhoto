const API = '/api';
let currentUser = null;
let lastCheckTs = Date.now();

function token() { return localStorage.getItem('token'); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts.headers },
    ...opts,
  });
  if (res.status === 401 || res.status === 403) { showLoginOverlay(); return null; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function apiFetchForm(path, formData) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('fullName');
  localStorage.removeItem('role');
  location.href = '/dashboard';
}

// ── Toast ─────────────────────────────────────────────────────────────
function showToast(msg, duration = 4000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Login overlay ─────────────────────────────────────────────────────
function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('dash-wrap').classList.add('hidden');
}

function hideLoginOverlay() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('dash-wrap').classList.remove('hidden');
}

function initLoginForm() {
  const form = document.getElementById('dash-login-form');
  const msg  = document.getElementById('dl-msg');
  const btn  = document.getElementById('dl-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Вход…';
    msg.textContent = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    document.getElementById('dl-email').value.trim(),
          password: document.getElementById('dl-pass').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      if (data.role !== 'admin' && data.role !== 'employee') {
        throw new Error('Доступ только для сотрудников студии');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('fullName', data.fullName);
      localStorage.setItem('role', data.role);
      hideLoginOverlay();
      await setupDashboard(data);
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────
const tabTitles = { bookings: 'Заявки', employees: 'Команда', gallery: 'Галерея', services: 'Услуги', users: 'Пользователи', reviews: 'Отзывы', profile: 'Профиль' };

function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  document.getElementById('tab-title').textContent = tabTitles[name] || name;

  if (name === 'bookings')  loadBookings();
  if (name === 'employees') loadEmployees();
  if (name === 'gallery')   loadAdminGallery();
  if (name === 'services')  loadAdminServices();
  if (name === 'users')     loadUsers();
  if (name === 'reviews')   loadAdminReviews();
  if (name === 'profile')   loadMailSettings();
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

function callBadge(call_status) {
  if (call_status === 'called') return '<span class="badge badge-called">Позвонили</span>';
  return '<span class="badge badge-call-needed">Нужен звонок</span>';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso.includes('T') ? iso : iso + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtBookingDate(date, time) {
  if (!date) return '—';
  const d = new Date(date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return time ? `${dateStr} ${time}` : dateStr;
}

// ── Bookings ──────────────────────────────────────────────────────────
let newBookingIds = new Set();

async function loadBookings() {
  const tbody = document.getElementById('bookings-body');
  try {
    const list = await apiFetch('/dashboard/bookings');
    if (!list) return;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="loading">Заявок нет</td></tr>'; return; }
    tbody.innerHTML = list.map(b => `
      <tr class="${newBookingIds.has(b.id) ? 'row-new' : ''}">
        <td>${b.id}</td>
        <td>${esc(b.client_name)}</td>
        <td>${esc(b.client_phone)}</td>
        <td>${esc(b.service)}</td>
        <td>${fmtBookingDate(b.booking_date, b.booking_time)}</td>
        <td>
          ${callBadge(b.call_status)}
          ${b.call_status !== 'called' ? `<button class="btn-action btn-called" onclick="markCalled(${b.id}, this)">Позвонили</button>` : ''}
        </td>
        <td>${badge(b.status)}</td>
        <td class="actions-cell">
          ${b.status === 'pending' ? `<button class="btn-action btn-confirm" onclick="confirmBooking(${b.id}, this)">Подтвердить</button>` : '—'}
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Ошибка: ${esc(err.message)}</td></tr>`;
  }
}

async function confirmBooking(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch(`/bookings/${id}/confirm`, { method: 'PUT' });
    showToast(`Заявка #${id} подтверждена`);
    newBookingIds.delete(id);
    loadBookings();
    updateNotifCount();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
    btn.disabled = false;
  }
}
window.confirmBooking = confirmBooking;

async function markCalled(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch(`/bookings/${id}/call-status`, { method: 'PATCH', body: JSON.stringify({ call_status: 'called' }) });
    showToast(`Звонок по заявке #${id} отмечен`);
    loadBookings();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
    btn.disabled = false;
  }
}
window.markCalled = markCalled;

// ── Employees (admin) ─────────────────────────────────────────────────
const ROLE_LABELS_DASH = { photographer: 'Фотограф', manager: 'Менеджер', retoucher: 'Ретушёр', stylist: 'Стилист' };

function teamPhotoSrc(member) {
  if (member.photo_url) return member.photo_url + '?t=' + Date.now();
  const seed = encodeURIComponent(member.full_name);
  return `https://api.dicebear.com/7.x/personas/svg?seed=${seed}&size=200&backgroundColor=fff3ec,ffe8d6`;
}

async function loadEmployees() {
  const grid = document.getElementById('employees-grid');
  try {
    const list = await apiFetch('/admin/employees');
    if (!list) return;
    if (!list.length) { grid.innerHTML = '<div class="loading">Сотрудников нет</div>'; return; }
    grid.innerHTML = list.map(m => `
      <div class="emp-card" data-id="${m.id}">
        <div class="emp-photo-wrap">
          <img class="emp-photo" src="${teamPhotoSrc(m)}" alt="${esc(m.full_name)}" />
          <label class="emp-photo-upload" title="Загрузить фото">
            <input type="file" accept="image/png,image/jpeg,image/webp" class="emp-file-input" data-id="${m.id}" />
            <span class="emp-photo-icon">&#128247;</span>
          </label>
        </div>
        <div class="emp-info">
          <div class="emp-name">${esc(m.full_name)}</div>
          <div class="emp-meta">
            <span class="emp-role-badge${m.role === 'admin' ? ' emp-role-badge--admin' : ''}">
              ${m.role === 'admin' ? 'Директор' : (ROLE_LABELS_DASH[m.employee_type] || 'Сотрудник')}
            </span>
            ${m.photo_url ? `<button class="emp-del-photo" data-id="${m.id}" title="Удалить фото">✕ фото</button>` : ''}
          </div>
        </div>
        <div class="emp-actions">
          <button class="btn-action btn-edit" onclick="openEditEmployee(${m.id}, '${esc(m.full_name)}', '${m.employee_type || ''}', '${m.role}')">Изменить</button>
          ${m.id !== currentUser.id ? `<button class="btn-action btn-delete" onclick="deleteUser(${m.id}, this)">Удалить</button>` : '<span class="you-label">Вы</span>'}
        </div>
      </div>`).join('');

    // Photo upload handlers
    grid.querySelectorAll('.emp-file-input').forEach(input => {
      input.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const id = input.dataset.id;
        const fd = new FormData();
        fd.append('photo', file);
        try {
          await apiFetchForm(`/admin/employees/${id}/photo`, fd);
          showToast('Фото обновлено');
          loadEmployees();
        } catch (err) {
          showToast('Ошибка загрузки: ' + err.message);
        }
      });
    });

    // Delete photo handlers
    grid.querySelectorAll('.emp-del-photo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await apiFetch(`/admin/employees/${id}/photo`, { method: 'DELETE' });
          showToast('Фото удалено');
          loadEmployees();
        } catch (err) {
          showToast('Ошибка: ' + err.message);
        }
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="loading">Ошибка: ${esc(err.message)}</div>`;
  }
}

// ── Employee modal ────────────────────────────────────────────────────
function openAddEmployee() {
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-pass').value = '';
  document.getElementById('emp-role').value = 'employee';
  document.getElementById('emp-type').value = 'photographer';
  document.getElementById('emp-msg').textContent = '';
  document.getElementById('emp-modal-title').textContent = 'Добавить сотрудника';
  document.getElementById('emp-save-btn').textContent = 'Создать';
  document.getElementById('emp-email-wrap').style.display = '';
  document.getElementById('emp-pass-wrap').style.display = '';
  document.getElementById('employee-modal').classList.remove('hidden');
}

window.openEditEmployee = function(id, name, type, role) {
  document.getElementById('emp-id').value = id;
  document.getElementById('emp-name').value = name;
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-pass').value = '';
  document.getElementById('emp-role').value = role;
  document.getElementById('emp-type').value = type || 'photographer';
  document.getElementById('emp-msg').textContent = '';
  document.getElementById('emp-modal-title').textContent = 'Изменить сотрудника';
  document.getElementById('emp-save-btn').textContent = 'Сохранить';
  document.getElementById('emp-email-wrap').style.display = 'none';
  document.getElementById('emp-pass-wrap').style.display = 'none';
  document.getElementById('employee-modal').classList.remove('hidden');
};

function closeEmployeeModal() {
  document.getElementById('employee-modal').classList.add('hidden');
}

function initEmployeeModal() {
  document.getElementById('add-employee-btn').addEventListener('click', openAddEmployee);
  document.getElementById('emp-modal-close').addEventListener('click', closeEmployeeModal);
  document.getElementById('employee-modal').addEventListener('click', e => {
    if (e.target.id === 'employee-modal') closeEmployeeModal();
  });

  document.getElementById('employee-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id   = document.getElementById('emp-id').value;
    const name = document.getElementById('emp-name').value.trim();
    const type = document.getElementById('emp-type').value;
    const role = document.getElementById('emp-role').value;
    const msg  = document.getElementById('emp-msg');
    const btn  = document.getElementById('emp-save-btn');
    msg.textContent = '';
    btn.disabled = true;

    try {
      if (id) {
        // Edit mode
        await apiFetch(`/admin/employees/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ full_name: name, employee_type: type }),
        });
        showToast('Данные обновлены');
      } else {
        // Create mode
        const email = document.getElementById('emp-email').value.trim();
        const pass  = document.getElementById('emp-pass').value;
        if (!email || !pass) { msg.textContent = 'Email и пароль обязательны'; btn.disabled = false; return; }
        if (pass.length < 6) { msg.textContent = 'Пароль — минимум 6 символов'; btn.disabled = false; return; }
        await apiFetch('/admin/employees', {
          method: 'POST',
          body: JSON.stringify({ full_name: name, email, password: pass, role, employee_type: type }),
        });
        showToast('Сотрудник добавлен');
      }
      closeEmployeeModal();
      loadEmployees();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

const ROLE_RU = { client: 'Клиент', employee: 'Сотрудник', admin: 'Администратор' };
const TYPE_RU = { photographer: 'Фотограф', manager: 'Менеджер', retoucher: 'Ретушёр', stylist: 'Стилист' };

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
            ${roles.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_RU[r] || r}</option>`).join('')}
          </select>
        </td>
        <td>${TYPE_RU[u.employee_type] || (u.employee_type ? u.employee_type : '—')}</td>
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
    loadEmployees();
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

// ── Gallery (admin) ───────────────────────────────────────────────────
async function loadAdminGallery() {
  const grid = document.getElementById('gallery-admin-grid');
  try {
    const photos = await apiFetch('/admin/gallery');
    if (!photos) return;
    if (!photos.length) {
      grid.innerHTML = '<div class="loading">Галерея пуста. Загрузите первое фото.</div>';
      return;
    }
    grid.innerHTML = photos.map(p => `
      <div class="gallery-admin-item">
        <img class="gallery-admin-img" src="${esc(p.url)}" alt="${esc(p.caption || '')}" />
        ${p.caption ? `<div class="gallery-admin-caption">${esc(p.caption)}</div>` : ''}
        <button class="gallery-admin-del" data-id="${p.id}" title="Удалить">✕</button>
      </div>`).join('');

    grid.querySelectorAll('.gallery-admin-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить фото из галереи?')) return;
        try {
          await apiFetch(`/admin/gallery/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Фото удалено');
          loadAdminGallery();
        } catch (err) { showToast('Ошибка: ' + err.message); }
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="loading">Ошибка: ${esc(err.message)}</div>`;
  }
}

function initGalleryUpload() {
  const input = document.getElementById('gallery-upload-input');
  if (!input) return;
  input.addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    let uploaded = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append('photo', file);
      try {
        await apiFetchForm('/admin/gallery', fd);
        uploaded++;
      } catch (err) { showToast('Ошибка загрузки: ' + err.message); }
    }
    if (uploaded) { showToast(`Загружено: ${uploaded} фото`); loadAdminGallery(); }
    input.value = '';
  });
}

// ── Services (admin) ──────────────────────────────────────────────────
const SVC_TYPE_RU = { photographer: 'Фотограф', manager: 'Менеджер', retoucher: 'Ретушёр', stylist: 'Стилист' };

async function loadAdminServices() {
  const grid = document.getElementById('services-admin-grid');
  try {
    const list = await apiFetch('/services');
    if (!list) return;
    if (!list.length) { grid.innerHTML = '<div class="loading">Услуг нет</div>'; return; }
    grid.innerHTML = list.map(s => `
      <div class="svc-card">
        <div class="svc-photo-wrap">
          ${s.photo_url
            ? `<img class="svc-photo" src="${esc(s.photo_url)}?t=${Date.now()}" alt="${esc(s.name)}" />`
            : `<div class="svc-photo-placeholder">Нет фото</div>`}
          <label class="svc-photo-btn">
            Загрузить фото
            <input type="file" accept="image/*" class="svc-file-input" data-id="${s.id}" />
          </label>
        </div>
        <div class="svc-info">
          <div class="svc-name">${esc(s.name)}</div>
          <div class="svc-details">${s.price.toLocaleString('ru-RU')} ₽ · ${s.duration} мин · ${SVC_TYPE_RU[s.employee_type] || s.employee_type}</div>
        </div>
        <div class="svc-actions">
          <button class="btn-action btn-edit" onclick="openEditService(${s.id},'${esc(s.name)}',${s.price},${s.duration},'${s.employee_type}')">Изменить</button>
          ${s.photo_url ? `<button class="btn-action btn-delete svc-del-photo" data-id="${s.id}">Удалить фото</button>` : ''}
          <button class="btn-action btn-delete svc-del" data-id="${s.id}">Удалить</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.svc-file-input').forEach(input => {
      input.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('photo', file);
        try {
          await apiFetchForm(`/admin/services/${input.dataset.id}/photo`, fd);
          showToast('Фото услуги обновлено');
          loadAdminServices();
        } catch (err) { showToast('Ошибка: ' + err.message); }
      });
    });

    grid.querySelectorAll('.svc-del-photo').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiFetch(`/admin/services/${btn.dataset.id}/photo`, { method: 'DELETE' });
          showToast('Фото удалено');
          loadAdminServices();
        } catch (err) { showToast('Ошибка: ' + err.message); }
      });
    });

    grid.querySelectorAll('.svc-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить услугу?')) return;
        try {
          await apiFetch(`/admin/services/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Услуга удалена');
          loadAdminServices();
        } catch (err) { showToast('Ошибка: ' + err.message); }
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="loading">Ошибка: ${esc(err.message)}</div>`;
  }
}

function openAddService() {
  document.getElementById('svc-id').value = '';
  document.getElementById('svc-name').value = '';
  document.getElementById('svc-price').value = '';
  document.getElementById('svc-duration').value = '';
  document.getElementById('svc-type').value = 'photographer';
  document.getElementById('svc-msg').textContent = '';
  document.getElementById('svc-modal-title').textContent = 'Добавить услугу';
  document.getElementById('svc-save-btn').textContent = 'Создать';
  document.getElementById('service-modal').classList.remove('hidden');
}

window.openEditService = function(id, name, price, duration, type) {
  document.getElementById('svc-id').value = id;
  document.getElementById('svc-name').value = name;
  document.getElementById('svc-price').value = price;
  document.getElementById('svc-duration').value = duration;
  document.getElementById('svc-type').value = type || 'photographer';
  document.getElementById('svc-msg').textContent = '';
  document.getElementById('svc-modal-title').textContent = 'Изменить услугу';
  document.getElementById('svc-save-btn').textContent = 'Сохранить';
  document.getElementById('service-modal').classList.remove('hidden');
};

function closeServiceModal() {
  document.getElementById('service-modal').classList.add('hidden');
}

function initServiceModal() {
  document.getElementById('add-service-btn').addEventListener('click', openAddService);
  document.getElementById('svc-modal-close').addEventListener('click', closeServiceModal);
  document.getElementById('service-modal').addEventListener('click', e => {
    if (e.target.id === 'service-modal') closeServiceModal();
  });

  document.getElementById('service-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id  = document.getElementById('svc-id').value;
    const msg = document.getElementById('svc-msg');
    const btn = document.getElementById('svc-save-btn');
    msg.textContent = '';
    btn.disabled = true;
    try {
      const body = {
        name: document.getElementById('svc-name').value.trim(),
        price: Number(document.getElementById('svc-price').value),
        duration: Number(document.getElementById('svc-duration').value),
        employee_type: document.getElementById('svc-type').value,
      };
      if (id) {
        await apiFetch(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Услуга обновлена');
      } else {
        await apiFetch('/admin/services', { method: 'POST', body: JSON.stringify(body) });
        showToast('Услуга добавлена');
      }
      closeServiceModal();
      loadAdminServices();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

// ── Notification count ────────────────────────────────────────────────
function updateNotifCount() {
  const el = document.getElementById('notif-count');
  if (!el) return;
  const n = newBookingIds.size;
  el.textContent = n;
  el.classList.toggle('hidden', n === 0);
}

// ── SSE real-time notifications ───────────────────────────────────────
function initSSE() {
  const t = localStorage.getItem('token');
  if (!t) return;
  const es = new EventSource(`/api/dashboard/stream?token=${encodeURIComponent(t)}`);

  es.addEventListener('new-booking', e => {
    const b = JSON.parse(e.data);
    newBookingIds.add(b.id);
    updateNotifCount();

    const dateStr = b.booking_date
      ? new Date(b.booking_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      : '';
    const timeStr = b.booking_time || '';
    showToast(`Новая заявка #${b.id} — ${b.client_name} (${b.service})${dateStr ? ', ' + dateStr + ' ' + timeStr : ''}`);

    if (document.getElementById('tab-bookings') && !document.getElementById('tab-bookings').classList.contains('hidden')) {
      loadBookings();
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Новая заявка — Momento', {
        body: `${b.client_name} • ${b.service} • ${dateStr} ${timeStr}`.trim(),
        icon: '/favicon.ico',
      });
    }
  });

  es.addEventListener('connected', () => console.log('[SSE] connected'));
  es.onerror = () => { /* reconnects automatically */ };

  return es;
}

// ── Polling fallback ──────────────────────────────────────────────────
async function pollNewBookings() {
  try {
    const data = await apiFetch(`/dashboard/new-bookings-count?lastCheck=${lastCheckTs}`);
    if (data && data.count > 0) {
      showToast(`Новых заявок: ${data.count}!`);
      loadBookings();
    }
    lastCheckTs = Date.now();
  } catch { /* ignore */ }
}

// ── Escape HTML ───────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Profile / mail settings ───────────────────────────────────────────
function setMailBadge(connected) {
  const badge = document.getElementById('mail-status-badge');
  if (!badge) return;
  badge.textContent = connected ? 'Подключена' : 'Не настроена';
  badge.className   = connected ? 'mail-badge mail-badge--on' : 'mail-badge mail-badge--off';
}

function setResendBadge(connected) {
  const badge = document.getElementById('resend-status-badge');
  if (!badge) return;
  badge.textContent = connected ? 'Подключён' : 'Не настроен';
  badge.className   = connected ? 'mail-badge mail-badge--on' : 'mail-badge mail-badge--off';
}

function setMailMsg(text, isError = false) {
  const el = document.getElementById('mail-form-msg');
  if (!el) return;
  el.textContent = text;
  el.className   = 'mail-form-msg' + (isError ? ' mail-form-msg--error' : ' mail-form-msg--ok');
}

async function loadMailSettings() {
  try {
    const data = await apiFetch('/dashboard/mail-settings');
    if (!data) return;
    const userInput = document.getElementById('mail-user');
    const passHint  = document.getElementById('pass-hint');
    if (data.mail_user) userInput.value = data.mail_user;
    passHint.textContent = data.has_password ? 'Пароль сохранён. Оставьте поле пустым, чтобы не менять.' : '';
    setMailBadge(data.mail_user && data.has_password);
    setResendBadge(data.has_resend);
  } catch { /* ignore */ }
}

function initResendForm() {
  const form    = document.getElementById('resend-form');
  const saveBtn = document.getElementById('resend-save-btn');
  const toggle  = document.getElementById('resend-key-toggle');
  const keyInput = document.getElementById('resend-key-input');
  const msg     = document.getElementById('resend-form-msg');
  if (!form) return;

  toggle.addEventListener('click', () => {
    keyInput.type = keyInput.type === 'text' ? 'password' : 'text';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Проверяем…';
    msg.textContent = '';
    msg.className = 'mail-form-msg';
    try {
      const key = keyInput.value.trim();
      if (!key) { msg.textContent = 'Введите API-ключ'; msg.className = 'mail-form-msg mail-form-msg--error'; return; }
      const data = await apiFetch('/dashboard/resend-settings/test', {
        method: 'POST',
        body: JSON.stringify({ resend_api_key: key }),
      });
      msg.textContent = data.message || 'Resend подключён!';
      msg.className = 'mail-form-msg mail-form-msg--ok';
      keyInput.value = '';
      setResendBadge(true);
      showToast('Resend подключён — письма будут работать!');
    } catch (err) {
      msg.textContent = 'Ошибка: ' + err.message;
      msg.className = 'mail-form-msg mail-form-msg--error';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Подключить и проверить';
    }
  });
}

function initMailForm() {
  const form      = document.getElementById('mail-form');
  const testBtn   = document.getElementById('mail-test-btn');
  const toggle    = document.getElementById('mail-pass-toggle');
  const passInput = document.getElementById('mail-pass');
  if (!form) return;

  toggle.addEventListener('click', () => {
    const isText = passInput.type === 'text';
    passInput.type = isText ? 'password' : 'text';
    toggle.title = isText ? 'Показать' : 'Скрыть';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('mail-save-btn');
    saveBtn.disabled = true;
    setMailMsg('');
    try {
      const mail_user = document.getElementById('mail-user').value.trim();
      const mail_pass = passInput.value;
      if (!mail_user) { setMailMsg('Введите email', true); saveBtn.disabled = false; return; }
      await apiFetch('/dashboard/mail-settings', {
        method: 'POST',
        body: JSON.stringify({ mail_user, mail_pass: mail_pass || undefined }),
      });
      setMailMsg('Настройки сохранены');
      document.getElementById('pass-hint').textContent = 'Пароль сохранён. Оставьте поле пустым, чтобы не менять.';
      passInput.value = '';
      setMailBadge(true);
      showToast('Настройки почты сохранены');
    } catch (err) {
      setMailMsg(err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Проверяем…';
    setMailMsg('');
    try {
      const mail_user = document.getElementById('mail-user').value.trim();
      const mail_pass = passInput.value;
      const data = await apiFetch('/dashboard/mail-settings/test', {
        method: 'POST',
        body: JSON.stringify({ mail_user: mail_user || undefined, mail_pass: mail_pass || undefined }),
      });
      setMailMsg(data.message || 'Письмо отправлено');
      setMailBadge(true);
      showToast('Тест прошёл успешно — проверьте ящик');
    } catch (err) {
      setMailMsg('Ошибка: ' + err.message, true);
      showToast('Ошибка подключения: ' + err.message);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Проверить подключение';
    }
  });
}

// ── Setup dashboard after auth ────────────────────────────────────────
async function setupDashboard(meData) {
  const me = meData || await apiFetch('/me');
  if (!me) { showLoginOverlay(); return; }
  if (me.role !== 'admin' && me.role !== 'employee') { logout(); return; }

  currentUser = me;
  document.getElementById('user-name').textContent = me.full_name;
  document.getElementById('user-role').textContent = me.role === 'admin' ? 'Администратор' : `Сотрудник (${me.employee_type || ''})`;
  document.getElementById('logout-btn').addEventListener('click', logout);

  if (me.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    initEmployeeModal();
    initGalleryUpload();
    initServiceModal();
  }

  initMailForm();
  initResendForm();

  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Start SSE for real-time notifications; fall back to polling
  initSSE();
  setInterval(pollNewBookings, 30000);

  // Bell click scrolls to bookings tab
  const bell = document.getElementById('notif-bell');
  if (bell) {
    bell.addEventListener('click', () => {
      switchTab('bookings');
      newBookingIds.clear();
      updateNotifCount();
    });
  }

  switchTab('bookings');
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  initLoginForm();

  if (!token()) {
    showLoginOverlay();
    return;
  }

  const me = await apiFetch('/me');
  if (!me || (me.role !== 'admin' && me.role !== 'employee')) {
    showLoginOverlay();
    return;
  }

  hideLoginOverlay();
  await setupDashboard(me);
}

init();
