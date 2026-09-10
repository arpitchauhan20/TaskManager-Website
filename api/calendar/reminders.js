const calendarApp = require('../../services/calendarServerless');

module.exports = (req, res) => {
  req.url = '/api/calendar/reminders';
  return calendarApp(req, res);
};
