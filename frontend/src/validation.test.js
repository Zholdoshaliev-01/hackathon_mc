import { describe, expect, it } from 'vitest';

import { extractApiError, extractFieldErrors } from './api.js';
import { findDuplicateIndexes, isValidKyrgyzPhone, isValidTelegram, normalizeKyrgyzPhone, normalizeTelegram } from './validation.js';

describe('normalizeKyrgyzPhone', () => {
  it.each([
    ['0555123456', '+996555123456'], ['555123456', '+996555123456'],
    ['+996555123456', '+996555123456'], ['996555123456', '+996555123456'],
    ['+996 555 123 456', '+996555123456'], ['0555 123 456', '+996555123456'],
  ])('normalizes %s', (source, expected) => expect(normalizeKyrgyzPhone(source)).toBe(expected));
  it('rejects incomplete and non-Kyrgyz numbers', () => {
    expect(normalizeKyrgyzPhone('123')).toBe('');
    expect(isValidKyrgyzPhone('+77001234567')).toBe(false);
  });
});

describe('Telegram normalization', () => {
  it.each([['@motion_dev'], ['motion_dev'], ['https://t.me/motion_dev'], ['t.me/motion_dev']])('normalizes %s', (source) => expect(normalizeTelegram(source)).toBe('@motion_dev'));
  it('validates the backend-compatible username format', () => {
    expect(isValidTelegram('@valid_user')).toBe(true);
    expect(isValidTelegram('@bad-name')).toBe(false);
    expect(isValidTelegram('@abc')).toBe(false);
  });
});

describe('duplicate detection', () => {
  it('detects equivalent phone formats', () => {
    expect(findDuplicateIndexes(['0555123456', '+996 555 123 456', '+996700000000'], normalizeKyrgyzPhone)).toEqual([0, 1]);
  });
  it('ignores empty optional values', () => expect(findDuplicateIndexes(['', '', 'user@example.com'])).toEqual([]));
  it('detects optional values without case differences', () => expect(findDuplicateIndexes(['User@Example.com', 'user@example.com', ''])).toEqual([0, 1]));
});

describe('extractApiError', () => {
  it('uses a string detail returned by FastAPI', () => {
    expect(extractApiError({ detail: 'Участник уже зарегистрирован.' }, undefined, 409)).toBe('Участник уже зарегистрирован.');
  });
  it('uses an object detail message', () => {
    expect(extractApiError({ detail: { message: 'Телефон занят.', phone: '+996555123456' } }, undefined, 409)).toBe('Телефон занят.');
  });
  it('maps FastAPI validation errors and preserves field paths', () => {
    const payload = { detail: [{ loc: ['body', 'participants', 1, 'email'], msg: 'Input should be a valid email address', type: 'value_error' }] };
    expect(extractApiError(payload, undefined, 422)).toBe('Email: Введите корректный email.');
    expect(extractFieldErrors(payload)[0].path).toBe('participants[1][email]');
  });
  it('returns friendly status fallbacks', () => {
    expect(extractApiError({}, undefined, 429)).toContain('Слишком много попыток');
    expect(extractApiError({}, undefined, 500)).toContain('Сервер временно недоступен');
    expect(extractApiError('<html>Too Many Requests</html>', undefined, 429)).toContain('Слишком много попыток');
  });
});
