import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const baseURL = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:18080';
const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);
const executablePath = candidates.find(existsSync);
if (!executablePath) throw new Error('Set BROWSER_PATH to an installed Chromium/Edge executable.');

const viewports = [
  [320, 568], [360, 800], [375, 812], [390, 844], [414, 896], [430, 932],
  [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080], [844, 390],
];
const deepViewports = [[320, 568], [390, 844], [768, 1024], [1024, 768]];
const browser = await chromium.launch({ executablePath, headless: true });
const failures = [];
const screenshotDir = resolve('test-results/responsive');
if (process.env.RESPONSIVE_SCREENSHOTS === '1') mkdirSync(screenshotDir, { recursive: true });

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/registration-status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_open: true, deadline: '2026-10-10T00:00:00+06:00', server_time: '2026-10-06T18:30:00+06:00', reason: 'open', message: null }) }));
  return { context, page, errors };
}

async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const hasScrollableParent = (element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (parent.scrollWidth > parent.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll('body *')].filter((element) => {
      if (element.matches('.nav:not(.open), .nav:not(.open) *, .orb, .hero-grid, .hero-code, .scroll-hint')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'absolute') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > viewport + 1) && !hasScrollableParent(element);
    }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, id: element.id, rect: element.getBoundingClientRect().toJSON() }));
    return { viewport, htmlWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, offenders };
  });
  if (result.htmlWidth > result.viewport + 1 || result.bodyWidth > result.viewport + 1 || result.offenders.length) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(result)}`);
  }
}

async function publicAudit(width, height) {
  const { context, page, errors } = await newPage(width, height);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#registration-countdown.open').waitFor();
  await assertNoOverflow(page, `public ${width}x${height}`);
  if (width <= 720) {
    await page.locator('.menu-toggle').click();
    await page.locator('#nav.open').waitFor();
    await page.waitForTimeout(250);
    await assertNoOverflow(page, `menu ${width}x${height}`);
    await page.keyboard.press('Escape');
    if (await page.locator('#nav.open').count()) throw new Error(`menu ${width}x${height}: Escape did not close navigation`);
  }
  if (process.env.RESPONSIVE_SCREENSHOTS === '1') await page.screenshot({ path: resolve(screenshotDir, `public-${width}x${height}.png`), fullPage: true });
  if (errors.length) throw new Error(`public ${width}x${height}: JS errors: ${errors.join('; ')}`);
  await context.close();
}

async function closedAudit(width, height) {
  const { context, page, errors } = await newPage(width, height);
  await page.unroute('**/api/v1/registration-status');
  await page.route('**/api/v1/registration-status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_open: false, deadline: '2026-10-10T00:00:00+06:00', server_time: '2026-10-10T00:00:00+06:00', reason: 'deadline_passed', message: 'Регистрация завершена.' }) }));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#registration-countdown.closed').waitFor();
  await page.locator('#registration-closed:not([hidden])').waitFor();
  if (await page.locator('#registration-form:visible').count()) throw new Error(`closed ${width}x${height}: registration form is still visible`);
  if (await page.locator('[data-registration-cta]:not(.registration-disabled)').count()) throw new Error(`closed ${width}x${height}: active registration CTA remains`);
  await assertNoOverflow(page, `closed ${width}x${height}`);
  if (errors.length) throw new Error(`closed ${width}x${height}: JS errors: ${errors.join('; ')}`);
  await context.close();
}

async function wizardAudit(width, height) {
  const { context, page, errors } = await newPage(width, height);
  await page.route('**/api/v1/registrations', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 999, registration_number: 'MW-9999', name: 'Очень длинное название мобильной команды', created_at: new Date().toISOString() }) }));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#team-name').fill('Очень длинное название мобильной команды');
  await page.locator('#organization').selectOption('motion_web_academy');
  await page.locator('#next-step').click();
  const participants = [
    ['Айбек', 'ОченьдлиннаяфамилияКапитана', '+996555111111', '@captain_long_username', 'captain.with.a.very.long.email@example.com'],
    ['Алина', 'Ким', '0700222222', 'second_member', 'second.member@example.com'],
    ['Данияр', 'Токтосунов', '777333333', 'https://t.me/third_member', 'third.member@example.com'],
  ];
  for (let index = 0; index < 3; index += 1) {
    const fields = ['first_name', 'last_name', 'phone', 'telegram', 'email'];
    for (let field = 0; field < fields.length; field += 1) await page.locator(`[name="participants[${index}][${fields[field]}]"]`).fill(participants[index][field]);
  }
  await page.locator('#next-step').click();
  await page.locator('#project-name').fill('Очень длинное название проекта для проверки переноса на маленьком экране');
  await page.locator('#project-description').fill('Описание проекта с длинными словами и данными должно переноситься внутри карточки и никогда не расширять viewport.');
  await page.locator('#next-step').click();
  await assertNoOverflow(page, `review ${width}x${height}`);
  await page.locator('#registration-consent').check();
  await page.locator('#submit-form').click();
  await page.locator('#success-state:not([hidden])').waitFor();
  await assertNoOverflow(page, `success ${width}x${height}`);
  if (process.env.RESPONSIVE_SCREENSHOTS === '1') await page.screenshot({ path: resolve(screenshotDir, `success-${width}x${height}.png`), fullPage: true });
  if (errors.length) throw new Error(`wizard ${width}x${height}: JS errors: ${errors.join('; ')}`);
  await context.close();
}

const teamsFixture = { items: [{ id: 1, registration_number: 'MW-1234', name: 'Команда с очень длинным названием без поломки интерфейса', organization: 'motion_web_academy', captain_name: 'Айбек Оченьдлиннаяфамилия', captain_phone: '+996555123456', participant_count: 3, created_at: '2026-10-06T10:00:00Z' }], total: 1, page: 1, page_size: 200 };
const teamFixture = { id: 1, registration_number: 'MW-1234', name: teamsFixture.items[0].name, organization: 'motion_web_academy', project_name: 'Длинное название проекта для modal', project_description: 'Подробное описание проекта, которое должно корректно переноситься на мобильном экране.', created_at: '2026-10-06T10:00:00Z', participants: [{ id: 1, first_name: 'Айбек', last_name: 'Оченьдлиннаяфамилия', phone: '+996555123456', telegram: '@captain_long_username', email: 'captain.with.a.very.long.email@example.com', is_captain: true }] };

async function adminAudit(width, height) {
  const { context, page, errors } = await newPage(width, height);
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Требуется авторизация администратора."}' });
    if (path.endsWith('/auth/login')) return route.fulfill({ status: 204 });
    if (path.endsWith('/stats')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ teams: 1, participants: 3, motion_web_academy: 1, motion_college: 0 }) });
    if (/\/teams\/1$/.test(path)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teamFixture) });
    if (path.endsWith('/teams')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teamsFixture) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' });
  });
  await page.goto(`${baseURL}/admin/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-view:not([hidden])').waitFor();
  await assertNoOverflow(page, `admin login ${width}x${height}`);
  await page.locator('#admin-username').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('#login-form button[type="submit"]').click();
  await page.locator('#dashboard:not([hidden])').waitFor();
  await assertNoOverflow(page, `admin dashboard ${width}x${height}`);
  if (width <= 768) {
    if (!(await page.locator('#team-cards').isVisible())) throw new Error(`admin ${width}x${height}: cards are not visible`);
    await page.locator('.admin-team-card').click();
    await page.locator('#team-dialog[open]').waitFor();
    await assertNoOverflow(page, `admin modal ${width}x${height}`);
  }
  if (process.env.RESPONSIVE_SCREENSHOTS === '1') await page.screenshot({ path: resolve(screenshotDir, `admin-${width}x${height}.png`), fullPage: true });
  if (errors.length) throw new Error(`admin ${width}x${height}: JS errors: ${errors.join('; ')}`);
  await context.close();
}

for (const [width, height] of viewports) {
  try { await publicAudit(width, height); process.stdout.write(`✓ public ${width}x${height}\n`); }
  catch (error) { failures.push(error.message); process.stderr.write(`✗ ${error.message}\n`); }
}
for (const [width, height] of deepViewports) {
  try { await wizardAudit(width, height); process.stdout.write(`✓ wizard ${width}x${height}\n`); }
  catch (error) { failures.push(error.message); process.stderr.write(`✗ ${error.message}\n`); }
  try { await adminAudit(width, height); process.stdout.write(`✓ admin ${width}x${height}\n`); }
  catch (error) { failures.push(error.message); process.stderr.write(`✗ ${error.message}\n`); }
}
for (const [width, height] of [[320, 568], [1440, 900]]) {
  try { await closedAudit(width, height); process.stdout.write(`✓ closed ${width}x${height}\n`); }
  catch (error) { failures.push(error.message); process.stderr.write(`✗ ${error.message}\n`); }
}

await browser.close();
if (failures.length) {
  process.stderr.write(`\n${failures.length} responsive audit failure(s).\n`);
  process.exitCode = 1;
} else process.stdout.write('\nResponsive audit passed without horizontal overflow or page errors.\n');
