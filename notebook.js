"use strict";

/*
 * 本子页逻辑
 * ============
 * 1. 读取 window.APP_DATA,渲染成果卡片;
 * 2. 把预置便签按 anchorId 挂到对应卡片上(只读视角);
 * 3. URL 带 ?edit 时进入编辑模式:拖拽、缩放、双击写字、删除、新增便签;
 * 4. “导出 JSON”把当前便签(锚定关系 + 相对偏移 + 文案)下载成 notes.json;
 * 5. 编辑模式下的改动会暂存到 localStorage,刷新不丢,导出后清空。
 */

(function () {
  const DATA = window.APP_DATA || { works: [], notes: [] };

  const DRAFT_KEY = "allmind.notebook.draft.v1";

  /* 三种预设尺寸,导出后若带 w/h 则以 w/h 为准(支持自由缩放)。 */
  const SIZES = {
    small: { w: 176, h: 128 },
    medium: { w: 236, h: 176 },
    large: { w: 320, h: 256 },
  };
  const COLORS = ["yellow", "pink", "green", "blue", "gray"];

  const board = document.getElementById("board");
  const editHint = document.getElementById("edit-hint");
  const exportButton = document.getElementById("export-notes");

  /* ?edit 决定是否进入编辑模式。 */
  const editMode = new URLSearchParams(window.location.search).has("edit");

  /* 当前便签数据:编辑模式优先读草稿,否则用预置数据。 */
  let notes = loadNotes();
  let topZ = 6;
  let drag = null;
  let inputTimer = 0;

  if (editMode) {
    document.body.classList.add("editing");
    editHint.hidden = false;
    exportButton.hidden = false;
  }

  /* ==================== 数据读取 ==================== */

  function loadNotes() {
    if (editMode) {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.notes)) return parsed.notes;
        }
      } catch (error) {
        console.warn("读取便签草稿失败:", error);
      }
    }
    return (DATA.notes || []).map((note) => ({ ...note }));
  }

  /* ==================== 渲染成果卡片 ==================== */

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

  function renderWorkCard(work) {
    const card = document.createElement("article");
    card.className = "work-card";
    card.dataset.id = work.id;

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

    if (editMode) {
      const addButton = document.createElement("button");
      addButton.className = "work-add-note";
      addButton.type = "button";
      addButton.textContent = "+ 在这张卡片上贴便签";
      card.appendChild(addButton);
    }

    return card;
  }

  /* ==================== 渲染便签 ==================== */

  function noteSize(note) {
    const preset = SIZES[note.size] || SIZES.medium;
    return {
      w: typeof note.w === "number" ? note.w : preset.w,
      h: typeof note.h === "number" ? note.h : preset.h,
    };
  }

  function createNoteElement(note) {
    const size = noteSize(note);
    const element = document.createElement("div");
    element.className = "note";
    element.dataset.id = note.id;
    element.dataset.anchor = note.anchorId;
    element.dataset.color = note.color;
    element.dataset.size = note.size || "medium";
    element.dataset.tilt = String(note.tilt || 0);

    element.style.left = note.x + "px";
    element.style.top = note.y + "px";
    element.style.width = size.w + "px";
    element.style.height = size.h + "px";
    element.style.zIndex = String(++topZ);
    element.style.setProperty("--tilt", (note.tilt || 0) + "deg");

    element.innerHTML =
      '<span class="tape" aria-hidden="true"></span>' +
      (editMode
        ? '<button class="note-del" type="button" aria-label="删除这条便签">×</button>'
        : "") +
      '<div class="note-body" role="textbox" aria-multiline="true" tabindex="0" ' +
      'data-placeholder="双击这里写批注…"></div>' +
      (editMode ? '<span class="note-resize" aria-hidden="true"></span>' : "");

    element.querySelector(".note-body").textContent = note.text;
    return element;
  }

  function render() {
    board.innerHTML = "";

    DATA.works.forEach((work) => board.appendChild(renderWorkCard(work)));

    notes.forEach((note) => {
      const card = board.querySelector('.work-card[data-id="' + note.anchorId + '"]');
      if (!card) {
        /* 便签锚定的卡片不存在时跳过,避免静默丢失。 */
        console.warn("便签 " + note.id + " 锚定的成果不存在:", note.anchorId);
        return;
      }
      card.appendChild(createNoteElement(note));
    });

    topZ = 6 + notes.length;
  }

  /* ==================== 便签编辑交互 ==================== */

  function bringToFront(noteElement) {
    noteElement.style.zIndex = String(++topZ);
  }

  function enterEditing(noteElement) {
    exitEditing();
    noteElement.classList.add("is-editing");

    const body = noteElement.querySelector(".note-body");
    body.contentEditable = "true";
    body.focus();

    const range = document.createRange();
    range.selectNodeContents(body);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function exitEditing() {
    const editing = board.querySelectorAll(".note.is-editing");
    if (!editing.length) return;

    editing.forEach((element) => {
      element.classList.remove("is-editing");
      element.querySelector(".note-body").contentEditable = "false";
    });

    saveDraft();
  }

  /* 从 DOM 回读所有便签的当前状态,是导出与草稿的唯一数据来源。 */
  function collectNotesFromDom() {
    return Array.from(board.querySelectorAll(".note")).map((element) => ({
      id: element.dataset.id,
      anchorId: element.dataset.anchor,
      x: element.offsetLeft,
      y: element.offsetTop,
      w: element.offsetWidth,
      h: element.offsetHeight,
      size: element.dataset.size,
      color: element.dataset.color,
      tilt: Number(element.dataset.tilt) || 0,
      text: element.querySelector(".note-body").innerText,
    }));
  }

  function saveDraft() {
    if (!editMode) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ version: 1, notes: collectNotesFromDom() }),
      );
    } catch (error) {
      console.warn("保存便签草稿失败:", error);
    }
  }

  function onPointerDown(event) {
    if (!editMode) return;
    if (event.button !== 0) return;

    const noteElement = event.target.closest(".note");
    if (!noteElement) {
      exitEditing();
      return;
    }

    if (event.target.closest(".note-del")) return;

    if (!noteElement.classList.contains("is-editing")) exitEditing();
    bringToFront(noteElement);

    /* 正在写字的便签不响应拖拽,避免影响文字选中。 */
    if (noteElement.classList.contains("is-editing")) return;

    drag = {
      noteElement: noteElement,
      isResize: Boolean(event.target.closest(".note-resize")),
      startX: event.clientX,
      startY: event.clientY,
      startLeft: noteElement.offsetLeft,
      startTop: noteElement.offsetTop,
      startWidth: noteElement.offsetWidth,
      startHeight: noteElement.offsetHeight,
      moved: false,
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(event) {
    if (!drag) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) return;
      drag.moved = true;
      drag.noteElement.classList.add("is-dragging");
    }

    if (drag.isResize) {
      drag.noteElement.style.width = Math.max(140, drag.startWidth + deltaX) + "px";
      drag.noteElement.style.height = Math.max(96, drag.startHeight + deltaY) + "px";
    } else {
      /* 便签可以整体悬出卡片,所以这里不做边界钳制。 */
      drag.noteElement.style.left = drag.startLeft + deltaX + "px";
      drag.noteElement.style.top = drag.startTop + deltaY + "px";
    }
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    if (drag) {
      drag.noteElement.classList.remove("is-dragging");
      if (drag.moved) saveDraft();
    }
    drag = null;
  }

  /* ==================== 新增与删除 ==================== */

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function createId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addNoteToCard(cardElement) {
    exitEditing();

    const note = {
      id: createId(),
      anchorId: cardElement.dataset.id,
      x: Math.round(30 + Math.random() * 40),
      y: Math.round(20 + Math.random() * 40),
      size: "medium",
      color: randomItem(COLORS),
      tilt: Number((Math.random() * 3.2 - 1.6).toFixed(2)),
      text: "",
    };

    const element = createNoteElement(note);
    cardElement.appendChild(element);
    enterEditing(element);
    saveDraft();
  }

  function deleteNote(noteElement) {
    noteElement.remove();
    saveDraft();
  }

  /* ==================== 导出 JSON ==================== */

  function exportJson() {
    const payload = { notes: collectNotesFromDom() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "notes.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    window.localStorage.removeItem(DRAFT_KEY);
  }

  /* ==================== 事件绑定 ==================== */

  board.addEventListener("pointerdown", onPointerDown);

  board.addEventListener("dblclick", (event) => {
    if (!editMode) return;
    const body = event.target.closest(".note-body");
    if (!body) return;
    enterEditing(body.closest(".note"));
  });

  board.addEventListener("click", (event) => {
    const del = event.target.closest(".note-del");
    if (del) deleteNote(del.closest(".note"));

    const addButton = event.target.closest(".work-add-note");
    if (addButton) addNoteToCard(addButton.closest(".work-card"));
  });

  board.addEventListener("input", () => {
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(saveDraft, 400);
  });

  board.addEventListener("keydown", (event) => {
    if (event.key === "Escape") exitEditing();
  });

  exportButton.addEventListener("click", exportJson);

  window.addEventListener("beforeunload", () => {
    if (editMode && board.querySelector(".note.is-editing")) saveDraft();
  });

  /* ==================== 启动 ==================== */

  render();
})();
