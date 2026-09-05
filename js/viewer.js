(() => {
  "use strict";

  const viewer = document.getElementById("viewer");
  const stage = document.getElementById("viewerStage");
  const image = document.getElementById("viewerImage");
  const closeBtn = document.getElementById("viewerClose");
  const prevBtn = document.getElementById("viewerPrev");
  const nextBtn = document.getElementById("viewerNext");
  const counter = document.getElementById("viewerCounter");

  if (!viewer || !stage || !image) {
    console.error("TourViewer: thiếu viewer trong index.html");
    return;
  }

  let items = [];
  let index = 0;

  // Swipe state. No custom zoom/transform is used.
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;
  let moved = false;
  let multiTouch = false;
  let activePointers = 0;

  function sourceOf(item) {
    return item?.medium || item?.original || item?.thumbnail || "";
  }

  function preload(src) {
    if (!src) return;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }

  function resetGesture() {
    tracking = false;
    moved = false;
    multiTouch = false;
    activePointers = 0;
  }

  function render() {
    if (!items.length) return;

    const item = items[index];
    const src = sourceOf(item);

    image.src = src;
    image.alt = `Фото ${index + 1}`;

    if (counter) {
      counter.textContent = `${index + 1} / ${items.length}`;
    }

    // Reset browser image display state between photos.
    image.style.transform = "none";
    image.style.maxWidth = "92vw";
    image.style.maxHeight = "86vh";

    const next = items[(index + 1) % items.length];
    preload(sourceOf(next));
  }

  function open(nextItems, startIndex = 0) {
    items = Array.isArray(nextItems) ? nextItems : [];
    if (!items.length) return;

    index = Math.max(0, Math.min(Number(startIndex) || 0, items.length - 1));

    viewer.hidden = false;
    document.body.classList.add("viewer-open");
    resetGesture();
    render();
  }

  function close() {
    viewer.hidden = true;
    document.body.classList.remove("viewer-open");
    resetGesture();
    items = [];
    image.removeAttribute("src");
  }

  function go(step) {
    if (!items.length) return;
    index = (index + step + items.length) % items.length;
    resetGesture();
    render();
  }

  closeBtn?.addEventListener("click", close);
  prevBtn?.addEventListener("click", () => go(-1));
  nextBtn?.addEventListener("click", () => go(1));

  // Close only when clicking the dark backdrop, not the image/buttons.
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) close();
  });

  window.addEventListener("keydown", (event) => {
    if (viewer.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  });

  /*
   * Native zoom is intentionally left alone.
   * We do NOT transform the image and do NOT block context menu,
   * pinch zoom, long-press save, or browser image behavior.
   * The only custom touch behavior is horizontal swipe navigation.
   */

  stage.addEventListener("pointerdown", (event) => {
    if (viewer.hidden) return;

    activePointers += 1;

    if (activePointers > 1) {
      multiTouch = true;
      tracking = false;
      return;
    }

    startX = event.clientX;
    startY = event.clientY;
    startTime = performance.now();
    tracking = true;
    moved = false;
  });

  stage.addEventListener("pointermove", (event) => {
    if (!tracking || multiTouch) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      moved = true;
    }

    // Do not preventDefault: browser keeps native pinch/zoom behavior.
  });

  function endPointer(event) {
    if (activePointers > 0) activePointers -= 1;

    if (activePointers > 0) return;

    if (!tracking || multiTouch) {
      resetGesture();
      return;
    }

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const elapsed = performance.now() - startTime;

    tracking = false;

    // A deliberate, quick horizontal swipe changes the image.
    if (
      moved &&
      elapsed < 700 &&
      Math.abs(dx) >= 60 &&
      Math.abs(dx) > Math.abs(dy) * 1.2
    ) {
      go(dx < 0 ? 1 : -1);
      return;
    }

    moved = false;
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  window.TourViewer = { open, close };
})();
