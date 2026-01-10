import puppeteer from 'puppeteer';

const URL = 'https://www.sportovistezamberk.cz/web/cs/sportoviste/gaf-arena-2-7.html?tab_id=web';
const WEEKS_TO_SCRAPE = 4;

async function extractWeekEvents(page) {
  return page.evaluate(() => {
    const dayHeaders = document.querySelectorAll('.calendar-date-header');
    const weekDates = {};
    dayHeaders.forEach((header, index) => {
      const dateEl = header.querySelector('.calendar-header-date');
      if (dateEl) {
        weekDates[index] = dateEl.textContent.trim();
      }
    });

    const timelineData = [];
    const days = document.querySelectorAll('.data-row.tyden > .tbl-data-cell');

    days.forEach((dayCell, dayIndex) => {
      if (dayIndex === 0) return;

      const dayDate = weekDates[dayIndex] || `Day ${dayIndex}`;

      const eventItems = dayCell.querySelectorAll('[data-start]');
      eventItems.forEach(item => {
        const startTime = item.getAttribute('data-start');
        const endTime = item.getAttribute('data-end');
        const eventId = item.getAttribute('data-event');

        const text = item.textContent.trim();
        const parts = text.split('-').map(s => s.trim());
        const meaningfulParts = parts.filter(p =>
          p &&
          !p.match(/^\d{1,2}:\d{2}$/) &&
          !p.includes('Správa sportovišť')
        );
        let title = meaningfulParts[meaningfulParts.length - 1] || '-';

        if (startTime) {
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
      weekDates: Object.values(weekDates)
    };
  });
}

function formatDateForFilter(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

async function navigateToWeek(page, date) {
  const dateStr = formatDateForFilter(date);
  await page.evaluate((d) => {
    document.querySelector('#filtr_kalendar_start').value = d;
    document.querySelector('#filters').dispatchEvent(new Event('submit'));
  }, dateStr);
  await new Promise(resolve => setTimeout(resolve, 2000));
}

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
    await page.waitForSelector('#publish', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const allEvents = [];
    const allWeekDates = [];
    const seenEventIds = new Set();

    for (let week = 0; week < WEEKS_TO_SCRAPE; week++) {
      if (week > 0) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + (week * 7));
        console.log(`Navigating to week ${week + 1}...`);
        await navigateToWeek(page, targetDate);
      }

      console.log(`Extracting week ${week + 1} data...`);
      const weekData = await extractWeekEvents(page);

      for (const event of weekData.events) {
        const uniqueKey = event.id || `${event.date}-${event.time}-${event.title}`;
        if (!seenEventIds.has(uniqueKey)) {
          seenEventIds.add(uniqueKey);
          allEvents.push(event);
        }
      }
      allWeekDates.push(...weekData.weekDates);
    }

    console.log(`Scraped ${allEvents.length} events across ${WEEKS_TO_SCRAPE} weeks`);
    return {
      events: allEvents,
      weekDates: [...new Set(allWeekDates)],
      pageTitle: 'GAF Aréna Žamberk'
    };
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
