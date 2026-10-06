import { api, ApiError } from './api.js';
import { organizations, text } from './i18n.js';
import { normalizePhone, normalizeTelegram, validateField, validateStep } from './validation.js';

const participantTemplate = (index) => `<section class="participant-card"><header><b>0${index + 1}</b><div><small>${index === 0 ? 'КАПИТАН' : 'УЧАСТНИК'}</small><h3>${index === 0 ? 'Капитан команды' : `Участник ${index + 1}`}</h3></div>${index === 0 ? '<span>CAPTAIN</span>' : ''}</header><div class="field-row"><div class="field"><label for="p${index}-first">Имя <em>*</em></label><input id="p${index}-first" name="participants[${index}][first_name]" required maxlength="80" autocomplete="given-name" /><span class="field-error"></span></div><div class="field"><label for="p${index}-last">Фамилия <em>*</em></label><input id="p${index}-last" name="participants[${index}][last_name]" required maxlength="80" autocomplete="family-name" /><span class="field-error"></span></div></div><div class="field"><label for="p${index}-phone">Телефон <em>*</em></label><input id="p${index}-phone" name="participants[${index}][phone]" type="tel" required inputmode="tel" placeholder="+996 555 123 456" autocomplete="tel" /><span class="field-error"></span></div><div class="field-row"><div class="field"><label for="p${index}-telegram">Telegram username</label><input id="p${index}-telegram" name="participants[${index}][telegram]" placeholder="@username" autocomplete="off" /><span class="field-error"></span></div><div class="field"><label for="p${index}-email">Email</label><input id="p${index}-email" name="participants[${index}][email]" type="email" placeholder="name@example.com" autocomplete="email" /><span class="field-error"></span></div></div></section>`;

export function initForm() {
  const form = document.querySelector('#registration-form');
  if (!form) return;
  document.querySelector('#participants').innerHTML = [0, 1, 2].map(participantTemplate).join('');
  const steps = [...form.querySelectorAll('.form-step')];
  const progress = [...document.querySelectorAll('[data-progress]')];
  const next = document.querySelector('#next-step');
  const prev = document.querySelector('#prev-step');
  const submit = document.querySelector('#submit-form');
  const banner = document.querySelector('#form-error');
  let current = 0;

  const data = () => ({
    name: form.elements.name.value.trim(), organization: form.elements.organization.value,
    project_name: form.elements.project_name.value.trim() || null,
    project_description: form.elements.project_description.value.trim() || null,
    consent: form.elements.consent.checked,
    participants: [0, 1, 2].map((index) => ({
      first_name: form.elements[`participants[${index}][first_name]`].value.trim(),
      last_name: form.elements[`participants[${index}][last_name]`].value.trim(),
      phone: normalizePhone(form.elements[`participants[${index}][phone]`].value) || form.elements[`participants[${index}][phone]`].value,
      telegram: normalizeTelegram(form.elements[`participants[${index}][telegram]`].value) || null,
      email: form.elements[`participants[${index}][email]`].value.trim() || null,
    })),
  });

  function render() {
    steps.forEach((step, index) => step.classList.toggle('active', index === current));
    progress.forEach((item, index) => { item.classList.toggle('active', index === current); item.classList.toggle('complete', index < current); });
    document.querySelector('.progress-line i').style.width = `${(current / 3) * 100}%`;
    prev.hidden = current === 0; next.hidden = current === 3; submit.hidden = current !== 3;
    banner.hidden = true;
    if (current === 3) renderSummary(data());
    steps[current].querySelector('input, select, textarea')?.focus({ preventScroll: true });
  }

  next.addEventListener('click', () => { if (validateStep(steps[current])) { current += 1; render(); document.querySelector('.form-shell').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  prev.addEventListener('click', () => { current -= 1; render(); });
  form.addEventListener('focusout', (event) => { if (event.target.matches('input, select, textarea')) validateField(event.target); });
  form.elements.project_description.addEventListener('input', (event) => { document.querySelector('#description-count').textContent = `${event.target.value.length} / 3000`; });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const consentError = form.querySelector('.consent-error');
    consentError.textContent = form.elements.consent.checked ? '' : 'Подтвердите правильность данных.';
    if (!form.elements.consent.checked || !validateStep(steps[current])) return;
    submit.disabled = true; submit.classList.add('loading'); banner.hidden = true;
    try {
      const result = await api.register(data());
      form.hidden = true; document.querySelector('#success-state').hidden = false;
      document.querySelector('#success-team').textContent = result.name;
      document.querySelector('#registration-number').textContent = `#${result.registration_number}`;
      document.querySelector('.form-shell').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      banner.textContent = error instanceof ApiError ? error.message : text.network; banner.hidden = false;
      if (error?.details?.phone) {
        const phoneInput = [...form.querySelectorAll('input[type="tel"]')].find((input) => normalizePhone(input.value) === error.details.phone);
        if (phoneInput) { current = 1; render(); phoneInput.closest('.field').querySelector('.field-error').textContent = error.message; phoneInput.setAttribute('aria-invalid', 'true'); }
      }
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally { submit.disabled = false; submit.classList.remove('loading'); }
  });
}

function renderSummary(payload) {
  document.querySelector('#summary').innerHTML = `<div><small>КОМАНДА</small><strong>${escape(payload.name)}</strong><span>${organizations[payload.organization]}</span></div>${payload.participants.map((p, i) => `<div><small>${i === 0 ? 'КАПИТАН' : `УЧАСТНИК ${i + 1}`}</small><strong>${escape(p.first_name)} ${escape(p.last_name)}</strong><span>${escape(p.phone)}</span></div>`).join('')}<div><small>ИДЕЯ</small><strong>${escape(payload.project_name || 'Будет определена позже')}</strong><span>${escape(payload.project_description || 'Описание не указано')}</span></div>`;
}

function escape(value) { const node = document.createElement('span'); node.textContent = value || ''; return node.innerHTML; }

