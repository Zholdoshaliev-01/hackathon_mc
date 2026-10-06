import { text } from './i18n.js';

export function normalizePhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = `996${digits.slice(1)}`;
  else if (digits.length === 9) digits = `996${digits}`;
  return digits.startsWith('996') && digits.length === 12 ? `+${digits}` : null;
}

export function normalizeTelegram(value) {
  if (!value.trim()) return '';
  return `@${value.trim().replace(/^https:\/\/t\.me\//, '').replace(/^t\.me\//, '').replace(/^@/, '')}`;
}

function messageFor(input) {
  if (input.validity.valueMissing) return text.required;
  if (input.type === 'email' && input.validity.typeMismatch) return text.email;
  if (input.name.endsWith('[phone]') && !normalizePhone(input.value)) return text.phone;
  if (input.name.endsWith('[telegram]') && input.value && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalizeTelegram(input.value))) return text.telegram;
  return '';
}

export function validateField(input) {
  const error = input.closest('.field')?.querySelector('.field-error');
  const message = messageFor(input);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) error.textContent = message;
  return !message;
}

export function validateStep(step) {
  const inputs = [...step.querySelectorAll('input, select, textarea')];
  const valid = inputs.map(validateField).every(Boolean);
  if (!valid) inputs.find((input) => input.getAttribute('aria-invalid') === 'true')?.focus();
  return valid;
}

