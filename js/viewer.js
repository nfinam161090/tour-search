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
    console.error("TourViewer: thiếu phần tử viewer trong HTML.");
    return;
  }

  let items = [];
  let index = 0;

  // Zoom
  let scale = 1;
  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  // Position
  let offsetX = 0;
  let offsetY = 0;

  // Single pointer / swipe / drag
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let dragStartX = 0;
  let dragStartY = 0;

  // Multi-touch
  const pointerMap = new Map();

  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  // Điểm trên ảnh đang nằm dưới tâm pinch.
  let pinchAnchorX = 0;
  let pinchAnchorY = 0;

  let pinchActive = false;

  // --------------------------------------------------
  // PRELOAD
  // --------------------------------------------------

  function preload(src) {
    if (!src) return;

    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }


  // --------------------------------------------------
  // RESET
  // --------------------------------------------------

  function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;

    applyTransform();
  }


  // --------------------------------------------------
  // CLAMP
  // --------------------------------------------------

  function clampOffsets() {
    if (scale <= 1) {
      offsetX = 0;
      offsetY = 0;
      return;
    }

    const rect = stage.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const maxX =
      (rect.width * (scale - 1)) / 2;

    const maxY =
      (rect.height * (scale - 1)) / 2;

    offsetX = Math.max(
      -maxX,
      Math.min(maxX, offsetX)
    );

    offsetY = Math.max(
      -maxY,
      Math.min(maxY, offsetY)
    );
  }


  // --------------------------------------------------
  // APPLY TRANSFORM
  // --------------------------------------------------

  function applyTransform() {
    clampOffsets();

    image.style.transform =
      `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;

    image.classList.toggle(
      "zoomed",
      scale > 1.001
    );
  }


  // --------------------------------------------------
  // GET LOCAL STAGE POSITION
  //
  // Tọa độ tính từ tâm stage.
  // --------------------------------------------------

  function getLocalPoint(clientX, clientY) {
    const rect =
      stage.getBoundingClientRect();

    return {
      x:
        clientX -
        (rect.left + rect.width / 2),

      y:
        clientY -
        (rect.top + rect.height / 2)
    };
  }


  // --------------------------------------------------
  // SMOOTH ZOOM AT A POINT
  //
  // Giữ đúng điểm đang được chạm.
  // Đây là phần quan trọng nhất.
  // --------------------------------------------------

  function zoomAt(
    nextScale,
    clientX,
    clientY
  ) {
    const oldScale = scale;

    const newScale =
      Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, nextScale)
      );

    if (newScale === oldScale) {
      return;
    }

    const point =
      getLocalPoint(
        clientX,
        clientY
      );

    /*
     * Công thức:
     *
     * offset mới =
     * point + (offset cũ - point) * scaleRatio
     *
     * Nhờ vậy điểm đang được zoom
     * sẽ vẫn nằm dưới ngón tay / chuột.
     */

    const ratio =
      newScale / oldScale;

    offsetX =
      point.x +
      (offsetX - point.x) * ratio;

    offsetY =
      point.y +
      (offsetY - point.y) * ratio;

    scale = newScale;

    if (scale <= 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    }

    applyTransform();
  }


  // --------------------------------------------------
  // SET ZOOM WITHOUT FOCAL POINT
  // --------------------------------------------------

  function setZoom(nextScale) {
    const newScale =
      Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, nextScale)
      );

    scale = newScale;

    if (scale <= 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    }

    applyTransform();
  }


  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  function render() {
    if (!items.length) {
      return;
    }

    const item =
      items[index];

    const src =
      item.medium ||
      item.original ||
      item.thumbnail ||
      "";

    image.src = src;

    image.alt =
      `Фото ${index + 1}`;

    counter.textContent =
      `${index + 1} / ${items.length}`;

    resetZoom();

    /*
     * Chỉ preload ảnh tiếp theo.
     */

    const next =
      items[
        (index + 1) % items.length
      ];

    if (next) {
      preload(
        next.medium ||
        next.original ||
        next.thumbnail
      );
    }
  }


  // --------------------------------------------------
  // OPEN
  // --------------------------------------------------

  function open(
    nextItems,
    startIndex = 0
  ) {
    items =
      Array.isArray(nextItems)
        ? nextItems
        : [];

    if (!items.length) {
      return;
    }

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


  // --------------------------------------------------
  // CLOSE
  // --------------------------------------------------

  function close() {
    viewer.hidden = true;

    document.body.classList.remove(
      "viewer-open"
    );

    items = [];

    image.removeAttribute("src");

    pointerMap.clear();

    dragging = false;
    pinchActive = false;

    resetZoom();
  }


  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  function go(step) {
    if (!items.length) {
      return;
    }

    index =
      (
        index +
        step +
        items.length
      ) % items.length;

    render();
  }


  // --------------------------------------------------
  // DISTANCE BETWEEN TWO POINTERS
  // --------------------------------------------------

  function distance(a, b) {
    return Math.hypot(
      a.clientX - b.clientX,
      a.clientY - b.clientY
    );
  }


  // --------------------------------------------------
  // MIDPOINT
  // --------------------------------------------------

  function midpoint(a, b) {
    return {
      x:
        (a.clientX + b.clientX) / 2,

      y:
        (a.clientY + b.clientY) / 2
    };
  }


  // --------------------------------------------------
  // START PINCH
  // --------------------------------------------------

  function startPinch() {
    if (pointerMap.size !== 2) {
      return;
    }

    const [a, b] =
      [...pointerMap.values()];

    pinchStartDistance =
      distance(a, b);

    pinchStartScale =
      scale;

    const mid =
      midpoint(a, b);

    const local =
      getLocalPoint(
        mid.x,
        mid.y
      );

    /*
     * Lưu vị trí nội tại trên ảnh
     * nằm dưới tâm pinch.
     *
     * p = (screen - offset) / scale
     */

    pinchAnchorX =
      (
        local.x - offsetX
      ) / scale;

    pinchAnchorY =
      (
        local.y - offsetY
      ) / scale;

    pinchActive = true;

    dragging = false;
  }


  // --------------------------------------------------
  // UPDATE PINCH
  // --------------------------------------------------

  function updatePinch() {
    if (
      !pinchActive ||
      pointerMap.size !== 2 ||
      pinchStartDistance <= 0
    ) {
      return;
    }

    const [a, b] =
      [...pointerMap.values()];

    const currentDistance =
      distance(a, b);

    const ratio =
      currentDistance /
      pinchStartDistance;

    let newScale =
      pinchStartScale * ratio;

    newScale =
      Math.max(
        MIN_SCALE,
        Math.min(
          MAX_SCALE,
          newScale
        )
      );

    const mid =
      midpoint(a, b);

    const local =
      getLocalPoint(
        mid.x,
        mid.y
      );

    /*
     * Giữ nguyên chính xác điểm trên ảnh
     * dưới tâm hai ngón tay.
     */

    scale = newScale;

    offsetX =
      local.x -
      pinchAnchorX * scale;

    offsetY =
      local.y -
      pinchAnchorY * scale;

    if (scale <= 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    }

    applyTransform();
  }


  // --------------------------------------------------
  // EVENTS: CLOSE / NAV
  // --------------------------------------------------

  closeBtn?.addEventListener(
    "click",
    close
  );

  prevBtn?.addEventListener(
    "click",
    () => go(-1)
  );

  nextBtn?.addEventListener(
    "click",
    () => go(1)
  );


  // --------------------------------------------------
  // CLICK BACKDROP
  // --------------------------------------------------

  viewer.addEventListener(
    "click",
    event => {

      if (
        event.target === viewer ||
        event.target === stage
      ) {
        close();
      }

    }
  );


  // --------------------------------------------------
  // KEYBOARD
  // --------------------------------------------------

  window.addEventListener(
    "keydown",
    event => {

      if (viewer.hidden) {
        return;
      }

      if (
        event.key === "Escape"
      ) {

        event.preventDefault();
        close();
        return;

      }


      if (
        event.key === "ArrowLeft"
      ) {

        event.preventDefault();
        go(-1);
        return;

      }


      if (
        event.key === "ArrowRight"
      ) {

        event.preventDefault();
        go(1);
        return;

      }


      if (
        event.key === "+" ||
        event.key === "="
      ) {

        event.preventDefault();
        setZoom(
          scale + 0.1
        );

        return;

      }


      if (
        event.key === "-"
      ) {

        event.preventDefault();
        setZoom(
          scale - 0.1
        );

        return;

      }


      if (
        event.key === "0"
      ) {

        event.preventDefault();
        resetZoom();

      }

    }
  );


  // --------------------------------------------------
  // DESKTOP WHEEL
  // --------------------------------------------------

  stage.addEventListener(
    "wheel",
    event => {

      if (viewer.hidden) {
        return;
      }

      event.preventDefault();

      /*
       * Wheel zoom nhỏ và mượt hơn.
       */

      const direction =
        event.deltaY < 0
          ? 1
          : -1;

      const amount =
        1 + direction * 0.08;

      const nextScale =
        scale * amount;

      zoomAt(
        nextScale,
        event.clientX,
        event.clientY
      );

    },
    {
      passive: false
    }
  );


  // --------------------------------------------------
  // DOUBLE CLICK
  // --------------------------------------------------

  stage.addEventListener(
    "dblclick",
    event => {

      if (viewer.hidden) {
        return;
      }

      if (scale > 1.01) {

        resetZoom();

      } else {

        zoomAt(
          2,
          event.clientX,
          event.clientY
        );

      }

    }
  );


  // --------------------------------------------------
  // POINTER DOWN
  // --------------------------------------------------

  stage.addEventListener(
    "pointerdown",
    event => {

      if (viewer.hidden) {
        return;
      }

      pointerMap.set(
        event.pointerId,
        {
          clientX: event.clientX,
          clientY: event.clientY
        }
      );

      stage.setPointerCapture?.(
        event.pointerId
      );


      /*
       * 2 ngón → pinch
       */

      if (pointerMap.size === 2) {

        startPinch();
        return;

      }


      /*
       * 1 ngón
       */

      if (pointerMap.size === 1) {

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

    }
  );


  // --------------------------------------------------
  // POINTER MOVE
  // --------------------------------------------------

  stage.addEventListener(
    "pointermove",
    event => {

      if (
        !pointerMap.has(
          event.pointerId
        )
      ) {
        return;
      }


      pointerMap.set(
        event.pointerId,
        {
          clientX: event.clientX,
          clientY: event.clientY
        }
      );


      /*
       * 2 ngón
       */

      if (
        pointerMap.size === 2
      ) {

        updatePinch();
        return;

      }


      /*
       * 1 ngón
       */

      if (
        !dragging ||
        pointerMap.size !== 1
      ) {
        return;
      }


      const dx =
        event.clientX -
        startX;

      const dy =
        event.clientY -
        startY;


      if (
        Math.abs(dx) > 8 ||
        Math.abs(dy) > 8
      ) {
        moved = true;
      }


      /*
       * Chỉ kéo ảnh khi zoom.
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


  // --------------------------------------------------
  // POINTER END
  // --------------------------------------------------

  function endPointer(event) {

    const wasPinching =
      pinchActive;

    pointerMap.delete(
      event.pointerId
    );


    /*
     * Nếu vừa pinch xong
     */

    if (
      pointerMap.size < 2
    ) {
      pinchActive = false;
    }


    /*
     * Nếu vẫn còn 1 pointer,
     * chuyển tiếp sang trạng thái kéo.
     */

    if (
      pointerMap.size === 1
    ) {

      const remaining =
        [...pointerMap.values()][0];

      dragging = true;

      startX =
        remaining.clientX;

      startY =
        remaining.clientY;

      dragStartX =
        offsetX;

      dragStartY =
        offsetY;

      return;

    }


    /*
     * Không còn pointer.
     */

    if (
      pointerMap.size === 0
    ) {

      dragging = false;


      /*
       * Swipe chỉ khi:
       *
       * - không zoom
       * - không vừa pinch
       * - kéo ngang
       */

      if (
        !wasPinching &&
        scale === 1 &&
        moved
      ) {

        const dx =
          event.clientX -
          startX;

        const dy =
          event.clientY -
          startY;


        if (
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

  }


  stage.addEventListener(
    "pointerup",
    endPointer
  );

  stage.addEventListener(
    "pointercancel",
    endPointer
  );

  stage.addEventListener(
    "pointerout",
    event => {

      /*
       * Không xử lý swipe tại đây.
       * Tránh mất pointer trên mobile.
       */

      if (
        event.pointerId &&
        pointerMap.has(
          event.pointerId
        )
      ) {
        return;
      }

    }
  );


  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------

  window.TourViewer = {
    open,
    close,
    resetZoom
  };

})();
