/// Keeps the WebView page at 1:1 scale so the installed app fits the screen
/// like an app. The site already ships `user-scalable=no`; this re-applies it
/// after client-side navigation and blocks the iOS pinch / double-tap gestures
/// that WKWebView still handles itself.
const String viewportLockScript = r'''
(function () {
  if (window.__mederpViewportLock) return;
  window.__mederpViewportLock = true;

  var CONTENT = 'width=device-width, initial-scale=1.0, minimum-scale=1.0, ' +
    'maximum-scale=1.0, user-scalable=no';

  function applyViewport() {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    var meta = head.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== CONTENT) {
      meta.setAttribute('content', CONTENT);
    }
  }

  applyViewport();
  if (document.head) {
    new MutationObserver(applyViewport).observe(document.head, { childList: true, subtree: true });
  }

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
    document.addEventListener(name, function (event) {
      event.preventDefault();
    }, { passive: false });
  });

  var lastTapAt = 0;
  var lastTapX = 0;
  var lastTapY = 0;
  document.addEventListener('touchend', function (event) {
    var touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    var now = Date.now();
    var sameSpot = Math.abs(touch.clientX - lastTapX) < 24 && Math.abs(touch.clientY - lastTapY) < 24;
    // Only the second of two quick taps on the same spot zooms. Blocking that
    // one keeps rapid taps on different buttons working.
    if (now - lastTapAt < 320 && sameSpot) event.preventDefault();
    lastTapAt = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  }, { passive: false });
})();
''';
