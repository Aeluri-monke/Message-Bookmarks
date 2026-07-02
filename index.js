// Message Bookmarks & Search
// Manual bookmarks + live in-chat search, with a floating panel to jump around long chats.

import { extension_settings, getContext } from "../../../extensions.js";
import {
    eventSource,
    event_types,
    chat_metadata,
    saveSettingsDebounced,
} from "../../../../script.js";

const MODULE = "message_bookmarks";
const defaultSettings = {
    enabled: true,
};

const CATEGORIES = {
    romantic: { emoji: "💋", color: "#ff8fb3", label: "Romantic" },
    conflict: { emoji: "⚔️", color: "#ff6b6b", label: "Conflict" },
    emotional: { emoji: "😭", color: "#6ba3ff", label: "Emotional" },
    plot: { emoji: "🎲", color: "#b98bff", label: "Plot" },
    other: { emoji: "📌", color: "#9aa0a6", label: "Other" },
};

// ---------- settings ----------

function getSettings() {
    if (extension_settings[MODULE] === undefined) {
        extension_settings[MODULE] = structuredClone(defaultSettings);
    }
    for (const key in defaultSettings) {
        if (extension_settings[MODULE][key] === undefined) {
            extension_settings[MODULE][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE];
}

function addExtensionSettings(settings) {
    const settingsContainer =
        document.getElementById("message_bookmarks_container") ??
        document.getElementById("extensions_settings2");
    if (!settingsContainer) return;

    const inlineDrawer = document.createElement("div");
    inlineDrawer.classList.add("inline-drawer");
    settingsContainer.append(inlineDrawer);

    const inlineDrawerToggle = document.createElement("div");
    inlineDrawerToggle.classList.add("inline-drawer-toggle", "inline-drawer-header");

    const title = document.createElement("b");
    title.textContent = "🔖 Message Bookmarks & Search";

    const inlineDrawerIcon = document.createElement("div");
    inlineDrawerIcon.classList.add("inline-drawer-icon", "fa-solid", "fa-circle-chevron-down", "down");

    inlineDrawerToggle.append(title, inlineDrawerIcon);

    const inlineDrawerContent = document.createElement("div");
    inlineDrawerContent.classList.add("inline-drawer-content");
    inlineDrawerContent.id = "mb_settings";

    inlineDrawer.append(inlineDrawerToggle, inlineDrawerContent);

    const enabledLabel = document.createElement("label");
    enabledLabel.classList.add("checkbox_label");
    enabledLabel.htmlFor = "messageBookmarksEnabled";
    const enabledCheckbox = document.createElement("input");
    enabledCheckbox.id = "messageBookmarksEnabled";
    enabledCheckbox.type = "checkbox";
    enabledCheckbox.checked = settings.enabled;
    enabledCheckbox.addEventListener("change", () => {
        settings.enabled = enabledCheckbox.checked;
        saveSettingsDebounced();
        applyEnabledState();
    });
    const enabledText = document.createElement("span");
    enabledText.textContent = "Enabled";
    enabledLabel.append(enabledCheckbox, enabledText);
    inlineDrawerContent.append(enabledLabel);

    const hint = document.createElement("small");
    hint.textContent = "Bookmarks live in each chat's metadata, so they save and export with the chat itself.";
    hint.style.opacity = "0.6";
    inlineDrawerContent.append(hint);
}

function applyEnabledState() {
    const settings = getSettings();
    $("#mb-float-btn").toggle(settings.enabled);
    if (!settings.enabled) closePanel();
}

// ---------- bookmark storage (lives in chat metadata, so it travels with the chat file) ----------

function getBookmarks() {
    if (!chat_metadata.messageBookmarks) {
        chat_metadata.messageBookmarks = [];
    }
    return chat_metadata.messageBookmarks;
}

function persistBookmarks() {
    const context = getContext();
    if (typeof context.saveMetadata === "function") {
        context.saveMetadata();
    }
}

function addBookmark(mesId, label, category) {
    const bookmarks = getBookmarks();
    bookmarks.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mesId: String(mesId),
        label: label && label.trim() ? label.trim() : `Message #${mesId}`,
        category: CATEGORIES[category] ? category : "other",
        timestamp: Date.now(),
    });
    persistBookmarks();
    renderBookmarksTab();
}

function removeBookmark(id) {
    const bookmarks = getBookmarks();
    const idx = bookmarks.findIndex((b) => b.id === id);
    if (idx !== -1) {
        bookmarks.splice(idx, 1);
        persistBookmarks();
        renderBookmarksTab();
    }
}

// ---------- jump / highlight ----------

function jumpToMessage(mesId) {
    const target = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
    if (!target) {
        if (window.toastr) {
            toastr.warning("That message isn't currently rendered — try scrolling near it first.");
        }
        return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("mb-flash");
    setTimeout(() => target.classList.remove("mb-flash"), 1400);
    closePanel();
}

function snippetOf(mesId) {
    const context = getContext();
    const msg = context.chat.find((m, i) => String(i) === String(mesId));
    if (!msg) return "";
    const raw = (msg.mes || "").replace(/\n+/g, " ").trim();
    return raw.length > 90 ? raw.slice(0, 90) + "…" : raw;
}

// ---------- add-bookmark mini modal ----------

let pendingMesId = null;

function openAddModal(mesId) {
    pendingMesId = mesId;
    const $modal = $("#mb-add-modal");
    $modal.find("#mb-add-label").val("").attr("placeholder", `Message #${mesId}`);
    $modal.find("#mb-add-category").val("other");
    $modal.find("#mb-add-preview").text(snippetOf(mesId));
    $modal.fadeIn(120);
    $modal.find("#mb-add-label").trigger("focus");
}

function closeAddModal() {
    $("#mb-add-modal").fadeOut(120);
    pendingMesId = null;
}

// ---------- panel ----------

function togglePanel() {
    const $panel = $("#mb-panel");
    if ($panel.is(":visible")) {
        closePanel();
    } else {
        $panel.fadeIn(120);
        renderBookmarksTab();
        $("#mb-search-input").trigger("focus");
    }
}

function closePanel() {
    $("#mb-panel").fadeOut(120);
}

function switchTab(tab) {
    $(".mb-tab").removeClass("active");
    $(`.mb-tab[data-tab="${tab}"]`).addClass("active");
    $(".mb-tabpane").hide();
    $(`#mb-tab-${tab}`).show();
}

// ---------- search ----------

function runSearch(query) {
    const $results = $("#mb-search-results");
    $results.empty();

    const q = query.trim().toLowerCase();
    if (!q) {
        $results.append('<div class="mb-empty">Type something to search the chat…</div>');
        return;
    }

    const context = getContext();
    const chat = context.chat || [];
    const matches = [];

    chat.forEach((msg, index) => {
        const text = (msg.mes || "");
        const lower = text.toLowerCase();
        if (lower.includes(q)) {
            matches.push({ index, msg, text });
        }
    });

    if (matches.length === 0) {
        $results.append('<div class="mb-empty">No matches found.</div>');
        return;
    }

    matches
        .slice()
        .reverse() // most recent first
        .forEach(({ index, msg, text }) => {
            const lowerText = text.toLowerCase();
            const pos = lowerText.indexOf(q);
            const start = Math.max(0, pos - 40);
            const end = Math.min(text.length, pos + q.length + 40);
            let snippet = text.slice(start, end).replace(/\n+/g, " ");
            if (start > 0) snippet = "…" + snippet;
            if (end < text.length) snippet = snippet + "…";

            // highlight the match, case-insensitive, escaping for safety
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`(${escaped})`, "ig");
            const highlighted = $("<div>").text(snippet).html().replace(re, "<mark>$1</mark>");

            const who = msg.is_user ? (msg.name || "You") : (msg.name || "Character");

            const $row = $(`
                <div class="mb-result-row" data-mesid="${index}">
                    <div class="mb-result-meta">
                        <span class="mb-result-who">${who}</span>
                        <span class="mb-result-num">#${index}</span>
                    </div>
                    <div class="mb-result-snippet">${highlighted}</div>
                </div>
            `);
            $row.on("click", () => jumpToMessage(index));
            $results.append($row);
        });
}

// ---------- bookmarks list ----------

let activeCategoryFilter = "all";

function renderBookmarksTab() {
    const $list = $("#mb-bookmark-list");
    $list.empty();

    const bookmarks = getBookmarks()
        .slice()
        .sort((a, b) => Number(a.mesId) - Number(b.mesId));

    const filtered =
        activeCategoryFilter === "all"
            ? bookmarks
            : bookmarks.filter((b) => b.category === activeCategoryFilter);

    if (filtered.length === 0) {
        $list.append('<div class="mb-empty">No bookmarks yet — hover a message and tap 🔖 to save one.</div>');
        return;
    }

    filtered.forEach((b) => {
        const cat = CATEGORIES[b.category] || CATEGORIES.other;
        const $row = $(`
            <div class="mb-bookmark-row" style="border-left-color:${cat.color}">
                <div class="mb-bookmark-main">
                    <span class="mb-bookmark-cat" title="${cat.label}">${cat.emoji}</span>
                    <span class="mb-bookmark-label">${$("<div>").text(b.label).html()}</span>
                    <span class="mb-bookmark-num">#${b.mesId}</span>
                </div>
                <div class="mb-bookmark-snippet">${$("<div>").text(snippetOf(b.mesId)).html()}</div>
                <button class="mb-bookmark-remove" title="Remove bookmark">✕</button>
            </div>
        `);
        $row.on("click", (e) => {
            if ($(e.target).hasClass("mb-bookmark-remove")) return;
            jumpToMessage(b.mesId);
        });
        $row.find(".mb-bookmark-remove").on("click", (e) => {
            e.stopPropagation();
            removeBookmark(b.id);
        });
        $list.append($row);
    });
}

function renderCategoryChips() {
    const $chips = $("#mb-category-chips");
    $chips.empty();
    const all = [{ key: "all", emoji: "🌀", label: "All" }, ...Object.entries(CATEGORIES).map(([key, v]) => ({ key, ...v }))];
    all.forEach((c) => {
        const $chip = $(`<button class="mb-chip ${activeCategoryFilter === c.key ? "active" : ""}" data-cat="${c.key}">${c.emoji} ${c.label}</button>`);
        $chip.on("click", () => {
            activeCategoryFilter = c.key;
            renderCategoryChips();
            renderBookmarksTab();
        });
        $chips.append($chip);
    });
}

// ---------- inject bookmark button into message action row ----------

function injectBookmarkButtons() {
    document.querySelectorAll("#chat .mes").forEach((mesEl) => {
        const buttonsRow = mesEl.querySelector(".mes_buttons, .mes_button_row, .flex-container.flex1.alignitemscenter");
        const target = mesEl.querySelector(".mes_buttons") || buttonsRow;
        if (!target || target.querySelector(".mb-bookmark-btn")) return;

        const mesId = mesEl.getAttribute("mesid");
        if (mesId === null) return;

        const btn = document.createElement("div");
        btn.className = "mes_button mb-bookmark-btn";
        btn.title = "Bookmark this message";
        btn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openAddModal(mesId);
        });
        target.appendChild(btn);
    });
}

// ---------- panel HTML ----------

function buildUI() {
    const floatBtn = $(`
        <div id="mb-float-btn" title="Search & Bookmarks">🔖</div>
    `);
    $("body").append(floatBtn);
    floatBtn.on("click", togglePanel);

    const panel = $(`
        <div id="mb-panel">
            <div class="mb-panel-header">
                <span>🔖 Bookmarks & Search</span>
                <button id="mb-panel-close">✕</button>
            </div>
            <div class="mb-tabs">
                <button class="mb-tab active" data-tab="search">🔍 Search</button>
                <button class="mb-tab" data-tab="bookmarks">⭐ Bookmarks</button>
            </div>
            <div id="mb-tab-search" class="mb-tabpane">
                <input id="mb-search-input" type="text" placeholder="Search this chat…" />
                <div id="mb-search-results" class="mb-scroll"></div>
            </div>
            <div id="mb-tab-bookmarks" class="mb-tabpane" style="display:none">
                <div id="mb-category-chips"></div>
                <div id="mb-bookmark-list" class="mb-scroll"></div>
            </div>
        </div>
    `);
    $("body").append(panel);

    $("#mb-panel-close").on("click", closePanel);
    $(".mb-tab").on("click", function () {
        switchTab($(this).data("tab"));
    });
    $("#mb-search-input").on("input", function () {
        runSearch($(this).val());
    });

    const addModal = $(`
        <div id="mb-add-modal">
            <div class="mb-add-box">
                <div class="mb-add-title">Save bookmark</div>
                <input id="mb-add-label" type="text" placeholder="Label this moment…" />
                <select id="mb-add-category">
                    ${Object.entries(CATEGORIES)
                        .map(([key, v]) => `<option value="${key}">${v.emoji} ${v.label}</option>`)
                        .join("")}
                </select>
                <div id="mb-add-preview" class="mb-add-preview"></div>
                <div class="mb-add-actions">
                    <button id="mb-add-cancel">Cancel</button>
                    <button id="mb-add-save">Save 🔖</button>
                </div>
            </div>
        </div>
    `);
    $("body").append(addModal);

    $("#mb-add-cancel").on("click", closeAddModal);
    $("#mb-add-modal").on("click", (e) => {
        if (e.target.id === "mb-add-modal") closeAddModal();
    });
    $("#mb-add-save").on("click", () => {
        if (pendingMesId === null) return;
        addBookmark(pendingMesId, $("#mb-add-label").val(), $("#mb-add-category").val());
        closeAddModal();
        if (window.toastr) toastr.success("Bookmarked!");
    });
    $("#mb-add-label").on("keydown", (e) => {
        if (e.key === "Enter") $("#mb-add-save").trigger("click");
        if (e.key === "Escape") closeAddModal();
    });

    renderCategoryChips();
    runSearch("");
}

// ---------- boot ----------

jQuery(() => {
    try {
        const settings = getSettings();
        addExtensionSettings(settings);
        buildUI();
        applyEnabledState();
        injectBookmarkButtons();

        // re-inject buttons whenever new messages render, and refresh bookmark list on chat swap
        const observer = new MutationObserver(() => injectBookmarkButtons());
        const chatEl = document.getElementById("chat");
        if (chatEl) {
            observer.observe(chatEl, { childList: true, subtree: true });
        }

        eventSource.on(event_types.CHAT_CHANGED, () => {
            activeCategoryFilter = "all";
            renderCategoryChips();
            renderBookmarksTab();
            runSearch("");
            setTimeout(injectBookmarkButtons, 200);
        });
    } catch (e) {
        try {
            if (typeof toastr !== "undefined") {
                toastr.error?.("Message Bookmarks: initialization error — " + e.message, "Message Bookmarks");
            }
        } catch {}
        console.error("[Message Bookmarks] init failed:", e);
    }
});
