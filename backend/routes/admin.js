const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Review = require('../models/Review');
const Service = require('../models/Service');
const GalleryPhoto = require('../models/GalleryPhoto');
const { authenticate, requireRole } = require('../middleware/auth');

const adminOnly = [authenticate, requireRole('admin')];

const uploadDir = path.join(__dirname, '../../frontend/uploads/team');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const galleryDir = path.join(__dirname, '../../frontend/uploads/gallery');
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });

const servicesDir = path.join(__dirname, '../../frontend/uploads/services');
if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

function imageFilter(_req, file, cb) {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Разрешены только изображения'));
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, _file, cb) => cb(null, `user-${req.params.id}.png`),
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFilter });

const galleryStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, galleryDir),
  filename: (_req, file, cb) => cb(null, `gallery-${Date.now()}${path.extname(file.originalname)}`),
});
const galleryUpload = multer({ storage: galleryStorage, limits: { fileSize: 12 * 1024 * 1024 }, fileFilter: imageFilter });

const servicePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, servicesDir),
  filename: (req, _file, cb) => cb(null, `service-${req.params.id}.jpg`),
});
const serviceUpload = multer({ storage: servicePhotoStorage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFilter });

// GET /api/admin/users
router.get('/users', ...adminOnly, async (_req, res) => {
  try {
    res.json(await User.getAllUsers());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/users/change-role  { userId, newRole }
router.post('/users/change-role', ...adminOnly, async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const allowed = ['client', 'employee', 'admin'];
    if (!userId || !allowed.includes(newRole)) {
      return res.status(400).json({ error: `Допустимые роли: ${allowed.join(', ')}` });
    }
    const { changes } = await User.updateRole(userId, newRole);
    if (changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
    }
    const { changes } = await User.deleteById(targetId);
    if (changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/admin/reviews
router.get('/reviews', ...adminOnly, async (_req, res) => {
  try {
    res.json(await Review.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/reviews/publish  { reviewId, is_published }
router.post('/reviews/publish', ...adminOnly, async (req, res) => {
  try {
    const { reviewId, is_published = true } = req.body;
    if (!reviewId) return res.status(400).json({ error: 'Укажите reviewId' });
    const { changes } = await Review.setPublished(reviewId, is_published);
    if (changes === 0) return res.status(404).json({ error: 'Отзыв не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Employee management ────────────────────────────────────────────────

// GET /api/admin/employees — list all staff (employees + admins)
router.get('/employees', ...adminOnly, async (_req, res) => {
  try {
    const rows = await User.findTeam();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/employees — create new employee/admin
router.post('/employees', ...adminOnly, async (req, res) => {
  try {
    const { full_name, email, password, role = 'employee', employee_type } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email и password обязательны' });
    }
    if (!['employee', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Роль: employee или admin' });
    }
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await User.create({ email, password_hash, role, full_name, employee_type: employee_type || null });
    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/admin/employees/:id — update name & type
router.put('/employees/:id', ...adminOnly, async (req, res) => {
  try {
    const { full_name, employee_type } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name обязательно' });
    const { changes } = await User.updateEmployee(Number(req.params.id), { full_name, employee_type });
    if (changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/employees/:id/photo — upload portrait PNG
router.post('/employees/:id/photo', ...adminOnly, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    try {
      const photo_url = `/uploads/team/user-${req.params.id}.png`;
      await User.updatePhoto(Number(req.params.id), photo_url);
      res.json({ success: true, photo_url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });
});

// DELETE /api/admin/employees/:id/photo — remove portrait
router.delete('/employees/:id/photo', ...adminOnly, async (req, res) => {
  try {
    const filePath = path.join(uploadDir, `user-${req.params.id}.png`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await User.updatePhoto(Number(req.params.id), null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Gallery management ─────────────────────────────────────────────────

// GET /api/admin/gallery
router.get('/gallery', ...adminOnly, async (_req, res) => {
  try {
    res.json(await GalleryPhoto.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/gallery — upload gallery photo
router.post('/gallery', ...adminOnly, (req, res) => {
  galleryUpload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    try {
      const url = `/uploads/gallery/${req.file.filename}`;
      const caption = req.body.caption || '';
      const result = await GalleryPhoto.create({ url, caption });
      res.status(201).json({ id: result.id, url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });
});

// DELETE /api/admin/gallery/:id
router.delete('/gallery/:id', ...adminOnly, async (req, res) => {
  try {
    const photo = await GalleryPhoto.findById(Number(req.params.id));
    if (!photo) return res.status(404).json({ error: 'Фото не найдено' });
    const filename = path.basename(photo.url);
    const filePath = path.join(galleryDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await GalleryPhoto.deleteById(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Services management ────────────────────────────────────────────────

// POST /api/admin/services — create service
router.post('/services', ...adminOnly, async (req, res) => {
  try {
    const { name, price, duration, employee_type = 'photographer' } = req.body;
    if (!name || !price || !duration) {
      return res.status(400).json({ error: 'name, price и duration обязательны' });
    }
    const result = await Service.create({ name, price: Number(price), duration: Number(duration), employee_type });
    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/admin/services/:id — update service
router.put('/services/:id', ...adminOnly, async (req, res) => {
  try {
    const { name, price, duration, employee_type } = req.body;
    if (!name || !price || !duration) {
      return res.status(400).json({ error: 'name, price и duration обязательны' });
    }
    const { changes } = await Service.update(Number(req.params.id), {
      name, price: Number(price), duration: Number(duration), employee_type: employee_type || 'photographer',
    });
    if (changes === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/admin/services/:id
router.delete('/services/:id', ...adminOnly, async (req, res) => {
  try {
    const svc = await Service.findById(Number(req.params.id));
    if (!svc) return res.status(404).json({ error: 'Услуга не найдена' });
    if (svc.photo_url) {
      const filePath = path.join(servicesDir, `service-${req.params.id}.jpg`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const { changes } = await Service.deleteById(Number(req.params.id));
    if (changes === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/admin/services/:id/photo
router.post('/services/:id/photo', ...adminOnly, (req, res) => {
  serviceUpload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    try {
      const photo_url = `/uploads/services/service-${req.params.id}.jpg`;
      await Service.updatePhoto(Number(req.params.id), photo_url);
      res.json({ success: true, photo_url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });
});

// DELETE /api/admin/services/:id/photo
router.delete('/services/:id/photo', ...adminOnly, async (req, res) => {
  try {
    const filePath = path.join(servicesDir, `service-${req.params.id}.jpg`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Service.updatePhoto(Number(req.params.id), null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
