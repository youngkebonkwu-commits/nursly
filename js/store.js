/* ============================================================
   THE QUIET BLOG — Store (reactive state)
   Thin reactive layer over TQB data API + UI prefs.
   ============================================================ */

(function (global) {
  "use strict";

  const listeners = new Set();
  const state = {
    user: TQB.Auth.currentUser(),
    theme: localStorage.getItem("tqb_theme") || "light",
    route: location.hash.replace(/^#/, "") || "/",
    routeParams: {},
  };

  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

  const Store = {
    get() { return state; },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setUser(u) {
      state.user = u;
      emit();
    },
    patchUser(patch) {
      if (state.user) { state.user = Object.assign({}, state.user, patch); emit(); }
    },

    setTheme(t) {
      state.theme = t;
      localStorage.setItem("tqb_theme", t);
      document.documentElement.setAttribute("data-theme", t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t === "dark" ? "#1a1814" : "#f6f1ea");
      emit();
    },

    navigate(path) {
      if (path === state.route) return;
      if (path !== state.route && state.route !== undefined) {
        history.pushState ? history.pushState({ path }, "", "#" + path) : (location.hash = path);
      } else {
        location.hash = path;
      }
      state.route = path;
      window.scrollTo(0, 0);
      emit();
    },

    setRoute(path) {
      state.route = path;
      emit();
    },
  };

  // react to hash changes (back/forward)
  window.addEventListener("hashchange", () => {
    state.route = location.hash.replace(/^#/, "") || "/";
    window.scrollTo(0, 0);
    emit();
  });
  window.addEventListener("popstate", () => {
    state.route = location.hash.replace(/^#/, "") || "/";
    window.scrollTo(0, 0);
    emit();
  });

  // apply theme on load
  document.documentElement.setAttribute("data-theme", state.theme);

  // wire auth changes into store
  TQB.Auth.onAuthStateChanged((u) => {
    state.user = u;
    emit();
  });

  global.Store = Store;
})(window);
