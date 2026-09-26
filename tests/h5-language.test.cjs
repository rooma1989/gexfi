const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/../www.gexfi.com/h5-language.js`, 'utf8');
for (const [pageLang, expected] of [['en', 'en'], ['zh-CN', 'zh-Hans']]) {
  let callback;
  let writes = 0;
  function link(href) {
    return {
      get href() { return href; },
      set href(value) { writes++; href = value; },
    };
  }
  const links = [link('https://h5.gexfi.com/?source=site&lang=old#/pages/auth/login')];
  const body = {};
  vm.runInNewContext(source, {
    URL,
    document: {
      documentElement: { lang: pageLang },
      body,
      querySelectorAll(selector) {
        assert.equal(selector, 'a[href^="https://h5.gexfi.com/"]');
        return links;
      },
    },
    MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe(target, options) {
        assert.equal(target, body);
        assert.ok(options.childList && options.subtree && options.attributes);
        assert.equal(options.attributeFilter.join(','), 'href');
      }
    },
  });
  assert.equal(links[0].href, `https://h5.gexfi.com/?source=site&lang=${expected}#/pages/auth/login`);
  // A responsive rerender creates a fresh link without the language parameter.
  links[0] = link('https://h5.gexfi.com/');
  callback();
  assert.equal(links[0].href, `https://h5.gexfi.com/?lang=${expected}`);
  const previousWrites = writes;
  callback();
  assert.equal(writes, previousWrites, 'Observer must not keep rewriting unchanged links');
}
console.log('PASS: initial links, Framer rerenders, language mapping, and stable observer updates');
