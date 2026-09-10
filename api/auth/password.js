const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/password';
  return authApp(req, res);
};
