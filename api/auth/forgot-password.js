const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/forgot-password';
  return authApp(req, res);
};
