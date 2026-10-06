const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const DEFAULT_TIMEOUT = 12_000;

const STATUS_MESSAGES = {
  410: 'Регистрация на хакатон уже завершена.',
  400: 'Проверьте введённые данные.', 401: 'Требуется авторизация.',
  403: 'Недостаточно прав для выполнения действия.', 404: 'Запрашиваемые данные не найдены.',
  409: 'Такая регистрация уже существует.', 422: 'Проверьте правильность заполнения формы.',
  429: 'Слишком много попыток. Подождите немного и попробуйте снова.',
};
const FIELD_LABELS = {
  name: 'Название команды', organization: 'Организация', project_name: 'Название проекта',
  project_description: 'Описание идеи', first_name: 'Имя', last_name: 'Фамилия', phone: 'Телефон',
  telegram: 'Telegram', email: 'Email', consent: 'Подтверждение данных', participants: 'Участники',
};

function cleanValidationMessage(message = '') {
  return String(message).replace(/^Value error,\s*/i, '').replace(/^Field required$/i, 'Поле обязательно.')
    .replace(/^Input should be a valid email address.*$/i, 'Введите корректный email.')
    .replace(/^List should have (?:at least|at most) 3 items.*$/i, 'В команде должно быть ровно 3 участника.');
}

export function validationPath(loc = []) {
  const path = loc[0] === 'body' ? loc.slice(1) : loc;
  if (path[0] === 'participants' && Number.isInteger(path[1]) && path[2]) return `participants[${path[1]}][${path[2]}]`;
  return typeof path[0] === 'string' ? path[0] : null;
}

export function extractFieldErrors(responseData) {
  const details = Array.isArray(responseData?.detail) ? responseData.detail : Array.isArray(responseData?.errors) ? responseData.errors : [];
  return details.map((item) => {
    const path = validationPath(item?.loc || item?.path || []);
    const field = path?.match(/\[([^\]]+)\]$/)?.[1] || path;
    return { path, message: cleanValidationMessage(item?.msg || item?.message || 'Некорректное значение.'), label: FIELD_LABELS[field] || 'Поле' };
  });
}

export function extractApiError(responseData, fallbackMessage = 'Не удалось выполнить запрос.', status = 0) {
  if (typeof responseData === 'string' && responseData.trim()) {
    const message = responseData.trim();
    if (status >= 500 || message.startsWith('<') || message.length > 500) return status >= 500 ? 'Сервер временно недоступен. Попробуйте ещё раз.' : STATUS_MESSAGES[status] || fallbackMessage;
    return message;
  }
  if (!responseData || typeof responseData !== 'object') return status >= 500 ? 'Сервер временно недоступен. Попробуйте ещё раз.' : STATUS_MESSAGES[status] || fallbackMessage;
  if (typeof responseData.detail === 'string' && responseData.detail.trim()) return responseData.detail.trim();
  if (responseData.detail && typeof responseData.detail.message === 'string') return responseData.detail.message;
  if (typeof responseData.message === 'string' && responseData.message.trim()) return responseData.message.trim();
  const fieldErrors = extractFieldErrors(responseData);
  if (fieldErrors.length) return fieldErrors.length === 1 ? `${fieldErrors[0].label}: ${fieldErrors[0].message}` : `Проверьте поля формы: ${fieldErrors.map((error) => error.label).join(', ')}.`;
  if (Array.isArray(responseData.errors)) {
    const message = responseData.errors.map((error) => typeof error === 'string' ? error : error?.message).filter(Boolean).join(' ');
    if (message) return message;
  }
  if (responseData.errors && typeof responseData.errors === 'object') {
    const message = Object.values(responseData.errors).flat().map((error) => typeof error === 'string' ? error : error?.message).filter(Boolean).join(' ');
    if (message) return message;
  }
  return status >= 500 ? 'Сервер временно недоступен. Попробуйте ещё раз.' : STATUS_MESSAGES[status] || fallbackMessage;
}

export class ApiError extends Error {
  constructor(message, status = 0, data = null, options = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.data = data; this.details = data?.detail ?? data;
    this.fieldErrors = extractFieldErrors(data); this.isTimeout = Boolean(options.isTimeout); this.isNetwork = Boolean(options.isNetwork);
  }
}

export async function apiRequest(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, responseType = 'json', headers = {}, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include', ...fetchOptions,
      headers: responseType === 'blob' ? headers : { 'Content-Type': 'application/json', ...headers }, signal: controller.signal,
    });
    if (response.status === 204) return null;
    if (responseType === 'blob' && response.ok) return { blob: await response.blob(), filename: filenameFrom(response) };
    const data = await parseResponse(response);
    if (!response.ok) throw new ApiError(extractApiError(data, undefined, response.status), response.status, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') throw new ApiError('Сервер отвечает слишком долго. Попробуйте ещё раз.', 0, null, { isTimeout: true });
    throw new ApiError('Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте ещё раз.', 0, null, { isNetwork: true });
  } finally { clearTimeout(timer); }
}

async function parseResponse(response) {
  const body = await response.text();
  if (!body) return null;
  if ((response.headers.get('content-type') || '').includes('application/json')) { try { return JSON.parse(body); } catch { return null; } }
  return body;
}
function filenameFrom(response) { return response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'hackathon-teams.csv'; }

export const registerTeam = (payload) => apiRequest('/registrations', { method: 'POST', body: JSON.stringify(payload) });
export const getRegistrationStatus = () => apiRequest('/registration-status');
export const adminLogin = (credentials) => apiRequest('/admin/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const adminLogout = () => apiRequest('/admin/auth/logout', { method: 'POST' });
export const getAdminSession = () => apiRequest('/admin/auth/me');
export const getTeams = (params = '') => apiRequest(`/admin/teams${params}`);
export const getTeam = (id) => apiRequest(`/admin/teams/${id}`);
export const getStats = () => apiRequest('/admin/stats');
export const deleteTeam = (id) => apiRequest(`/admin/teams/${id}`, { method: 'DELETE' });
export const exportCsv = () => apiRequest('/admin/export/csv', { responseType: 'blob' });

export const api = { register: registerTeam, registrationStatus: getRegistrationStatus, admin: { login: adminLogin, logout: adminLogout, me: getAdminSession, stats: getStats, teams: getTeams, team: getTeam, deleteTeam, exportCsv } };
