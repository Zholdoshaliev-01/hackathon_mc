import { organizations } from './i18n.js';
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined && text !== null) node.textContent = text; return node; }
function detail(label, value) { if (!value) return null; const row = element('p', 'summary-detail'); if (label) row.append(element('span', '', label)); row.append(element('strong', '', value)); return row; }
function section(title, step, lines) { const card = element('section', 'summary-card'); const header = element('header'); header.append(element('small', '', title)); const edit = element('button', 'summary-edit', 'Изменить'); edit.type = 'button'; edit.dataset.editStep = String(step); header.append(edit); card.append(header); lines.filter(Boolean).forEach((line) => card.append(line)); return card; }
export function renderReview(container, payload) {
  container.replaceChildren(section('КОМАНДА', 0, [detail('Название', payload.name), detail('Организация', organizations[payload.organization])]));
  payload.participants.forEach((participant, index) => container.append(section(index === 0 ? 'КАПИТАН' : `УЧАСТНИК ${index + 1}`, 1, [detail('Имя', `${participant.first_name} ${participant.last_name}`.trim()), detail('Телефон', participant.phone), detail('Telegram', participant.telegram), detail('Email', participant.email)])));
}
