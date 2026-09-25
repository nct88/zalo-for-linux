# Fix log

## 2026-09-25 — "Mở cửa sổ riêng" froze the whole app

- Symptom: opening a chat in a separate window left the child window stuck
  loading (never shown) and the main window stopped responding; its renderer
  main thread sat in a futex wait at 0% CPU.
- Cause: the child-window patch forced `preload-render.js` into the
  `window.open()` child. That child shares the main window's renderer
  process, so Zalo's whole bootstrap re-ran inside `window.open()` and
  deadlocked the shared renderer. Upstream children run no preload.
- Fix: children get `preload-child-linux.js`, which holds only the Linux
  window chrome (close button, drag, rounded corners). Patches migrate
  already-patched `main.js`/`compact-app.js` from the old preload path.
- Verified on the Debian test box (real AppImage): open, drag, close button,
  reopen, and two child windows at once; main renderer stays responsive.
