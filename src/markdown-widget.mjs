import { layouts } from './component-layout.mjs';

export function widgetOrigins(site) {
  return new Set([site.origin, ...(site.widgetOrigins ?? [])]);
}

export function markdownWidget(md) {
  const fenceInfo = token => md.utils.unescapeAll(token.info).trim().split(/\s+/);
  const isWidgetFence = token => token.type === 'fence' && fenceInfo(token)[0] === 'widget';

  md.core.ruler.after('block', 'markdown_widgets', state => {
    const { tokens, env } = state;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (!isWidgetFence(token)) continue;
      const fail = (message, line = token.map[0]) => {
        throw new Error(`line ${env.bodyStartLine + line}: ${message}`);
      };
      const [, reference, ...options] = fenceInfo(token);
      const { aspect, layout } = widgetOptions(options, fail);
      const src = widgetSource(reference, env, fail);
      const lines = token.content.split('\n');
      const separator = lines.findIndex(line => line.trim() === '---');
      const json = widgetJson(separator < 0 ? token.content : lines.slice(0, separator).join('\n'), fail);

      const fallback = [];
      if (separator >= 0) {
        const fallbackLine = token.map[0] + separator + 2;
        md.block.parse(lines.slice(separator + 1).join('\n'), md, env, fallback);
        if (fallback.length === 0) fail('Add Markdown fallback content after ---', fallbackLine - 1);
        const nested = fallback.find(isWidgetFence);
        if (nested) fail('A widget fallback cannot contain another widget', fallbackLine + nested.map[0]);
        for (const child of fallback) {
          child.level += token.level + 1;
          if (child.map) child.map = child.map.map(line => fallbackLine + line);
        }
      }

      // Let the document's inline parser and content transforms process the
      // fallback, including reference links and site-relative asset URLs.
      token.type = 'widget_open';
      token.nesting = 1;
      token.meta = { aspect, layout, src, json, hasFallback: fallback.length > 0 };
      const close = new token.constructor('widget_close', '', -1);
      close.block = true;
      close.level = token.level;
      close.meta = { layout };
      tokens.splice(index + 1, 0, ...fallback, close);
      index += fallback.length + 1;
      env.hasWidgets = true;
    }
  });

  md.renderer.rules.widget_open = (tokens, index) => {
    const { aspect, layout, src, json, hasFallback } = tokens[index].meta;
    const figure = layout ? `<figure class="component component-${layout}" data-widget="widget">\n` : '';
    const style = aspect ? ` style="aspect-ratio:${aspect}"` : '';
    const fallback = hasFallback ? '\n' : 'Interactive content is unavailable.';
    return `${figure}<md-widget src="${md.utils.escapeHtml(src)}"${style}>
  <script type="application/json">${json}</script>
  <div data-fallback${hasFallback ? ' data-authored' : ''} slot="fallback">${fallback}`;
  };
  md.renderer.rules.widget_close = (tokens, index) => {
    const figure = tokens[index].meta.layout ? '</figure>\n' : '';
    return `</div>\n  <div data-mount hidden></div>\n</md-widget>\n${figure}`;
  };
}

function widgetOptions(options, fail) {
  let aspect;
  let layout;
  for (const option of options) {
    if (option.startsWith('aspect=')) {
      if (aspect) fail('Duplicate widget aspect option');
      const ratio = /^aspect=([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(option);
      if (!ratio || !ratio.slice(1).every(value => Number.isSafeInteger(Number(value)))) {
        fail('Expected a widget aspect ratio in the form aspect=W/H with positive integers');
      }
      aspect = `${ratio[1]}/${ratio[2]}`;
    } else if (option.startsWith('layout=')) {
      if (layout) fail('Duplicate widget layout option');
      const name = option.slice('layout='.length);
      layout = layouts.get(name);
      if (!layout) fail(`Unknown widget layout: ${name}. Choose one of: ${[...layouts.keys()].join(', ')}`);
    } else {
      fail(`Unknown widget option: ${option}`);
    }
  }
  return { aspect, layout };
}

function widgetSource(reference, env, fail) {
  if (!reference || /[\\\u0000-\u001f\u007f]|%(?![\da-f]{2})/i.test(reference)) {
    fail('Expected a valid widget module URL');
  }
  let url;
  try {
    url = new URL(reference, env.pageUrl);
  } catch {
    fail('Invalid widget module URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !env.widgetOrigins.has(url.origin)) {
    fail(`Disallowed widget module URL: ${url.href}`);
  }
  // Keep local assets portable between the deployed origin and local preview.
  return url.origin === env.pageUrl.origin && !url.pathname.startsWith('//')
    ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

function widgetJson(source, fail) {
  let props;
  try {
    props = JSON.parse(source);
  } catch {
    fail('Malformed widget props JSON');
  }
  if (props === null || typeof props !== 'object' || Array.isArray(props)) {
    fail('Widget props must be a JSON object');
  }
  // Preserve JSON number literals as authored, including larger exponents.
  return source.trim().replace(/<|\u2028|\u2029/g, char =>
    ({ '<': '\\u003c', '\u2028': '\\u2028', '\u2029': '\\u2029' })[char]);
}
