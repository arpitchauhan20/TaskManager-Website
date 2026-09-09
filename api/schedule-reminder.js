module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { taskId, title, deadline, reminderTime, priority, channels, email } = req.body || {};

  res.status(200).json({
    success: true,
    reminder: {
      id: 'rem_' + Date.now(),
      taskId,
      title,
      deadline,
      reminderTime,
      priority,
      channels,
      email,
      createdAt: new Date().toISOString()
    }
  });
};
