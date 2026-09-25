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

## 2026-09-25 — Light/dark switch showed "light" after reopening a dark app

- Symptom: after closing and reopening, the title-bar switch could show one
  theme while Zalo rendered the other.
- Cause: two sources of truth. The switch mode lives in
  `userData/zalo-linux-theme.json`; Zalo keeps its own setting in
  `localStorage.za_theme` (`theme_setting` 0 light / 1 dark / 2 system). The
  preload only synced `za_theme` while it was on system (2), so a pinned Zalo
  setting made Zalo render its own theme on the next launch. Measured before
  the fix: switch saved light + Zalo setting dark gave `html` without `dark`,
  a "light" switch, and dark pixels.
- Fix: the switch is the only source of truth. The preload always writes
  `za_theme` back to system (2) with the effective theme (system = nativeTheme,
  which the switch drives), and adopts a light/dark choice made in Zalo's own
  settings as the switch mode.
- Also: the `index.html` patch replaced the body of `if (theme === "dark")`
  with a bare comment (`if (...) }`), a SyntaxError on every launch; it now
  becomes an empty block, and old output is repaired.
- Verified on the test box (rebuilt AppImage): switch dark + Zalo light, and
  switch light + Zalo dark, both reopen consistent (class, `za_theme`, switch
  and window pixels); real clicks, close button, reopen via `gtk-launch` stay
  dark. Adopting a choice from Zalo's settings screen was not exercised.
