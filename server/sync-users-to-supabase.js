/**
 * One-time script: sync all local SQLite users to Supabase Auth
 * Run: node sync-users-to-supabase.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { all } = require('./db');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

async function sync() {
  const users = await all('SELECT * FROM users');
  console.log(`Found ${users.length} local users to sync...`);

  for (const u of users) {
    // Check if already in Supabase
    const { data: existing } = await sb.auth.admin.listUsers();
    const found = existing?.users?.find(su => su.email === u.email);

    if (found) {
      console.log(`✅ Already in Supabase: ${u.email}`);
      continue;
    }

    // Create in Supabase Auth with a temp password
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: Math.random().toString(36) + 'Aa1!', // temp password
      user_metadata: { name: u.name || '' },
      email_confirm: true,
    });

    if (error) {
      console.log(`❌ Failed ${u.email}: ${error.message}`);
    } else {
      console.log(`✅ Synced: ${u.email}`);
    }
  }

  console.log('\nDone! Users can now use Reset Password and Magic Link.');
  process.exit(0);
}

sync().catch(e => { console.error(e); process.exit(1); });
