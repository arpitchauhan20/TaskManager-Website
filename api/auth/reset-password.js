const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/reset-password';
  return authApp(req, res);
};
