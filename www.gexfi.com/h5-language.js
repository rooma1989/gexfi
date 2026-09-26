(() => {
  const lang = document.documentElement.lang.startsWith('zh') ? 'zh-Hans' : 'en';
  function updateLinks() {
    document.querySelectorAll('a[href^="https://h5.gexfi.com/"]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('lang', lang);
      if (link.href !== url.href) link.href = url.href;
    });
  }

  updateLinks();
  // Framer replaces legacy navigation links when responsive variants render.
  new MutationObserver(updateLinks).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
})();
