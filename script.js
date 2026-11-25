/* Navigation remains functional without the optional motion libraries. */
(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (!menuButton || !nav) return;
  document.querySelector('.site-header')?.classList.add('nav-ready');

  const links = [...nav.querySelectorAll('a')];
  const mobileQuery = window.matchMedia('(max-width: 1150px)');
  let returnFocus = null;

  const closeMenu = ({ restoreFocus = false } = {}) => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
    nav.classList.remove('is-open');
    document.documentElement.classList.remove('nav-open');
    if (restoreFocus) (returnFocus || menuButton).focus();
  };

  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    if (!opening) return closeMenu({ restoreFocus: true });
    returnFocus = menuButton;
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', 'Fechar menu');
    nav.classList.add('is-open');
    document.documentElement.classList.add('nav-open');
    requestAnimationFrame(() => links[0]?.focus());
  });

  links.forEach((link) => link.addEventListener('click', () => closeMenu({ restoreFocus: true })));

  document.addEventListener('keydown', (event) => {
    if (menuButton.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === menuButton)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  mobileQuery.addEventListener('change', (event) => {
    if (!event.matches) closeMenu();
  });
})();
