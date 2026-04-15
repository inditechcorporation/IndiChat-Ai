require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function test() {
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SERVICE_KEY set:', !!process.env.SUPABASE_SERVICE_KEY);

  // Test 1: List users
  const { data: users, error: listErr } = await sb.auth.admin.listUsers();
  if (listErr) console.log('List users error:', listErr.message);
  else console.log('Total users in Supabase Auth:', users.users.length);

  // Test 2: Generate reset link
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email: 'aarifali4012@gmail.com',
    options: { redirectTo: 'http://localhost:5173/reset-password' }
  });

  if (error) {
    console.log('generateLink ERROR:', error.message, error.status);
  } else {
    console.log('generateLink SUCCESS');
    console.log('Action link:', data?.properties?.action_link?.substring(0, 80) + '...');
    console.log('Email sent:', data?.properties?.email_otp ? 'OTP generated' : 'check Supabase logs');
  }

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
