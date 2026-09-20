/* Passive, opt-in diagnostics. Never changes editor content, selection or focus. */
(() => {
  if (new URLSearchParams(location.search).get('inputDiagnostic') !== '1' || document.getElementById('input-diagnostic-panel')) return;
  const storageKey = 'lexdeck-input-diagnostic-v1';
  const selector = '[data-input-diagnostic], .lex-editor-field[contenteditable="true"]';
  const events = ['keydown', 'keyup', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'focusin', 'focusout', 'pointerdown', 'pointerup'];
  const limit = 2000;
  const clip = value => typeof value === 'string' ? value.slice(0, 600) : null;
  let trials = [];
  try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) trials = saved.slice(-10); } catch { /* Recording still works without storage. */ }
  let active = null;
  let lastField = null;
  const ids = new WeakMap();
  let nextId = 1;
  const fieldOf = node => (node instanceof Element ? node : node?.parentElement)?.closest(selector) || null;
  const id = field => {
    if (!field) return null;
    if (!ids.has(field)) ids.set(field, field.getAttribute('data-input-diagnostic') || `editor-${nextId++}`);
    return ids.get(field);
  };
  const fieldState = field => field ? {
    id: id(field), connected: field.isConnected, tag: field.tagName,
    label: field.getAttribute('aria-label') || field.getAttribute('data-input-diagnostic'),
    text: clip('value' in field ? field.value : field.textContent),
    html: field.isContentEditable ? clip(field.innerHTML) : null,
    selectionStart: field.selectionStart ?? null, selectionEnd: field.selectionEnd ?? null,
  } : null;
  const point = (node, offset) => {
    const field = fieldOf(node);
    return { field: id(field), node: node?.nodeName || null, text: field ? clip(node?.textContent) : null, offset };
  };
  const state = field => {
    const selection = window.getSelection();
    return {
      target: fieldState(field), focused: id(fieldOf(document.activeElement)),
      previous: lastField && lastField !== field ? fieldState(lastField) : null,
      selection: selection ? { anchor: point(selection.anchorNode, selection.anchorOffset), focus: point(selection.focusNode, selection.focusOffset), collapsed: selection.isCollapsed } : null,
    };
  };
  const persist = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(trials)); return true; } catch { return false; }
  };
  const append = (trial, entry) => {
    if (!trial) return;
    if (trial.events.length >= limit) { trial.events.shift(); trial.dropped++; }
    trial.events.push({ ms: Math.round(performance.now() - trial.startedAt), ...entry });
  };
  const observer = new MutationObserver(records => {
    if (!active) return;
    const fields = new Set(records.map(record => fieldOf(record.target)).filter(Boolean));
    for (const field of fields) append(active, { type: 'dom-mutation', state: state(field) });
  });
  const observed = new WeakSet();
  const observe = field => {
    if (!field || observed.has(field)) return;
    observed.add(field);
    observer.observe(field, { subtree: true, childList: true, characterData: true });
  };
  const capture = event => {
    if (!active) return;
    const field = fieldOf(event.target);
    if (!field) return;
    observe(field);
    const trial = active;
    const entry = {
      type: event.type, trusted: event.isTrusted, key: event.key ?? null,
      code: event.code ?? null, keyCode: event.keyCode ?? null,
      inputType: event.inputType ?? null, data: clip(event.data),
      isComposing: event.isComposing ?? null, cancelable: event.cancelable,
      defaultPrevented: event.defaultPrevented, state: state(field),
    };
    if (typeof event.getTargetRanges === 'function') entry.ranges = Array.from(event.getTargetRanges(), range => ({ start: point(range.startContainer, range.startOffset), end: point(range.endContainer, range.endOffset) }));
    append(trial, entry);
    // Capture React/default-action results without intercepting any event.
    queueMicrotask(() => {
      if (active === trial) append(trial, { type: `${event.type}:after`, defaultPrevented: event.defaultPrevented, state: state(field) });
    });
    if (event.type === 'focusout') lastField = field;
  };
  for (const type of events) document.addEventListener(type, capture, { capture: true, passive: true });
  document.addEventListener('selectionchange', () => {
    if (!active) return;
    const field = fieldOf(document.activeElement);
    if (field) append(active, { type: 'selectionchange', state: state(field) });
  });
  window.addEventListener('pagehide', () => {
    if (active) active.ended = new Date().toISOString();
    persist();
  });

  const panel = document.createElement('aside');
  panel.id = 'input-diagnostic-panel';
  panel.setAttribute('aria-label', '입력 진단 기록기');
  panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;width:290px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:12px;background:#fff;color:#303236;border:1px solid #89739d;border-radius:12px;box-shadow:0 2px 12px #0002;font:13px/1.5 system-ui,sans-serif;';
  panel.innerHTML = '<strong>한글 입력 진단</strong><p data-status role="status" style="margin:4px 0">기록 대기 · 테스트 문구만 입력해 주세요.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-start>기록 시작</button><button type="button" data-stop disabled>기록 정지</button><button type="button" data-export>기록 파일 받기</button></div><div data-results hidden style="margin-top:8px"></div><button type="button" data-clear style="margin-top:8px">전체 기록 지우기</button>';
  for (const button of panel.querySelectorAll('button')) button.style.cssText = 'font:inherit;padding:6px;border:1px solid #ccc;border-radius:6px;background:#f5f2f9;color:#303236;';
  document.body.appendChild(panel);
  const status = panel.querySelector('[data-status]');
  const start = panel.querySelector('[data-start]');
  const stop = panel.querySelector('[data-stop]');
  const results = panel.querySelector('[data-results]');
  const finish = () => {
    if (!active) return;
    const trial = active;
    append(trial, { type: 'stop', state: state(fieldOf(document.activeElement)) });
    trial.ended = new Date().toISOString();
    active = null;
    start.disabled = false; stop.disabled = true;
    status.textContent = persist() ? `기록 정지 · ${trial.events.length}건 (총 ${trials.length}회)` : '저장소 사용 불가 · 이동 전에 기록 파일을 받아 주세요.';
    results.replaceChildren(); results.hidden = false;
    for (const name of trial.path.includes('/diagnostics/') ? ['A', 'B'] : ['C']) {
      const label = document.createElement('label');
      label.textContent = `${name} 결과 `;
      const select = document.createElement('select');
      select.style.cssText = 'font:inherit;padding:4px;margin-right:8px;';
      for (const value of ['미확인', '정상', '이전 글자 재등장']) { const option = document.createElement('option'); option.textContent = value; select.appendChild(option); }
      select.addEventListener('change', () => { trial.results[name] = select.value; persist(); });
      label.appendChild(select); results.appendChild(label);
    }
  };
  start.addEventListener('click', () => {
    active = {
      started: new Date().toISOString(), startedAt: performance.now(), path: location.pathname,
      userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      language: navigator.language, viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height },
      layout: matchMedia('(min-width: 768px)').matches ? 'wide' : 'narrow',
      results: {}, dropped: 0, events: [],
    };
    trials.push(active); trials = trials.slice(-10);
    lastField = null;
    document.querySelectorAll(selector).forEach(observe);
    append(active, { type: 'start' });
    start.disabled = true; stop.disabled = false; results.hidden = true;
    status.textContent = '기록 중 · 테스트 후 기록 정지를 눌러 주세요.';
  });
  stop.addEventListener('click', finish);
  panel.querySelector('[data-export]').addEventListener('click', () => {
    finish();
    const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), trials }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `lexdeck-input-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  panel.querySelector('[data-clear]').addEventListener('click', () => {
    active = null; trials = []; lastField = null;
    persist(); start.disabled = false; stop.disabled = true; results.hidden = true;
    status.textContent = '전체 기록을 지웠습니다.';
  });
})();
