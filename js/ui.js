/* ============================================================
   THE QUIET BLOG — UI utilities
   DOM helpers, icons, toasts, modals, lightbox, dropdowns.
   ============================================================ */

(function (global) {
  "use strict";

  // ---------- DOM ----------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "dataset" && typeof v === "object") Object.assign(node.dataset, v);
        else node.setAttribute(k, v);
      }
    }
    children.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    });
    return node;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---------- Icons ----------
  function icon(name, cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + name);
    svg.appendChild(use);
    if (cls) svg.setAttribute("class", cls);
    return svg;
  }

  // ---------- Avatar helper ----------
  function avatar(user, size) {
    size = size || "md";
    if (user && user.photoURL) {
      return el("img", { class: "avatar size-" + size, src: user.photoURL, alt: (user.displayName || "user") + " avatar" });
    }
    const initials = ((user && user.displayName) || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
    const ph = el("div", { class: "avatar-placeholder size-" + size }, initials);
    // color from name
    const palette = ["#4a6b8a", "#6b8e6b", "#b08948", "#a87272", "#7a6b8a", "#5e8a7a", "#8a7a5e", "#6b7a8a"];
    let h = 0; const name = (user && user.displayName) || "x";
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    ph.style.background = palette[h % palette.length];
    return ph;
  }

  function avatarLink(user, size) {
    if (!user) return avatar(null, size);
    const a = el("a", { href: "#/u/" + user.uid }, avatar(user, size));
    a.style.display = "inline-block";
    return a;
  }

  // ---------- Time formatting ----------
  function timeAgo(ts) {
    if (!ts && ts !== 0) return "";
    const t = (ts && ts._ts) || ts || 0;
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    if (d < 7) return d + "d ago";
    const w = Math.floor(d / 7);
    if (w < 5) return w + "w ago";
    return fullDate(t);
  }
  function fullDate(ts) {
    const t = (ts && ts._ts) || ts || 0;
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function dateTime(ts) {
    const t = (ts && ts._ts) || ts || 0;
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---------- Reading time ----------
  function readingTime(text) {
    const words = ((text || "").trim().match(/\S+/g) || []).length;
    if (words === 0) return "";
    const mins = Math.max(1, Math.round(words / 200));
    return mins + " min read";
  }

  // ---------- Hashtag rendering ----------
  function renderText(text) {
    // escape
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!text) return "";
    let html = esc(text);
    // hashtags
    html = html.replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (m, pre, tag) => pre + `<a class="hashtag" href="#/tag/${encodeURIComponent(tag.toLowerCase())}">#${tag}</a>`);
    // @mentions handled as plain text (no user lookup needed for display)
    return html;
  }

  // ---------- Toast ----------
  function toast(msg, type) {
    const host = document.getElementById("toast-host");
    if (!host) return;
    const t = el("div", { class: "toast" + (type ? " toast-" + type : "") }, msg);
    host.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .3s, transform .3s";
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
      setTimeout(() => t.remove(), 320);
    }, 2400);
  }

  // ---------- Modal ----------
  function modal({ title, body, footer, size, onMount, onClose }) {
    const overlay = el("div", { class: "modal-overlay" });
    const m = el("div", { class: "modal" + (size === "sm" ? " modal-sm" : "") });
    const head = el("div", { class: "modal-head" },
      el("h3", {}, title || ""),
      el("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, icon("close"))
    );
    m.appendChild(head);
    if (body) {
      const bodyEl = el("div", { class: "modal-body" });
      if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = body;
      m.appendChild(bodyEl);
    }
    if (footer) {
      const foot = el("div", { class: "modal-foot" });
      (Array.isArray(footer) ? footer : [footer]).forEach((f) => foot.appendChild(f));
      m.appendChild(foot);
    }
    overlay.appendChild(m);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", escClose);
    function escClose(e) { if (e.key === "Escape") close(); }
    function close() {
      overlay.remove();
      document.removeEventListener("keydown", escClose);
      if (onClose) onClose();
    }
    document.body.appendChild(overlay);
    if (onMount) onMount(m);
    return { close, modal: m, overlay };
  }

  function confirmDialog({ title, message, confirmText, danger }) {
    return new Promise((resolve) => {
      const m = modal({
        title: title || "Are you sure?",
        size: "sm",
        body: el("p", { class: "soft" }, message || ""),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => { m.close(); resolve(false); } }, "Cancel"),
          el("button", { class: "btn " + (danger ? "btn-danger" : ""), onclick: () => { m.close(); resolve(true); } }, confirmText || "Confirm"),
        ],
      });
    });
  }

  // ---------- Lightbox ----------
  function lightbox(src) {
    const lb = el("div", { class: "lightbox" });
    lb.appendChild(el("button", { class: "lb-close", onclick: () => lb.remove() }, icon("close")));
    lb.appendChild(el("img", { src }));
    lb.addEventListener("click", (e) => { if (e.target === lb) lb.remove(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { lb.remove(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(lb);
  }

  // ---------- Dropdown menu ----------
  function dropdown(anchor, items, opts) {
    opts = opts || {};
    // close existing
    document.querySelectorAll(".menu").forEach((m) => m.remove());
    const menu = el("div", { class: "menu" });
    items.forEach((it) => {
      if (it === "divider") { menu.appendChild(el("div", { class: "divider" })); return; }
      const b = el("button", { class: it.danger ? "danger" : "", onclick: () => { menu.remove(); it.onClick && it.onClick(); } },
        it.icon ? icon(it.icon) : null, it.label || "");
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    let left = r.right - menu.offsetWidth;
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = r.top - menu.offsetHeight - 6;
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", close, true);
        }
      };
      document.addEventListener("click", close, true);
    }, 0);
    return menu;
  }

  // ---------- Skeleton loading ----------
  function skeleton() {
    return el("div", { class: "skeleton" },
      el("div", { class: "row", style: { marginBottom: "12px" } },
        el("div", { class: "sk-line", style: { height: "40px", width: "40px", borderRadius: "50%", marginBottom: "0" } }),
        el("div", { class: "grow" },
          el("div", { class: "sk-line w-40" }),
          el("div", { class: "sk-line w-60", style: { marginTop: "8px" } })
        )
      ),
      el("div", { class: "sk-line w-80" }),
      el("div", { class: "sk-line w-60" }),
      el("div", { class: "sk-line w-40" })
    );
  }
  function loadingNode() {
    return el("div", { class: "loading" }, el("div", { class: "spinner" }), el("div", {}, "Loading…"));
  }
  function emptyState({ icon: iconName, title, message, action }) {
    const e = el("div", { class: "empty-state" },
      icon(iconName || "feather"),
      el("h3", {}, title || "Nothing here yet"),
      el("p", {}, message || "")
    );
    if (action) e.appendChild(el("div", { class: "mt-16" }, action));
    return e;
  }

  // ---------- File upload helper ----------
  function fileInput(accept, multiple, onFiles) {
    const input = el("input", { type: "file", accept: accept, style: { display: "none" } });
    if (multiple) input.multiple = true;
    input.addEventListener("change", () => { onFiles(input.files); input.value = ""; });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
    return input;
  }

  // ---------- Debounce ----------
  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms || 200); };
  }

  global.UI = {
    el, clear, icon, avatar, avatarLink,
    timeAgo, fullDate, dateTime, readingTime, renderText,
    toast, modal, confirmDialog, lightbox, dropdown,
    skeleton, loadingNode, emptyState, fileInput, debounce,
  };
})(window);
