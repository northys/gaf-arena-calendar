import puppeteer from 'puppeteer';

const URL = 'https://www.sportovistezamberk.cz/web/cs/sportoviste/gaf-arena-2-7.html?tab_id=web';

export async function scrapeCalendar() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    console.log('Loading page...');
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for calendar to load
    await page.waitForSelector('#publish', { timeout: 15000 });

    // Give it a moment for all events to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Extracting calendar data...');

    const calendarData = await page.evaluate(() => {
      const events = [];

      // Get the week dates from header
      const dayHeaders = document.querySelectorAll('.calendar-date-header');
      const weekDates = {};
      dayHeaders.forEach((header, index) => {
        const dateEl = header.querySelector('.calendar-header-date');
        if (dateEl) {
          weekDates[index] = dateEl.textContent.trim();
        }
      });

      // Get structured data from timeline
      const timelineData = [];
      const days = document.querySelectorAll('.data-row.tyden > .tbl-data-cell');

      days.forEach((dayCell, dayIndex) => {
        if (dayIndex === 0) return; // Skip header column

        const dayDate = weekDates[dayIndex] || `Day ${dayIndex}`;

        // Extract from data attributes - find elements with data-start
        const eventItems = dayCell.querySelectorAll('[data-start]');
        eventItems.forEach(item => {
          const startTime = item.getAttribute('data-start');
          const endTime = item.getAttribute('data-end');
          const eventId = item.getAttribute('data-event');

          // Parse title from text content
          // Format: "16:00 - 17:30- Správa sportovišť města Žamberk-veřejné bruslení"
          const text = item.textContent.trim();

          // Split by dash and find the last meaningful part (the event name)
          const parts = text.split('-').map(s => s.trim());
          // Filter out time parts, organization, and empty strings
          const meaningfulParts = parts.filter(p =>
            p &&
            !p.match(/^\d{1,2}:\d{2}$/) &&
            !p.includes('Správa sportovišť')
          );
          // Title is usually the last part
          let title = meaningfulParts[meaningfulParts.length - 1] || '-';

          if (startTime) {
            // Format time nicely
            const startFormatted = startTime.match(/\d{2}:\d{2}/)?.[0] || startTime;
            const endFormatted = endTime?.match(/\d{2}:\d{2}/)?.[0] || endTime;

            timelineData.push({
              id: eventId,
              date: dayDate,
              time: endFormatted ? `${startFormatted} - ${endFormatted}` : startFormatted,
              title: title || '-',
              dayIndex
            });
          }
        });
      });

      return {
        events: timelineData,
        weekDates: Object.values(weekDates),
        pageTitle: document.title
      };
    });

    console.log(`Scraped ${calendarData.events.length} events`);
    return calendarData;
  } finally {
    await browser.close();
  }
}

// CLI mode - run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeCalendar()
    .then(data => {
      console.log('\n=== GAF Aréna Žamberk - Weekly Schedule ===\n');
      if (data.weekDates.length > 0) {
        console.log('Week:', data.weekDates.join(' - '));
      }

      const eventsByDate = {};
      data.events.forEach(event => {
        const key = event.date || 'Unknown';
        if (!eventsByDate[key]) eventsByDate[key] = [];
        eventsByDate[key].push(event);
      });

      Object.entries(eventsByDate).forEach(([date, events]) => {
        console.log(`\n📅 ${date}`);
        events.forEach(e => {
          console.log(`  ${e.time || '??:??'} - ${e.title}`);
        });
      });
    })
    .catch(console.error);
}
