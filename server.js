require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const googleRoutes = require('./routes/google');
const accountsRoutes = require('./routes/accounts');
const mailRoutes = require('./routes/mail');

const app = express();

app.use(express.json());
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: true
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRoutes);
app.use('/auth/google', googleRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/mail', mailRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
});
