# IdleHand - John Zigterman

## Description

It's a fun little game for your browser.

## Test setup

Run this when you want a reliable browser smoke check for core gameplay:

1. `npm install`
2. `npm run test:install-browsers`
3. `npm test`

This runs:
- `node --check` over `script.js`
- Playwright smoke browser tests by default

Run broader suites:
- `npm run test:full` for the full in-browser regression set
- `npm run test:nightly` for additional persistence/reload checks

If you only want a headed browser run for debugging:
- `npm run test:e2e:headed`

## License

All Rights Reserved

Copyright (c) 2023 John Paul Zigterman
