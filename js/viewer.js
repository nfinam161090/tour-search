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
    console.error("TourViewer: viewerStage / viewerImage không tồn tại.");
    return;
  }

  /* =========================================================
     DATA
  ========================================================= */

  let items = [];
  let currentIndex = 0;

  /* =========================================================
     ZOOM
     
     Rất bảo thủ:
     1.0x -> bình thường
     1.5x -> zoom nhẹ
     2.0x -> khá lớn
     2.5x -> tối đa mặc định
     
     Không cho zoom 4x nữa.
  ========================================================= */

  const MIN_SCALE = 1;
  const MAX_SCALE = 2.5;

  let scale = 1;

  let offsetX = 0;
  let offsetY = 0;

  /* =========================================================
     POINTER
  ========================================================= */

  const pointers = new Map();

  let gesture = "none";

  /* swipe / drag */
  let gestureStartX = 0;
  let gestureStartY = 0;

  let startOffsetX = 0;
  let startOffsetY = 0;

  let moved = false;

  /* pinch */
  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  let pinchMidStartX = 0;
  let pinchMidStartY = 0;

  let pinchAnchorX = 0;
  let pinchAnchorY = 0;


  /* =========================================================
     UTILS
  ========================================================= */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  function getStageRect() {
    return stage.getBoundingClientRect();
  }


  function localPoint(clientX, clientY) {
    const rect = getStageRect();

    return {
      x:
        clientX -
        (rect.left + rect.width / 2),

      y:
        clientY -
        (rect.top + rect.height / 2)
    };
  }


  function distance(a, b) {
    return Math.hypot(
      b.clientX - a.clientX,
      b.clientY - a.clientY
    );
  }


  function midpoint(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    };
  }


  function getImageSource(item) {
    if (!item) return "";

    return (
      item.medium ||
      item.original ||
      item.thumbnail ||
      ""
    );
  }


  /* =========================================================
     PRELOAD
  ========================================================= */

  function preload(src) {
    if (!src) return;

    const img = new Image();

    img.decoding = "async";
    img.src = src;
  }


  /* =========================================================
     OFFSET LIMIT
  ========================================================= */

  function clampOffsets() {
    if (scale <= 1) {
      offsetX = 0;
      offsetY = 0;
      return;
    }

    const rect = getStageRect();

    /*
     * Chỉ cho kéo trong phạm vi ảnh thực sự có thể di chuyển.
     */
    const maxX =
      Math.max(0, rect.width * (scale - 1) / 2);

    const maxY =
      Math.max(0, rect.height * (scale - 1) / 2);

    offsetX = clamp(
      offsetX,
      -maxX,
      maxX
    );

    offsetY = clamp(
      offsetY,
      -maxY,
      maxY
    );
  }


  /* =========================================================
     APPLY
     
     CHỈ JS được quyền thay transform.
     
     CSS KHÔNG được scale ảnh.
  ========================================================= */

  function applyTransform() {
    clampOffsets();

    image.style.transform =
      `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
  }


  /* =========================================================
     RESET
  ========================================================= */

  function resetZoom() {
    scale = 1;

    offsetX = 0;
    offsetY = 0;

    applyTransform();
  }


  /* =========================================================
     ZOOM AT POINT
     
     Zoom nhẹ hơn.
  ========================================================= */

  function zoomAt(
    targetScale,
    clientX,
    clientY
  ) {
    const oldScale = scale;

    const newScale = clamp(
      targetScale,
      MIN_SCALE,
      MAX_SCALE
    );

    if (Math.abs(newScale - oldScale) < 0.001) {
      return;
    }

    const point =
      localPoint(
        clientX,
        clientY
      );

    const ratio =
      newScale / oldScale;

    /*
     * Giữ vị trí dưới chuột/ngón tay.
     */
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


  /* =========================================================
     CHANGE IMAGE
  ========================================================= */

  function render() {
    if (!items.length) return;

    const item =
      items[currentIndex];

    const src =
      getImageSource(item);

    image.src = src;

    image.alt =
      `Фото ${currentIndex + 1}`;

    if (counter) {
      counter.textContent =
        `${currentIndex + 1} / ${items.length}`;
    }

    resetZoom();

    /*
     * Chỉ preload ảnh kế tiếp.
     */
    const nextItem =
      items[
        (currentIndex + 1) %
        items.length
      ];

    if (nextItem) {
      preload(
        getImageSource(nextItem)
      );
    }
  }


  /* =========================================================
     OPEN
  ========================================================= */

  function open(
    newItems,
    startIndex = 0
  ) {
    items =
      Array.isArray(newItems)
        ? newItems
        : [];

    if (!items.length) {
      return;
    }

    currentIndex =
      clamp(
        Number(startIndex) || 0,
        0,
        items.length - 1
      );

    viewer.hidden = false;

    document.body.classList.add(
      "viewer-open"
    );

    pointerReset();

    render();
  }


  /* =========================================================
     CLOSE
  ========================================================= */

  function close() {
    viewer.hidden = true;

    document.body.classList.remove(
      "viewer-open"
    );

    pointerReset();

    resetZoom();

    items = [];

    image.removeAttribute("src");
  }


  /* =========================================================
     NAVIGATION
  ========================================================= */

  function go(step) {
    if (!items.length) return;

    currentIndex =
      (
        currentIndex +
        step +
        items.length
      ) %
      items.length;

    pointerReset();

    render();
  }


  /* =========================================================
     POINTER RESET
  ========================================================= */

  function pointerReset() {
    pointers.clear();

    gesture = "none";

    gestureStartX = 0;
    gestureStartY = 0;

    startOffsetX = offsetX;
    startOffsetY = offsetY;

    moved = false;

    pinchStartDistance = 0;
    pinchStartScale = scale;

    pinchMidStartX = 0;
    pinchMidStartY = 0;

    pinchAnchorX = 0;
    pinchAnchorY = 0;
  }


  /* =========================================================
     START PINCH
  ========================================================= */

  function startPinch() {
    if (pointers.size !== 2) {
      return;
    }

    const [a, b] =
      [...pointers.values()];

    const d =
      distance(a, b);

    if (d <= 0) {
      return;
    }

    const mid =
      midpoint(a, b);

    const local =
      localPoint(
        mid.x,
        mid.y
      );

    pinchStartDistance = d;

    pinchStartScale =
      scale;

    pinchMidStartX =
      mid.x;

    pinchMidStartY =
      mid.y;

    /*
     * Điểm nội tại trên ảnh nằm dưới ngón tay.
     *
     * Khi pinch di chuyển:
     * - ảnh phóng
     * - ảnh cũng đi theo tâm 2 ngón
     */
    pinchAnchorX =
      (
        local.x - offsetX
      ) / scale;

    pinchAnchorY =
      (
        local.y - offsetY
      ) / scale;

    gesture = "pinch";

    moved = true;
  }


  /* =========================================================
     UPDATE PINCH
     
     QUAN TRỌNG:
     
     Không dùng:
     scale = oldScale * rawDistanceRatio
     
     vì nó quá nhạy.
     
     Dùng power 0.45 để làm chậm zoom.
  ========================================================= */

  function updatePinch() {
    if (
      gesture !== "pinch" ||
      pointers.size !== 2 ||
      pinchStartDistance <= 0
    ) {
      return;
    }

    const [a, b] =
      [...pointers.values()];

    const currentDistance =
      distance(a, b);

    if (currentDistance <= 0) {
      return;
    }

    const rawRatio =
      currentDistance /
      pinchStartDistance;

    /*
     * Giảm độ nhạy rất mạnh.
     *
     * Ví dụ:
     *
     * ngón tay mở ra 2 lần
     * => zoom khoảng 1.37 lần
     *
     * thay vì 2 lần.
     */
    const smoothRatio =
      Math.pow(
        rawRatio,
        0.45
      );

    let newScale =
      pinchStartScale *
      smoothRatio;

    newScale =
      clamp(
        newScale,
        MIN_SCALE,
        MAX_SCALE
      );

    const mid =
      midpoint(a, b);

    const local =
      localPoint(
        mid.x,
        mid.y
      );

    scale = newScale;

    /*
     * Giữ điểm đang xem.
     */
    offsetX =
      local.x -
      pinchAnchorX * scale;

    offsetY =
      local.y -
      pinchAnchorY * scale;

    if (scale <= 1.001) {
      scale = 1;

      offsetX = 0;
      offsetY = 0;
    }

    applyTransform();
  }


  /* =========================================================
     BUTTONS
  ========================================================= */

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


  /* =========================================================
     BACKDROP
  ========================================================= */

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


  /* =========================================================
     KEYBOARD
  ========================================================= */

  window.addEventListener(
    "keydown",
    event => {

      if (viewer.hidden) {
        return;
      }

      switch (event.key) {

        case "Escape":

          event.preventDefault();
          close();

          break;


        case "ArrowLeft":

          event.preventDefault();
          go(-1);

          break;


        case "ArrowRight":

          event.preventDefault();
          go(1);

          break;


        case "+":

        case "=":

          event.preventDefault();

          setZoom(
            scale + 0.1
          );

          break;


        case "-":

          event.preventDefault();

          setZoom(
            scale - 0.1
          );

          break;


        case "0":

          event.preventDefault();
          resetZoom();

          break;
      }

    }
  );


  /* =========================================================
     SIMPLE SET ZOOM
  ========================================================= */

  function setZoom(newScale) {

    scale =
      clamp(
        newScale,
        MIN_SCALE,
        MAX_SCALE
      );

    if (scale <= 1) {
      scale = 1;

      offsetX = 0;
      offsetY = 0;
    }

    applyTransform();
  }


  /* =========================================================
     DESKTOP WHEEL
     
     Nhẹ hơn trước rất nhiều.
  ========================================================= */

  stage.addEventListener(
    "wheel",
    event => {

      if (viewer.hidden) {
        return;
      }

      event.preventDefault();

      /*
       * Trackpad / wheel:
       * thay đổi chỉ 5% mỗi tick.
       */
      const direction =
        event.deltaY < 0
          ? 1
          : -1;

      const factor =
        direction > 0
          ? 1.05
          : 0.95;

      const targetScale =
        scale * factor;

      zoomAt(
        targetScale,
        event.clientX,
        event.clientY
      );

    },
    {
      passive: false
    }
  );


  /* =========================================================
     DOUBLE CLICK / DOUBLE TAP
     
     1x -> 1.8x
     1.8x -> 1x
     
     Không nhảy 2x/3x/4x.
  ========================================================= */

  stage.addEventListener(
    "dblclick",
    event => {

      if (viewer.hidden) {
        return;
      }

      if (scale > 1.05) {

        resetZoom();

      } else {

        zoomAt(
          1.8,
          event.clientX,
          event.clientY
        );

      }

    }
  );


  /* =========================================================
     POINTER DOWN
  ========================================================= */

  stage.addEventListener(
    "pointerdown",
    event => {

      if (viewer.hidden) {
        return;
      }

      pointers.set(
        event.pointerId,
        {
          clientX: event.clientX,
          clientY: event.clientY
        }
      );

      stage.setPointerCapture?.(
        event.pointerId
      );


      /* -------------------------
         2 ngón = PINCH
      ------------------------- */

      if (pointers.size === 2) {
        startPinch();
        return;
      }


      /* -------------------------
         1 ngón
      ------------------------- */

      if (pointers.size === 1) {

        gesture = "one";

        gestureStartX =
          event.clientX;

        gestureStartY =
          event.clientY;

        startOffsetX =
          offsetX;

        startOffsetY =
          offsetY;

        moved = false;
      }

    }
  );


  /* =========================================================
     POINTER MOVE
  ========================================================= */

  stage.addEventListener(
    "pointermove",
    event => {

      if (
        !pointers.has(
          event.pointerId
        )
      ) {
        return;
      }


      pointers.set(
        event.pointerId,
        {
          clientX: event.clientX,
          clientY: event.clientY
        }
      );


      /* -------------------------
         PINCH
      ------------------------- */

      if (
        pointers.size === 2
      ) {

        updatePinch();

        return;
      }


      /* -------------------------
         SINGLE POINTER
      ------------------------- */

      if (
        gesture !== "one" ||
        pointers.size !== 1
      ) {
        return;
      }


      const dx =
        event.clientX -
        gestureStartX;

      const dy =
        event.clientY -
        gestureStartY;


      if (
        Math.abs(dx) > 8 ||
        Math.abs(dy) > 8
      ) {
        moved = true;
      }


      /*
       * Nếu đã zoom:
       * 1 ngón kéo ảnh.
       */

      if (
        scale > 1.001 &&
        moved
      ) {

        offsetX =
          startOffsetX +
          dx;

        offsetY =
          startOffsetY +
          dy;

        applyTransform();

      }

    }
  );


  /* =========================================================
     POINTER END
  ========================================================= */

  function endPointer(event) {

    const pointer =
      pointers.get(
        event.pointerId
      );

    pointers.delete(
      event.pointerId
    );


    /*
     * Nếu vẫn còn 1 ngón:
     * tiếp tục giữ trạng thái.
     */
    if (
      pointers.size === 1
    ) {

      const remaining =
        [...pointers.values()][0];

      gesture = "one";

      gestureStartX =
        remaining.clientX;

      gestureStartY =
        remaining.clientY;

      startOffsetX =
        offsetX;

      startOffsetY =
        offsetY;

      return;
    }


    /*
     * Không còn ngón.
     */

    if (
      pointers.size === 0
    ) {

      const wasGesture =
        gesture;

      gesture = "none";


      /*
       * Swipe:
       *
       * chỉ khi:
       * - ảnh đang ở 1x
       * - gesture là one
       */

      if (
        wasGesture === "one" &&
        scale <= 1.001 &&
        moved &&
        pointer
      ) {

        const dx =
          event.clientX -
          gestureStartX;

        const dy =
          event.clientY -
          gestureStartY;


        if (
          Math.abs(dx) >= 60 &&
          Math.abs(dx) >
            Math.abs(dy) * 1.2
        ) {

          go(
            dx < 0
              ? 1
              : -1
          );

        }

      }

      moved = false;

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


  /* =========================================================
     CONTEXT MENU OFF
  ========================================================= */

  image.addEventListener(
    "contextmenu",
    event => {
      event.preventDefault();
    }
  );


  /* =========================================================
     PUBLIC
  ========================================================= */

  window.TourViewer = {
    open,
    close,
    resetZoom
  };

})();
