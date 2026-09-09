module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const publicKey = process.env.VAPID_PUBLIC_KEY || 'BC_sS7sD-_DCNVuBQ9smVFmPSsQvBlCQkKaUAkyPCr2eCZlOgtlGPYxLy-ce9-Se1Iu8NzIkzXnys25E2JZbMnI';
  res.status(200).json({ publicKey });
};
