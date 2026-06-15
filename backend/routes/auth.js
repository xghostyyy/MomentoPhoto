const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'client', employeeType } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password и fullName обязательны' });
    }

    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email уже зарегистрирован' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { id } = await User.createUser(email, passwordHash, role, fullName, employeeType ?? null);

    const token = jwt.sign(
      { id, role, employeeType: employeeType ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({ token, id, role, employeeType: employeeType ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email и password обязательны' });
    }

    const user = await User.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign(
      { id: user.id, role: user.role, employeeType: user.employee_type },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      id: user.id,
      role: user.role,
      employeeType: user.employee_type,
      fullName: user.full_name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/me  (защищённый)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
