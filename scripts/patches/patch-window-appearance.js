const fs = require('fs-extra');
const path = require('path');
let logger;
try {
  logger = require('../utils/logger');
} catch (_) {
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    success: (...args) => console.log('[SUCCESS]', ...args),
    dim: (...args) => console.log(' ', ...args)
  };
}

const APP_DIR = path.join(__dirname, '..', '..', 'app');

const ROUNDED_PRELOAD_INJECTION = `
// --- Zalo Linux Window Rounded Corners & Background Transparency ---
(function() {
  if (process.platform !== "linux") return;
  const { ipcRenderer } = require("electron");

  const styleId = "zalo-linux-rounded-style";
  function injectRoundedStyle() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = \`
      html {
        background-color: transparent !important;
        background: transparent !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        background-color: transparent !important;
        background: transparent !important;
        border-radius: 12px !important;
        clip-path: inset(0 round 12px) !important;
        overflow: hidden !important;
        /* No border: on the rounded corners its anti-aliased outer pixels lie
           outside the content, so a semi-transparent border shows as a light
           (dark theme) or grey (light theme) jagged ring over the desktop. */
        border: none !important;
      }

      html.is-maximized body,
      body.is-maximized {
        border-radius: 0px !important;
        clip-path: none !important;
        border: none !important;
      }

      #app,
      #loading-page {
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        background-color: var(--layer-background, #ffffff) !important;
      }

      html.dark #app,
      body.dark #app,
      html.dark #loading-page,
      body.dark #loading-page {
        background-color: var(--layer-background, #22262B) !important;
      }

      /* Render #app as one surface so the rounded body clip is applied once.
         Otherwise every layer is clipped on its own and the lower ones (the
         white/grey #app and #sidebarNav backgrounds) bleed through the
         anti-aliased edge of the sidebar: a pale ring on the rounded corners.
         #app covers the whole viewport at 0,0, so being the containing block
         for position:fixed popups does not move them. */
      html:not(.is-maximized) #app {
        filter: brightness(1.0001) !important;
      }

      #titleBar {
        height: 38px !important;
        min-height: 38px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        padding: 0 0 0 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        -webkit-app-region: no-drag !important;
        user-select: none !important;
        position: relative !important;
        z-index: 100 !important;
        cursor: default !important;
      }

      body:has(#main-tab) #titleBar,
      body:has(#sidebarNav) #titleBar {
        left: 64px !important;
        width: calc(100% - 64px) !important;
        max-width: calc(100% - 64px) !important;
      }

      #titleBar .title-drag {
        height: 38px !important;
        top: 0 !important;
        left: 0 !important;
        right: 60px !important;
        width: auto !important;
        -webkit-app-region: no-drag !important;
        cursor: default !important;
      }

      #titleBar .title-name {
        line-height: 38px !important;
        height: 38px !important;
        display: flex !important;
        align-items: center !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        -webkit-app-region: no-drag !important;
        user-select: none !important;
        cursor: default !important;
      }

      #container {
        height: calc(100% - 38px) !important;
        max-height: calc(100% - 38px) !important;
      }

      #sidebarNav {
        height: 100% !important;
      }

      /* Zalo pulls #container and #main-tab up 24px (its macOS title bar
         height). With the 38px title bar both must go up 38px and the sidebar
         grow by as much, otherwise #app shows above it (14px) and #sidebarNav
         below it (24px): white strips in light mode, grey in dark mode.
         #container clips its children (overflow: hidden), so it has to move
         too; its padding keeps the chat content below the title bar, and the
         sidebar's 14px padding keeps its icons where they were. */
      #container:not(.WEB) {
        margin-top: -38px !important;
        padding-top: 38px !important;
      }
      #main-tab:not(.WEB) {
        margin-top: -38px !important;
        height: calc(100% + 38px) !important;
      }
      html:not(:has(.title-bar-feature)) #main-tab:not(.WEB) {
        padding-top: 14px;
      }
      /* keep Zalo's own full-height layout when its system banner is shown */
      .use-system-banner:has(.system-banner__container) #container:not(.WEB) {
        margin-top: -56px !important;
        padding-top: 56px !important;
      }
      .use-system-banner:has(.system-banner__container) #main-tab:not(.WEB) {
        margin-top: 0px !important;
        height: 100vh !important;
      }

      .zalo-linux-tb-controls {
        display: flex !important;
        align-items: center !important;
        height: 100% !important;
        margin-left: auto !important;
        -webkit-app-region: no-drag !important;
        z-index: 1000 !important;
      }

      .zalo-linux-close-button {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        width: 48px !important;
        height: 38px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
        color: var(--text-secondary, #999999) !important;
        border-top-right-radius: 12px !important;
        transition: background-color 0.15s ease, color 0.15s ease !important;
      }

      .zalo-linux-close-button svg {
        width: 12px !important;
        height: 12px !important;
        display: block !important;
        pointer-events: none !important;
      }

      .zalo-linux-close-button:hover {
        background-color: #e81123 !important;
        color: #ffffff !important;
      }

      .zalo-linux-close-button:active {
        background-color: #c40e1d !important;
        color: #ffffff !important;
      }

      html.is-maximized .zalo-linux-close-button,
      body.is-maximized .zalo-linux-close-button {
        border-top-right-radius: 0px !important;
      }

      /* In child window: hide redundant top #titleBar, make chat header the titlebar */
      body.child-window #titleBar,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) #titleBar,
      .child-mode #titleBar,
      #titleBar:has(.child-mode) {
        display: none !important;
      }

      body.child-window #container,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) #container {
        margin-top: 0px !important;
        padding-top: 0px !important;
        height: 100% !important;
        max-height: 100% !important;
      }

      body.child-window header#header,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header {
        height: 54px !important;
        min-height: 54px !important;
        padding-right: 48px !important;
        -webkit-app-region: no-drag !important;
        border-top-left-radius: 12px !important;
        border-top-right-radius: 12px !important;
        user-select: none !important;
        cursor: default !important;
      }

      body.child-window header#header *,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header * {
        -webkit-app-region: no-drag !important;
      }

      body.child-window header#header .threadChat,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header .threadChat {
        -webkit-app-region: no-drag !important;
        user-select: none !important;
        cursor: default !important;
      }

      body.child-window #headerBtns,
      body:not(:has(#main-tab)):not(:has(#sidebarNav)) #headerBtns {
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        -webkit-app-region: no-drag !important;
      }

      #zalo-linux-child-close-btn {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 48px !important;
        height: 54px !important;
        min-height: 54px !important;
        z-index: 99999 !important;
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
        color: var(--text-secondary, #999999) !important;
        border-top-right-radius: 12px !important;
        transition: background-color 0.15s ease, color 0.15s ease !important;
      }

      #zalo-linux-child-close-btn svg {
        width: 12px !important;
        height: 12px !important;
        display: block !important;
        pointer-events: none !important;
      }

      #zalo-linux-child-close-btn:hover {
        background-color: #e81123 !important;
        color: #ffffff !important;
      }

      #zalo-linux-child-close-btn:active {
        background-color: #c40e1d !important;
        color: #ffffff !important;
      }

      html.is-maximized #zalo-linux-child-close-btn,
      body.is-maximized #zalo-linux-child-close-btn {
        border-top-right-radius: 0px !important;
      }

      html.is-maximized body.child-window header#header,
      html.is-maximized body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header {
        border-top-left-radius: 0px !important;
        border-top-right-radius: 0px !important;
      }

      /* Light/dark switch next to the close button. Id selectors and
         !important keep Zalo's global button styles off it. */
      #zalo-linux-theme-toggle {
        -webkit-app-region: no-drag !important;
        appearance: none !important;
        display: flex !important;
        align-items: center !important;
        height: 38px !important;
        padding: 0 8px !important;
        margin: 0 2px 0 0 !important;
        border: none !important;
        background: transparent !important;
        outline: none !important;
        cursor: pointer !important;
      }
      #zalo-linux-theme-toggle[hidden] {
        display: none !important;
      }
      #zalo-linux-theme-toggle .zl-theme-track {
        position: relative;
        width: 34px;
        height: 20px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.14);
        transition: background-color 0.22s ease;
      }
      #zalo-linux-theme-toggle:hover .zl-theme-track {
        background: rgba(0, 0, 0, 0.2);
      }
      #zalo-linux-theme-toggle .zl-theme-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffffff;
        color: #f59e0b;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.22s ease, color 0.22s ease;
      }
      #zalo-linux-theme-toggle .zl-theme-thumb svg {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 10px;
        height: 10px;
        transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #zalo-linux-theme-toggle .zl-moon {
        opacity: 0;
        transform: rotate(-90deg) scale(0.5);
      }
      #zalo-linux-theme-toggle.is-dark .zl-theme-track {
        background: rgba(255, 255, 255, 0.18);
      }
      #zalo-linux-theme-toggle.is-dark:hover .zl-theme-track {
        background: rgba(255, 255, 255, 0.26);
      }
      #zalo-linux-theme-toggle.is-dark .zl-theme-thumb {
        transform: translateX(14px);
        background: #e6e9ed;
        color: #2b3138;
      }
      #zalo-linux-theme-toggle.is-dark .zl-sun {
        opacity: 0;
        transform: rotate(90deg) scale(0.5);
      }
      #zalo-linux-theme-toggle.is-dark .zl-moon {
        opacity: 1;
        transform: none;
      }
      #zalo-linux-theme-toggle:focus-visible .zl-theme-track {
        outline: 2px solid #0068ff;
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        #zalo-linux-theme-toggle .zl-theme-track,
        #zalo-linux-theme-toggle .zl-theme-thumb,
        #zalo-linux-theme-toggle .zl-theme-thumb svg {
          transition: none !important;
        }
      }
    \`;
    (document.head || document.documentElement).appendChild(style);
  }

  function adjustTitleBarLayout() {
    const tb = document.getElementById("titleBar");
    if (!tb) return;
    const hasSideTab = document.getElementById("main-tab") || document.getElementById("sidebarNav");
    const offset = hasSideTab ? 64 : (tb.offsetLeft || 0);
    if (offset > 0) {
      tb.style.setProperty("left", offset + "px", "important");
      tb.style.setProperty("width", "calc(100% - " + offset + "px)", "important");
      tb.style.setProperty("max-width", "calc(100% - " + offset + "px)", "important");
    } else {
      tb.style.setProperty("left", "0px", "important");
      tb.style.setProperty("width", "100%", "important");
      tb.style.setProperty("max-width", "100%", "important");
    }
  }

  function ensureCloseButton() {
    const isChildWindow = !document.getElementById("main-tab") && !document.getElementById("sidebarNav") && (window.location.href.includes("child") || window.__ZaBUNDLENAME__ === "child" || !!document.getElementById("header"));

    if (isChildWindow) {
      document.documentElement.classList.add("child-window");
      if (document.body) document.body.classList.add("child-window");

      const topTb = document.getElementById("titleBar");
      if (topTb) {
        topTb.style.setProperty("display", "none", "important");
      }

      if (document.getElementById("zalo-linux-child-close-btn")) return;

      const closeBtn = document.createElement("button");
      closeBtn.id = "zalo-linux-child-close-btn";
      closeBtn.className = "zalo-linux-close-button";
      closeBtn.title = "Đóng";
      closeBtn.setAttribute("aria-label", "Đóng");
      closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          ipcRenderer.send("zalo-window-close");
        } catch (_) {
          window.close();
        }
      });

      document.body.appendChild(closeBtn);
      return;
    }

    const tb = document.getElementById("titleBar");
    if (!tb) return;
    adjustTitleBarLayout();
    if (document.getElementById("zalo-linux-titlebar-controls")) return;

    const controls = document.createElement("div");
    controls.id = "zalo-linux-titlebar-controls";
    controls.className = "zalo-linux-tb-controls";

    const closeBtn = document.createElement("button");
    closeBtn.id = "zalo-linux-close-btn";
    closeBtn.className = "zalo-linux-close-button";
    closeBtn.title = "Đóng";
    closeBtn.setAttribute("aria-label", "Đóng");
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        ipcRenderer.send("zalo-window-close");
      } catch (_) {
        window.close();
      }
    });

    controls.appendChild(createThemeToggle());
    controls.appendChild(closeBtn);
    tb.appendChild(controls);
  }

  // Light/dark switch. Click pins the opposite theme, right-click returns to
  // following the desktop. The main process owns the mode (patch-auto-theme)
  // and broadcasts the change, so the switch only mirrors html.dark. Hidden
  // in windows whose main process does not answer (no theme IPC there).
  function createThemeToggle() {
    const tgl = document.createElement("button");
    tgl.id = "zalo-linux-theme-toggle";
    tgl.type = "button";
    tgl.hidden = true;
    tgl.setAttribute("role", "switch");
    tgl.setAttribute("aria-label", "Giao diện tối");
    tgl.innerHTML = '<span class="zl-theme-track"><span class="zl-theme-thumb">' +
      '<svg class="zl-sun" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.3" fill="currentColor"/>' +
      '<path d="M6 .9v1.2M6 9.9v1.2M.9 6h1.2M9.9 6h1.2M2.4 2.4l.85.85M8.75 8.75l.85.85M2.4 9.6l.85-.85M8.75 3.25l.85-.85" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' +
      '<svg class="zl-moon" viewBox="0 0 12 12" aria-hidden="true"><path d="M10 7.7A4.4 4.4 0 0 1 4.3 2a4.4 4.4 0 1 0 5.7 5.7z" fill="currentColor"/></svg>' +
      '</span></span>';

    let mode = "system";
    const isDark = () => document.documentElement.classList.contains("dark");
    const render = () => {
      const dark = isDark();
      tgl.classList.toggle("is-dark", dark);
      tgl.setAttribute("aria-checked", dark ? "true" : "false");
      tgl.title = (dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối") +
        (mode === "system" ? " (đang theo hệ thống)" : " · chuột phải: theo hệ thống");
    };
    const apply = (state) => {
      if (state && state.mode) mode = state.mode;
      render();
    };
    const setMode = (next) => ipcRenderer.invoke("zalo-linux-set-theme-mode", next).then(apply).catch(() => {});

    tgl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMode(isDark() ? "light" : "dark");
    });
    tgl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMode("system");
    });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    ipcRenderer.invoke("zalo-linux-get-theme-mode").then((state) => {
      tgl.hidden = false;
      apply(state);
    }).catch(() => tgl.remove());
    return tgl;
  }

  function handleMaximized(isMax) {
    if (isMax) {
      document.documentElement.classList.add("is-maximized");
      if (document.body) document.body.classList.add("is-maximized");
    } else {
      document.documentElement.classList.remove("is-maximized");
      if (document.body) document.body.classList.remove("is-maximized");
    }
  }

  ipcRenderer.on("zalo-window-maximized", (e, isMax) => {
    handleMaximized(isMax);
  });

  try {
    ipcRenderer.invoke("zalo-get-maximized-state").then((isMax) => {
      if (isMax) handleMaximized(true);
    }).catch(() => {});
  } catch (_) {}

  function attachDrag(el) {
    if (!el || el.__zalo_drag_attached) return;
    el.__zalo_drag_attached = true;

    let isDragging = false;
    let startScreenX = 0;
    let startScreenY = 0;

    function stopDrag(e) {
      if (isDragging) {
        isDragging = false;
        try {
          if (e && e.pointerId !== undefined) {
            el.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        ipcRenderer.send("zalo-window-drag-end");
      }
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, [role='button'], .clickable, #headerBtns, .zalo-linux-close-button, #zalo-linux-theme-toggle")) {
        return;
      }
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      isDragging = true;
      startScreenX = e.screenX;
      startScreenY = e.screenY;
      ipcRenderer.send("zalo-window-drag-start");
    });

    el.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const deltaX = e.screenX - startScreenX;
      const deltaY = e.screenY - startScreenY;
      ipcRenderer.send("zalo-window-drag-move", { deltaX, deltaY });
    });

    el.addEventListener("pointerup", stopDrag);
    el.addEventListener("pointercancel", stopDrag);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    el.addEventListener("dblclick", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, [role='button'], .clickable, #headerBtns, .zalo-linux-close-button, #zalo-linux-theme-toggle")) {
        return;
      }
      ipcRenderer.send("zalo-window-toggle-maximize");
    });
  }

  function setupDraggableHeaders() {
    const tb = document.getElementById("titleBar");
    if (tb) attachDrag(tb);

    const hdr = document.getElementById("header");
    if (hdr) attachDrag(hdr);
  }

  function initUI() {
    injectRoundedStyle();
    adjustTitleBarLayout();
    ensureCloseButton();
    setupDraggableHeaders();
    try {
      const observer = new MutationObserver(() => {
        adjustTitleBarLayout();
        ensureCloseButton();
        setupDraggableHeaders();
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
`;

// Child ("Mở cửa sổ riêng") windows come from window.open() and live in the
// main window's renderer process. Giving them the full preload-render.js made
// that shared renderer re-run Zalo's whole bootstrap inside window.open() and
// deadlock: the child stayed loading forever and the main window froze. They
// get a preload that carries only the Linux window chrome (close button, drag,
// rounded corners) instead.
const CHILD_PRELOAD_FILE = 'preload-child-linux.js';
const CHILD_PRELOAD_EXPR = 'require("path").join(__dirname,"' + CHILD_PRELOAD_FILE + '")';
const OLD_CHILD_PRELOAD_EXPR = 'require("path").join(__dirname,"preload-render.js")';

function useChildPreload(content) {
  return content.split('{preload:' + OLD_CHILD_PRELOAD_EXPR + '}').join('{preload:' + CHILD_PRELOAD_EXPR + '}');
}

const SUPPRESS_SET_BG_CODE = `
// --- Zalo Linux Window Background Transparency Preservation ---
try {
  const { BrowserWindow: _zBW } = require('electron');
  if (_zBW && _zBW.prototype && !_zBW.prototype.__zalo_bg_suppressed) {
    _zBW.prototype.__zalo_bg_suppressed = true;
    _zBW.prototype.setBackgroundColor = function(_color) {
      // Suppress on Linux so transparent window corners never get filled with opaque background
    };
  }
} catch (_) {}
`;

// Matches every IPC block this patch has ever appended to main.js (their
// closing `} catch (_) {}` is the only one at column 0).
const MAIN_IPC_BLOCK_RE = /\n*try \{\n  const \{ ipcMain: _zIpc, BrowserWindow: _zBW \} = require\('electron'\);[\s\S]*?\n\} catch \(_\) \{\}\n?/g;

const MAIN_IPC_BLOCK = `
try {
  const { ipcMain: _zIpc, BrowserWindow: _zBW } = require('electron');
  _zIpc.removeHandler('zalo-get-maximized-state');
  _zIpc.handle('zalo-get-maximized-state', (ev) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      return win ? win.isMaximized() : false;
    } catch (_) { return false; }
  });
  _zIpc.removeAllListeners('zalo-window-close');
  _zIpc.on('zalo-window-close', (ev) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      if (win && !win.isDestroyed()) win.close();
    } catch (_) {}
  });
  _zIpc.removeAllListeners('zalo-window-drag-start');
  _zIpc.on('zalo-window-drag-start', (ev) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      if (win && !win.isDestroyed()) {
        win.__dragStartPos = win.getPosition();
      }
    } catch (_) {}
  });
  _zIpc.removeAllListeners('zalo-window-drag-move');
  _zIpc.on('zalo-window-drag-move', (ev, data) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      if (win && !win.isDestroyed() && !win.isMaximized()) {
        if (!win.__dragStartPos) {
          win.__dragStartPos = win.getPosition();
        }
        const [startX, startY] = win.__dragStartPos;
        win.setPosition(Math.round(startX + data.deltaX), Math.round(startY + data.deltaY));
      }
    } catch (_) {}
  });
  _zIpc.removeAllListeners('zalo-window-drag-end');
  _zIpc.on('zalo-window-drag-end', (ev) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      if (win) {
        win.__dragStartPos = null;
      }
    } catch (_) {}
  });
  _zIpc.removeAllListeners('zalo-window-toggle-maximize');
  _zIpc.on('zalo-window-toggle-maximize', (ev) => {
    try {
      const win = _zBW.fromWebContents(ev.sender);
      if (win && !win.isDestroyed()) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      }
    } catch (_) {}
  });
  // Tray host probe: the main window close handler hides to tray only when
  // a StatusNotifier host exists; otherwise it quits.
  if (process.platform === 'linux') {
    const { execFile: _zExec } = require('child_process');
    const _zName = 'org.kde.StatusNotifierWatcher';
    const _zProbe = () => {
      _zExec('gdbus', ['call', '--session', '--dest', 'org.freedesktop.DBus',
        '--object-path', '/org/freedesktop/DBus',
        '--method', 'org.freedesktop.DBus.NameHasOwner', _zName], { timeout: 3000 }, (err, out) => {
        if (!err) { global.__zaloTrayHost = /true/.test(String(out)); return; }
        _zExec('dbus-send', ['--session', '--print-reply', '--dest=org.freedesktop.DBus',
          '/org/freedesktop/DBus', 'org.freedesktop.DBus.NameHasOwner', 'string:' + _zName],
          { timeout: 3000 }, (err2, out2) => {
            global.__zaloTrayHost = !err2 && /boolean true/.test(String(out2));
          });
      });
    };
    global.__zaloTrayHost = false;
    _zProbe();
    setInterval(_zProbe, 60000).unref();
  }
} catch (_) {}
`;

async function main() {
  const mainDistDir = path.join(APP_DIR, 'main-dist');
  const pcDistDir = path.join(APP_DIR, 'pc-dist');

  // 1. Patch main-dist/main.js
  const mainJsPath = path.join(mainDistDir, 'main.js');
  if (fs.existsSync(mainJsPath)) {
    let content = fs.readFileSync(mainJsPath, 'utf8');
    let changed = false;

    // Suppress setBackgroundColor globally at the top
    if (!content.includes('__zalo_bg_suppressed')) {
      content = SUPPRESS_SET_BG_CODE + '\n' + content;
      changed = true;
      logger.dim('Injected global setBackgroundColor suppression in main.js');
    }

    // Remove auto-open DevTools and console logger
    const devtoolsPattern = ';Ae.webContents.openDevTools({mode:"detach"});Ae.webContents.on("console-message",(e,l,m,ln,s)=>{try{require("fs").appendFileSync("/tmp/zalo-sync-debug.log",`[R-${l}] ${m}\\n`)}catch(_){};console.log(`[R-${l}] ${m}`)});';
    if (content.includes(devtoolsPattern)) {
      content = content.replace(devtoolsPattern, '');
      changed = true;
      logger.dim('Removed auto-open DevTools call from main.js');
    } else if (content.includes(';Ae.webContents.openDevTools({mode:"detach"});')) {
      content = content.replace(';Ae.webContents.openDevTools({mode:"detach"});', ';');
      changed = true;
      logger.dim('Removed detached DevTools call from main.js');
    }

    // Set transparent: true and transparent background on BrowserWindow options
    const bgPattern = 'backgroundColor:(null==r||null===(e=r.color)||void 0===e?void 0:e.backgroundPrimary)||"#ffffff",show:!1';
    if (content.includes(bgPattern)) {
      content = content.replace(bgPattern, 'transparent:!0,backgroundColor:"#00000000",hasShadow:!1,show:!1');
      changed = true;
      logger.dim('Configured transparent BrowserWindow options in main.js');
    }

    // Prevent k.setBackgroundColor(r) from ruining transparency
    const setBgPattern = 'return r&&k.setBackgroundColor(r),k';
    if (content.includes(setBgPattern)) {
      content = content.replace(setBgPattern, 'return k');
      changed = true;
      logger.dim('Suppressed opaque window setBackgroundColor in main.js');
    }

    // Prevent Ae.setBackgroundColor(r) and e.setBackgroundColor(i) from ruining transparency
    if (content.includes('r&&Ae.setBackgroundColor(r)')) {
      content = content.replace('r&&Ae.setBackgroundColor(r)', 'null');
      changed = true;
      logger.dim('Suppressed Ae.setBackgroundColor in main.js');
    }
    if (content.includes('i&&e.setBackgroundColor(i)')) {
      content = content.replace('i&&e.setBackgroundColor(i)', 'null');
      changed = true;
      logger.dim('Suppressed e.setBackgroundColor in main.js');
    }

    // Hook window maximize / unmaximize events to notify renderer and capture window render
    const listenerPattern = '_setupDefaultWindowListener(e){';
    if (content.includes(listenerPattern) && !content.includes('zalo-window-maximized')) {
      content = content.replace(
        listenerPattern,
        listenerPattern + 'e.on("maximize",(()=>{try{e.webContents.send("zalo-window-maximized",!0)}catch(_){}})),e.on("unmaximize",(()=>{try{e.webContents.send("zalo-window-maximized",!1)}catch(_){}})),'
      );
      changed = true;
      logger.dim('Added maximize/unmaximize listeners in main.js');
    }

    // IPC for the maximized state and the custom close button. Strip every
    // earlier injected copy first: a second ipcMain.handle() on the same
    // channel throws (eventNames() does not list invoke handlers), which
    // aborted the block before 'zalo-window-close' was ever registered.
    const withoutOldIpc = content.replace(MAIN_IPC_BLOCK_RE, '').trimEnd();
    const withIpc = withoutOldIpc + '\n' + MAIN_IPC_BLOCK;
    if (withIpc !== content) {
      content = withIpc;
      changed = true;
      logger.dim('Installed window IPC handlers (maximize state, close button, tray probe) in main.js');
    }

    // Without a tray host (stock GNOME has none) Zalo's hide-on-close leaves
    // an invisible window nobody can bring back, so quit instead.
    const hideOnCloseRe = /([$\w]+)\.appIsQuitting\|\|\(e\.preventDefault\(\),"darwin"===process\.platform&&([$\w]+)\.isFullScreen\(\)\?/;
    if (!content.includes('!global.__zaloTrayHost?')) {
      if (hideOnCloseRe.test(content)) {
        content = content.replace(hideOnCloseRe, '$1.appIsQuitting||(e.preventDefault(),"linux"===process.platform&&!global.__zaloTrayHost?$1.quit():"darwin"===process.platform&&$2.isFullScreen()?');
        changed = true;
        logger.dim('Main window close quits when no tray host is available');
      } else {
        logger.warn('Main window close handler not found; hide-on-close left unchanged');
      }
    }

    // Patch child window options in main.js
    const childOptsNeedle = 't&&(this.childOpts=t,this.childOpts.modal=!0,this.childOpts.frame=!0)';
    const childOptsReplacement = 't&&(this.childOpts=t,this.childOpts.modal=!1,this.childOpts.frame=!1,this.childOpts.transparent=!0,this.childOpts.backgroundColor="#00000000",this.childOpts.hasShadow=!1,this.childOpts.titleBarStyle="hidden",this.childOpts.webPreferences=Object.assign({},(this.mainOpts&&this.mainOpts.webPreferences)||{},{preload:'+CHILD_PRELOAD_EXPR+'}))';
    if (content.includes(childOptsNeedle)) {
      content = content.replace(childOptsNeedle, childOptsReplacement);
      changed = true;
      logger.dim('Patched childOpts in setUpConfiguration (main.js)');
    }

    const winOpenNeedle = 'overrideBrowserWindowOptions:r(r(r({frame:!1,show:!1,titleBarStyle:"hidden",resizable:!0,transparent:!0,backgroundColor:"#00000000",hasShadow:!1},e),this.childOpts),this.childWindowSize)}}';
    const winOpenReplacement = 'overrideBrowserWindowOptions:r(r(r(r({frame:!1,show:!1,titleBarStyle:"hidden",resizable:!0,transparent:!0,backgroundColor:"#00000000",hasShadow:!1},e),this.childOpts),this.childWindowSize),{frame:!1,transparent:!0,backgroundColor:"#00000000",hasShadow:!1,titleBarStyle:"hidden",webPreferences:Object.assign({},(this.mainOpts&&this.mainOpts.webPreferences)||{},{preload:'+CHILD_PRELOAD_EXPR+'})})}}';
    if (content.includes(winOpenNeedle)) {
      content = content.replace(winOpenNeedle, winOpenReplacement);
      changed = true;
      logger.dim('Patched overrideBrowserWindowOptions for child windows (main.js)');
    }

    const setupWinNeedle = '_setupWindowEvent(e,t){if(f(e),e){';
    const setupWinReplacement = '_setupWindowEvent(e,t){if(f(e),e){try{e.removeMenu&&e.removeMenu();e.setMenuBarVisibility&&e.setMenuBarVisibility(!1);e.autoHideMenuBar=!0}catch(_){};e.on("maximize",(()=>{try{e.webContents.send("zalo-window-maximized",!0)}catch(_){}}));e.on("unmaximize",(()=>{try{e.webContents.send("zalo-window-maximized",!1)}catch(_){}}));';
    if (content.includes(setupWinNeedle) && !content.includes('e.removeMenu&&e.removeMenu()')) {
      content = content.replace(setupWinNeedle, setupWinReplacement);
      changed = true;
      logger.dim('Added maximize/unmaximize and menu suppression to _setupWindowEvent (main.js)');
    }

    const withChildPreload = useChildPreload(content);
    if (withChildPreload !== content) {
      content = withChildPreload;
      changed = true;
      logger.dim('Child windows use ' + CHILD_PRELOAD_FILE + ' instead of preload-render.js (main.js)');
    }

    if (changed) {
      fs.writeFileSync(mainJsPath, content, 'utf8');
      logger.success('Patched main.js for Linux window appearance, close button and disabled DevTools startup');
    }
  }

  // 2. Patch main-dist/compact-app.js
  const compactJsPath = path.join(mainDistDir, 'compact-app.js');
  if (fs.existsSync(compactJsPath)) {
    let content = fs.readFileSync(compactJsPath, 'utf8');
    let changed = false;

    if (!content.includes('__zalo_bg_suppressed')) {
      content = SUPPRESS_SET_BG_CODE + '\n' + content;
      changed = true;
      logger.dim('Injected global setBackgroundColor suppression in compact-app.js');
    }

    const bgPattern = 'backgroundColor:(null==r||null===(e=r.color)||void 0===e?void 0:e.backgroundPrimary)||"#ffffff",show:!1';
    if (content.includes(bgPattern)) {
      content = content.replace(bgPattern, 'transparent:!0,backgroundColor:"#00000000",hasShadow:!1,show:!1');
      changed = true;
    }

    const setBgPattern = 'return r&&k.setBackgroundColor(r),k';
    if (content.includes(setBgPattern)) {
      content = content.replace(setBgPattern, 'return k');
      changed = true;
    }

    if (content.includes('r&&Ae.setBackgroundColor(r)')) {
      content = content.replace('r&&Ae.setBackgroundColor(r)', 'null');
      changed = true;
    }
    if (content.includes('i&&e.setBackgroundColor(i)')) {
      content = content.replace('i&&e.setBackgroundColor(i)', 'null');
      changed = true;
    }

    const withoutOldIpc = content.replace(MAIN_IPC_BLOCK_RE, '').trimEnd();
    const withIpc = withoutOldIpc + '\n' + MAIN_IPC_BLOCK;
    if (withIpc !== content) {
      content = withIpc;
      changed = true;
      logger.dim('Installed window IPC handlers in compact-app.js');
    }

    // Patch child window options in compact-app.js
    const childOptsNeedle = 't&&(this.childOpts=t,this.childOpts.modal=!0,this.childOpts.frame=!0)';
    const childOptsReplacement = 't&&(this.childOpts=t,this.childOpts.modal=!1,this.childOpts.frame=!1,this.childOpts.transparent=!0,this.childOpts.backgroundColor="#00000000",this.childOpts.hasShadow=!1,this.childOpts.titleBarStyle="hidden",this.childOpts.webPreferences=Object.assign({},(this.mainOpts&&this.mainOpts.webPreferences)||{},{preload:'+CHILD_PRELOAD_EXPR+'}))';
    if (content.includes(childOptsNeedle)) {
      content = content.replace(childOptsNeedle, childOptsReplacement);
      changed = true;
      logger.dim('Patched childOpts in setUpConfiguration (compact-app.js)');
    }

    const winOpenNeedle = 'overrideBrowserWindowOptions:r(r(r({frame:!1,show:!1,titleBarStyle:"hidden",resizable:!0,transparent:!0,backgroundColor:"#00000000",hasShadow:!1},e),this.childOpts),this.childWindowSize)}}';
    const winOpenReplacement = 'overrideBrowserWindowOptions:r(r(r(r({frame:!1,show:!1,titleBarStyle:"hidden",resizable:!0,transparent:!0,backgroundColor:"#00000000",hasShadow:!1},e),this.childOpts),this.childWindowSize),{frame:!1,transparent:!0,backgroundColor:"#00000000",hasShadow:!1,titleBarStyle:"hidden",webPreferences:Object.assign({},(this.mainOpts&&this.mainOpts.webPreferences)||{},{preload:'+CHILD_PRELOAD_EXPR+'})})}}';
    if (content.includes(winOpenNeedle)) {
      content = content.replace(winOpenNeedle, winOpenReplacement);
      changed = true;
      logger.dim('Patched overrideBrowserWindowOptions for child windows (compact-app.js)');
    }

    const setupWinNeedle = '_setupWindowEvent(e,t){if(f(e),e){';
    const setupWinReplacement = '_setupWindowEvent(e,t){if(f(e),e){try{e.removeMenu&&e.removeMenu();e.setMenuBarVisibility&&e.setMenuBarVisibility(!1);e.autoHideMenuBar=!0}catch(_){};e.on("maximize",(()=>{try{e.webContents.send("zalo-window-maximized",!0)}catch(_){}}));e.on("unmaximize",(()=>{try{e.webContents.send("zalo-window-maximized",!1)}catch(_){}}));';
    if (content.includes(setupWinNeedle) && !content.includes('e.removeMenu&&e.removeMenu()')) {
      content = content.replace(setupWinNeedle, setupWinReplacement);
      changed = true;
      logger.dim('Added maximize/unmaximize and menu suppression to _setupWindowEvent (compact-app.js)');
    }

    const withChildPreload = useChildPreload(content);
    if (withChildPreload !== content) {
      content = withChildPreload;
      changed = true;
      logger.dim('Child windows use ' + CHILD_PRELOAD_FILE + ' instead of preload-render.js (compact-app.js)');
    }

    if (changed) {
      fs.writeFileSync(compactJsPath, content, 'utf8');
      logger.success('Patched compact-app.js for Linux window appearance');
    }
  }

  // 3. Patch index.html & login.html to prevent body background fill
  const htmlFiles = ['index.html', 'login.html', 'child.html'].map(f => path.join(pcDistDir, f));
  for (const htmlPath of htmlFiles) {
    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      let changed = false;

      // Disable body.style.background assignment
      if (content.includes('document.body.style.background = bgColorDark;')) {
        content = content.replace(
          'document.body.style.background = bgColorDark;',
          '/* transparent body */'
        );
        changed = true;
      }
      if (content.includes('document.body.style.background = bgColorDark')) {
        content = content.replace(
          'document.body.style.background = bgColorDark',
          '/* transparent body */'
        );
        changed = true;
      }

      // Ensure inline style doesn't have an opaque body background and has full rounded styles
      const fullInlineStyle = '<style id="zalo-transparent-base">' +
        'html{background:transparent !important;background-color:transparent !important;overflow:hidden !important;margin:0 !important;padding:0 !important;width:100% !important;height:100% !important;}' +
        'body{margin:0 !important;padding:0 !important;width:100% !important;height:100% !important;box-sizing:border-box !important;background:transparent !important;background-color:transparent !important;border-radius:12px !important;clip-path:inset(0 round 12px) !important;overflow:hidden !important;border:none !important;}' +
        'html.is-maximized body,body.is-maximized{border-radius:0px !important;clip-path:none !important;border:none !important;}' +
        '#app,#loading-page{width:100% !important;height:100% !important;box-sizing:border-box !important;background-color:var(--layer-background,#ffffff) !important;}' +
        'html.dark #app,body.dark #app,html.dark #loading-page,body.dark #loading-page{background-color:var(--layer-background,#22262B) !important;}' +
        'html:not(.is-maximized) #app{filter:brightness(1.0001) !important;}' +
        '#titleBar{height:38px !important;min-height:38px !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important;padding:0 0 0 16px !important;display:flex !important;align-items:center !important;justify-content:space-between !important;-webkit-app-region:no-drag !important;user-select:none !important;cursor:default !important;position:relative !important;z-index:100 !important;}' +
        'body:has(#main-tab) #titleBar,body:has(#sidebarNav) #titleBar{left:64px !important;width:calc(100% - 64px) !important;max-width:calc(100% - 64px) !important;}' +
        '#titleBar .title-drag{height:38px !important;top:0 !important;left:0 !important;right:60px !important;width:auto !important;-webkit-app-region:no-drag !important;cursor:default !important;}' +
        '#titleBar .title-name{line-height:38px !important;height:38px !important;display:flex !important;align-items:center !important;font-size:13px !important;font-weight:500 !important;-webkit-app-region:no-drag !important;user-select:none !important;cursor:default !important;}' +
        '#container{height:calc(100% - 38px) !important;max-height:calc(100% - 38px) !important;}' +
        '#sidebarNav{height:100% !important;}' +
        '#container:not(.WEB){margin-top:-38px !important;padding-top:38px !important;}' +
        '#main-tab:not(.WEB){margin-top:-38px !important;height:calc(100% + 38px) !important;}' +
        'html:not(:has(.title-bar-feature)) #main-tab:not(.WEB){padding-top:14px;}' +
        '.use-system-banner:has(.system-banner__container) #container:not(.WEB){margin-top:-56px !important;padding-top:56px !important;}' +
        '.use-system-banner:has(.system-banner__container) #main-tab:not(.WEB){margin-top:0px !important;height:100vh !important;}' +
        '.zalo-linux-tb-controls{display:flex !important;align-items:center !important;height:100% !important;margin-left:auto !important;-webkit-app-region:no-drag !important;z-index:1000 !important;}' +
        '.zalo-linux-close-button{-webkit-app-region:no-drag !important;pointer-events:auto !important;cursor:pointer !important;width:48px !important;height:38px !important;display:flex !important;align-items:center !important;justify-content:center !important;background:transparent !important;border:none !important;outline:none !important;padding:0 !important;margin:0 !important;color:var(--text-secondary,#999999) !important;border-top-right-radius:12px !important;transition:background-color 0.15s ease,color 0.15s ease !important;}' +
        '.zalo-linux-close-button svg{width:12px !important;height:12px !important;display:block !important;pointer-events:none !important;}' +
        '.zalo-linux-close-button:hover{background-color:#e81123 !important;color:#ffffff !important;}' +
        '.zalo-linux-close-button:active{background-color:#c40e1d !important;color:#ffffff !important;}' +
        'html.is-maximized .zalo-linux-close-button,body.is-maximized .zalo-linux-close-button{border-top-right-radius:0px !important;}' +
        'body.child-window #titleBar,body:not(:has(#main-tab)):not(:has(#sidebarNav)) #titleBar,.child-mode #titleBar,#titleBar:has(.child-mode){display:none !important;}' +
        'body.child-window #container,body:not(:has(#main-tab)):not(:has(#sidebarNav)) #container{margin-top:0px !important;padding-top:0px !important;height:100% !important;max-height:100% !important;}' +
        'body.child-window header#header,body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header{height:54px !important;min-height:54px !important;padding-right:48px !important;-webkit-app-region:no-drag !important;border-top-left-radius:12px !important;border-top-right-radius:12px !important;user-select:none !important;cursor:default !important;}' +
        'body.child-window header#header *,body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header *{-webkit-app-region:no-drag !important;}' +
        'body.child-window header#header .threadChat,body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header .threadChat{-webkit-app-region:no-drag !important;user-select:none !important;cursor:default !important;}' +
        'body.child-window #headerBtns,body:not(:has(#main-tab)):not(:has(#sidebarNav)) #headerBtns{margin-left:auto !important;display:flex !important;align-items:center !important;-webkit-app-region:no-drag !important;}' +
        '#zalo-linux-child-close-btn{position:fixed !important;top:0 !important;right:0 !important;width:48px !important;height:54px !important;min-height:54px !important;z-index:99999 !important;-webkit-app-region:no-drag !important;pointer-events:auto !important;cursor:pointer !important;display:flex !important;align-items:center !important;justify-content:center !important;background:transparent !important;border:none !important;outline:none !important;padding:0 !important;margin:0 !important;color:var(--text-secondary,#999999) !important;border-top-right-radius:12px !important;transition:background-color 0.15s ease,color 0.15s ease !important;}' +
        '#zalo-linux-child-close-btn svg{width:12px !important;height:12px !important;display:block !important;pointer-events:none !important;}' +
        '#zalo-linux-child-close-btn:hover{background-color:#e81123 !important;color:#ffffff !important;}' +
        '#zalo-linux-child-close-btn:active{background-color:#c40e1d !important;color:#ffffff !important;}' +
        'html.is-maximized #zalo-linux-child-close-btn,body.is-maximized #zalo-linux-child-close-btn{border-top-right-radius:0px !important;}' +
        'html.is-maximized body.child-window header#header,html.is-maximized body:not(:has(#main-tab)):not(:has(#sidebarNav)) header#header{border-top-left-radius:0px !important;border-top-right-radius:0px !important;}' +
        '</style>';

      if (content.includes('<style id="zalo-transparent-base">')) {
        content = content.replace(/<style id="zalo-transparent-base">[\s\S]*?<\/style>/, fullInlineStyle);
        changed = true;
      } else {
        content = content.replace('</head>', `${fullInlineStyle}</head>`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(htmlPath, content, 'utf8');
        logger.dim(`Patched ${path.basename(htmlPath)} with full Linux window rounded styles`);
      }
    }
  }

  // 4. Inject rounded corner style and maximize handler into preloads
  const preloads = [
    path.join(mainDistDir, 'preload-render.js'),
    path.join(mainDistDir, 'compact-app-preload.js')
  ];
  for (const preloadPath of preloads) {
    if (fs.existsSync(preloadPath)) {
      let content = fs.readFileSync(preloadPath, 'utf8');
      if (content.includes('// --- Zalo Linux Window Rounded Corners & Background Transparency ---')) {
        // Replace existing injection with updated version
        const startIdx = content.indexOf('// --- Zalo Linux Window Rounded Corners & Background Transparency ---');
        content = content.substring(0, startIdx).trimEnd() + '\n' + ROUNDED_PRELOAD_INJECTION + '\n';
        fs.writeFileSync(preloadPath, content, 'utf8');
        logger.dim(`Updated rounded styles in ${path.basename(preloadPath)}`);
      } else {
        content = content.trimEnd() + '\n' + ROUNDED_PRELOAD_INJECTION + '\n';
        fs.writeFileSync(preloadPath, content, 'utf8');
        logger.dim(`Injected rounded styles into ${path.basename(preloadPath)}`);
      }
    }
  }

  // 5. Standalone child-window preload: the window chrome only, no Zalo bootstrap
  if (fs.existsSync(mainDistDir)) {
    fs.writeFileSync(path.join(mainDistDir, CHILD_PRELOAD_FILE), '"use strict";\n' + ROUNDED_PRELOAD_INJECTION, 'utf8');
    logger.dim(`Wrote ${CHILD_PRELOAD_FILE}`);
  }

  logger.success('Linux window appearance patch applied successfully');
}

if (require.main === module) {
  main();
}

module.exports = { main, useChildPreload, CHILD_PRELOAD_EXPR };
