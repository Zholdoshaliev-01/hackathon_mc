import './styles/global.css';
import './styles/components.css';
import './styles/responsive.css';
import { initForm } from './form.js';

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
initForm();
