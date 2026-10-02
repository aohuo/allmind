"use strict";

/*
 * 成果展示页逻辑
 * ================
 * 1. 读取 window.APP_DATA.works,渲染成果卡片;
 * 2. 根据成果的 category 自动生成筛选按钮;
 * 3. 点击图片卡片打开灯箱全屏查看,Esc / 点击遮罩 / 关闭按钮退出。
 */

(function () {
  const DATA = window.APP_DATA || { works: [] };

  const board = document.getElementById("board");
  const filterBar = document.getElementById("filter-bar");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");

  let activeFilter = "all";

  /* ==================== 渲染媒体区 ==================== */

  function renderMedia(work) {
    const media = document.createElement("div");
    media.className = "work-media";
    let hasContent = false;

    if (work.type === "video") {
      const video = work.video || { kind: "file", src: "" };

      if (video.kind === "embed" && video.src) {
        const iframe = document.createElement("iframe");
        iframe.src = video.src;
        iframe.title = work.title;
        iframe.loading = "lazy";
        iframe.allowFullscreen = true;
        iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
        media.appendChild(iframe);
        hasContent = true;
      } else if (video.src) {
        const el = document.createElement("video");
        el.src = video.src;
        if (work.poster) el.poster = work.poster;
        el.controls = true;
        el.preload = "metadata";
        el.playsInline = true;
        media.appendChild(el);
        hasContent = true;
      }

      if (hasContent) {
        const badge = document.createElement("span");
        badge.className = "play-badge";
        badge.textContent = "▶ VIDEO";
        media.appendChild(badge);
      }
    } else if (work.type === "image" && work.image) {
      const img = document.createElement("img");
      img.src = work.image;
      img.alt = work.title;
      img.loading = "lazy";
      media.appendChild(img);
      hasContent = true;
    }

    if (!hasContent) {
      media.classList.add("is-placeholder");
      const placeholder = document.createElement("span");
      placeholder.className = "media-placeholder";
      placeholder.textContent = work.type === "video" ? "VIDEO" : "IMAGE";
      media.appendChild(placeholder);
    }

    return media;
  }

  /* ==================== 渲染卡片 ==================== */

  function renderCard(work) {
    const card = document.createElement("article");
    card.className = "work-card";
    card.dataset.category = work.category || "";

    card.appendChild(renderMedia(work));

    const title = document.createElement("h3");
    title.textContent = work.title;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "work-meta";
    const date = document.createElement("span");
    date.textContent = work.date || "";
    const category = document.createElement("span");
    category.textContent = work.category || "";
    meta.append(date, document.createElement("span"), category);
    meta.querySelectorAll("span")[1].className = "dot";
    card.appendChild(meta);

    if (work.tags && work.tags.length) {
      const tags = document.createElement("div");
      tags.className = "work-tags";
      work.tags.forEach((tag) => {
        const span = document.createElement("span");
        span.textContent = tag;
        tags.appendChild(span);
      });
      card.appendChild(tags);
    }

    if (work.desc) {
      const desc = document.createElement("p");
      desc.className = "work-desc";
      desc.textContent = work.desc;
      card.appendChild(desc);
    }

    return card;
  }

  /* ==================== 分类筛选 ==================== */

  function renderFilters() {
    const categories = ["all"].concat(
      Array.from(new Set(DATA.works.map((work) => work.category).filter(Boolean))),
    );

    categories.forEach((category) => {
      const button = document.createElement("button");
      button.className = "filter-btn";
      button.type = "button";
      button.dataset.filter = category;
      button.textContent = category === "all" ? "全部" : category;
      filterBar.appendChild(button);
    });
  }

  function applyFilter() {
    filterBar.querySelectorAll(".filter-btn").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === activeFilter);
    });

    board.querySelectorAll(".work-card").forEach((card) => {
      card.hidden = activeFilter !== "all" && card.dataset.category !== activeFilter;
    });
  }

  /* ==================== 灯箱 ==================== */

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    /* 关闭后立即释放图片源,避免大图常驻内存。 */
    lightboxImg.removeAttribute("src");
    lightboxImg.removeAttribute("alt");
  }

  /* ==================== 事件绑定 ==================== */

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;
    activeFilter = button.dataset.filter;
    applyFilter();
  });

  board.addEventListener("click", (event) => {
    const img = event.target.closest(".work-media img");
    if (img) openLightbox(img.src, img.alt);
  });

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target === lightboxClose) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });

  /* ==================== 启动 ==================== */

  renderFilters();
  DATA.works.forEach((work) => board.appendChild(renderCard(work)));
  applyFilter();
})();
