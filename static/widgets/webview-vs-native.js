export const OPTIONS = [
  {
    id: 'native',
    label: 'Native screen',
    short: 'Native',
    summary: 'Built directly with iOS (SwiftUI/UIKit) and Android (Compose/Views) primitives.'
  },
  {
    id: 'webview',
    label: 'Embedded WebView',
    short: 'WebView',
    summary: 'Web content hosted inside the app via WKWebView and Android WebView.'
  },
  {
    id: 'browser',
    label: 'System browser',
    short: 'System browser',
    summary: 'In-app browser tab (SFSafariViewController / Chrome Custom Tabs) or external browser.'
  }
];

export const PARAMETERS = [
  {
    key: 'offline',
    group: 'hard',
    label: 'Offline behavior',
    hint: 'Does the feature need to work without a network connection?',
    choices: [
      { value: 'none', label: 'Online only' },
      { value: 'read-cache', label: 'Cached reads' },
      { value: 'offline-write', label: 'Offline capture & sync' }
    ]
  },
  {
    key: 'deviceApis',
    group: 'hard',
    label: 'Device capabilities',
    hint: 'Hardware, sensors, and OS-level integrations required.',
    choices: [
      { value: 'none', label: 'None' },
      { value: 'standard', label: 'Basic (camera / files)' },
      { value: 'deep', label: 'Deep (BLE / NFC / bg)' }
    ]
  },
  {
    key: 'interaction',
    group: 'hard',
    label: 'Interaction fidelity',
    hint: 'Scroll physics, gestures, keyboard handling, and animation budget.',
    choices: [
      { value: 'document', label: 'Document / reading' },
      { value: 'form', label: 'Forms & lists' },
      { value: 'fluid', label: 'Fluid gestures / 60fps+' }
    ]
  },
  {
    key: 'auth',
    group: 'hard',
    label: 'Session & auth boundary',
    hint: 'How user identity and trust boundaries cross into the feature.',
    choices: [
      { value: 'public', label: 'Public / none' },
      { value: 'shared-session', label: 'App session' },
      { value: 'third-party-sso', label: '3rd-party OAuth / pay' }
    ]
  },
  {
    key: 'changeCadence',
    group: 'context',
    label: 'Change cadence',
    hint: 'How often content, copy, or rules change outside app releases.',
    choices: [
      { value: 'rare', label: 'With app releases' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'continuous', label: 'Daily / editorial' }
    ]
  },
  {
    key: 'webMaturity',
    group: 'context',
    label: 'Existing web flow',
    hint: 'Whether a mobile-ready web implementation already exists.',
    choices: [
      { value: 'none', label: 'Greenfield' },
      { value: 'partial', label: 'Desktop / partial' },
      { value: 'production', label: 'Mobile-ready web' }
    ]
  },
  {
    key: 'journeyRole',
    group: 'context',
    label: 'Role in user journey',
    hint: 'How central the feature is to daily retention and brand feel.',
    choices: [
      { value: 'peripheral', label: 'Peripheral / one-off' },
      { value: 'secondary', label: 'Secondary flow' },
      { value: 'core', label: 'Core product loop' }
    ]
  },
  {
    key: 'navigation',
    group: 'context',
    label: 'Navigation integration',
    hint: 'How tightly the screen connects to the app stack and deep links.',
    choices: [
      { value: 'standalone', label: 'Leave & return' },
      { value: 'contained', label: 'In-app frame' },
      { value: 'deeply-integrated', label: 'Deep native stack' }
    ]
  },
  {
    key: 'teamCapacity',
    group: 'context',
    label: 'Team ownership',
    hint: 'Who builds and maintains the feature across iOS and Android.',
    choices: [
      { value: 'web-heavy', label: 'Web-owned' },
      { value: 'balanced', label: 'Shared web + mobile' },
      { value: 'native-heavy', label: 'Dedicated iOS & Android' }
    ]
  }
];

export const PRESETS = {
  'help-center': {
    label: 'Help center & policies',
    values: {
      offline: 'none',
      deviceApis: 'none',
      interaction: 'document',
      auth: 'shared-session',
      changeCadence: 'continuous',
      webMaturity: 'production',
      journeyRole: 'peripheral',
      navigation: 'contained',
      teamCapacity: 'web-heavy'
    }
  },
  'offline-capture': {
    label: 'Offline field capture',
    values: {
      offline: 'offline-write',
      deviceApis: 'deep',
      interaction: 'fluid',
      auth: 'shared-session',
      changeCadence: 'rare',
      webMaturity: 'none',
      journeyRole: 'core',
      navigation: 'deeply-integrated',
      teamCapacity: 'balanced'
    }
  },
  'oauth-checkout': {
    label: '3rd-party OAuth / billing',
    values: {
      offline: 'none',
      deviceApis: 'none',
      interaction: 'form',
      auth: 'third-party-sso',
      changeCadence: 'monthly',
      webMaturity: 'production',
      journeyRole: 'peripheral',
      navigation: 'standalone',
      teamCapacity: 'web-heavy'
    }
  },
  'account-settings': {
    label: 'Account settings form',
    values: {
      offline: 'none',
      deviceApis: 'none',
      interaction: 'form',
      auth: 'shared-session',
      changeCadence: 'monthly',
      webMaturity: 'production',
      journeyRole: 'secondary',
      navigation: 'contained',
      teamCapacity: 'balanced'
    }
  }
};

const WEIGHTS = {
  offline: {
    none:            { native: 0,  webview: 6,  browser: 6  },
    'read-cache':    { native: 8,  webview: 4,  browser: -4 },
    'offline-write': { native: 28, webview: -20, browser: -28 }
  },
  deviceApis: {
    none:     { native: 0,  webview: 6,  browser: 6  },
    standard: { native: 8,  webview: 2,  browser: -4 },
    deep:     { native: 28, webview: -18, browser: -28 }
  },
  interaction: {
    document: { native: 0,  webview: 12, browser: 12 },
    form:     { native: 6,  webview: 8,  browser: 2  },
    fluid:    { native: 22, webview: -12, browser: -18 }
  },
  auth: {
    public:            { native: 0,  webview: 6,  browser: 12 },
    'shared-session':  { native: 12, webview: 8,  browser: -10 },
    'third-party-sso': { native: -10, webview: -24, browser: 28 }
  },
  changeCadence: {
    rare:       { native: 10, webview: 0,  browser: 0  },
    monthly:    { native: 2,  webview: 8,  browser: 6  },
    continuous: { native: -8, webview: 16, browser: 14 }
  },
  webMaturity: {
    none:       { native: 14, webview: -8, browser: -10 },
    partial:    { native: 6,  webview: 4,  browser: 0  },
    production: { native: -4, webview: 16, browser: 14 }
  },
  journeyRole: {
    peripheral: { native: -6, webview: 10, browser: 14 },
    secondary:  { native: 4,  webview: 10, browser: 2  },
    core:       { native: 18, webview: -8, browser: -14 }
  },
  navigation: {
    standalone:          { native: -4, webview: 6,  browser: 16 },
    contained:           { native: 4,  webview: 14, browser: 4  },
    'deeply-integrated': { native: 18, webview: -8, browser: -16 }
  },
  teamCapacity: {
    'web-heavy':    { native: -8, webview: 14, browser: 12 },
    balanced:       { native: 4,  webview: 6,  browser: 4  },
    'native-heavy': { native: 14, webview: -2, browser: -4 }
  }
};

const FACTOR_REASONS = {
  offline: {
    'offline-write': {
      target: 'native',
      text: 'Offline capture and reliable background sync require durable native storage rather than evictable WebView caches.'
    },
    'read-cache': {
      target: 'native',
      text: 'Cached offline reads are easiest to guarantee natively; WebViews need explicit cache strategy and fallback handling.'
    }
  },
  deviceApis: {
    deep: {
      target: 'native',
      text: 'Deep hardware or background OS APIs push you native; bridging them into JavaScript duplicates work across iOS and Android.'
    },
    standard: {
      target: 'native',
      text: 'Standard device pickers work in web views, but permission prompts and lifecycle recovery are smoother natively.'
    }
  },
  interaction: {
    fluid: {
      target: 'native',
      text: 'Gesture-heavy, 60fps+ interactions depend on native scroll physics, keyboard avoidance, and platform transitions.'
    },
    document: {
      target: 'webview',
      text: 'Document-centric reading flows play to the web platform’s strengths in typography, links, and reflow.'
    }
  },
  auth: {
    'third-party-sso': {
      target: 'browser',
      text: 'Third-party OAuth and external checkout belong in the system browser for shared cookies, password managers, and visible URL trust.'
    },
    'shared-session': {
      target: 'native',
      text: 'Reusing the app’s authenticated session is seamless natively, requires explicit cookie/token handoff in a WebView, and breaks in an external browser.'
    },
    public: {
      target: 'browser',
      text: 'Public content needs no session handoff, removing the main friction of opening the system browser.'
    }
  },
  changeCadence: {
    continuous: {
      target: 'webview',
      text: 'Frequent editorial or regulatory updates benefit from web deployment without waiting on app store review cycles.'
    },
    rare: {
      target: 'native',
      text: 'Infrequent changes align comfortably with normal app release schedules.'
    }
  },
  webMaturity: {
    production: {
      target: 'webview',
      text: 'An existing mobile-ready web flow avoids building and maintaining the same feature twice in Swift and Kotlin.'
    },
    none: {
      target: 'native',
      text: 'Starting greenfield eliminates the reuse advantage of a WebView unless you also need a web version.'
    }
  },
  journeyRole: {
    core: {
      target: 'native',
      text: 'Core product loops justify native investment in responsiveness, accessibility parity, and platform ergonomics.'
    },
    peripheral: {
      target: 'browser',
      text: 'Peripheral, low-frequency screens rarely repay the maintenance cost of dual native implementations.'
    }
  },
  navigation: {
    'deeply-integrated': {
      target: 'native',
      text: 'Tight integration with native tabs, gestures, and deep links breaks down quickly across a WebView boundary.'
    },
    contained: {
      target: 'webview',
      text: 'A contained in-app screen fits a WebView if you define explicit back-navigation and error states.'
    },
    standalone: {
      target: 'browser',
      text: 'A standalone leave-and-return journey lets the system browser handle navigation, TLS indicators, and autofill.'
    }
  },
  teamCapacity: {
    'web-heavy': {
      target: 'webview',
      text: 'Web-team ownership favors shipping once on the web rather than bottlenecking on separate iOS and Android teams.'
    },
    'native-heavy': {
      target: 'native',
      text: 'Dedicated iOS and Android capacity lowers the opportunity cost of building a first-class native screen.'
    }
  }
};

export function normalizeParams(input = {}) {
  const base = PRESETS['help-center'].values;
  const result = {};
  for (const param of PARAMETERS) {
    const candidate = input[param.key];
    const valid = param.choices.some(c => c.value === candidate);
    result[param.key] = valid ? candidate : base[param.key];
  }
  return result;
}

export function evaluateDecision(rawParams = {}) {
  const params = normalizeParams(rawParams);
  const raw = { native: 35, webview: 35, browser: 35 };

  for (const param of PARAMETERS) {
    const value = params[param.key];
    const delta = WEIGHTS[param.key][value];
    raw.native += delta.native;
    raw.webview += delta.webview;
    raw.browser += delta.browser;
  }

  // Detect hard architectural gates.
  const hardGates = [];
  if (params.offline === 'offline-write') {
    hardGates.push({ option: 'native', key: 'offline', label: 'Offline capture & sync' });
  }
  if (params.deviceApis === 'deep') {
    hardGates.push({ option: 'native', key: 'deviceApis', label: 'Deep device APIs' });
  }
  if (params.auth === 'third-party-sso') {
    hardGates.push({ option: 'browser', key: 'auth', label: 'Third-party OAuth / checkout' });
  }

  const gateTargets = new Set(hardGates.map(g => g.option));
  const hasConflict = gateTargets.size > 1;

  // Normalize raw scores to 0..100 for display.
  const clamp = n => Math.max(4, Math.min(98, Math.round(n)));
  const scores = {
    native: clamp(raw.native),
    webview: clamp(raw.webview),
    browser: clamp(raw.browser)
  };

  // Apply hard-gate winner resolution when unambiguous.
  let ranked = ['native', 'webview', 'browser'].sort((a, b) => scores[b] - scores[a]);
  let winner = ranked[0];
  let status = 'clear';
  let statusLabel = 'Clear fit';

  if (hasConflict) {
    status = 'conflict';
    statusLabel = 'Split the journey';
  } else if (gateTargets.size === 1) {
    winner = [...gateTargets][0];
    ranked = [winner, ...ranked.filter(id => id !== winner)];
    if (scores[winner] < scores[ranked[1]] + 8) {
      scores[winner] = Math.min(98, scores[ranked[1]] + 12);
    }
    status = 'gate';
    statusLabel = 'Hard requirement';
  } else {
    const margin = scores[ranked[0]] - scores[ranked[1]];
    if (margin <= 8) {
      status = 'close';
      statusLabel = 'Close call';
    }
  }

  // Collect driving reasons aligned with the winning option (plus any hard gates).
  const reasons = [];
  if (hasConflict) {
    reasons.push(
      'Conflicting hard requirements: use the System Browser for the third-party auth/checkout handoff, then return to a Native screen for offline capture or deep device access.'
    );
  }
  for (const param of PARAMETERS) {
    const value = params[param.key];
    const entry = FACTOR_REASONS[param.key]?.[value];
    if (!entry) continue;
    const isGate = hardGates.some(g => g.key === param.key);
    const weight = WEIGHTS[param.key][value][winner];
    if (isGate || weight >= 8) {
      reasons.push({ priority: isGate ? 100 : weight, text: entry.text });
    }
  }

  const topReasons = reasons
    .map(item => (typeof item === 'string' ? { priority: 200, text: item } : item))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(item => item.text);

  // Compute sensitivity: what single parameter change most narrows or flips the outcome?
  const flipHint = computeFlipHint(params, winner, hasConflict);

  const showBoundary = winner === 'webview' || (!hasConflict && ranked[1] === 'webview' && scores.webview >= 48);

  return {
    params,
    winner,
    runnerUp: ranked[1],
    ranked,
    scores,
    status,
    statusLabel,
    hasConflict,
    hardGates,
    reasons: topReasons,
    flipHint,
    showBoundary
  };
}

function computeFlipHint(params, winner, hasConflict) {
  if (hasConflict) {
    return 'Decouple third-party authentication from the offline or hardware-heavy workflow so each step uses the right host.';
  }
  if (winner === 'native') {
    if (params.offline === 'offline-write' || params.deviceApis === 'deep') {
      return 'Only dropping offline writes and deep device APIs would make a WebView viable here.';
    }
    return 'If content changes daily and a mobile-ready web flow already exists, an embedded WebView becomes competitive.';
  }
  if (winner === 'webview') {
    if (params.auth === 'shared-session') {
      return 'If the flow didn’t need your app’s session or in-app chrome, the System Browser would remove WebView maintenance.';
    }
    return 'Adding offline capture, deep hardware APIs, or fluid 60fps+ gestures would flip this to Native.';
  }
  // winner === 'browser'
  if (params.auth === 'third-party-sso') {
    return 'Keep third-party OAuth and external payments in the System Browser; only move in-app if you own the entire credential flow.';
  }
  return 'If you need seamless in-app session reuse and tighter navigation framing, an embedded WebView is the next step.';
}

function findMatchingPreset(params) {
  for (const [id, preset] of Object.entries(PRESETS)) {
    if (PARAMETERS.every(p => preset.values[p.key] === params[p.key])) {
      return id;
    }
  }
  return null;
}

export default {
  apiVersion: 1,
  mount(container, props = {}) {
    if (props !== null && typeof props !== 'object') {
      throw new Error('Expected a JSON object for widget props');
    }

    const title = typeof props.title === 'string' && props.title.trim()
      ? props.title.trim()
      : 'WebView vs. Native Decision Evaluator';

    const presetKey = typeof props.preset === 'string' && PRESETS[props.preset]
      ? props.preset
      : 'help-center';

    let state = normalizeParams({
      ...PRESETS[presetKey].values,
      ...(props.initial && typeof props.initial === 'object' ? props.initial : {})
    });

    const doc = container.ownerDocument;
    const win = doc.defaultView;
    const listeners = new win.AbortController();

    container.innerHTML = `
      <style>
        .wvn {
          font-family: var(--sans);
          color: var(--widget-ink);
          background: var(--widget-paper);
          line-height: 1.5;
          font-size: 0.9rem;
        }
        .wvn *, .wvn *::before, .wvn *::after { box-sizing: border-box; }

        .wvn-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem 1rem;
          padding: 0.9rem 1.15rem;
          border-bottom: 1px solid var(--widget-line);
          background: var(--widget-surface);
        }
        .wvn-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 650;
          letter-spacing: -0.02em;
        }
        .wvn-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }
        .wvn-preset-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--widget-muted);
          margin-right: 0.2rem;
        }
        .wvn-preset-btn {
          appearance: none;
          border: 1px solid var(--widget-line);
          background: var(--widget-paper);
          color: var(--widget-ink);
          font: 500 0.78rem/1.2 var(--sans);
          padding: 0.4rem 0.65rem;
          min-height: 2rem;
          border-radius: 3px;
          cursor: pointer;
          transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
        }
        .wvn-preset-btn:hover { border-color: var(--widget-accent); color: var(--widget-accent); }
        .wvn-preset-btn[aria-pressed="true"] {
          background: var(--widget-accent);
          border-color: var(--widget-accent);
          color: var(--widget-paper);
        }
        .wvn-preset-btn:focus-visible,
        .wvn-choice:focus-visible {
          outline: 2px solid var(--widget-accent);
          outline-offset: 2px;
        }

        .wvn-body {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.95fr);
          align-items: start;
        }
        @media (max-width: 780px) {
          .wvn-body { grid-template-columns: minmax(0, 1fr); }
        }

        .wvn-controls {
          padding: 1rem 1.15rem 1.15rem;
          border-right: 1px solid var(--widget-line);
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        @media (max-width: 780px) {
          .wvn-controls {
            border-right: 0;
            border-bottom: 1px solid var(--widget-line);
          }
        }

        .wvn-group-title {
          margin: 0 0 0.65rem;
          font-size: 0.72rem;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--widget-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .wvn-group-title::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--widget-line);
        }

        .wvn-param-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .wvn-param {
          margin: 0;
          padding: 0;
          border: 0;
        }
        .wvn-param-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.3rem;
        }
        .wvn-param legend {
          padding: 0;
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--widget-ink);
        }
        .wvn-param-hint {
          font-size: 0.75rem;
          color: var(--widget-muted);
          margin: 0 0 0.35rem;
        }

        .wvn-choices {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 3px;
          padding: 3px;
          border: 1px solid var(--widget-line);
          border-radius: 4px;
          background: var(--widget-surface);
        }
        .wvn-choice {
          appearance: none;
          border: 1px solid transparent;
          border-radius: 3px;
          background: transparent;
          color: var(--widget-muted);
          font: 500 0.76rem/1.25 var(--sans);
          padding: 0.45rem 0.45rem;
          min-height: 2.2rem;
          cursor: pointer;
          text-align: center;
          transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
        }
        .wvn-choice:hover {
          background: var(--widget-paper);
          color: var(--widget-ink);
        }
        .wvn-choice[aria-pressed="true"] {
          background: var(--widget-paper);
          background: color-mix(in srgb, var(--widget-accent) 10%, var(--widget-paper));
          border-color: var(--widget-accent);
          color: var(--widget-accent);
          font-weight: 600;
        }

        .wvn-result {
          padding: 1.1rem 1.15rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .wvn-verdict {
          padding: 0.9rem 1rem;
          border: 1px solid var(--widget-line);
          border-left: 3px solid var(--widget-accent);
          border-radius: 3px;
          background: var(--widget-surface);
        }
        .wvn-verdict-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.3rem;
        }
        .wvn-verdict-kicker {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--widget-muted);
        }
        .wvn-badge {
          font: 600 0.7rem/1 var(--mono);
          padding: 0.25rem 0.45rem;
          border-radius: 2px;
          border: 1px solid var(--widget-accent);
          color: var(--widget-accent);
          background: var(--widget-paper);
        }
        .wvn-winner {
          margin: 0 0 0.25rem;
          font-size: 1.25rem;
          font-weight: 650;
          letter-spacing: -0.025em;
          color: var(--widget-ink);
        }
        .wvn-winner-desc {
          margin: 0;
          font-size: 0.82rem;
          color: var(--widget-muted);
        }

        .wvn-scores {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .wvn-score-row {
          display: grid;
          grid-template-columns: 6.75rem 1fr 2.4rem;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.8rem;
        }
        .wvn-score-name {
          font-weight: 500;
          color: var(--widget-muted);
        }
        .wvn-score-row[data-winner="true"] .wvn-score-name,
        .wvn-score-row[data-winner="true"] .wvn-score-val {
          color: var(--widget-ink);
          font-weight: 650;
        }
        .wvn-bar-track {
          height: 0.55rem;
          background: var(--widget-surface);
          border: 1px solid var(--widget-line);
          border-radius: 2px;
          overflow: hidden;
        }
        .wvn-bar-fill {
          height: 100%;
          background: var(--widget-muted);
          transition: width 0.2s ease;
        }
        .wvn-score-row[data-winner="true"] .wvn-bar-fill {
          background: var(--widget-accent);
        }
        .wvn-score-val {
          font-family: var(--mono);
          font-size: 0.75rem;
          text-align: right;
          color: var(--widget-muted);
        }

        .wvn-section-heading {
          margin: 0 0 0.4rem;
          font-size: 0.73rem;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--widget-muted);
        }
        .wvn-reasons {
          margin: 0;
          padding-left: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.82rem;
        }
        .wvn-flip {
          margin: 0;
          padding: 0.65rem 0.8rem;
          border: 1px dashed var(--widget-line);
          border-radius: 3px;
          font-size: 0.8rem;
          color: var(--widget-muted);
          background: var(--widget-paper);
        }
        .wvn-flip strong {
          color: var(--widget-ink);
          font-weight: 600;
        }
        .wvn-boundary {
          padding: 0.7rem 0.85rem;
          border: 1px solid var(--widget-line);
          border-radius: 3px;
          background: var(--widget-surface);
          font-size: 0.79rem;
        }
        .wvn-boundary ul {
          margin: 0.35rem 0 0;
          padding-left: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .wvn-boundary[hidden] { display: none; }
      </style>
      <div class="wvn">
        <div class="wvn-head">
          <p class="wvn-title"></p>
          <div class="wvn-presets" role="group" aria-label="Example scenarios">
            <span class="wvn-preset-label">Presets</span>
          </div>
        </div>
        <div class="wvn-body">
          <div class="wvn-controls">
            <section class="wvn-group" data-group="hard">
              <p class="wvn-group-title">Hard requirements</p>
              <div class="wvn-param-list"></div>
            </section>
            <section class="wvn-group" data-group="context">
              <p class="wvn-group-title">Feature &amp; team context</p>
              <div class="wvn-param-list"></div>
            </section>
          </div>
          <div class="wvn-result" aria-live="polite">
            <div class="wvn-verdict">
              <div class="wvn-verdict-top">
                <span class="wvn-verdict-kicker">Recommended option</span>
                <span class="wvn-badge" data-badge></span>
              </div>
              <p class="wvn-winner" data-winner></p>
              <p class="wvn-winner-desc" data-winner-desc></p>
            </div>
            <div class="wvn-scores" data-scores></div>
            <div>
              <p class="wvn-section-heading">What drives this choice</p>
              <ul class="wvn-reasons" data-reasons></ul>
            </div>
            <p class="wvn-flip" data-flip></p>
            <div class="wvn-boundary" data-boundary hidden>
              <p class="wvn-section-heading">WebView boundary checklist</p>
              <ul>
                <li><strong>Navigation:</strong> own back stack, external links, and error/retry states natively.</li>
                <li><strong>Authentication:</strong> define token/cookie injection, expiry refresh, and logout clearing.</li>
                <li><strong>JS bridge:</strong> keep the contract narrow, versioned, and strictly origin-restricted.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('.wvn-title').textContent = title;

    // Build preset buttons.
    const presetsWrap = container.querySelector('.wvn-presets');
    const presetButtons = new Map();
    for (const [id, preset] of Object.entries(PRESETS)) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'wvn-preset-btn';
      btn.textContent = preset.label;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        state = normalizeParams(preset.values);
        render();
      }, { signal: listeners.signal });
      presetsWrap.append(btn);
      presetButtons.set(id, btn);
    }

    // Build parameter controls.
    const choiceButtons = new Map();
    for (const param of PARAMETERS) {
      const list = container.querySelector(`.wvn-group[data-group="${param.group}"] .wvn-param-list`);
      const fieldset = doc.createElement('fieldset');
      fieldset.className = 'wvn-param';

      const legend = doc.createElement('legend');
      legend.textContent = param.label;

      const hint = doc.createElement('p');
      hint.className = 'wvn-param-hint';
      hint.textContent = param.hint;

      const choicesDiv = doc.createElement('div');
      choicesDiv.className = 'wvn-choices';
      choicesDiv.setAttribute('role', 'group');
      choicesDiv.setAttribute('aria-label', param.label);

      const buttonsForParam = new Map();
      for (const choice of param.choices) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'wvn-choice';
        btn.textContent = choice.label;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
          state = { ...state, [param.key]: choice.value };
          render();
        }, { signal: listeners.signal });
        choicesDiv.append(btn);
        buttonsForParam.set(choice.value, btn);
      }

      fieldset.append(legend, hint, choicesDiv);
      list.append(fieldset);
      choiceButtons.set(param.key, buttonsForParam);
    }

    // Build score bars.
    const scoresWrap = container.querySelector('[data-scores]');
    const scoreRows = new Map();
    for (const opt of OPTIONS) {
      const row = doc.createElement('div');
      row.className = 'wvn-score-row';

      const name = doc.createElement('span');
      name.className = 'wvn-score-name';
      name.textContent = opt.short;

      const track = doc.createElement('div');
      track.className = 'wvn-bar-track';

      const fill = doc.createElement('div');
      fill.className = 'wvn-bar-fill';
      track.append(fill);

      const val = doc.createElement('span');
      val.className = 'wvn-score-val';

      row.append(name, track, val);
      scoresWrap.append(row);
      scoreRows.set(opt.id, { row, fill, val });
    }

    const badgeEl = container.querySelector('[data-badge]');
    const winnerEl = container.querySelector('[data-winner]');
    const winnerDescEl = container.querySelector('[data-winner-desc]');
    const reasonsEl = container.querySelector('[data-reasons]');
    const flipEl = container.querySelector('[data-flip]');
    const boundaryEl = container.querySelector('[data-boundary]');

    const optionById = new Map(OPTIONS.map(o => [o.id, o]));

    function render() {
      const activePreset = findMatchingPreset(state);
      for (const [id, btn] of presetButtons) {
        btn.setAttribute('aria-pressed', String(id === activePreset));
      }
      for (const [key, map] of choiceButtons) {
        for (const [value, btn] of map) {
          btn.setAttribute('aria-pressed', String(state[key] === value));
        }
      }

      const result = evaluateDecision(state);
      badgeEl.textContent = result.statusLabel;

      if (result.hasConflict) {
        winnerEl.textContent = 'System Browser + Native';
        winnerDescEl.textContent = 'Split the journey: handle third-party auth or checkout in the system browser, then return to a native screen for offline or hardware work.';
      } else {
        const winOpt = optionById.get(result.winner);
        winnerEl.textContent = winOpt.label;
        winnerDescEl.textContent = winOpt.summary;
      }

      for (const opt of OPTIONS) {
        const { row, fill, val } = scoreRows.get(opt.id);
        const score = result.scores[opt.id];
        row.dataset.winner = String(!result.hasConflict && opt.id === result.winner);
        fill.style.width = `${score}%`;
        val.textContent = `${score}`;
      }

      reasonsEl.textContent = '';
      for (const reason of result.reasons) {
        const li = doc.createElement('li');
        li.textContent = reason;
        reasonsEl.append(li);
      }

      flipEl.textContent = '';
      const strong = doc.createElement('strong');
      strong.textContent = 'What would flip this: ';
      flipEl.append(strong, doc.createTextNode(result.flipHint));

      boundaryEl.hidden = !result.showBoundary;
    }

    render();

    return () => {
      listeners.abort();
    };
  }
};
