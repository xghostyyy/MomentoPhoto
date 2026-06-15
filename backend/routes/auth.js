const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const { verifyToken } = require('../middleware/auth');
const { sendVerificationCode } = require('../utils/email');

// POST /api/register — step 1: store pending registration, email a 6-digit code
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password и fullName обязательны' });
    }

    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email уже зарегистрирован' });

    const passwordHash = await bcrypt.hash(password, 10);
    const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await EmailVerification.upsert({ email, code, password_hash: passwordHash, full_name: fullName, expires_at: expiresAt });
    sendVerificationCode(email, code, fullName).catch(console.error);
    console.log(`[verify] code for ${email} = ${code}`); // dev convenience

    res.status(200).json({ pending: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/verify-code — step 2: validate code, create the user, return JWT
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email и code обязательны' });

    const v = await EmailVerification.findByEmail(email);
    if (!v) return res.status(400).json({ error: 'Код не найден — запросите регистрацию заново' });
    if (new Date(v.expires_at).getTime() < Date.now()) {
      await EmailVerification.deleteByEmail(email);
      return res.status(400).json({ error: 'Код истёк — запросите новый' });
    }
    if (String(v.code) !== String(code).trim()) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      await EmailVerification.deleteByEmail(email);
      return res.status(409).json({ error: 'Email уже зарегистрирован' });
    }

    const role = 'client';
    const { id } = await User.createUser(email, v.password_hash, role, v.full_name, null);
    await EmailVerification.deleteByEmail(email);

    const token = jwt.sign({ id, role, employeeType: null }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, id, role, employeeType: null, fullName: v.full_name });
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
