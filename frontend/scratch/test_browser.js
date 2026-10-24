import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  const title = await page.title();
  console.log('Page title:', title);
  await browser.close();
  console.log('Browser test successful!');
}

main().catch(err => {
  console.error('Browser error:', err);
  process.exit(1);
});
