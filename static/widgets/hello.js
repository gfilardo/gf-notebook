export default {
  apiVersion: 1,
  mount(container, { label = 'Sine wave', cycles = 2 }) {
    if (typeof label !== 'string' || !label.trim() ||
        !Number.isInteger(cycles) || cycles < 1 || cycles > 12) {
      throw new Error('Expected a label and 1 to 12 wave cycles');
    }

    container.innerHTML = `
      <style>
        .hello-wave { display: grid; grid-template-rows: minmax(3rem, 1fr) auto; height: 100%; min-height: 8rem; }
        .hello-wave-plot { position: relative; }
        .hello-wave canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
        .hello-wave-controls {
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          padding: 0.5rem 0.75rem; border-top: 1px solid var(--widget-line);
          background: var(--widget-surface); color: var(--widget-ink); font: 0.875rem/1.4 var(--sans);
        }
        .hello-wave button {
          min-height: 2.75rem; padding: 0 0.75rem; border: 1px solid var(--widget-line); border-radius: 4px;
          background: var(--widget-paper); color: var(--widget-ink); font: inherit; cursor: pointer;
        }
        .hello-wave button:focus-visible { outline: 2px solid var(--widget-accent); outline-offset: 2px; }
      </style>
      <div class="hello-wave">
        <div class="hello-wave-plot"><canvas role="img"></canvas></div>
        <div class="hello-wave-controls"><span></span><button type="button">Play</button></div>
      </div>
    `;
    const canvas = container.querySelector('canvas');
    const button = container.querySelector('button');
    container.querySelector('span').textContent = label;
    canvas.setAttribute('aria-label', `${label}, ${cycles} cycles`);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');

    const window = container.ownerDocument.defaultView;
    const theme = window.matchMedia('(prefers-color-scheme: dark)');
    const listeners = new window.AbortController();
    let frame = null;
    let previousTime = null;
    let phase = 0;

    function draw() {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const scale = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(width * scale));
      const pixelHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

      const colors = window.getComputedStyle(container);
      const middle = height / 2;
      const amplitude = height * 0.28;
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      context.fillStyle = colors.getPropertyValue('--widget-paper').trim();
      context.fillRect(0, 0, width, height);
      context.strokeStyle = colors.getPropertyValue('--widget-line').trim();
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, middle);
      context.lineTo(width, middle);
      context.stroke();
      context.strokeStyle = colors.getPropertyValue('--widget-accent').trim();
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, middle + Math.sin(phase) * amplitude);
      for (let x = 1; x <= width; x++) {
        context.lineTo(x, middle + Math.sin(x / width * cycles * 2 * Math.PI + phase) * amplitude);
      }
      context.stroke();
    }

    function tick(time) {
      if (previousTime !== null) phase -= (time - previousTime) / 350;
      previousTime = time;
      draw();
      frame = window.requestAnimationFrame(tick);
    }

    function pause() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
      button.textContent = 'Play';
    }

    draw();
    button.addEventListener('click', () => {
      if (frame === null) {
        button.textContent = 'Pause';
        frame = window.requestAnimationFrame(tick);
      } else {
        pause();
      }
    }, { signal: listeners.signal });
    theme.addEventListener('change', draw, { signal: listeners.signal });
    const resizeObserver = new window.ResizeObserver(draw);
    resizeObserver.observe(canvas);

    return () => {
      pause();
      resizeObserver.disconnect();
      listeners.abort();
    };
  }
};
