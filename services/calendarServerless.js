// Serverless Express bridge for Vercel Calendar endpoints
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const calendarRoutes = require('../routes/calendarRoutes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Mount calendar routes directly
app.use('/', calendarRoutes);

module.exports = app;
