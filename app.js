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
matchMedia('(min-width: 741px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });

const cards = [...document.querySelectorAll('.project-card')];
document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#project-grid').classList.toggle('is-filtered', button.dataset.filter !== 'all');
    let count = 0;
    cards.forEach((card) => {
      const show = button.dataset.filter === 'all' || card.dataset.category === button.dataset.filter;
      card.hidden = !show;
      if (show) count++;
    });
    document.querySelector('#filter-status').textContent = `מוצגים ${count} פרויקטים`;
  });
});

const dialog = document.querySelector('#project-dialog');
let lastTrigger;
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
document.querySelector('#project-grid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-project]');
  if (!button) return;
  button.disabled = true;
  try {
    const project = (await getProjects()).find((item) => item.id === button.dataset.project);
    if (!project) throw new Error('Project not found');
    const content = document.querySelector('#dialog-content');
    content.replaceChildren();
    content.append(element('p', 'dialog-category', project.categoryLabel));
    const heading = element('h2', 'dialog-title', project.title);
    heading.id = 'dialog-title';
    content.append(heading, element('p', 'dialog-name', project.name), element('p', 'dialog-description', project.detail));
    if (project.detailImage) {
      const preview = element('img', 'dialog-image');
      preview.src = project.detailImage;
      preview.alt = project.detailImageAlt || '';
      preview.width = project.detailImageWidth || 1280;
      preview.height = project.detailImageHeight || 720;
      preview.loading = 'lazy';
      content.append(preview);
    }
    const tags = element('div', 'project-tags dialog-tags');
    project.tags.forEach((tag) => tags.append(element('span', '', tag)));
    const links = element('div', 'dialog-links');
    links.append(externalLink(project.url, `${project.linkLabel} ↗`, 'button button-dark'));
    if (project.repo) links.append(externalLink(project.repo, 'הקוד ב־GitHub ↗', 'text-link'));
    if (project.extra) links.append(externalLink(project.extra, `${project.extraLabel} ↗`, 'text-link'));
    content.append(tags, links);
    lastTrigger = button;
    dialog.showModal();
    document.querySelector('.dialog-close').focus();
  } catch {
    toast('הפירוט אינו זמין כרגע. אפשר לפתוח את קישור הפרויקט או את הקוד.');
  } finally { button.disabled = false; }
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => lastTrigger?.focus());

let toastTimeout;
function toast(message) {
  const node = document.querySelector('.toast');
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.classList.add('visible');
  toastTimeout = setTimeout(() => node.classList.remove('visible'), 4500);
}
document.querySelector('.copy-email').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('hrsi56@gmail.com'); toast('כתובת הדוא״ל הועתקה'); }
  catch { toast('כתובת הדוא״ל: hrsi56@gmail.com'); }
});
document.querySelector('#year').textContent = new Date().getFullYear();
const sections = [...document.querySelectorAll('main section[id]')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      nav.querySelectorAll('a').forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-18% 0px -55% 0px', threshold: 0 });
  sections.forEach((section) => observer.observe(section));
}
