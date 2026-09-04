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

  // =========================
  // ZOOM STATE
  // =========================

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  const MIN_SCALE = 1;
  const MAX_SCALE = 3;

  // Zoom rất mượt, giống cảm giác điện thoại
  const WHEEL_ZOOM_STEP = 0.12;

  // =========================
  // DRAG STATE
  // =========================

  let dragging = false;
  let moved = false;

  let startX = 0;
  let startY = 0;

  let dragStartX = 0;
  let dragStartY = 0;

  // =========================
  // PINCH STATE
  // =========================

  let pointerMap = new Map();

  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  let pinchCenterX = 0;
  let pinchCenterY = 0;

  // =========================
  // PRELOAD
  // =========================

  function preload(src) {
    if (!src) return;

    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }

  // =========================
  // GET STAGE CENTER
  // =========================

  function getStageCenter() {
    const rect = stage.getBoundingClientRect();

    return {
      x: rect.width / 2,
      y: rect.height / 2
    };
  }

  // =========================
  // RESET
  // =========================

  function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;

    applyTransform();
  }

  // =========================
  // LIMIT MOVEMENT
  // =========================

  function clampOffsets() {
    if (scale <= 1) {
      offsetX = 0;
      offsetY = 0;
      return;
    }

    const rect = stage.getBoundingClientRect();

    /*
     * Giới hạn kéo dựa trên kích thước vùng xem.
     * Không cho ảnh bị kéo mất khỏi màn hình.
     */
    const maxX = Math.max(
      0,
      (rect.width * (scale - 1)) / 2
    );

    const maxY = Math.max(
      0,
      (rect.height * (scale - 1)) / 2
    );

    offsetX = Math.max(
      -maxX,
      Math.min(maxX, offsetX)
    );

    offsetY = Math.max(
      -maxY,
      Math.min(maxY, offsetY)
    );
  }

  // =========================
  // APPLY TRANSFORM
  // =========================

  function applyTransform() {
    clampOffsets();

    image.style.transform =
      `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;

    image.classList.toggle(
      "zoomed",
      scale > 1
    );
  }

  // =========================
  // ZOOM TO POINT
  // =========================

  function zoomTo(
    nextScale,
    pointX,
    pointY
  ) {
    const oldScale = scale;

    nextScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, nextScale)
    );

    if (nextScale === oldScale) {
      return;
    }

    /*
     * Nếu quay về 1x thì đưa ảnh về chính giữa.
     */
    if (nextScale === 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;

      applyTransform();
      return;
    }

    /*
     * Điểm zoom tính từ tâm stage.
     *
     * Ví dụ:
     * người dùng pinch ở góc phải →
     * ảnh vẫn zoom quanh đúng vị trí đó.
     */

    const rect = stage.getBoundingClientRect();

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const localX = pointX - centerX;
    const localY = pointY - centerY;

    const scaleRatio =
      nextScale / oldScale;

    offsetX =
      localX -
      (localX - offsetX) * scaleRatio;

    offsetY =
      localY -
      (localY - offsetY) * scaleRatio;

    scale = nextScale;

    applyTransform();
  }

  // =========================
  // SMOOTH ZOOM
  // =========================

  function setZoom(
    nextScale,
    centerX = null,
    centerY = null
  ) {
    if (
      centerX === null ||
      centerY === null
    ) {
      const center = getStageCenter();

      centerX = center.x;
      centerY = center.y;
    }

    zoomTo(
      nextScale,
      centerX,
      centerY
    );
  }

  // =========================
  // RENDER IMAGE
  // =========================

  function render() {
    if (!items.length) return;

    const item = items[index];

    const src =
      item.medium ||
      item.original ||
      item.thumbnail;

    image.src = src;

    image.alt =
      `Фото ${index + 1}`;

    counter.textContent =
      `${index + 1} / ${items.length}`;

    resetZoom();

    // Preload next image
    const next =
      items[(index + 1) % items.length];

    preload(
      next?.medium ||
      next?.original ||
      next?.thumbnail
    );
  }

  // =========================
  // OPEN
  // =========================

  function open(
    nextItems,
    startIndex = 0
  ) {
    items =
      Array.isArray(nextItems)
        ? nextItems
        : [];

    if (!items.length) return;

    index =
      Math.max(
        0,
        Math.min(
          startIndex,
          items.length - 1
        )
      );

    viewer.hidden = false;

    document.body.classList.add(
      "viewer-open"
    );

    render();
  }

  // =========================
  // CLOSE
  // =========================

  function close() {
    viewer.hidden = true;

    document.body.classList.remove(
      "viewer-open"
    );

    items = [];

    image.removeAttribute("src");

    pointerMap.clear();

    resetZoom();
  }

  // =========================
  // NEXT / PREVIOUS
  // =========================

  function go(step) {
    if (!items.length) return;

    index =
      (index + step + items.length) %
      items.length;

    render();
  }

  // =========================
  // POINTER DISTANCE
  // =========================

  function distance(a, b) {
    return Math.hypot(
      a.clientX - b.clientX,
      a.clientY - b.clientY
    );
  }

  // =========================
  // PINCH CENTER
  // =========================

  function getPinchCenter(a, b) {
    const rect =
      stage.getBoundingClientRect();

    return {
      x:
        ((a.clientX + b.clientX) / 2) -
        rect.left,

      y:
        ((a.clientY + b.clientY) / 2) -
        rect.top
    };
  }

  // =========================
  // BUTTONS
  // =========================

  closeBtn.addEventListener(
    "click",
    close
  );

  prevBtn.addEventListener(
    "click",
    () => go(-1)
  );

  nextBtn.addEventListener(
    "click",
    () => go(1)
  );

  // =========================
  // CLICK OUTSIDE IMAGE
  // =========================

  viewer.addEventListener(
    "click",
    (event) => {
      if (
        event.target === viewer ||
        event.target === stage
      ) {
        close();
      }
    }
  );

  // =========================
  // KEYBOARD
  // =========================

  window.addEventListener(
    "keydown",
    (event) => {
      if (viewer.hidden) return;

      if (event.key === "Escape") {
        close();
      }

      else if (
        event.key === "ArrowLeft"
      ) {
        event.preventDefault();
        go(-1);
      }

      else if (
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        go(1);
      }

      else if (
        event.key === "+" ||
        event.key === "="
      ) {
        event.preventDefault();

        setZoom(
          scale + 0.25
        );
      }

      else if (
        event.key === "-"
      ) {
        event.preventDefault();

        setZoom(
          scale - 0.25
        );
      }

      else if (
        event.key === "0"
      ) {
        event.preventDefault();

        resetZoom();
      }
    }
  );

  // =========================
  // MOUSE WHEEL
  // =========================

  stage.addEventListener(
    "wheel",
    (event) => {
      if (viewer.hidden) return;

      event.preventDefault();

      const rect =
        stage.getBoundingClientRect();

      const x =
        event.clientX - rect.left;

      const y =
        event.clientY - rect.top;

      /*
       * Zoom nhỏ từng bước.
       * Không còn cảm giác "nhảy" quá mạnh.
       */

      const direction =
        event.deltaY < 0
          ? 1
          : -1;

      setZoom(
        scale +
        direction *
        WHEEL_ZOOM_STEP,
        x,
        y
      );
    },
    {
      passive: false
    }
  );

  // =========================
  // DOUBLE CLICK / DOUBLE TAP
  // =========================

  stage.addEventListener(
    "dblclick",
    (event) => {
      const rect =
        stage.getBoundingClientRect();

      const x =
        event.clientX - rect.left;

      const y =
        event.clientY - rect.top;

      /*
       * 1x → 2x
       * 2x trở lên → 1x
       *
       * Giống thao tác double tap
       * trên điện thoại.
       */

      if (scale <= 1.05) {
        zoomTo(
          2,
          x,
          y
        );
      } else {
        resetZoom();
      }
    }
  );

  // =========================
  // POINTER DOWN
  // =========================

  stage.addEventListener(
    "pointerdown",
    (event) => {
      pointerMap.set(
        event.pointerId,
        event
      );

      stage.setPointerCapture?.(
        event.pointerId
      );

      // -----------------------
      // 1 FINGER / MOUSE
      // -----------------------

      if (
        pointerMap.size === 1
      ) {
        dragging = true;
        moved = false;

        startX =
          event.clientX;

        startY =
          event.clientY;

        dragStartX =
          offsetX;

        dragStartY =
          offsetY;
      }

      // -----------------------
      // 2 FINGERS
      // -----------------------

      else if (
        pointerMap.size === 2
      ) {
        const [
          a,
          b
        ] = [
          ...pointerMap.values()
        ];

        pinchStartDistance =
          distance(a, b);

        pinchStartScale =
          scale;

        const center =
          getPinchCenter(a, b);

        pinchCenterX =
          center.x;

        pinchCenterY =
          center.y;

        dragging = false;
      }
    }
  );

  // =========================
  // POINTER MOVE
  // =========================

  stage.addEventListener(
    "pointermove",
    (event) => {
      if (
        !pointerMap.has(
          event.pointerId
        )
      ) {
        return;
      }

      pointerMap.set(
        event.pointerId,
        event
      );

      // =====================
      // PINCH
      // =====================

      if (
        pointerMap.size === 2
      ) {
        const [
          a,
          b
        ] = [
          ...pointerMap.values()
        ];

        const currentDistance =
          distance(a, b);

        if (
          pinchStartDistance > 0
        ) {
          const newScale =
            pinchStartScale *
            (
              currentDistance /
              pinchStartDistance
            );

          const center =
            getPinchCenter(a, b);

          zoomTo(
            newScale,
            center.x,
            center.y
          );
        }

        return;
      }

      // =====================
      // DRAG
      // =====================

      if (!dragging) return;

      const dx =
        event.clientX -
        startX;

      const dy =
        event.clientY -
        startY;

      moved =
        moved ||
        Math.abs(dx) > 8 ||
        Math.abs(dy) > 8;

      /*
       * Chỉ kéo ảnh khi đang zoom.
       */

      if (scale > 1) {
        offsetX =
          dragStartX + dx;

        offsetY =
          dragStartY + dy;

        applyTransform();
      }
    }
  );

  // =========================
  // POINTER END
  // =========================

  function endPointer(event) {
    pointerMap.delete(
      event.pointerId
    );

    if (
      pointerMap.size === 0
    ) {
      dragging = false;

      const dx =
        event.clientX -
        startX;

      const dy =
        event.clientY -
        startY;

      /*
       * Swipe ảnh chỉ hoạt động
       * khi đang ở 1x.
       *
       * Khi zoom thì vuốt = kéo ảnh.
       */

      if (
        scale === 1 &&
        Math.abs(dx) > 60 &&
        Math.abs(dx) >
          Math.abs(dy) * 1.15
      ) {
        go(
          dx < 0
            ? 1
            : -1
        );
      }
    }
  }

  stage.addEventListener(
    "pointerup",
    endPointer
  );

  stage.addEventListener(
    "pointercancel",
    endPointer
  );

  // =========================
  // PUBLIC API
  // =========================

  window.TourViewer = {
    open,
    close
  };

})();
