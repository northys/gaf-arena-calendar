# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ICS calendar server that scrapes public skating events from GAF Aréna Žamberk ice rink website and serves them as a subscribable iCalendar feed.

## Commands

```bash
npm start        # run the server (default port 3000)
npm run scrape   # run scraper CLI to test extraction
```

## Architecture

Two-file Node.js (ES modules) application:

- **scraper.js** - Puppeteer-based scraper that extracts calendar events from sportovistezamberk.cz. Parses the weekly schedule grid, extracting event IDs, dates, times, and titles from DOM data attributes. Scrapes multiple weeks (default 4) by navigating via form submission (`#filtr_kalendar_start` + `#filters` submit).

- **server.js** - Express server with two endpoints:
  - `GET /calendar.ics` - scrapes live data, filters for "veřejné bruslení" events, returns ICS format with Europe/Prague timezone and reminders
  - `GET /health` - health check

Events are scraped on-demand (no caching). ICS generation includes stable UIDs based on source event IDs for proper calendar sync.

## Docker

Uses system Chromium instead of bundled. Multi-arch build (amd64/arm64) via GitHub Actions to ghcr.io.

```bash
docker build -t calendar .
docker run -p 3000:3000 calendar
```
