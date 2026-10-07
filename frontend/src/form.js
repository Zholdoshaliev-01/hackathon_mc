import { ApiError, registerTeam } from './api.js';
import { renderReview } from './review.js';
import { clearDraft, loadDraft, loadLastSuccess, saveDraft, saveLastSuccess } from './storage.js';
import { normalizeKyrgyzPhone, normalizeTelegram, setFieldError, validateField, validateParticipantDuplicates, validateStep } from './validation.js';

const participantTemplate = (index) => `<section class="participant-card"><header><b>0${index + 1}</b><div><small>${index === 0 ? 'КАПИТАН' : 'УЧАСТНИК'}</small><h3>${index === 0 ? 'Капитан команды' : `Участник ${index + 1}`}</h3></div>${index === 0 ? '<span>CAPTAIN</span>' : ''}</header><div class="field-row"><div class="field"><label for="p${index}-first">Имя <em>*</em></label><input id="p${index}-first" name="participants[${index}][first_name]" required maxlength="80" autocomplete="given-name" /><span class="field-error"></span></div><div class="field"><label for="p${index}-last">Фамилия <em>*</em></label><input id="p${index}-last" name="participants[${index}][last_name]" required maxlength="80" autocomplete="family-name" /><span class="field-error"></span></div></div><div class="field"><label for="p${index}-phone">Телефон <em>*</em></label><input id="p${index}-phone" name="participants[${index}][phone]" type="tel" required inputmode="tel" placeholder="+996 555 123 456" autocomplete="tel" /><span class="field-error"></span></div><div class="field-row"><div class="field"><label for="p${index}-telegram">Telegram username</label><input id="p${index}-telegram" name="participants[${index}][telegram]" inputmode="text" placeholder="@username" autocomplete="off" /><span class="field-error"></span></div><div class="field"><label for="p${index}-email">Email</label><input id="p${index}-email" name="participants[${index}][email]" type="email" inputmode="email" placeholder="name@example.com" autocomplete="email" /><span class="field-error"></span></div></div></section>`;

export function initForm(registrationStatus) {
  const form = document.querySelector('#registration-form');
  if (!form) return;
  document.querySelector('#participants').innerHTML = [0, 1, 2].map(participantTemplate).join('');

  const steps = [...form.querySelectorAll('.form-step')];
  const progress = [...document.querySelectorAll('[data-progress]')];
  const nextButton = document.querySelector('#next-step');
  const previousButton = document.querySelector('#prev-step');
  const submitButton = document.querySelector('#submit-form');
  const submitLabel = submitButton.querySelector('span');
  const notice = document.querySelector('#form-error');
  const summary = document.querySelector('#summary');
  const progressContainer = document.querySelector('#registration-progress');
  const progressCurrent = document.querySelector('#registration-progress-current');
  const closedState = document.querySelector('#registration-closed');
  const successState = document.querySelector('#success-state');
  const stepLabels = ['Команда', 'Участники', 'Проверка'];
  const lastStep = steps.length - 1;
  let currentStep = 0;
  let isSubmitting = false;
  let hasSuccessfulRegistration = false;
  let previousRegistrationPhase = null;
  let draftTimer;

  registrationStatus?.subscribe((state) => {
    if (state.phase === previousRegistrationPhase && state.phase !== 'open') return;
    previousRegistrationPhase = state.phase;
    if (state.phase === 'closed' && !hasSuccessfulRegistration) {
      form.hidden = true;
      progressContainer.hidden = true;
      progressCurrent.hidden = true;
      closedState.hidden = false;
      document.querySelector('#registration-closed-reason').textContent = state.message || 'Регистрация завершена.';
      submitButton.disabled = true;
      closedState.querySelector('h3')?.focus({ preventScroll: true });
    } else if (state.phase === 'open' && !hasSuccessfulRegistration) {
      closedState.hidden = true;
      form.hidden = false;
      progressContainer.hidden = false;
      progressCurrent.hidden = false;
      submitButton.disabled = false;
    }
  });

  const collectData = ({ normalized = true } = {}) => ({
    name: form.elements.name.value.trim(),
    organization: form.elements.organization.value,
    consent: form.elements.consent.checked,
    participants: [0, 1, 2].map((index) => {
      const phone = form.elements[`participants[${index}][phone]`].value;
      const telegram = form.elements[`participants[${index}][telegram]`].value;
      return {
        first_name: form.elements[`participants[${index}][first_name]`].value.trim(),
        last_name: form.elements[`participants[${index}][last_name]`].value.trim(),
        phone: normalized ? normalizeKyrgyzPhone(phone) || phone.trim() : phone,
        telegram: normalized ? normalizeTelegram(telegram) || null : telegram,
        email: form.elements[`participants[${index}][email]`].value.trim() || null,
      };
    }),
  });

  function renderStep({ focusHeading = true, preserveNotice = false } = {}) {
    steps.forEach((step, index) => step.classList.toggle('active', index === currentStep));
    progress.forEach((item, index) => { item.classList.toggle('active', index === currentStep); item.classList.toggle('complete', index < currentStep); });
    document.querySelector('.progress-line i').style.width = `${(currentStep / lastStep) * 100}%`;
    document.querySelector('#progress-count').textContent = `Шаг ${currentStep + 1} из ${steps.length}`;
    document.querySelector('#progress-label').textContent = stepLabels[currentStep];
    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === lastStep;
    submitButton.hidden = currentStep !== lastStep;
    if (!preserveNotice) hideNotice();
    if (currentStep === lastStep) renderReview(summary, collectData());
    if (focusHeading) steps[currentStep].querySelector('legend')?.focus({ preventScroll: true });
  }

  function goToStep(index, options) {
    currentStep = Math.max(0, Math.min(lastStep, Number(index)));
    renderStep(options);
    scheduleDraft();
  }

  nextButton.addEventListener('click', () => {
    let valid = validateStep(steps[currentStep]);
    if (currentStep === 1) valid = validateParticipantDuplicates(form) && valid;
    if (!valid) { showNotice('warning', 'Проверьте данные', 'Исправьте выделенные поля, чтобы продолжить.'); return; }
    goToStep(currentStep + 1);
    document.querySelector('.form-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  previousButton.addEventListener('click', () => goToStep(currentStep - 1));
  progress.forEach((button, index) => button.addEventListener('click', () => { if (index < currentStep) goToStep(index); }));
  summary.addEventListener('click', (event) => { const button = event.target.closest('[data-edit-step]'); if (button) goToStep(button.dataset.editStep); });

  form.addEventListener('focusout', (event) => {
    if (!event.target.matches('input, select, textarea')) return;
    validateField(event.target);
    if (currentStep === 1) validateParticipantDuplicates(form, { focus: false });
  });
  form.addEventListener('input', () => { hideNotice('info'); scheduleDraft(); });
  form.addEventListener('change', scheduleDraft);
  notice.querySelector('.notice-close').addEventListener('click', hideNotice);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (registrationStatus?.state.isOpen === false) {
      registrationStatus.markClosed();
      return;
    }
    if (!validateBeforeSubmit()) return;
    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    submitLabel.textContent = 'Отправляем...';
    hideNotice();
    try {
      const result = await registerTeam(collectData());
      saveLastSuccess(result);
      clearDraft();
      showSuccess(result);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 410)) registrationStatus?.markClosed(error.message);
      handleSubmitError(error);
    } finally {
      isSubmitting = false;
      submitButton.disabled = registrationStatus?.state.isOpen === false;
      submitButton.classList.remove('loading');
      submitLabel.textContent = 'Подтвердить регистрацию';
    }
  });

  function validateBeforeSubmit() {
    const validSteps = steps.map((step) => validateStep(step, { focus: false }));
    const unique = validateParticipantDuplicates(form, { focus: false });
    if (validSteps.every(Boolean) && unique) return true;
    const invalidStep = steps.findIndex((step) => step.querySelector('[aria-invalid="true"]'));
    goToStep(invalidStep >= 0 ? invalidStep : lastStep, { focusHeading: false });
    steps[currentStep].querySelector('[aria-invalid="true"]')?.focus();
    showNotice('warning', 'Проверьте данные', 'Исправьте выделенные поля перед отправкой регистрации.');
    return false;
  }

  function handleSubmitError(error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте ещё раз.');
    applyBackendFieldErrors(apiError);
    const title = apiError.status === 429 ? 'Слишком много попыток' : apiError.status >= 500 || apiError.isNetwork || apiError.isTimeout ? 'Сервис временно недоступен' : 'Ошибка регистрации';
    showNotice('error', title, apiError.message);
    notice.focus({ preventScroll: true });
    notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function applyBackendFieldErrors(error) {
    error.fieldErrors.forEach(({ path, message }) => { const input = path ? form.elements[path] : null; if (input) setFieldError(input, message); });
    const duplicatePhone = error.data?.detail?.phone;
    if (duplicatePhone) {
      const input = [0, 1, 2].map((index) => form.elements[`participants[${index}][phone]`]).find((item) => normalizeKyrgyzPhone(item.value) === duplicatePhone);
      if (input) setFieldError(input, 'Этот номер уже зарегистрирован в другой команде.');
    } else if (error.status === 409 && /команд|назван/i.test(error.message)) {
      setFieldError(form.elements.name, 'Название команды уже занято.');
    }
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDraft(collectData({ normalized: false }), currentStep), 250);
  }
  function restoreDraft() {
    const draft = loadDraft();
    if (!draft?.data || draft.version !== 1) return false;
    const data = draft.data;
    setValue('name', data.name); setValue('organization', data.organization);
    form.elements.consent.checked = Boolean(data.consent);
    (data.participants || []).slice(0, 3).forEach((participant, index) => Object.entries(participant).forEach(([key, value]) => setValue(`participants[${index}][${key}]`, value)));
    currentStep = Math.max(0, Math.min(lastStep, Number(draft.currentStep) || 0));
    return true;
  }
  function setValue(name, value) { if (form.elements[name] && value !== null && value !== undefined) form.elements[name].value = value; }

  function showNotice(type, title, message) {
    notice.className = `form-notice ${type}`;
    notice.querySelector('.notice-icon').textContent = { error: '!', warning: '!', success: '✓', info: 'i' }[type] || 'i';
    notice.querySelector('.notice-title').textContent = title;
    notice.querySelector('.notice-message').textContent = message;
    notice.hidden = false; notice.tabIndex = -1;
  }
  function hideNotice(type) { if (!type || notice.classList.contains(type)) notice.hidden = true; }

  function showSuccess(result) {
    hasSuccessfulRegistration = true;
    form.hidden = true;
    progressContainer.hidden = true;
    progressCurrent.hidden = true;
    closedState.hidden = true;
    const success = successState;
    success.hidden = false;
    document.querySelector('#success-team').textContent = result.name;
    document.querySelector('#registration-number').textContent = `#${result.registration_number}`;
    success.querySelector('h3').focus({ preventScroll: true });
    document.querySelector('.form-shell').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const lastSuccess = loadLastSuccess();
  if (lastSuccess?.registration_number && lastSuccess?.name) showSuccess(lastSuccess);
  else {
    const restored = restoreDraft();
    renderStep({ focusHeading: false });
    if (restored) showNotice('info', 'Черновик восстановлен', 'Черновик регистрации восстановлен. Проверьте данные перед отправкой.');
  }
}
