const fetch = require('node-fetch');
const store = require('./store');
const { encrypt, decrypt } = require('./crypto');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
} = process.env;

// Step 1: build the URL we send the user to for consent
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',   // <-- required to get a refresh_token
    prompt: 'consent',        // <-- forces Google to re-issue refresh_token every time
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Step 2: exchange the one-time code for tokens
async function exchangeCodeForTokens(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token exchange failed: ' + JSON.stringify(data));
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function fetchGoogleEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const info = await res.json();
  return info.email;
}

// Refresh an expired access token using the stored refresh token
async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  return data; // { access_token, expires_in, ... } (no new refresh_token normally)
}

// Given a DB row for a connected account, return a valid access token,
// refreshing (and persisting the refresh) if it has expired.
async function getValidAccessToken(accountRow) {
  const now = Date.now();
  if (now < accountRow.token_expiry - 60_000) {
    return decrypt(accountRow.access_token_enc);
  }
  const refreshToken = decrypt(accountRow.refresh_token_enc);
  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiry = now + refreshed.expires_in * 1000;

  store.updateAccountAccessToken(accountRow.id, encrypt(refreshed.access_token), newExpiry);

  return refreshed.access_token;
}

// Revoke a token with Google (called on disconnect)
async function revokeToken(token) {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token })
  }).catch(() => {}); // best-effort; ignore network errors on revoke
}

function encodeRawEmail(to, subject, body) {
  const encodedSubject = '=?UTF-8?B?' + Buffer.from(subject, 'utf8').toString('base64') + '?=';
  const raw = [
    'To: ' + to,
    'Subject: ' + encodedSubject,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body
  ].join('\r\n');
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendGmail(accessToken, to, subject, body) {
  const raw = encodeRawEmail(to, subject, body);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed (HTTP ${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  getValidAccessToken,
  revokeToken,
  sendGmail
};
