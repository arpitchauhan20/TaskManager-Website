const calendarApp = require('../../services/calendarServerless');

module.exports = (req, res) => {
  req.url = '/api/calendar/status';
  return calendarApp(req, res);
};
