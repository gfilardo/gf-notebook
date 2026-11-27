import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import hello from '../static/widgets/hello.js';

const source = await readFile(new URL('../static/js/md-widget.js', import.meta.url), 'utf8');
const moduleUrl = code => `data:text/javascript,${encodeURIComponent(code)}`;
const example = `export default {
  apiVersion: 1,
  mount(container, props) {
    const log = container.ownerDocument.log;
    container.innerHTML = 'Widget output';
    log.mounts.push({ container, props });
    return () => log.cleanups.push(container);
  }
};`;

function runtime() {
  const log = { mounts: [], cleanups: [], errors: [] };
  const observers = [];
  const selectors = {
    ':scope > [data-fallback]': node => node.attributes.has('data-fallback'),
    ':scope > [data-mount]': node => node.attributes.has('data-mount'),
    ':scope > script[type="application/json"]': node =>
      node.tag === 'script' && node.getAttribute('type') === 'application/json'
  };
  class Element {
    attributes = new Map();
    children = [];
    hidden = false;
    isConnected = false;
    ownerDocument = document;

    constructor(tag) { this.tag = tag; }
    attachShadow() { return (this.shadowRoot = new Element('shadow')); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelector(selector) { return this.children.find(selectors[selector]); }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parent = this;
        this.children.push(node);
      }
    }
    remove() {
      if (!this.parent) return;
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = undefined;
    }
  }
  const document = { URL: 'https://notebook.example/article/', createElement: tag => new Element(tag), log };
  let Widget;
  vm.runInNewContext(source, {
    URL,
    HTMLElement: Element,
    customElements: { define(name, Class) { assert.equal(name, 'md-widget'); Widget = Class; } },
    console: { error(...args) { log.errors.push(args); } },
    IntersectionObserver: class {
      constructor(callback) {
        this.enter = () => callback([{ isIntersecting: true }]);
        this.exit = () => callback([{ isIntersecting: false }]);
        observers.push(this);
      }
      observe(host) { this.host = host; }
      disconnect() { this.disconnected = true; }
    }
  }, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });

  function create(src, props = {}) {
    const host = new Widget();
    host.setAttribute('src', src);
    const script = new Element('script');
    script.setAttribute('type', 'application/json');
    script.textContent = JSON.stringify(props);
    const fallback = new Element('div');
    fallback.setAttribute('data-fallback', '');
    const mount = new Element('div');
    mount.setAttribute('data-mount', '');
    mount.hidden = true;
    host.append(script, fallback, mount);
    return {
      host, script, fallback, mount,
      part: part => host.shadowRoot.children.find(node => node.getAttribute('part') === part),
      connect() { host.isConnected = true; host.connectedCallback(); return observers.at(-1); },
      disconnect() { host.isConnected = false; host.disconnectedCallback(); }
    };
  }
  return { create, log, observers };
}

test('mounts independent widget instances lazily inside shadow DOM and cleans up once', async () => {
  const { create, log } = runtime();
  const src = moduleUrl(example);
  const label = '</script><img onerror=…>';
  const first = create(src, { label });
  const second = create(src, { label: 'Second' });
  first.fallback.setAttribute('data-authored', '');
  first.fallback.textContent = 'Static explanation';
  const observer = first.connect();
  observer.exit();
  assert.equal(first.part('skeleton').hidden, true);
  assert.deepEqual(log.mounts, []);
  observer.enter();
  observer.enter();
  assert.equal(observer.disconnected, true);
  assert.equal(first.part('skeleton').hidden, false);
  assert.equal(first.fallback.hidden, false);
  second.connect().enter();
  await import(src);
  await setImmediate();

  assert.deepEqual(log.mounts.map(({ props }) => props.label).sort(), [label, 'Second']);
  assert.equal(first.fallback.hidden, true);
  assert.equal(first.part('skeleton').hidden, true);
  assert.ok(first.host.shadowRoot.children.includes(first.mount));
  const [container] = first.mount.children;
  assert.equal(container.innerHTML, 'Widget output');
  assert.deepEqual(first.host.children, [first.script, first.fallback]);
  first.disconnect();
  first.disconnect();
  assert.deepEqual(log.cleanups, [container]);
  assert.deepEqual(first.mount.children, []);
  assert.equal(first.fallback.hidden, false);
  assert.equal(first.fallback.textContent, 'Static explanation');
  assert.equal(second.fallback.hidden, true);
  first.connect().enter();
  await setImmediate();
  assert.equal(first.mount.children.length, 1);
  assert.notEqual(first.mount.children[0], container);
});

test('failed imports, unsupported versions, and failed mounts keep the fallback visible', async () => {
  const { create, log } = runtime();
  const cases = [
    ['throw new Error("import failed");', /import failed/],
    ['export default { apiVersion: 2, mount() {} };', /apiVersion 1/],
    ['export default { apiVersion: 1, mount(el) { el.append(el.ownerDocument.createElement("canvas")); throw new Error("mount failed"); } };', /mount failed/]
  ];
  for (const [code, message] of cases) {
    const src = moduleUrl(code);
    const instance = create(src);
    instance.connect().enter();
    await import(src).catch(() => {});
    await setImmediate();
    assert.equal(instance.fallback.hidden, false);
    assert.equal(instance.part('notice').hidden, false);
    assert.equal(instance.part('skeleton').hidden, true);
    assert.deepEqual(instance.mount.children, []);
    assert.match(log.errors.at(-1)[1].message, message);
  }
});

test('disconnect invalidates a pending import and reconnect only mounts the current instance', async t => {
  const { create, log, observers } = runtime();
  const gate = Symbol.for('md-widget test import gate');
  const { promise, resolve } = Promise.withResolvers();
  globalThis[gate] = promise;
  t.after(() => { delete globalThis[gate]; });
  const src = moduleUrl(`await globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(gate))})];\n${example}`);
  const removed = create(src);
  const moved = create(src);
  removed.connect().enter();
  removed.disconnect();
  const oldObserver = moved.connect();
  oldObserver.enter();
  moved.disconnect();
  const currentObserver = moved.connect();
  moved.host.connectedCallback();
  assert.equal(observers.length, 3);
  oldObserver.enter();
  currentObserver.enter();
  assert.deepEqual(log.mounts, []);

  resolve();
  await import(src);
  await setImmediate();
  assert.equal(log.mounts.length, 1);
  assert.deepEqual(removed.mount.children, []);
  assert.equal(moved.mount.children.length, 1);
  moved.disconnect();
  assert.deepEqual(log.cleanups, [log.mounts[0].container]);
});

test('the canvas example uses inherited theme colors and cleans up drawing resources', () => {
  const button = new EventTarget();
  const theme = new EventTarget();
  const label = {};
  const frames = new Map();
  const paints = [];
  const context = {
    setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
    fillRect() { paints.push(this.fillStyle); },
    stroke() { paints.push(this.strokeStyle); }
  };
  const canvas = {
    setAttribute(name, value) { this[name] = value; },
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 320, height: 120 })
  };
  let observer;
  const window = {
    AbortController,
    devicePixelRatio: 2,
    matchMedia: () => theme,
    getComputedStyle: () => ({
      getPropertyValue: name => ({
        '--widget-paper': '#f8f3ec', '--widget-line': '#dfd6cb', '--widget-accent': '#98122d'
      })[name]
    }),
    requestAnimationFrame(callback) { frames.set(1, callback); return 1; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class {
      constructor(draw) { this.draw = draw; observer = this; }
      observe(node) { this.node = node; }
      disconnect() { this.node = null; }
    }
  };
  const container = {
    ownerDocument: { defaultView: window },
    querySelector: tag => ({ canvas, button, span: label })[tag]
  };

  const cleanup = hello.mount(container, { label: 'Demo', cycles: 4 });
  assert.equal(label.textContent, 'Demo');
  assert.equal(canvas['aria-label'], 'Demo, 4 cycles');
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 240);
  assert.equal(observer.node, canvas);
  assert.deepEqual(paints, ['#f8f3ec', '#dfd6cb', '#98122d']);
  theme.dispatchEvent(new Event('change'));
  assert.equal(paints.length, 6);
  button.dispatchEvent(new Event('click'));
  assert.equal(button.textContent, 'Pause');
  assert.equal(frames.size, 1);
  cleanup();
  assert.equal(button.textContent, 'Play');
  assert.equal(frames.size, 0);
  assert.equal(observer.node, null);
  button.dispatchEvent(new Event('click'));
  theme.dispatchEvent(new Event('change'));
  assert.equal(frames.size, 0);
  assert.equal(paints.length, 6);
});
