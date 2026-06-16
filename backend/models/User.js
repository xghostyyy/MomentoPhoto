const { getDb } = require('../utils/db');

const User = {
  findByEmail(email) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  findById(id) {
    return new Promise((resolve, reject) => {
      getDb().get(
        'SELECT id, email, role, full_name, employee_type, email_notifications FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  },

  create({ email, password_hash, role = 'client', full_name, employee_type = null, email_notifications = 1 }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        `INSERT INTO users (email, password_hash, role, full_name, employee_type, email_notifications)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, password_hash, role, full_name, employee_type, email_notifications],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },

  createUser(email, passwordHash, role = 'client', fullName, employeeType = null) {
    return User.create({
      email,
      password_hash: passwordHash,
      role,
      full_name: fullName,
      employee_type: employeeType,
    });
  },

  getAllUsers() {
    return new Promise((resolve, reject) => {
      getDb().all(
        'SELECT id, email, role, full_name, employee_type FROM users ORDER BY id ASC',
        [],
        (err, rows) => { if (err) return reject(err); resolve(rows); }
      );
    });
  },

  updateRole(userId, newRole) {
    return new Promise((resolve, reject) => {
      getDb().run('UPDATE users SET role = ? WHERE id = ?', [newRole, userId], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  },

  deleteById(userId) {
    return new Promise((resolve, reject) => {
      getDb().run('DELETE FROM users WHERE id = ?', [userId], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  },

  findAllEmployees({ includeEmail = false, includeMail = false } = {}) {
    const cols = [
      'id', 'full_name', 'employee_type',
      ...(includeEmail ? ['email'] : []),
      ...(includeMail  ? ['mail_user', 'mail_pass'] : []),
    ].join(', ');
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT ${cols} FROM users WHERE role = 'employee'`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  findTeamByType(employeeType, { includeEmail = false, includeMail = false } = {}) {
    const cols = [
      'id', 'full_name', 'employee_type', 'role',
      ...(includeEmail ? ['email'] : []),
      ...(includeMail  ? ['mail_user', 'mail_pass'] : []),
    ].join(', ');
    return new Promise((resolve, reject) => {
      // Always include all admins; filter employees by their type
      getDb().all(
        `SELECT ${cols} FROM users WHERE role = 'admin' OR (role = 'employee' AND employee_type = ?)`,
        [employeeType],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  findAllAdmins({ includeEmail = false, includeMail = false } = {}) {
    const cols = [
      'id', 'full_name', 'employee_type', 'role',
      ...(includeEmail ? ['email'] : []),
      ...(includeMail  ? ['mail_user', 'mail_pass'] : []),
    ].join(', ');
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT ${cols} FROM users WHERE role = 'admin'`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  findTeam() {
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT id, full_name, employee_type, role, photo_url
         FROM users WHERE role IN ('employee', 'admin')
         ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC`,
        [],
        (err, rows) => { if (err) return reject(err); resolve(rows); }
      );
    });
  },

  updateEmployee(id, { full_name, employee_type }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'UPDATE users SET full_name = ?, employee_type = ? WHERE id = ?',
        [full_name, employee_type || null, id],
        function (err) { if (err) return reject(err); resolve({ changes: this.changes }); }
      );
    });
  },

  updatePhoto(id, photo_url) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'UPDATE users SET photo_url = ? WHERE id = ?',
        [photo_url, id],
        function (err) { if (err) return reject(err); resolve({ changes: this.changes }); }
      );
    });
  },

  getMailSettings(userId) {
    return new Promise((resolve, reject) => {
      getDb().get(
        'SELECT mail_user, mail_pass FROM users WHERE id = ?',
        [userId],
        (err, row) => { if (err) return reject(err); resolve(row); }
      );
    });
  },

  updateMailSettings(userId, mailUser, mailPass) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'UPDATE users SET mail_user = ?, mail_pass = ? WHERE id = ?',
        [mailUser || null, mailPass || null, userId],
        function (err) { if (err) return reject(err); resolve({ changes: this.changes }); }
      );
    });
  },
};

module.exports = User;
