import './styles/global.css';
import './styles/components.css';
import './styles/responsive.css';
import { initForm } from './form.js';

const header = document.querySelector('#header');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 24), { passive: true });
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') === 'true'; menu.setAttribute('aria-expanded', String(!open)); nav.classList.toggle('open', !open); document.body.classList.toggle('menu-open', !open); });
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); document.body.classList.remove('menu-open'); }));

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
initForm();
