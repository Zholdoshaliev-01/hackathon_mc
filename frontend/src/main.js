import './styles/global.css';
import './styles/components.css';
import './styles/responsive.css';
import { initForm } from './form.js';
import { registrationStatus, splitRemainingTime } from './registration-status.js';

const header = document.querySelector('#header');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 24), { passive: true });
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  nav.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  if (open) nav.querySelector('a')?.focus(); else if (document.activeElement?.closest('#nav')) menu.focus();
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
nav.addEventListener('click', (event) => { if (event.target === nav) setMenu(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && nav.classList.contains('open')) setMenu(false); });

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
initForm(registrationStatus);

const countdown = document.querySelector('#registration-countdown');
const countdownStatus = document.querySelector('#countdown-status');
const countdownRetry = document.querySelector('#countdown-retry');
const countdownValues = Object.fromEntries([...countdown.querySelectorAll('[data-countdown]')].map((node) => [node.dataset.countdown, node]));
const ctas = [...document.querySelectorAll('[data-registration-cta]')];
const ctaContents = new WeakMap(ctas.map((cta) => [cta, [...cta.childNodes].map((node) => node.cloneNode(true))]));
const setCountdownStatus = (message) => { if (countdownStatus.textContent !== message) countdownStatus.textContent = message; };

function setCountdownValues(values = { days: '--', hours: '--', minutes: '--', seconds: '--' }) {
  Object.entries(values).forEach(([unit, value]) => {
    const node = countdownValues[unit];
    const nextValue = typeof value === 'number' ? String(value).padStart(2, '0') : value;
    if (node.textContent !== nextValue) {
      node.textContent = nextValue;
      node.classList.remove('changed');
      requestAnimationFrame(() => node.classList.add('changed'));
    }
  });
}

function renderRegistrationStatus(state) {
  countdown.className = `countdown ${state.phase}`;
  countdownRetry.hidden = state.phase !== 'error';
  if (state.phase === 'open') {
    setCountdownValues(splitRemainingTime(state.remainingTime));
    setCountdownStatus(state.remainingTime === 0 ? 'Подтверждаем статус регистрации…' : 'Регистрация открыта');
  } else if (state.phase === 'closed') {
    setCountdownValues({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    setCountdownStatus('РЕГИСТРАЦИЯ ЗАВЕРШЕНА — приём заявок на HACKATHON 2026 закрыт.');
  } else if (state.phase === 'error') {
    setCountdownValues();
    setCountdownStatus('Не удалось проверить статус регистрации.');
  } else {
    setCountdownValues();
    setCountdownStatus('Проверяем статус регистрации…');
  }

  ctas.forEach((cta) => {
    const closed = state.isOpen === false;
    cta.classList.toggle('registration-disabled', closed);
    cta.setAttribute('aria-disabled', String(closed));
    if (closed) cta.textContent = 'Регистрация завершена';
    else if (cta.dataset.closedRendered === 'true') cta.replaceChildren(...ctaContents.get(cta).map((node) => node.cloneNode(true)));
    cta.dataset.closedRendered = String(closed);
  });
}

ctas.forEach((cta) => cta.addEventListener('click', (event) => {
  if (registrationStatus.state.isOpen !== false) return;
  event.preventDefault();
  document.querySelector('#registration-closed')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));
countdownRetry.addEventListener('click', () => registrationStatus.sync().catch(() => {}));
registrationStatus.subscribe(renderRegistrationStatus);
registrationStatus.start();
