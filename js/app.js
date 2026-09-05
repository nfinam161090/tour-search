(() => {
  "use strict";

  const listView = document.getElementById("listView");
  const detailView = document.getElementById("detailView");
  const searchInput = document.getElementById("searchInput");
  const clearSearch = document.getElementById("clearSearch");
  const categoryBar = document.getElementById("categoryBar");
  const tourList = document.getElementById("tourList");
  const listStatus = document.getElementById("listStatus");
  const detailStatus = document.getElementById("detailStatus");
  const tourDetail = document.getElementById("tourDetail");
  const backBtn = document.getElementById("backBtn");
  const brandBtn = document.getElementById("brandBtn");

  const state = {
    categories: [],
    tours: [],
    selectedCategory: "ALL",
    query: "",
    detailCache: new Map(),
    lastTourId: null
  };

  function assertApi() {
    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      throw new Error("Chưa điền API_URL trong js/config.js");
    }
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function matches(tour, query) {
    if (!query) return true;
    const haystack = normalize([
      tour.name_ru,
      tour.name_en,
      tour.keywords_ru,
      tour.keywords_en,
      tour.id
    ].join(" "));

    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return terms.every(term => haystack.includes(term));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  }

  async function api(params) {
    assertApi();
    const url = `${API_URL}${API_URL.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || data.success === false) {
      throw new Error(data?.error || "API trả dữ liệu không hợp lệ");
    }
    return data;
  }

  function categoryName(code) {
    const item = state.categories.find(c => String(c.code).toUpperCase() === String(code).toUpperCase());
    return item?.name_ru || code;
  }

  function setStatus(element, message = "", type = "") {
    element.textContent = message;
    element.className = `status ${type}`.trim();
  }

  function renderCategories() {
    const buttons = [
      `<button class="category-btn ${state.selectedCategory === "ALL" ? "active" : ""}" data-category="ALL" type="button">Все туры</button>`
    ];

    for (const category of state.categories) {
      const code = String(category.code).toUpperCase();
      buttons.push(`
        <button class="category-btn ${state.selectedCategory === code ? "active" : ""}" data-category="${escapeHtml(code)}" type="button">
          ${escapeHtml(category.name_ru)}
        </button>
      `);
    }

    categoryBar.innerHTML = buttons.join("");
  }

  function getVisibleTours() {
    return state.tours.filter(tour => {
      const categoryOk = state.selectedCategory === "ALL" ||
        String(tour.category).toUpperCase() === state.selectedCategory;
      return categoryOk && matches(tour, state.query);
    });
  }

  function renderTours() {
    const tours = getVisibleTours();

    if (!tours.length) {
      tourList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⌕</div>
          <h3>Ничего не найдено</h3>
          <p>Попробуйте другое слово или выберите другую категорию.</p>
        </div>
      `;
      setStatus(listStatus, "");
      return;
    }

    const groups = [];
    const byCategory = new Map();
    const categoryOrder = new Map(state.categories.map(c => [String(c.code).toUpperCase(), Number(c.sort_order ?? 999999)]));

    for (const tour of tours) {
      const code = String(tour.category).toUpperCase();
      if (!byCategory.has(code)) {
        byCategory.set(code, []);
        groups.push(code);
      }
      byCategory.get(code).push(tour);
    }

    // Keep category order from CATEGORIES.
    groups.sort((a, b) => (categoryOrder.get(a) ?? 999999) - (categoryOrder.get(b) ?? 999999));

    let html = "";
    for (const code of groups) {
      const items = byCategory.get(code) || [];
      if (state.selectedCategory === "ALL" && !state.query) {
        html += `<section class="tour-group"><h2>${escapeHtml(categoryName(code))}</h2>`;
      } else if (state.selectedCategory === "ALL") {
        html += `<section class="tour-group"><h2>${escapeHtml(categoryName(code))}</h2>`;
      }

      html += `<div class="tour-grid">`;
      for (const tour of items) {
        html += `
          <button class="tour-card" type="button" data-tour-id="${escapeHtml(tour.id)}">
            <span class="tour-card-title">${escapeHtml(tour.name_ru || tour.name_en || tour.id)}</span>
            ${tour.name_en ? `<span class="tour-card-en">${escapeHtml(tour.name_en)}</span>` : ""}
          </button>
        `;
      }
      html += `</div>`;
      if (state.selectedCategory === "ALL" || state.query) html += `</section>`;
    }

    // When a category is selected, show its items without an extra group heading.
    if (state.selectedCategory !== "ALL" && !state.query) {
      const code = state.selectedCategory;
      const items = byCategory.get(code) || [];
      html = `
        <section class="tour-group active-group">
          <h2>${escapeHtml(categoryName(code))}</h2>
          <div class="tour-grid">
            ${items.map(tour => `
              <button class="tour-card" type="button" data-tour-id="${escapeHtml(tour.id)}">
                <span class="tour-card-title">${escapeHtml(tour.name_ru || tour.name_en || tour.id)}</span>
                ${tour.name_en ? `<span class="tour-card-en">${escapeHtml(tour.name_en)}</span>` : ""}
              </button>
            `).join("")}
          </div>
        </section>
      `;
    }

    tourList.innerHTML = html;
    setStatus(listStatus, `${tours.length} tour${tours.length === 1 ? "" : "s"}`);
  }

  function showList() {
    detailView.hidden = true;
    listView.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openTour(tourId) {
    const id = String(tourId).trim().toUpperCase();
    state.lastTourId = id;
    listView.hidden = true;
    detailView.hidden = false;
    tourDetail.innerHTML = "";
    setStatus(detailStatus, "Загрузка тура…");
    window.scrollTo({ top: 0, behavior: "instant" });

    try {
      let data = state.detailCache.get(id);
      if (!data) {
        data = await api({ action: "detail", id });
        state.detailCache.set(id, data);
      }
      renderDetail(data);
      setStatus(detailStatus, "");
    } catch (error) {
      console.error(error);
      tourDetail.innerHTML = `
        <div class="error-state">
          <h3>Не удалось открыть тур</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="secondary-btn" type="button" id="retryTour">Повторить</button>
        </div>
      `;
      setStatus(detailStatus, "Ошибка", "error");
      document.getElementById("retryTour")?.addEventListener("click", () => openTour(id));
    }
  }

  function renderDetail(data) {
    const tour = data.tour || {};
    const details = data.details || {};
    const images = Array.isArray(data.images) ? data.images : [];

    const imageHtml = images.length
      ? `
        <div class="gallery-main-wrap">
          <button class="gallery-main" type="button" data-image-index="0">
            <img src="${escapeHtml(images[0].medium || images[0].thumbnail || "")}" alt="${escapeHtml(tour.name_ru || "Tour photo")}" loading="eager" decoding="async">
          </button>
        </div>
        <div class="gallery-thumbs" aria-label="Фотографии">
          ${images.map((image, i) => `
            <button class="thumb" type="button" data-image-index="${i}" aria-label="Фото ${i + 1}">
              <img src="${escapeHtml(image.thumbnail || image.medium || "")}" alt="" loading="lazy" decoding="async">
            </button>
          `).join("")}
        </div>
      `
      : `<div class="no-images">Фото пока отсутствуют.</div>`;

    tourDetail.innerHTML = `
      <div class="detail-head">
        <div>
          <div class="eyebrow">${escapeHtml(categoryName(tour.category))}</div>
          <h1>${escapeHtml(tour.name_ru || tour.name_en || tour.id)}</h1>
          ${tour.name_en ? `<div class="detail-en">${escapeHtml(tour.name_en)}</div>` : ""}
        </div>
        ${details.price ? `<div class="price">${escapeHtml(details.price)}</div>` : ""}
      </div>

      ${imageHtml}

      <div class="detail-content">
        ${details.description_ru ? `
          <section class="detail-section">
            <h2>Описание</h2>
            <div class="detail-text">${nl2br(details.description_ru)}</div>
          </section>
        ` : ""}

        ${details.program_ru ? `
          <section class="detail-section">
            <h2>Программа</h2>
            <div class="detail-text">${nl2br(details.program_ru)}</div>
          </section>
        ` : ""}

        ${details.pickup ? `
          <section class="detail-section detail-info-row">
            <strong>Трансфер</strong>
            <span>${escapeHtml(details.pickup)}</span>
          </section>
        ` : ""}
      </div>
    `;

    tourDetail.querySelectorAll("[data-image-index]").forEach(button => {
      button.addEventListener("click", () => {
        const idx = Number(button.dataset.imageIndex || 0);
        if (window.TourViewer) window.TourViewer.open(images, idx);
      });
    });
  }

  async function loadList() {
    setStatus(listStatus, "Загрузка списка…");
    try {
      const data = await api({ action: "list" });
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      state.tours = Array.isArray(data.tours) ? data.tours : [];
      renderCategories();
      renderTours();
    } catch (error) {
      console.error(error);
      tourList.innerHTML = `
        <div class="error-state">
          <h3>Не удалось загрузить список туров</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="secondary-btn" type="button" id="retryList">Повторить</button>
        </div>
      `;
      setStatus(listStatus, "Ошибка", "error");
      document.getElementById("retryList")?.addEventListener("click", loadList);
    }
  }

  categoryBar.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.selectedCategory = String(button.dataset.category).toUpperCase();
    renderCategories();
    renderTours();
  });

  tourList.addEventListener("click", event => {
    const card = event.target.closest("[data-tour-id]");
    if (!card) return;
    openTour(card.dataset.tourId);
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim();
    clearSearch.hidden = !state.query;
    renderTours();
  });

  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    state.query = "";
    clearSearch.hidden = true;
    searchInput.focus();
    renderTours();
  });

  backBtn.addEventListener("click", showList);
  brandBtn.addEventListener("click", () => {
    state.selectedCategory = "ALL";
    state.query = "";
    searchInput.value = "";
    clearSearch.hidden = true;
    showList();
    renderCategories();
    renderTours();
  });

  window.addEventListener("popstate", () => showList());

  loadList();
})();
