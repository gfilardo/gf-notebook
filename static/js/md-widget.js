class MarkdownWidget extends HTMLElement {
  #shadow = this.attachShadow({ mode: 'open' });
  #connection;
  #fallback;
  #mount;
  #skeleton;
  #notice;

  connectedCallback() {
    if (this.#connection || !this.isConnected) return;
    if (!this.#skeleton) this.#prepare();
    const connection = {};
    this.#connection = connection;

    if (typeof IntersectionObserver !== 'function') {
      void this.#load(connection);
      return;
    }
    connection.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void this.#load(connection);
    }, { rootMargin: '200px' });
    connection.observer.observe(this);
  }

  disconnectedCallback() {
    const connection = this.#connection;
    if (!connection) return;
    this.#connection = undefined;
    connection.observer?.disconnect();
    this.#reset(connection);
    this.#notice.hidden = true;
    this.#runCleanup(connection.cleanup);
  }

  #prepare() {
    const document = this.ownerDocument;
    this.#fallback = this.querySelector(':scope > [data-fallback]');
    this.#mount = this.querySelector(':scope > [data-mount]');
    if (this.#mount) this.#mount.setAttribute('part', 'mount');

    const fallbackSlot = document.createElement('slot');
    fallbackSlot.name = 'fallback';
    this.#skeleton = document.createElement('div');
    this.#skeleton.setAttribute('part', 'skeleton');
    this.#skeleton.setAttribute('aria-hidden', 'true');
    this.#skeleton.hidden = true;
    this.#notice = document.createElement('div');
    this.#notice.setAttribute('part', 'notice');
    this.#notice.setAttribute('role', 'status');
    this.#notice.hidden = true;
    this.#notice.textContent = 'The widget could not load.';
    this.#shadow.append(this.#skeleton, fallbackSlot, this.#notice);
    if (this.#mount) this.#shadow.append(this.#mount);
  }

  #current(connection) {
    return this.#connection === connection && this.isConnected;
  }

  async #load(connection) {
    if (!this.#current(connection) || connection.loading) return;
    connection.loading = true;
    connection.observer?.disconnect();
    this.setAttribute('aria-busy', 'true');
    this.#skeleton.hidden = false;

    try {
      const src = this.getAttribute('src');
      const script = this.querySelector(':scope > script[type="application/json"]');
      if (!src || !script || !this.#mount || !this.#fallback) {
        throw new Error('Incomplete widget markup');
      }
      const props = JSON.parse(script.textContent);
      if (props === null || typeof props !== 'object' || Array.isArray(props)) {
        throw new Error('Widget props must be a JSON object');
      }
      const { default: widget } = await import(new URL(src, this.ownerDocument.URL).href);
      if (!this.#current(connection)) return;
      if (!widget || typeof widget !== 'object' || widget.apiVersion !== 1 || typeof widget.mount !== 'function') {
        throw new Error('Expected a widget with apiVersion 1 and a mount function');
      }

      const inner = this.ownerDocument.createElement('div');
      inner.setAttribute('part', 'container');
      connection.inner = inner;
      this.#mount.append(inner);
      this.#mount.hidden = false;
      const cleanup = widget.mount(inner, props);
      // A widget can synchronously trigger a disconnect while it is mounting.
      if (!this.#current(connection)) {
        this.#runCleanup(cleanup);
        return;
      }
      if (cleanup !== undefined && typeof cleanup !== 'function') {
        throw new Error('Widget mount must return a cleanup function or undefined');
      }
      connection.cleanup = cleanup;
      this.#fallback.hidden = true;
      this.#skeleton.hidden = true;
      this.removeAttribute('aria-busy');
    } catch (error) {
      if (!this.#current(connection)) return;
      this.#reset(connection);
      this.#notice.hidden = false;
      console.error('Could not load Markdown widget', error);
    }
  }

  #reset(connection) {
    connection.inner?.remove();
    if (this.#mount) this.#mount.hidden = true;
    if (this.#fallback) this.#fallback.hidden = false;
    this.#skeleton.hidden = true;
    this.removeAttribute('aria-busy');
  }

  #runCleanup(cleanup) {
    if (typeof cleanup !== 'function') return;
    try {
      cleanup();
    } catch (error) {
      console.error('Could not clean up Markdown widget', error);
    }
  }
}

customElements.define('md-widget', MarkdownWidget);
