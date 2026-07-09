// Minimal file-backed data store. No native dependencies to install —
// good enough for a single-server app at modest scale. Swap for Postgres
// later by reimplementing these same functions against a real DB.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], connectedAccounts: [], nextUserId: 1, nextAccountId: 1 };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  // write to a temp file then rename — avoids a half-written file if the
  // process crashes mid-write
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---- users ----
function getUserByEmail(email) {
  return load().users.find(u => u.email === email) || null;
}
function getUserById(id) {
  return load().users.find(u => u.id === id) || null;
}
function createUser(email, passwordHash) {
  const data = load();
  const user = { id: data.nextUserId++, email, password_hash: passwordHash, created_at: new Date().toISOString() };
  data.users.push(user);
  save(data);
  return user;
}

// ---- connected accounts ----
function getAccountsForUser(userId) {
  return load().connectedAccounts.filter(a => a.user_id === userId);
}
function getAccountById(id, userId) {
  return load().connectedAccounts.find(a => a.id === id && a.user_id === userId) || null;
}
function upsertAccount({ userId, gmailAddress, accessTokenEnc, refreshTokenEnc, tokenExpiry }) {
  const data = load();
  let acc = data.connectedAccounts.find(a => a.user_id === userId && a.gmail_address === gmailAddress);
  if (acc) {
    acc.access_token_enc = accessTokenEnc;
    acc.refresh_token_enc = refreshTokenEnc;
    acc.token_expiry = tokenExpiry;
  } else {
    acc = {
      id: data.nextAccountId++,
      user_id: userId,
      gmail_address: gmailAddress,
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      token_expiry: tokenExpiry,
      created_at: new Date().toISOString()
    };
    data.connectedAccounts.push(acc);
  }
  save(data);
  return acc;
}
function updateAccountAccessToken(id, accessTokenEnc, tokenExpiry) {
  const data = load();
  const acc = data.connectedAccounts.find(a => a.id === id);
  if (!acc) return;
  acc.access_token_enc = accessTokenEnc;
  acc.token_expiry = tokenExpiry;
  save(data);
}
function deleteAccount(id) {
  const data = load();
  data.connectedAccounts = data.connectedAccounts.filter(a => a.id !== id);
  save(data);
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  getAccountsForUser,
  getAccountById,
  upsertAccount,
  updateAccountAccessToken,
  deleteAccount
};
