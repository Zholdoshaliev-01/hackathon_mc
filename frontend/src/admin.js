import './styles/global.css';
import './styles/admin.css';
import { ApiError, adminLogin, adminLogout, deleteTeam, exportCsv, getAdminSession, getStats, getTeam, getTeams } from './api.js';
import { organizations } from './i18n.js';
import { registrationStatus, splitRemainingTime } from './registration-status.js';

const loginView = document.querySelector('#login-view');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#login-form');
const loginError = loginForm.querySelector('.admin-error');
const rows = document.querySelector('#team-rows');
const cards = document.querySelector('#team-cards');
const dialog = document.querySelector('#team-dialog');
let searchTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showLogin(message = '') {
  dashboard.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
  loginError.hidden = !message;
  loginForm.elements.username.focus({ preventScroll: true });
}

function showDashboard() {
  loginView.hidden = true;
  dashboard.hidden = false;
  loginError.hidden = true;
}

function handleAdminError(error, fallback = 'Не удалось загрузить данные.') {
  if (error instanceof ApiError && error.status === 401) {
    showLogin('Сессия администратора истекла. Войдите снова.');
    return true;
  }
  renderTableError(error instanceof ApiError ? error.message : fallback);
  return false;
}

async function boot() {
  try { await getAdminSession(); showDashboard(); await loadAll(); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) showLogin();
    else showLogin('Сервер временно недоступен. Попробуйте ещё раз.');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  const label = button.querySelector('span');
  button.disabled = true; button.classList.add('loading'); label.textContent = 'Входим...'; loginError.hidden = true;
  try {
    await adminLogin({ username: loginForm.elements.username.value, password: loginForm.elements.password.value });
    loginForm.elements.password.value = '';
    showDashboard();
    await loadAll();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) loginError.textContent = 'Неверный логин или пароль.';
    else if (error instanceof ApiError && error.status === 429) loginError.textContent = 'Слишком много попыток входа. Попробуйте позже.';
    else if (error instanceof ApiError && (error.isNetwork || error.isTimeout || error.status >= 500)) loginError.textContent = 'Сервер временно недоступен.';
    else loginError.textContent = error instanceof ApiError ? error.message : 'Не удалось выполнить вход.';
    loginError.hidden = false; loginError.focus();
  } finally {
    button.disabled = false; button.classList.remove('loading'); label.textContent = 'Войти';
  }
});

document.querySelector('#toggle-password').addEventListener('click', (event) => {
  const password = loginForm.elements.password;
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  event.currentTarget.textContent = visible ? 'Показать' : 'Скрыть';
  event.currentTarget.setAttribute('aria-label', visible ? 'Показать пароль' : 'Скрыть пароль');
  event.currentTarget.setAttribute('aria-pressed', String(!visible));
  password.focus();
});

async function loadAll() {
  setLoading();
  try {
    const [stats] = await Promise.all([getStats(), loadTeams()]);
    renderStats(stats);
  } catch (error) { handleAdminError(error); }
}

function renderStats(data) {
  document.querySelector('#stat-teams').textContent = data.teams;
  document.querySelector('#stat-participants').textContent = data.participants;
  document.querySelector('#stat-academy').textContent = data.motion_web_academy;
  document.querySelector('#stat-college').textContent = data.motion_college;
}

async function loadTeams() {
  const params = new URLSearchParams({ page_size: '200' });
  const query = document.querySelector('#search').value.trim();
  const organization = document.querySelector('#filter').value;
  if (query) params.set('q', query);
  if (organization) params.set('organization', organization);
  const result = await getTeams(`?${params}`);
  renderTeams(result);
  return result;
}

function setLoading() {
  rows.replaceChildren(...Array.from({ length: 5 }, () => {
    const row = element('tr', 'skeleton'); const cell = element('td'); cell.colSpan = 7; cell.append(element('span')); row.append(cell); return row;
  }));
  cards.replaceChildren(...Array.from({ length: 3 }, () => element('article', 'admin-team-card skeleton-card')));
}

function renderTeams(result) {
  document.querySelector('#result-count').textContent = `${result.total} команд`;
  document.querySelector('#empty').hidden = result.items.length > 0;
  rows.replaceChildren(...result.items.map((team) => {
    const row = element('tr'); row.dataset.id = String(team.id); row.tabIndex = 0;
    const values = [team.registration_number, team.name, organizations[team.organization], team.captain_name, team.captain_phone, `${team.participant_count} / 3`, formatDate(team.created_at)];
    values.forEach((value, index) => {
      const cell = element('td');
      if (index === 0) cell.append(element('span', 'id', `#${value}`));
      else if (index === 1) cell.append(element('strong', '', value));
      else if (index === 2) cell.append(element('span', `org ${team.organization}`, value));
      else if (index === 4) cell.append(element('span', 'mono', value));
      else cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  renderTeamCards(result.items);
}

function renderTeamCards(teams) {
  cards.replaceChildren(...teams.map((team) => {
    const card = element('article', 'admin-team-card'); card.dataset.id = String(team.id); card.tabIndex = 0;
    const header = element('header');
    const title = element('div'); title.append(element('small', 'id', `#${team.registration_number}`), element('h3', '', team.name));
    header.append(title, element('span', `org ${team.organization}`, organizations[team.organization]));
    const details = element('dl');
    [['Капитан', team.captain_name], ['Телефон', team.captain_phone], ['Участники', `${team.participant_count} / 3`], ['Дата', formatDate(team.created_at)]].forEach(([label, value]) => {
      details.append(element('dt', '', label), element('dd', label === 'Телефон' ? 'mono' : '', value));
    });
    const action = element('button', 'card-action', 'Подробнее'); action.type = 'button'; action.dataset.openTeam = String(team.id);
    card.append(header, details, action); return card;
  }));
}

function renderTableError(message) {
  const row = element('tr'); const cell = element('td', 'error-cell', message || 'Не удалось загрузить данные.'); cell.colSpan = 7; row.append(cell); rows.replaceChildren(row);
  cards.replaceChildren(element('p', 'error-cell', message || 'Не удалось загрузить данные.'));
}

document.querySelector('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadTeams().catch((error) => handleAdminError(error)), 350);
});
document.querySelector('#filter').addEventListener('change', () => loadTeams().catch((error) => handleAdminError(error)));
rows.addEventListener('click', (event) => { const row = event.target.closest('tr[data-id]'); if (row) openTeam(row.dataset.id); });
rows.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.target.closest('tr[data-id]')?.click(); } });
cards.addEventListener('click', (event) => { const card = event.target.closest('[data-id]'); if (card) openTeam(card.dataset.id); });
cards.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.admin-team-card')) { event.preventDefault(); openTeam(event.target.dataset.id); } });

async function openTeam(id) {
  dialog.showModal();
  const detail = document.querySelector('#team-detail');
  detail.replaceChildren(element('div', 'detail-loading', 'Загрузка...'));
  try { renderTeamDetail(detail, await getTeam(id)); }
  catch (error) { if (!handleAdminError(error, 'Не удалось загрузить команду.')) detail.replaceChildren(element('p', 'error-cell', error.message)); else dialog.close(); }
}

function renderTeamDetail(container, team) {
  const fragment = document.createDocumentFragment();
  fragment.append(element('p', 'kicker', team.registration_number), element('h2', '', team.name), element('p', 'detail-org', `${organizations[team.organization]} · ${formatDate(team.created_at)}`));
  const project = element('div', 'detail-project');
  project.append(element('small', '', 'ПРОЕКТ / ИДЕЯ'), element('strong', '', team.project_name || 'Не указано'), element('p', '', team.project_description || 'Описание не указано'));
  fragment.append(project, element('h3', '', 'Участники'));
  const participants = element('div', 'detail-participants');
  [...team.participants].sort((a, b) => Number(b.is_captain) - Number(a.is_captain)).forEach((participant) => {
    const card = element('article');
    const phone = element('a', '', participant.phone); phone.href = `tel:${participant.phone}`;
    card.append(element('small', '', participant.is_captain ? 'КАПИТАН' : 'УЧАСТНИК'), element('strong', '', `${participant.first_name} ${participant.last_name}`), phone, element('span', '', [participant.telegram, participant.email].filter(Boolean).join(' · ') || 'Контакты не указаны'));
    participants.append(card);
  });
  const remove = element('button', 'delete-team', 'Удалить регистрацию'); remove.type = 'button'; remove.dataset.delete = String(team.id);
  fragment.append(participants, remove); container.replaceChildren(fragment);
}

dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button || !confirm('Удалить эту команду и всех участников? Это действие необратимо.')) return;
  button.disabled = true; button.textContent = 'Удаляем...';
  try { await deleteTeam(button.dataset.delete); dialog.close(); await loadAll(); }
  catch (error) { if (!handleAdminError(error, 'Не удалось удалить команду.')) { button.textContent = error.message; button.disabled = false; } }
});

document.querySelector('#logout').addEventListener('click', async () => { try { await adminLogout(); } finally { showLogin('Вы вышли из панели администратора.'); } });
document.querySelector('#export').addEventListener('click', async (event) => {
  const button = event.currentTarget; button.disabled = true; const original = button.textContent; button.textContent = 'Экспортируем...';
  try {
    const { blob, filename } = await exportCsv();
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { handleAdminError(error, 'Не удалось экспортировать CSV.'); }
  finally { button.disabled = false; button.textContent = original; }
});

function formatDate(date) { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date)); }
function renderAdminRegistrationStatus(state) {
  const container = document.querySelector('#admin-registration-status');
  const label = document.querySelector('#admin-status-label');
  const deadline = document.querySelector('#admin-deadline');
  const remaining = document.querySelector('#admin-remaining');
  const retry = document.querySelector('#admin-status-retry');
  container.className = `admin-registration-status ${state.phase}`;
  retry.hidden = state.phase !== 'error';
  deadline.textContent = state.deadline ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bishkek', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(state.deadline)) : '—';
  if (state.phase === 'open') {
    const value = splitRemainingTime(state.remainingTime);
    label.textContent = 'OPEN';
    remaining.textContent = `${value.days} дн. ${value.hours} ч. ${value.minutes} мин.`;
  } else if (state.phase === 'closed') {
    label.textContent = 'CLOSED';
    remaining.textContent = 'Регистрация закрыта.';
  } else if (state.phase === 'error') {
    label.textContent = 'НЕИЗВЕСТНО';
    remaining.textContent = 'Не удалось проверить статус.';
  } else {
    label.textContent = 'ПРОВЕРЯЕМ…';
    remaining.textContent = '—';
  }
}
document.querySelector('#admin-status-retry').addEventListener('click', () => registrationStatus.sync().catch(() => {}));
registrationStatus.subscribe(renderAdminRegistrationStatus);
registrationStatus.start();
boot();
