const fs = require('fs');

// Mock browser globals for SSR evaluation
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => ({ classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => []
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.location = { hash: '#home', href: 'http://localhost:3000/' };
global.history = { pushState: () => {}, replaceState: () => {} };
global.scrollTo = () => {};

eval(fs.readFileSync('js/data.js', 'utf8'));
eval(fs.readFileSync('js/shop-rules.js', 'utf8'));
eval(fs.readFileSync('js/state.js', 'utf8'));
eval(fs.readFileSync('js/builder.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

const homeHtml = window.appRouter.renderHomeView();

let indexHtml = fs.readFileSync('index.html', 'utf8');
const mainOpenTag = '<main id="main-content" class="flex-1">';
const mainCloseTag = '</main>';

const startIdx = indexHtml.indexOf(mainOpenTag);
const endIdx = indexHtml.indexOf(mainCloseTag);

if (startIdx !== -1 && endIdx !== -1) {
  const newIndex = indexHtml.slice(0, startIdx + mainOpenTag.length) + '\n' + homeHtml + '\n  ' + indexHtml.slice(endIdx);
  fs.writeFileSync('index.html', newIndex, 'utf8');
  console.log('index.html pre-populated with homepage successfully!');
} else {
  console.error('Could not find main tags in index.html');
}
