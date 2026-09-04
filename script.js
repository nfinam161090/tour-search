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
      document.getElementById("searchInput").value
    );

  const results =
    tours.filter(tour => {

      const categoryMatch =
        currentCategory === "ALL" ||
        tour.CATEGORY === currentCategory;

      const searchableText = normalize(
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
        searchableText.includes(search);

      return categoryMatch && searchMatch;

    });

  const container =
    document.getElementById("results");

  if (!results.length) {

    container.innerHTML = `
      <div class="no-results">
        Ничего не найдено.
      </div>
    `;

    return;
  }

  container.innerHTML =
    results.map(tour => {

      const image =
        tour.MAIN_IMAGE ||
        (
          tour.IMAGES &&
          tour.IMAGES.length
            ? tour.IMAGES[0]
            : ""
        );

      return `
        <article
          class="card"
          onclick="openTour('${tour.ID}')"
        >

          ${
            image
            ?
            `
            <img
              class="card-image"
              src="${image}"
              alt="${tour.NAME_RU || ""}"
              loading="lazy"
            >
            `
            :
            `
            <div class="card-image no-image">
              Нет изображения
            </div>
            `
          }

          <div class="card-body">

            <div class="card-title">
              ${tour.NAME_RU || ""}
            </div>

            <div class="card-description">
              ${tour.DESCRIPTION_RU || ""}
            </div>

            <div class="price">
              ${
                tour.PRICE
                ? "$" + tour.PRICE
                : ""
              }
            </div>

          </div>

        </article>
      `;

    }).join("");

}


function openTour(id) {

  const tour =
    tours.find(t => t.ID === id);

  if (!tour) return;

  const modal =
    document.getElementById("modal");

  const body =
    document.getElementById("modalBody");


  let galleryHTML = "";


  if (
    tour.IMAGES &&
    tour.IMAGES.length
  ) {

    galleryHTML =
      tour.IMAGES
        .map(image => `
          <img
            src="${image}"
            alt="${tour.NAME_RU || ""}"
            loading="lazy"
          >
        `)
        .join("");

  }


  body.innerHTML = `

    <div class="modal-title">
      ${tour.NAME_RU || ""}
    </div>

    <p>
      ${tour.DESCRIPTION_RU || ""}
    </p>

    <div class="price">
      ${
        tour.PRICE
        ? "$" + tour.PRICE
        : ""
      }
    </div>

    <div class="gallery">
      ${galleryHTML}
    </div>

  `;


  modal.style.display = "flex";

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
