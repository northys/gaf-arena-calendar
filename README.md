# GAF Arena Calendar

ICS calendar server that scrapes public skating events from [GAF Aréna Žamberk](https://www.sportovistezamberk.cz/) ice rink and serves them as a subscribable iCalendar feed.

## Features

- Scrapes weekly schedule from sportovistezamberk.cz
- Filters for "veřejné bruslení" (public skating) events
- Generates ICS feed with Europe/Prague timezone
- Includes reminders (1 hour and 30 minutes before events)
- Stable UIDs for proper calendar sync
- 1 hour cache for scraped data

## Usage

### Subscribe to calendar

Add this URL to your calendar app (Google Calendar, Apple Calendar, etc.):

```
https://your-server/calendar.ics
```

### Run locally

```bash
npm install
npm start
```

Server runs on port 3000 by default.

### Test scraper

```bash
npm run scrape
```

## Endpoints

- `GET /calendar.ics` - returns ICS calendar feed
- `GET /health` - health check

## Docker

```bash
docker build -t gaf-arena-calendar .
docker run -p 3000:3000 gaf-arena-calendar
```

Multi-arch images (amd64/arm64) are built via GitHub Actions and published to ghcr.io.

## License

MIT
