/* ══════════════════════════════════════════════════════
   Custom Cursor — dot + trailing ring
   Include this script on every page.
   ══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* --- Create elements --- */
    var dot  = document.createElement('div');
    var ring = document.createElement('div');
    dot.id  = 'cursor-dot';
    ring.id = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    /* --- State --- */
    var mouseX = -200, mouseY = -200;
    var ringX  = -200, ringY  = -200;
    var rafId  = null;

    /* --- Easing factor for ring lag (0 = no movement, 1 = instant) --- */
    var EASE = 0.10;

    /* --- Update loop (ring follows with smooth lerp) --- */
    function tick() {
        ringX += (mouseX - ringX) * EASE;
        ringY += (mouseY - ringY) * EASE;

        dot.style.left  = mouseX + 'px';
        dot.style.top   = mouseY + 'px';
        ring.style.left = ringX  + 'px';
        ring.style.top  = ringY  + 'px';

        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    /* --- Track mouse position --- */
    document.addEventListener('mousemove', function (e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        document.body.classList.remove('cursor-out');
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
        document.body.classList.add('cursor-out');
    });

    document.addEventListener('mouseenter', function () {
        document.body.classList.remove('cursor-out');
    });

    /* --- Hover detection on interactive elements --- */
    var INTERACTIVE = [
        'a', 'button', 'input', 'select', 'textarea', 'label',
        '[role="button"]', '[tabindex]', '.tl', '.os-window',
        '.taskbar-tab', '.win-titlebar', '[onclick]',
        '.nav-links li a', '.nav-logo', '.clickable'
    ].join(',');

    document.addEventListener('mouseover', function (e) {
        if (e.target.closest(INTERACTIVE)) {
            document.body.classList.add('cursor-hover');
        }
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
        if (e.target.closest(INTERACTIVE)) {
            document.body.classList.remove('cursor-hover');
        }
    }, { passive: true });

    /* --- Click feedback --- */
    document.addEventListener('mousedown', function () {
        document.body.classList.add('cursor-click');
    });

    document.addEventListener('mouseup', function () {
        document.body.classList.remove('cursor-click');
    });

})();
