const API_URL =
  "https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnR65Fz3kvUz1BDVqHkel2FfBtG4h_bXAi_ADw1k5g7CJ8rpLqu1hJo5X1TdyRysLd3fcG3VwGFpmAJ1JEfM8ig0g18foRlah_-2GxIPZpeVWptiYAqeZQ-FGEK2Bbj7BGFiAkwHagTCnhQ0ymc9QAR4k9tR1NpWs3XBR0HYK92cT_KETOZlKZbm_OArfKpPZt8KSWUXzC3pOdneAlBMR8DlwXXonf7WyRak1xqIVk66E7647ZyKGiTrqc9u5HUW9Oh9cEyzlVoz2rA7SjiBQg17_53rTw&lib=MQ9Iovo6jnGLxfuhsviDOH0YwIJMUfNPp";

let tours = [];
let currentCategory = "ALL";


async function loadTours() {

  try {

    const response =
      await fetch(API_URL);

    tours = await response.json();

    renderTours();

  } catch (error) {

    console.error(error);

    document.getElementById("results").innerHTML =
      `<div class="no-results">
        Не удалось загрузить данные.
      </div>`;

  }

}


function normalize(text) {

  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .trim();

}


function renderTours() {

  const search =
    normalize(
      document.getElementById(
        "searchInput"
      ).value
    );


  const results =
    tours.filter(
      tour => {

        const categoryMatch =
          currentCategory === "ALL" ||
          tour.CATEGORY ===
            currentCategory;


        const searchableText =
          normalize(
            [
              tour.NAME_RU,
              tour.NAME_EN,
              tour.DESCRIPTION_RU,
              tour.DESCRIPTION_EN,
              tour.KEYWORDS_RU,
              tour.KEYWORDS_EN
            ].join(" ")
          );


        const searchMatch =
          !search ||
          searchableText.includes(
            search
          );


        return (
          categoryMatch &&
          searchMatch
        );

      }
    );


  const container =
    document.getElementById(
      "results"
    );


  if (!results.length) {

    container.innerHTML = `

      <div class="no-results">
        Ничего не найдено.
      </div>

    `;

    return;

  }


  /*
   * ==================================
   * KHÔNG CÓ <img>
   * ==================================
   *
   * Đây là điểm giúp trang chính
   * tải nhanh.
   */

  container.innerHTML =
    results
      .map(
        tour => `

        <article
          class="card tour-card-text"
          onclick="openTour('${tour.ID}')"
        >

          <div class="card-body">

            <div class="card-title">
              ${tour.NAME_RU || ""}
            </div>

            ${
              tour.DESCRIPTION_RU
              ?
              `
              <div class="card-description">
                ${tour.DESCRIPTION_RU}
              </div>
              `
              :
              ""
            }

            ${
              tour.PRICE
              ?
              `
              <div class="price">
                $${tour.PRICE}
              </div>
              `
              :
              ""
            }

          </div>

        </article>

      `
      )
      .join("");

}


function openTour(id) {async function openTour(id) {

  const tour =
    tours.find(
      t => t.ID === id
    );

  if (!tour) return;


  const modal =
    document.getElementById(
      "modal"
    );


  modal.dataset.tourId =
    tour.ID;


  const body =
    document.getElementById(
      "modalBody"
    );


  /*
   * Hiện thông tin TOUR ngay lập tức
   *
   * Chưa tải ảnh
   */

  body.innerHTML = `

    <div class="tour-detail">

      <div class="modal-title">
        ${tour.NAME_RU || ""}
      </div>

      ${
        tour.DESCRIPTION_RU
        ?
        `
        <div class="tour-description">
          ${tour.DESCRIPTION_RU}
        </div>
        `
        :
        ""
      }

      ${
        tour.PRICE
        ?
        `
        <div class="price">
          $${tour.PRICE}
        </div>
        `
        :
        ""
      }

      <div
        id="galleryLoading"
        class="gallery-loading"
      >
        Загрузка фотографий...
      </div>

      <div
        id="tourGallery"
        class="gallery"
      >
      </div>

    </div>

  `;


  modal.style.display =
    "flex";


  /*
   * =================================
   * BẮT ĐẦU LOAD ẢNH
   * =================================
   */

  const gallery =
    document.getElementById(
      "tourGallery"
    );


  const loading =
    document.getElementById(
      "galleryLoading"
    );


  try {

    const response =
      await fetch(
        API_URL +
        "?action=images&id=" +
        encodeURIComponent(
          tour.DRIVE_FOLDER_ID
        )
      );


    const images =
      await response.json();


    /*
     * Lưu ảnh vào tour hiện tại
     */

    tour.IMAGES =
      images;


    /*
     * Không có ảnh
     */

    if (
      !Array.isArray(images) ||
      images.length === 0
    ) {

      loading.textContent =
        "Фотографии отсутствуют";

      return;

    }


    loading.style.display =
      "none";


    /*
     * Hiển thị gallery
     */

    gallery.innerHTML =
      images
        .map(
          (image, index) => `

          <div
            class="gallery-item"
            onclick="openLightbox(${index})"
          >

            <img
              src="${image.url}"
              alt="${tour.NAME_RU || ""}"
              loading="lazy"
            >

            <div
              class="gallery-overlay"
            >
              🔍
            </div>

          </div>

        `
        )
        .join("");


  } catch (error) {

    console.error(error);


    loading.textContent =
      "Не удалось загрузить фотографии.";

  }

}

let currentImageIndex = 0;


/* =========================
   OPEN LIGHTBOX
========================= */

function openLightbox(index) {

  const tour =
    tours.find(
      t =>
        t.ID === getCurrentTourId()
    );

  if (!tour) return;

  const images =
    tour.IMAGES || [];

  if (!images.length) return;

  currentImageIndex = index;

  showLightboxImage();

}


/* =========================
   GET CURRENT TOUR
========================= */

function getCurrentTourId() {

  const modal =
    document.getElementById("modal");

  return modal.dataset.tourId;

}


/* =========================
   SHOW IMAGE
========================= */

function showLightboxImage() {

  const tour =
    tours.find(
      t =>
        t.ID === getCurrentTourId()
    );

  if (!tour) return;

  const images =
    tour.IMAGES || [];

  if (!images.length) return;


  const image =
    images[currentImageIndex];


  const lightboxImage =
    document.getElementById(
      "lightboxImage"
    );


  const downloadImage =
    document.getElementById(
      "downloadImage"
    );


  const counter =
    document.getElementById(
      "lightboxCounter"
    );


  lightboxImage.src =
    image.url;


  downloadImage.href =
    image.download;


  counter.textContent =
    `${currentImageIndex + 1} / ${images.length}`;


  document.getElementById(
    "lightbox"
  ).style.display = "flex";


  /*
   * Khi mở ảnh:
   * đưa con trỏ về lightbox để
   * bàn phím hoạt động ngay
   */

  document
    .getElementById("lightbox")
    .focus();

}


/* =========================
   PREVIOUS IMAGE
========================= */

function previousImage() {

  const tour =
    tours.find(
      t =>
        t.ID === getCurrentTourId()
    );

  if (!tour) return;

  const images =
    tour.IMAGES || [];

  if (!images.length) return;


  currentImageIndex--;


  if (currentImageIndex < 0) {

    currentImageIndex =
      images.length - 1;

  }


  showLightboxImage();

}


/* =========================
   NEXT IMAGE
========================= */

function nextImage() {

  const tour =
    tours.find(
      t =>
        t.ID === getCurrentTourId()
    );

  if (!tour) return;

  const images =
    tour.IMAGES || [];

  if (!images.length) return;


  currentImageIndex++;


  if (
    currentImageIndex >=
    images.length
  ) {

    currentImageIndex = 0;

  }


  showLightboxImage();

}


/* =========================
   CLOSE LIGHTBOX
========================= */

function closeLightbox() {

  const lightbox =
    document.getElementById(
      "lightbox"
    );

  lightbox.style.display =
    "none";

}


/* =========================
   KEYBOARD CONTROL
========================= */

document.addEventListener(
  "keydown",
  function(event) {

    const lightbox =
      document.getElementById(
        "lightbox"
      );


    /*
     * Nếu lightbox đang đóng
     * thì không làm gì
     */

    if (
      !lightbox ||
      lightbox.style.display !== "flex"
    ) {

      return;

    }


    /*
     * Mũi tên trái
     */

    if (
      event.key === "ArrowLeft"
    ) {

      event.preventDefault();

      previousImage();

      return;

    }


    /*
     * Mũi tên phải
     */

    if (
      event.key === "ArrowRight"
    ) {

      event.preventDefault();

      nextImage();

      return;

    }


    /*
     * ESC
     */

    if (
      event.key === "Escape"
    ) {

      event.preventDefault();

      closeLightbox();

      return;

    }

  }
);


/* =========================
   TOUCH / SWIPE
========================= */

let touchStartX = 0;
let touchStartY = 0;

let touchEndX = 0;
let touchEndY = 0;


const lightbox =
  document.getElementById(
    "lightbox"
  );


lightbox.addEventListener(
  "touchstart",
  function(event) {

    if (!event.touches.length) {
      return;
    }

    touchStartX =
      event.touches[0].clientX;

    touchStartY =
      event.touches[0].clientY;

  },
  { passive: true }
);


lightbox.addEventListener(
  "touchend",
  function(event) {

    if (!event.changedTouches.length) {
      return;
    }

    touchEndX =
      event.changedTouches[0].clientX;

    touchEndY =
      event.changedTouches[0].clientY;


    handleSwipe();

  },
  { passive: true }
);


function handleSwipe() {

  const differenceX =
    touchEndX - touchStartX;


  const differenceY =
    touchEndY - touchStartY;


  /*
   * Chỉ xử lý vuốt ngang.
   * Không xử lý nếu người dùng
   * đang vuốt lên/xuống.
   */

  if (
    Math.abs(differenceX) <
    50
  ) {

    return;

  }


  if (
    Math.abs(differenceX) <
    Math.abs(differenceY)
  ) {

    return;

  }


  /*
   * Vuốt sang trái
   * → ảnh tiếp theo
   */

  if (differenceX < 0) {

    nextImage();

  }


  /*
   * Vuốt sang phải
   * → ảnh trước
   */

  else {

    previousImage();

  }

}

document
  .getElementById("closeModal")
  .addEventListener(
    "click",
    () => {

      document.getElementById("modal")
        .style.display = "none";

    }
  );


document
  .getElementById("searchInput")
  .addEventListener(
    "input",
    renderTours
  );


document
  .querySelectorAll(".category")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".category")
          .forEach(btn =>
            btn.classList.remove("active")
          );

        button.classList.add("active");

        currentCategory =
          button.dataset.category;

        renderTours();

      }
    );

  });


loadTours();
