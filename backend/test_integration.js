/**
 * Integration test — runs directly in Node, bypasses PowerShell UTF-8 issues.
 */
require('dotenv').config();
const http = require('http');
const EmailVerification = require('./models/EmailVerification');

let pass = 0; let fail = 0;
function ok(l)     { console.log('[PASS]', l); pass++; }
function ko(l, d)  { console.log('[FAIL]', l, '|', d); fail++; }

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const json  = body ? JSON.stringify(body) : null;
    const opts  = {
      hostname: 'localhost', port: 3000, path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json  ? { 'Content-Length': Buffer.byteLength(json) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (json) r.write(json);
    r.end();
  });
}

async function main() {
  // Login
  const adminR = await req('POST', '/api/login', { email: 'admin@momento.ru',   password: 'test123' });
  const photoR = await req('POST', '/api/login', { email: 'photo@momento.ru',   password: 'test123' });
  const mgrR   = await req('POST', '/api/login', { email: 'manager@momento.ru', password: 'test123' });
  const aT = adminR.body.token; const pT = photoR.body.token; const mT = mgrR.body.token;
  if (aT && pT && mT) ok('Login all 3 roles'); else ko('Login', 'missing tokens');

  // Register client — 2-step: request code, then verify
  const clientEmail = `client_${Date.now()}@test.ru`;
  const regR = await req('POST', '/api/register', { fullName: 'Тест Клиент', email: clientEmail, password: 'pass123' });
  if (regR.status === 200 && regR.body.pending) ok('Register → code sent (pending)');
  else ko('Register pending', JSON.stringify(regR.body));

  const v = await EmailVerification.findByEmail(clientEmail);
  const verR = await req('POST', '/api/verify-code', { email: clientEmail, code: v ? v.code : '000000' });
  if (verR.status === 201 && verR.body.role === 'client') ok('Verify code → client created');
  else ko('Verify code', JSON.stringify(verR.body));
  const cT = verR.body.token;
  if (cT) ok('Client token obtained'); else ko('Client token', '');

  // Wrong code rejected
  const badReg = await req('POST', '/api/register', { fullName: 'Bad', email: `bad_${Date.now()}@test.ru`, password: 'pass123' });
  const badVer = await req('POST', '/api/verify-code', { email: badReg.body.email, code: '000000' });
  if (badVer.status === 400) ok('Wrong code → 400'); else ko('Wrong code', badVer.status);

  // GET /api/me includes role
  const meR = await req('GET', '/api/me', null, cT);
  if (meR.body.role) ok(`GET /me role=${meR.body.role}`); else ko('GET /me no role', '');

  // Create booking as client (photo service)
  const b1R = await req('POST', '/api/bookings', { client_name: 'Тест Клиент', client_phone: '+79001111111', service: 'Портретная съёмка' }, cT);
  if (b1R.status === 201) ok('POST /bookings (client, photo service)'); else ko('POST /bookings photo', JSON.stringify(b1R.body));
  const b1Id = b1R.body.id;

  // Create booking (manager service)
  const b2R = await req('POST', '/api/bookings', { client_name: 'Аноним', client_phone: '+79002222222', service: 'Аренда помещения' });
  if (b2R.status === 201) ok('POST /bookings (anon, manager service)'); else ko('POST /bookings mgr', JSON.stringify(b2R.body));
  const b2Id = b2R.body.id;

  // Dashboard: photographer sees only photo bookings
  const dbPhotoR = await req('GET', '/api/dashboard/bookings', null, pT);
  const dbPhoto = dbPhotoR.body;
  const photoOk = Array.isArray(dbPhoto) && dbPhoto.length >= 1 &&
    dbPhoto.every(b => b.service_employee_type === 'photographer');
  if (photoOk) ok(`Dashboard: photographer sees ${dbPhoto.length} photo booking(s)`);
  else ko('Dashboard photo filter', JSON.stringify(dbPhoto));

  // Dashboard: manager sees only manager bookings
  const dbMgrR = await req('GET', '/api/dashboard/bookings', null, mT);
  const dbMgr = dbMgrR.body;
  const mgrOk = Array.isArray(dbMgr) && dbMgr.length >= 1 &&
    dbMgr.every(b => b.service_employee_type === 'manager');
  if (mgrOk) ok(`Dashboard: manager sees ${dbMgr.length} manager booking(s)`);
  else ko('Dashboard manager filter', JSON.stringify(dbMgr));

  // Dashboard: admin sees all
  const dbAdminR = await req('GET', '/api/dashboard/bookings', null, aT);
  if (Array.isArray(dbAdminR.body) && dbAdminR.body.length >= 2)
    ok(`Dashboard: admin sees all (${dbAdminR.body.length})`);
  else ko('Dashboard admin', JSON.stringify(dbAdminR.body));

  // Polling count
  const cntR = await req('GET', '/api/dashboard/new-bookings-count?lastCheck=0', null, aT);
  if (cntR.body.count >= 2) ok(`Polling count = ${cntR.body.count}`); else ko('Polling', JSON.stringify(cntR.body));

  // Confirm b1 so client can review
  const confR = await req('PUT', `/api/bookings/${b1Id}/confirm`, null, aT);
  if (confR.status === 200) ok('PUT /confirm booking'); else ko('confirm', JSON.stringify(confR.body));

  // Confirmed bookings for client
  const cbR = await req('GET', '/api/user/confirmed-bookings', null, cT);
  if (cbR.status === 200 && cbR.body.length >= 1) ok(`Confirmed bookings: ${cbR.body.length}`);
  else ko('confirmed-bookings', JSON.stringify(cbR.body));

  // Post review
  const rvR = await req('POST', '/api/reviews', { booking_id: b1Id, rating: 5, text: 'Великолепно!' }, cT);
  if (rvR.status === 201) ok('POST /reviews (confirmed booking)');
  else ko('POST review', JSON.stringify(rvR.body));
  const rvId = rvR.body.id;

  // Duplicate review blocked
  const dup = await req('POST', '/api/reviews', { booking_id: b1Id, rating: 4 }, cT);
  if (dup.status === 409) ok('Duplicate review → 409'); else ko('Duplicate review', dup.status);

  // Unconfirmed booking review blocked
  const unconf = await req('POST', '/api/reviews', { booking_id: b2Id, rating: 3 }, cT);
  if (unconf.status === 403 || unconf.status === 400) ok(`Unconfirmed review blocked → ${unconf.status}`);
  else ko('Unconfirmed review', unconf.status);

  // Admin: list users
  const usersR = await req('GET', '/api/admin/users', null, aT);
  if (Array.isArray(usersR.body) && usersR.body.length >= 3) ok(`Admin users: ${usersR.body.length}`);
  else ko('Admin users', JSON.stringify(usersR.body));
  const clientUser = usersR.body.find(u => u.role === 'client');
  if (clientUser && !clientUser.password_hash) ok('password_hash hidden from admin list');
  else ko('password_hash exposed', '');

  // Admin: change role
  if (clientUser) {
    const crR = await req('POST', '/api/admin/users/change-role', { userId: clientUser.id, newRole: 'employee' }, aT);
    if (crR.status === 200) ok('Change role → employee'); else ko('change-role', JSON.stringify(crR.body));
    // Restore
    await req('POST', '/api/admin/users/change-role', { userId: clientUser.id, newRole: 'client' }, aT);
  }

  // Admin: publish review
  const pubR = await req('POST', '/api/admin/reviews/publish', { reviewId: rvId, is_published: true }, aT);
  if (pubR.status === 200) ok('Publish review'); else ko('publish', JSON.stringify(pubR.body));

  // Public reviews shows published
  const pubListR = await req('GET', '/api/reviews');
  if (Array.isArray(pubListR.body) && pubListR.body.length >= 1) ok(`Published reviews: ${pubListR.body.length}`);
  else ko('Published reviews empty', '');

  // Admin: get all reviews
  const allRvR = await req('GET', '/api/admin/reviews', null, aT);
  if (Array.isArray(allRvR.body) && allRvR.body[0].created_at) ok('Reviews include created_at');
  else ko('Reviews no created_at', JSON.stringify(allRvR.body[0]));

  // Employee blocked from admin routes
  const guardR = await req('GET', '/api/admin/users', null, pT);
  if (guardR.status === 403) ok('Employee blocked from admin → 403'); else ko('Admin guard', guardR.status);

  // Cannot delete self
  const selfR = await req('DELETE', `/api/admin/users/${adminR.body.id}`, null, aT);
  if (selfR.status === 400) ok('Cannot delete self → 400'); else ko('Delete self', selfR.status);

  // Nonexistent user
  const ne = await req('DELETE', '/api/admin/users/9999', null, aT);
  if (ne.status === 404) ok('Delete nonexistent → 404'); else ko('Delete ne', ne.status);

  console.log(`\n=== PASS: ${pass}  FAIL: ${fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
