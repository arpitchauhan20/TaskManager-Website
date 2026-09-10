const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/login';
  return authApp(req, res);
};
