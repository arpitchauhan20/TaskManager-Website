const authApp = require('../../services/authServerless');

module.exports = (req, res) => {
  req.url = '/register';
  return authApp(req, res);
};
