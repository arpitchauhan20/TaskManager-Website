module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="taskflow.ics"');

  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const now = new Date();

  // Basic calendar scaffold
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow Pro//Live Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TaskFlow Pro Deadlines',
    'X-WR-TIMEZONE:UTC'
  ];

  ics.push('END:VCALENDAR');
  res.status(200).send(ics.join('\r\n'));
};
