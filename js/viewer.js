(() => {
  "use strict";

  const viewer = document.getElementById("viewer");
  const stage = document.getElementById("viewerStage");
  const image = document.getElementById("viewerImage");
  const closeBtn = document.getElementById("viewerClose");
  const prevBtn = document.getElementById("viewerPrev");
  const nextBtn = document.getElementById("viewerNext");
  const counter = document.getElementById("viewerCounter");

  let items = [];
  let index = 0;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let moved = false;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pointerMap = new Map();

  function preload(src) {
    if (!src) return;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }

  function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    applyTransform();
  }

  function clampOffsets() {
    if (scale <= 1) {
      offsetX = 0;
      offsetY = 0;
      return;
    }
    const rect = stage.getBoundingClientRect();
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  }

  function applyTransform() {
    clampOffsets();
    image.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
    image.classList.toggle("zoomed", scale > 1);
  }

  function setZoom(nextScale, centerX = 0, centerY = 0) {
    const oldScale = scale;
    scale = Math.max(1, Math.min(4, nextScale));
    if (scale === 1) {
      offsetX = 0;
      offsetY = 0;
    } else if (oldScale !== scale) {
      const ratio = (scale - oldScale) / oldScale;
      offsetX -= centerX * ratio;
      offsetY -= centerY * ratio;
    }
    applyTransform();
  }

  function render() {
    if (!items.length) return;
    const item = items[index];
    const src = item.medium || item.original || item.thumbnail;
    image.src = src;
    image.alt = `Фото ${index + 1}`;
    counter.textContent = `${index + 1} / ${items.length}`;
    resetZoom();

    const next = items[(index + 1) % items.length];
    preload(next?.medium || next?.original || next?.thumbnail);
  }

  function open(nextItems, startIndex = 0) {
    items = Array.isArray(nextItems) ? nextItems : [];
    if (!items.length) return;
    index = Math.max(0, Math.min(startIndex, items.length - 1));
    viewer.hidden = false;
    document.body.classList.add("viewer-open");
    render();
  }

  function close() {
    viewer.hidden = true;
    document.body.classList.remove("viewer-open");
    items = [];
    image.removeAttribute("src");
    pointerMap.clear();
    resetZoom();
  }

  function go(step) {
    if (!items.length) return;
    index = (index + step + items.length) % items.length;
    render();
  }

  function distance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target === stage) close();
  });

  window.addEventListener("keydown", (event) => {
    if (viewer.hidden) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
    else if (event.key === "+" || event.key === "=") setZoom(scale + 0.25);
    else if (event.key === "-") setZoom(scale - 0.25);
    else if (event.key === "0") resetZoom();
  });

  stage.addEventListener("wheel", (event) => {
    if (viewer.hidden) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    setZoom(scale + (event.deltaY < 0 ? 0.2 : -0.2), x, y);
  }, { passive: false });

  stage.addEventListener("dblclick", (event) => {
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    setZoom(scale > 1 ? 1 : 2, x, y);
  });

  stage.addEventListener("pointerdown", (event) => {
    pointerMap.set(event.pointerId, event);
    stage.setPointerCapture?.(event.pointerId);

    if (pointerMap.size === 1) {
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      dragX = offsetX;
      dragY = offsetY;
    } else if (pointerMap.size === 2) {
      const [a, b] = [...pointerMap.values()];
      pinchStartDistance = distance(a, b);
      pinchStartScale = scale;
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointerMap.has(event.pointerId)) return;
    pointerMap.set(event.pointerId, event);

    if (pointerMap.size === 2) {
      const [a, b] = [...pointerMap.values()];
      const d = distance(a, b);
      if (pinchStartDistance > 0) {
        setZoom(pinchStartScale * (d / pinchStartDistance));
      }
      return;
    }

    if (!dragging) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    moved = moved || Math.abs(dx) > 8 || Math.abs(dy) > 8;

    if (scale > 1) {
      offsetX = dragX + dx;
      offsetY = dragY + dy;
      applyTransform();
    }
  });

  function endPointer(event) {
    pointerMap.delete(event.pointerId);
    if (pointerMap.size === 0) {
      dragging = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      // Swipe only when not zoomed and horizontal movement dominates.
      if (scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        go(dx < 0 ? 1 : -1);
      }
    }
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("pointerleave", () => {});

  window.TourViewer = { open, close };
})();
