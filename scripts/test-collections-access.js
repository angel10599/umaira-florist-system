const fs = require('fs');
const vm = require('vm');

const jsData = fs.readFileSync('js/data.js', 'utf8');
const jsSite = fs.readFileSync('js/site-update.js', 'utf8');

const context = {
  window: {},
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
    head: { appendChild: () => {} },
    body: { setAttribute: () => {}, appendChild: () => {}, insertBefore: () => {} }
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  location: { hash: '#collections' }
};
context.window = context;
context.UI = { renderImage: (img, name, cls) => `<img src="${img}" alt="${name}">` };

vm.createContext(context);
try {
  vm.runInContext(jsData, context);
  vm.runInContext('function AppRouter() {}; AppRouter.prototype = {}; window.AppRouter = AppRouter; window.appRouter = new AppRouter();', context);
  vm.runInContext(jsSite, context);
  console.log('site-update.js loaded.');
  const html = context.appRouter.renderCollectionsView();
  console.log('SUCCESS! renderCollectionsView output length:', html.length);
} catch (e) {
  console.error('CRASH in renderCollectionsView:');
  console.error(e);
  process.exit(1);
}
