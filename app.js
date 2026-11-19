const EMAIL = 'hrsi56@gmail.com';

/* ---------- Header: mobile menu & scrolled state ---------- */
const header = document.querySelector('.site-header');
const nav = document.querySelector('#main-nav');
const menu = document.querySelector('.menu-toggle');
const setMenu = (open) => {
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
  menu.querySelector('.menu-label').textContent = open ? 'סגירה' : 'תפריט';
};
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menu.focus(); }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.site-header')) setMenu(false); });
matchMedia('(min-width: 860px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });
const markScrolled = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
addEventListener('scroll', markScrolled, { passive: true });
markScrolled();

/* ---------- Project filters ---------- */
const grid = document.querySelector('#project-grid');
const cards = [...grid.querySelectorAll('.project-card')];
const filterStatus = document.querySelector('#filter-status');
document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((other) => {
      const active = other === button;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    grid.classList.toggle('is-filtered', filter !== 'all');
    let count = 0;
    cards.forEach((card) => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.hidden = !show;
      if (show) count++;
    });
    filterStatus.textContent = count === 1 ? 'מוצג פרויקט אחד' : `מוצגים ${count} פרויקטים`;
  });
});

/* ---------- Project details dialog ---------- */
const dialog = document.querySelector('#project-dialog');
const dialogContent = document.querySelector('#dialog-content');
const closeButton = dialog.querySelector('.dialog-close');
const stepButtons = [...dialog.querySelectorAll('.dialog-step')];
let currentId;
let projectsPromise;
const getProjects = () => projectsPromise ||= fetch('projects.json').then((response) => {
  if (!response.ok) throw new Error('Project details unavailable');
  return response.json();
}).catch((error) => { projectsPromise = undefined; throw error; });

const element = (tag, className, text) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
};
const externalLink = (url, label, className) => {
  const link = element('a', className, label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
};
const visibleIds = () => cards.filter((card) => !card.hidden).map((card) => card.id.replace(/^project-/, ''));

function renderProject(project, projects) {
  const content = [];
  const cardVisual = document.querySelector(`#project-${CSS.escape(project.id)} .project-visual`);
  if (cardVisual) {
    const visual = cardVisual.cloneNode(true);
    visual.classList.add('dialog-visual');
    visual.removeAttribute('data-open-project');
    visual.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    content.push(visual);
  }
  content.push(element('p', 'dialog-category', project.categoryLabel));
  const heading = element('h2', 'dialog-title', project.title);
  heading.id = 'dialog-title';
  const name = element('p', 'dialog-name', project.name);
  name.lang = 'en';
  content.push(heading, name, element('p', 'dialog-description', project.detail));
  if (project.detailImage) {
    const preview = element('img', 'dialog-image');
    preview.src = project.detailImage;
    preview.alt = project.detailImageAlt || '';
    preview.width = project.detailImageWidth || 1280;
    preview.height = project.detailImageHeight || 720;
    preview.decoding = 'async';
    content.push(preview);
  }
  const tags = element('div', 'project-tags dialog-tags');
  tags.lang = 'en';
  project.tags.forEach((tag) => tags.append(element('span', '', tag)));
  const links = element('div', 'dialog-links');
  links.append(externalLink(project.url, `${project.linkLabel} ↖`, 'button button-dark'));
  if (project.repo) links.append(externalLink(project.repo, 'הקוד ב־GitHub ↗', 'text-link'));
  if (project.extra) links.append(externalLink(project.extra, `${project.extraLabel} ↗`, 'text-link'));
  content.push(tags, links);
  dialogContent.replaceChildren(...content);

  // Previous / next follow the order of the cards currently shown by the filter.
  const ids = visibleIds();
  const index = ids.indexOf(project.id);
  stepButtons.forEach((button) => {
    const target = projects.find((item) => item.id === ids[index + Number(button.dataset.step)]);
    button.hidden = !target;
    button.dataset.target = target?.id ?? '';
    button.querySelector('b').textContent = target?.title ?? '';
    button.setAttribute('aria-label', target ? `${button.dataset.step === '1' ? 'לפרויקט הבא' : 'לפרויקט הקודם'}: ${target.title}` : '');
  });
}

async function openProject(id, trigger) {
  if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
  try {
    const projects = await getProjects();
    const project = projects.find((item) => item.id === id);
    if (!project) throw new Error('Project not found');
    currentId = id;
    renderProject(project, projects);
    dialog.scrollTop = 0;
    if (!dialog.open) {
      dialog.showModal();
      closeButton.focus();
    } else if (document.activeElement?.hidden || !dialog.contains(document.activeElement)) {
      closeButton.focus();
    }
  } catch {
    toast('הפירוט אינו זמין כרגע. אפשר לפתוח את קישור הפרויקט או את הקוד.');
  } finally {
    if (trigger) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); }
  }
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-project]');
  if (button) { openProject(button.dataset.project, button); return; }
  const visual = event.target.closest('[data-open-project]');
  if (visual) openProject(visual.dataset.openProject);
});
stepButtons.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.target) openProject(button.dataset.target);
}));
dialog.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Right-to-left: the left arrow moves forward.
  const step = { ArrowLeft: '1', ArrowRight: '-1' }[event.key];
  const target = step && stepButtons.find((button) => button.dataset.step === step && !button.hidden);
  if (target) { event.preventDefault(); target.click(); }
});
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) dialog.close();
});
// Return focus to the card of the project that was open last, even after browsing with next/previous.
dialog.addEventListener('close', () => {
  document.querySelector(`.project-info[data-project="${CSS.escape(currentId ?? '')}"]`)?.focus();
});

/* ---------- Toast & copy e-mail ---------- */
let toastTimeout;
function toast(message) {
  const node = document.querySelector('.toast');
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.classList.add('visible');
  toastTimeout = setTimeout(() => node.classList.remove('visible'), 4500);
}
const copyButton = document.querySelector('.copy-email');
const copyLabel = copyButton.querySelector('.copy-label');
let copyTimeout;
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(EMAIL);
    toast('כתובת הדוא״ל הועתקה');
    copyButton.classList.add('is-copied');
    copyLabel.textContent = 'הועתק';
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => { copyButton.classList.remove('is-copied'); copyLabel.textContent = 'העתקה'; }, 2500);
  } catch {
    toast(`כתובת הדוא״ל: ${EMAIL}`);
  }
});

/* ---------- Footer year & scroll-spy ---------- */
document.querySelector('#year').textContent = new Date().getFullYear();
if ('IntersectionObserver' in window) {
  const links = [...nav.querySelectorAll('a')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-18% 0px -55% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
}
