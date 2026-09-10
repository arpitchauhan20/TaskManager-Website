const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/me';
  return authApp(req, res);
};
