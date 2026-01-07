import express from 'express';
import { scrapeCalendar } from './scraper.js';

const app = express();
const PORT = process.env.PORT || 3000;

function parseDateTime(dateStr, timeStr) {
  // dateStr: "5.1.2026", timeStr: "16:00 - 17:30"
  const [day, month, year] = dateStr.split('.').map(Number);
  const [startTime, endTime] = timeStr.split(' - ').map(t => t.trim());
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime ? endTime.split(':').map(Number) : [startHour + 1, startMin];

  return {
    start: { year, month, day, hour: startHour, min: startMin },
    end: { year, month, day, hour: endHour, min: endMin }
  };
}

function formatICSDate(dt) {
  // Format as local time with TZID (not UTC)
  const pad = n => String(n).padStart(2, '0');
  return `${dt.year}${pad(dt.month)}${pad(dt.day)}T${pad(dt.hour)}${pad(dt.min)}00`;
}

function generateUID(event) {
  // Use stable event ID from source if available
  if (event.id) {
    return `event-${event.id}@gaf-arena-zamberk`;
  }
  // Fallback to hash
  const hash = Buffer.from(`${event.date}-${event.time}-${event.title}`).toString('base64');
  return `${hash}@gaf-arena-zamberk`;
}

function formatDTSTAMP() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function eventsToICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GAF Arena Zamberk//Calendar Scraper//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GAF Aréna Žamberk - Veřejné bruslení',
    'X-WR-TIMEZONE:Europe/Prague',
  ];

  for (const event of events) {
    if (!event.date || !event.time || event.title === '-') continue;

    try {
      const { start, end } = parseDateTime(event.date, event.time);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${generateUID(event)}`);
      lines.push(`DTSTAMP:${formatDTSTAMP()}`);
      lines.push(`DTSTART;TZID=Europe/Prague:${formatICSDate(start)}`);
      lines.push(`DTEND;TZID=Europe/Prague:${formatICSDate(end)}`);
      lines.push(`SUMMARY:${event.title}`);
      lines.push('LOCATION:GAF Aréna Žamberk');
      // 1 hour reminder
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT1H');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Veřejné bruslení za 1 hodinu');
      lines.push('END:VALARM');
      // 30 min reminder
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT30M');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Veřejné bruslení za 30 minut');
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    } catch (e) {
      console.error(`Failed to parse event: ${event.title}`, e.message);
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

app.get('/calendar.ics', async (req, res) => {
  console.log(`[${new Date().toISOString()}] ICS request received`);

  try {
    const data = await scrapeCalendar();

    // Filter only public skating events
    const publicSkating = data.events.filter(e =>
      e.title.toLowerCase().includes('veřejné bruslení') ||
      e.title.toLowerCase().includes('verejne brusleni')
    );

    const ics = eventsToICS(publicSkating);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gaf-arena.ics"');
    res.send(ics);

    console.log(`[${new Date().toISOString()}] Served ${publicSkating.length} public skating events (of ${data.events.length} total)`);
  } catch (error) {
    console.error('Scraping failed:', error);
    res.status(500).send('Failed to fetch calendar data');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Calendar server running on http://localhost:${PORT}`);
  console.log(`Subscribe to: http://localhost:${PORT}/calendar.ics`);
});
