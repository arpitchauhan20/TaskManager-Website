const calendarApp = require('../../services/calendarServerless');

module.exports = (req, res) => {
  req.url = '/api/calendar/disconnect';
  return calendarApp(req, res);
};
