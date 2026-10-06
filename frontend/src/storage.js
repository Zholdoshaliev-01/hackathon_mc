const DRAFT_KEY = 'hackathon_registration_draft';
const SUCCESS_KEY = 'hackathon_registration_success';
function read(storage, key) { try { const value = storage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } }
function write(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
export const loadDraft = () => read(localStorage, DRAFT_KEY);
export const saveDraft = (data, currentStep) => write(localStorage, DRAFT_KEY, { version: 1, savedAt: Date.now(), currentStep, data });
export const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* Storage may be disabled. */ } };
export const loadLastSuccess = () => read(sessionStorage, SUCCESS_KEY);
export const saveLastSuccess = (registration) => write(sessionStorage, SUCCESS_KEY, { ...registration, savedAt: Date.now() });

