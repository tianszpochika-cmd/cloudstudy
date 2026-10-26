import fs from 'node:fs';
import vm from 'node:vm';

// This checks source wiring, not business acceptance or browser behavior.
const base = new URL('../docs/06-design/v2-980plus/redesign/mockups/admin/', import.meta.url);
const source = fs.readFileSync(new URL('app.js', base), 'utf8');
const shell = fs.readFileSync(new URL('index.html', base), 'utf8');
const failures = new Set();
const expected = ['alogin', 'dash', 'draft', 'review', 'publish', 'media', 'perm', 'audit', 'gov', 'report', 'cs', 'csdetail', 'shop', 'refund', 'ops', 'me'];
const screens = new Set([...source.matchAll(/^AV\.(\w+)\s*=/gm)].map(match => match[1]));
for (const screen of expected) if (!screens.has(screen)) failures.add('SCREEN-MISSING:' + screen);
for (const screen of screens) if (!expected.includes(screen)) failures.add('SCREEN-UNEXPECTED:' + screen);
for (const match of (source + '\n' + shell).matchAll(/#\/(\w+)/g)) {
  if (!screens.has(match[1])) failures.add('ROUTE-MISSING:' + match[1]);
}
for (const screen of screens) {
  if (!new RegExp('\\b' + screen + '\\s*:\\s*["\'`]').test(source)) failures.add('TITLE-MISSING:' + screen);
}
for (const match of source.matchAll(/getElementById\(["']([\w-]+)["']\)/g)) {
  const id = match[1];
  if (!(source + shell).includes('id="' + id + '"') && !(source + shell).includes("id='" + id + "'")) {
    failures.add('ID-NEVER-RENDERED:' + id);
  }
}
try { new vm.Script(source, { filename: 'admin/app.js' }); }
catch (error) { failures.add('SOURCE-SYNTAX:' + error.message); }

// Every source-level global is replaced with a harmless object/function. Handler
// probes can therefore resolve globals without executing a real UI/model action.
// Callback arguments are inspected too, catching the former aarm(...()=>d...) bug.
const mockedValues = new WeakSet();
function mockValue() {
  let mock;
  mock = new Proxy(function (...args) {
    for (const arg of args) if (typeof arg === 'function' && !mockedValues.has(arg)) arg(mock);
    return mock;
  }, {
    get(target, key) {
      if (key === Symbol.toPrimitive) return () => '0';
      if (key === 'value' || key === 'textContent') return '0';
      if (key === 'length' || key === 'selectionStart') return 0;
      return mock;
    },
    set() { return true; },
    deleteProperty() { return true; },
  });
  mockedValues.add(mock);
  return mock;
}
const globals = new Set([
  ...[...source.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm)].map(match => match[1]),
  ...[...source.matchAll(/^(?:const|let|var)\s+(\w+)/gm)].map(match => match[1]),
  'window', 'document', 'location', 'history', 'localStorage', 'navigator',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
]);
let handlerCount = 0;
// Inspect evaluated HTML, rather than JavaScript string fragments. The latter
// contain escaped quotes and concatenations that are not browser handlers yet.
const rendered = [['index.html', shell]];
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    innerHTML: '', textContent: '', value: '', scrollTop: 0, selectionStart: 0,
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    focus() {}, setSelectionRange() {},
  });
  return nodes.get(id);
}
const renderContext = vm.createContext({
  document: { getElementById: node, querySelectorAll: () => [], querySelector: () => null },
  window: { addEventListener() {} }, location: { hash: '#/dash' },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  history: { length: 1, back() {} }, console,
});
function capture(name, expression) {
  try {
    vm.runInContext(expression + '; arender();', renderContext, { timeout: 500 });
    rendered.push([name, node('view').innerHTML]);
  } catch (error) { failures.add('RENDER-ERROR:' + name + ':' + error.message); }
}
try {
  const model = new URL('model.js', base);
  if (fs.existsSync(model)) vm.runInContext(fs.readFileSync(model, 'utf8'), renderContext, { filename: 'admin/model.js', timeout: 500 });
  vm.runInContext(source, renderContext, { filename: 'admin/app.js', timeout: 500 });
  if (/const ASEED\s*=/.test(source)) {
    const accounts = vm.runInContext('Object.keys(M.identities)', renderContext);
    for (const account of accounts) for (const route of screens) {
      capture('render:' + account + ':' + route, 'A=M.normalize(ASEED); M.identity(A,' + JSON.stringify(account) + '); location.hash=' + JSON.stringify('#/' + route));
    }
    // Exercise conditional controls absent from the initial data: dual review,
    // newly published content, both ticket types and their terminal states.
    const reset = 'A=M.normalize(ASEED);';
    capture('render:review:dual', reset + 'M.mode(A); location.hash="#/review"');
    capture('render:review:dual-L1', reset + 'M.mode(A); M.submit(A,A.cur); M.identity(A,"wangfang"); M.approve(A,A.cur,"l1"); M.identity(A,"zhaolei"); location.hash="#/review"');
    capture('render:publish:new', reset + 'M.submit(A,A.cur); M.approve(A,A.cur,"simple"); M.identity(A,"zhaolei"); location.hash="#/publish"');
    const hashTicket = 'A.tickets.find(t=>t.hashOnly)', bodyTicket = 'A.tickets.find(t=>!t.hashOnly)';
    const ticketPrep = reset + 'M.identity(A,"chenchen");';
    for (const [name, expression] of [['hash', hashTicket], ['body', bodyTicket]]) {
      const prep = ticketPrep + 'A.curTk=' + expression + '.id; ' + expression + '.st="待接单"; ' + expression + '.assignee=null; M.ticketAction(A,A.curTk,"claim");';
      capture('render:csdetail:' + name + '-claimed', prep + 'location.hash="#/csdetail"');
      capture('render:csdetail:' + name + '-upgraded', prep + 'M.ticketAction(A,A.curTk,"upgrade","",{recipient:"support-wu",reason:"样例升级原因"}); location.hash="#/csdetail"');
      if (name === 'body') capture('render:csdetail:closed', prep + 'M.ticketAction(A,A.curTk,"close","样例回复"); location.hash="#/csdetail"');
    }
    capture('render:refund:approved', reset + 'M.identity(A,"liucai"); M.refund(A,A.refunds[0].id); location.hash="#/refund"');
  } else {
    for (const route of screens) capture('render:' + route, 'location.hash=' + JSON.stringify('#/' + route));
  }
} catch (error) { failures.add('APP-BOOT-ERROR:' + error.message); }
const seenHandlers = new Set();
for (const [filename, contents] of rendered) {
  for (const match of contents.matchAll(/\bon(?:click|input|change|submit|keydown)="([^"]*)"/g)) {
    const line = contents.slice(0, match.index).split('\n').length;
    const code = match[1].replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
    if (seenHandlers.has(code)) continue;
    seenHandlers.add(code); handlerCount++;
    const context = vm.createContext(Object.fromEntries([...globals].map(name => [name, mockValue()])));
    context.event = mockValue();
    context.element = mockValue();
    try {
      const handler = new vm.Script('(function(event){' + code + '\n}).call(element,event)', { filename: filename + ':' + line });
      handler.runInContext(context, { timeout: 200 });
    } catch (error) {
      // Type/range failures may depend on concrete UI values. This source check
      // reports binding and syntax failures; real values belong in model/browser tests.
      if (error.name === 'ReferenceError' || error.name === 'SyntaxError') {
        failures.add('HANDLER-' + error.name + ':' + filename + ':' + line + ':' + error.message);
      } else if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        failures.add('HANDLER-TIMEOUT:' + filename + ':' + line);
      }
    }
  }
}
const scripts = [...shell.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)].map(match => match[1]);
for (const src of scripts) {
  if (/^(?:https?:)?\/\//.test(src)) failures.add('SCRIPT-REMOTE:' + src);
  else if (!fs.existsSync(new URL(src, base))) failures.add('SCRIPT-MISSING:' + src);
}
if (!scripts.includes('app.js')) failures.add('SCRIPT-APP-MISSING');
if (fs.existsSync(new URL('model.js', base)) && (!scripts.includes('model.js') || scripts.indexOf('model.js') > scripts.indexOf('app.js'))) {
  failures.add('SCRIPT-MODEL-ORDER');
}
console.log(`screens=${screens.size} rendered=${rendered.length - 1} handlers=${handlerCount} fails=${failures.size}`);
for (const failure of failures) console.log(' ' + failure);
process.exitCode = failures.size ? 1 : 0;
