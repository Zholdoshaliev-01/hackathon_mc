import './styles/global.css';
import './styles/admin.css';
import { api, ApiError } from './api.js';
import { organizations } from './i18n.js';

const loginView = document.querySelector('#login-view');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#login-form');
const rows = document.querySelector('#team-rows');
const dialog = document.querySelector('#team-dialog');
let debounce;

async function boot() {
  try { await api.admin.me(); showDashboard(); await loadAll(); } catch { loginView.hidden = false; dashboard.hidden = true; }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const button = loginForm.querySelector('button'); const error = loginForm.querySelector('.admin-error');
  button.disabled = true; button.classList.add('loading'); error.hidden = true;
  try { await api.admin.login({ username: loginForm.elements.username.value, password: loginForm.elements.password.value }); loginForm.reset(); showDashboard(); await loadAll(); }
  catch (exception) { error.textContent = exception instanceof ApiError ? exception.message : 'Сервер недоступен.'; error.hidden = false; }
  finally { button.disabled = false; button.classList.remove('loading'); }
});

function showDashboard() { loginView.hidden = true; dashboard.hidden = false; }
async function loadAll() { setLoading(); try { const [stats, teams] = await Promise.all([api.admin.stats(), loadTeams()]); renderStats(stats); return teams; } catch (error) { if (error.status === 401) { loginView.hidden = false; dashboard.hidden = true; } else renderError(error.message); } }
function renderStats(data) { document.querySelector('#stat-teams').textContent = data.teams; document.querySelector('#stat-participants').textContent = data.participants; document.querySelector('#stat-academy').textContent = data.motion_web_academy; document.querySelector('#stat-college').textContent = data.motion_college; }
async function loadTeams() { const query = document.querySelector('#search').value.trim(); const org = document.querySelector('#filter').value; const params = new URLSearchParams({ page_size: '200' }); if (query) params.set('q', query); if (org) params.set('organization', org); const result = await api.admin.teams(`?${params}`); renderTeams(result); return result; }
function setLoading() { rows.innerHTML = Array.from({ length: 5 }, () => '<tr class="skeleton"><td colspan="7"><span></span></td></tr>').join(''); }
function renderTeams(result) { document.querySelector('#result-count').textContent = `${result.total} команд`; document.querySelector('#empty').hidden = result.items.length > 0; rows.innerHTML = result.items.map((team) => `<tr data-id="${team.id}" tabindex="0"><td><span class="id">#${escape(team.registration_number)}</span></td><td><strong>${escape(team.name)}</strong></td><td><span class="org ${team.organization}">${organizations[team.organization]}</span></td><td>${escape(team.captain_name)}</td><td><span class="mono">${escape(team.captain_phone)}</span></td><td>${team.participant_count} / 3</td><td>${formatDate(team.created_at)}</td></tr>`).join(''); }
function renderError(message) { rows.innerHTML = `<tr><td colspan="7" class="error-cell">${escape(message || 'Не удалось загрузить данные.')}</td></tr>`; }

document.querySelector('#search').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => loadTeams().catch((e) => renderError(e.message)), 350); });
document.querySelector('#filter').addEventListener('change', () => loadTeams().catch((e) => renderError(e.message)));
rows.addEventListener('click', (event) => { const row = event.target.closest('tr[data-id]'); if (row) openTeam(row.dataset.id); });
rows.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.closest('tr[data-id]')?.click(); });

async function openTeam(id) { dialog.showModal(); document.querySelector('#team-detail').innerHTML = '<div class="detail-loading">Загрузка...</div>'; try { const team = await api.admin.team(id); document.querySelector('#team-detail').innerHTML = `<p class="kicker">${escape(team.registration_number)}</p><h2>${escape(team.name)}</h2><p class="detail-org">${organizations[team.organization]} · ${formatDate(team.created_at)}</p><div class="detail-project"><small>ПРОЕКТ / ИДЕЯ</small><strong>${escape(team.project_name || 'Не указано')}</strong><p>${escape(team.project_description || 'Описание не указано')}</p></div><h3>Участники</h3><div class="detail-participants">${team.participants.sort((a,b) => b.is_captain-a.is_captain).map(p => `<article><small>${p.is_captain ? 'КАПИТАН' : 'УЧАСТНИК'}</small><strong>${escape(p.first_name)} ${escape(p.last_name)}</strong><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a><span>${escape(p.telegram || '—')} · ${escape(p.email || '—')}</span></article>`).join('')}</div><button class="delete-team" data-delete="${team.id}">Удалить регистрацию</button>`; } catch (e) { document.querySelector('#team-detail').textContent = e.message; } }
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('click', async (event) => { const button = event.target.closest('[data-delete]'); if (!button || !confirm('Удалить эту команду и всех участников? Это действие необратимо.')) return; button.disabled = true; try { await api.admin.deleteTeam(button.dataset.delete); dialog.close(); await loadAll(); } catch (e) { button.textContent = e.message; button.disabled = false; } });
document.querySelector('#logout').addEventListener('click', async () => { await api.admin.logout(); location.reload(); });
document.querySelector('#export').addEventListener('click', () => { window.location.href = api.admin.exportUrl; });
function formatDate(date) { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date)); }
function escape(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; }
boot();

