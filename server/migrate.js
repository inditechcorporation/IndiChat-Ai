require('dotenv').config();
const { db } = require('./db');

db.serialize(() => {
  // Add is_admin column if missing
  db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0', (e) => {
    if (e) console.log('is_admin:', e.message);
    else console.log('✅ is_admin column added');
  });

  // Create platform_settings table
  db.run(`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  )`, (e) => {
    if (e) console.log('platform_settings error:', e.message);
    else console.log('✅ platform_settings table OK');
  });

  // Seed defaults
  const defaults = [
    ['ai_name',      'IndiChat'],
    ['ai_intro',     'I am IndiChat, your intelligent voice assistant.'],
    ['creator_name', 'IndiTech Corporation'],
    ['creator_intro','IndiTech Corporation builds smart AI-powered devices.'],
  ];
  defaults.forEach(([k, v]) => {
    db.run('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)', [k, v]);
  });

  // Set admin email as admin
  const adminEmail = process.env.ADMIN_EMAIL || 'aarifali40122@gmail.com';
  db.run('UPDATE users SET is_admin = 1 WHERE email = ?', [adminEmail], function(e) {
    if (e) console.log('admin set error:', e.message);
    else console.log(`✅ Admin set for ${adminEmail} (${this.changes} row updated)`);
  });

  setTimeout(() => {
    console.log('✅ Migration done');
    process.exit(0);
  }, 1000);
});
