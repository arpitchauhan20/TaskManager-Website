const calendarApp = require('../../services/calendarServerless');

module.exports = (req, res) => {
  const queryIndex = req.url.indexOf('?');
  const qs = queryIndex >= 0 ? req.url.substring(queryIndex) : '';
  req.url = '/auth/google' + qs;
  return calendarApp(req, res);
};
