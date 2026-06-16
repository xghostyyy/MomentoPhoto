const { getDb } = require('../utils/db');

const GalleryPhoto = {
  findAll() {
    return new Promise((resolve, reject) => {
      getDb().all(
        'SELECT id, url, caption FROM gallery_photos ORDER BY id ASC',
        [], (err, rows) => { if (err) return reject(err); resolve(rows); }
      );
    });
  },

  findById(id) {
    return new Promise((resolve, reject) => {
      getDb().get('SELECT * FROM gallery_photos WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err); resolve(row);
      });
    });
  },

  create({ url, caption }) {
    return new Promise((resolve, reject) => {
      getDb().run(
        'INSERT INTO gallery_photos (url, caption) VALUES (?, ?)',
        [url, caption || null],
        function (err) { if (err) return reject(err); resolve({ id: this.lastID }); }
      );
    });
  },

  deleteById(id) {
    return new Promise((resolve, reject) => {
      getDb().run('DELETE FROM gallery_photos WHERE id = ?', [id], function (err) {
        if (err) return reject(err); resolve({ changes: this.changes });
      });
    });
  },
};

module.exports = GalleryPhoto;
