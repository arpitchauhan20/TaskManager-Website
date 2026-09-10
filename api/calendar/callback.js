const calendarApp = require('../../services/calendarServerless');

module.exports = (req, res) => {
  const queryIndex = req.url.indexOf('?');
  const qs = queryIndex >= 0 ? req.url.substring(queryIndex) : '';
  req.url = '/auth/google/callback' + qs;
  return calendarApp(req, res);
};
