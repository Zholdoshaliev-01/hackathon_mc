import { text } from './i18n.js';

export function normalizeKyrgyzPhone(value = '') {
  let digits = String(value).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) digits = `996${digits.slice(1)}`;
  else if (digits.length === 9) digits = `996${digits}`;
  return digits.length === 12 && digits.startsWith('996') ? `+${digits}` : '';
}
export function isValidKyrgyzPhone(value) { return /^\+996\d{9}$/.test(normalizeKyrgyzPhone(value)); }

export function normalizeTelegram(value = '') {
  const username = String(value).trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i, '').replace(/^t\.me\//i, '').replace(/^@/, '').replace(/\/$/, '');
  return username ? `@${username}` : '';
}
export function isValidTelegram(value) { return !String(value).trim() || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalizeTelegram(value)); }

export function findDuplicateIndexes(values, normalizer = (value) => String(value).trim().toLowerCase()) {
  const seen = new Map(); const duplicates = new Set();
  values.forEach((value, index) => { const normalized = normalizer(value); if (!normalized) return; if (seen.has(normalized)) { duplicates.add(seen.get(normalized)); duplicates.add(index); } else seen.set(normalized, index); });
  return [...duplicates];
}

export function fieldMessage(input) {
  const value = input.value.trim();
  if (input.required && !value && input.type !== 'checkbox') return text.required;
  if (input.type === 'checkbox' && input.required && !input.checked) return 'Подтвердите правильность данных.';
  if (input.name === 'name' && value.length < 2) return 'Введите название команды.';
  if (input.type === 'email' && value && !input.validity.valid) return text.email;
  if (input.name.endsWith('[phone]') && !isValidKyrgyzPhone(value)) return text.phone;
  if (input.name.endsWith('[telegram]') && !isValidTelegram(value)) return text.telegram;
  if (!input.validity.valid) return text.generic;
  return '';
}

export function setFieldError(input, message = '') {
  const step = input.closest('.form-step');
  const error = input.type === 'checkbox' ? step?.querySelector('.consent-error') : input.closest('.field')?.querySelector('.field-error');
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) {
    if (!error.id) error.id = `${input.id || input.name.replace(/\W/g, '-')}-error`;
    error.textContent = message; error.setAttribute('role', message ? 'alert' : 'status');
    if (message) input.setAttribute('aria-describedby', error.id); else input.removeAttribute('aria-describedby');
  }
  return !message;
}
export function validateField(input) { return setFieldError(input, fieldMessage(input)); }
export function validateStep(step, { focus = true } = {}) {
  const inputs = [...step.querySelectorAll('input, select, textarea')]; const valid = inputs.map(validateField).every(Boolean);
  if (!valid && focus) focusFirstInvalid(step); return valid;
}
export function validateParticipantDuplicates(form, { focus = true } = {}) {
  const configs = [
    { key: 'phone', normalize: normalizeKyrgyzPhone, message: 'Этот номер уже указан у другого участника.' },
    { key: 'email', normalize: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : '', message: 'Этот email уже указан у другого участника.' },
    { key: 'telegram', normalize: (value) => isValidTelegram(value) ? normalizeTelegram(value).toLowerCase() : '', message: 'Этот Telegram уже указан у другого участника.' },
  ];
  let firstInvalid = null;
  configs.forEach(({ key, normalize, message }) => {
    const inputs = [0, 1, 2].map((index) => form.elements[`participants[${index}][${key}]`]);
    findDuplicateIndexes(inputs.map((input) => input.value), normalize).forEach((index) => { setFieldError(inputs[index], message); firstInvalid ||= inputs[index]; });
  });
  if (firstInvalid && focus) firstInvalid.focus(); return !firstInvalid;
}
export function focusFirstInvalid(container) { container.querySelector('[aria-invalid="true"]')?.focus(); }
export const normalizePhone = normalizeKyrgyzPhone;
