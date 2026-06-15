const { getDb } = require('../utils/db');

const Review = {
  create({ booking_id, rating, text = '' }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'INSERT INTO reviews (booking_id, rating, text) VALUES (?, ?, ?)',
        [booking_id, rating, text],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  },

  findPublished() {
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT r.*, b.client_name
         FROM reviews r
         JOIN bookings b ON r.booking_id = b.id
         WHERE r.is_published = 1
         ORDER BY r.id DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  findAll() {
    return new Promise((resolve, reject) => {
      getDb().all(
        `SELECT r.*, b.client_name
         FROM reviews r
         JOIN bookings b ON r.booking_id = b.id
         ORDER BY r.id DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  setPublished(id, is_published) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'UPDATE reviews SET is_published = ? WHERE id = ?',
        [is_published ? 1 : 0, id],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  },
};

module.exports = Review;
