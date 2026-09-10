const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/logout';
  return authApp(req, res);
};
