// Serverless Express bridge for Vercel /api/auth/* endpoints
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('../routes/authRoutes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Mount auth routes directly
app.use('/', authRoutes);

module.exports = app;
