/* ============================================================
   THE QUIET BLOG — App bootstrap, router, chrome (header + nav)
   ============================================================ */

(function () {
  "use strict";
  const { el, clear, icon, avatar, avatarLink } = UI;

  const app = document.getElementById("app");

  // ---------- Header ----------
  function Header() {
    const me = Store.get().user;
    const header = el("div", { class: "app-header" });
    const inner = el("div", { class: "app-header-inner" });

    const brand = el("a", { class: "brand", href: "#/", onclick: (e) => { e.preventDefault(); Store.navigate("/"); } },
      el("span", { class: "brand-mark" }, icon("leaf")),
      el("span", {}, el("span", { style: { display: "block" } }, "The Quiet Blog"), el("span", { class: "brand-tag" }, "Share Thoughts. Keep It Calm."))
    );

    const searchWrap = el("div", { class: "header-search" });
    searchWrap.appendChild(el("span", { class: "s-icon" }, icon("search")));
    const searchInput = el("input", { type: "text", placeholder: "Search people & posts…", "aria-label": "Search" });
    searchWrap.appendChild(searchInput);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        Store.navigate("/search?q=" + encodeURIComponent(searchInput.value.trim()));
      }
    });

    const actions = el("div", { class: "header-actions" });

    // theme toggle
    const themeBtn = el("button", { class: "icon-btn", "aria-label": "Toggle theme", title: "Toggle theme", onclick: () => Store.setTheme(Store.get().theme === "dark" ? "light" : "dark") },
      icon(Store.get().theme === "dark" ? "sun" : "moon")
    );

    if (me) {
      actions.appendChild(themeBtn);
      actions.appendChild(el("button", { class: "icon-btn", "aria-label": "Saved", title: "Saved", onclick: () => Store.navigate("/saved") }, icon("bookmark")));
      actions.appendChild(avatarBtn(me));
    } else {
      actions.appendChild(themeBtn);
      actions.appendChild(el("a", { class: "btn btn-sm", href: "#/login", onclick: (e) => { e.preventDefault(); Store.navigate("/login"); } }, "Log in"));
    }

    inner.appendChild(brand);
    if (me) inner.appendChild(searchWrap);
    inner.appendChild(actions);
    header.appendChild(inner);
    return header;
  }

  function avatarBtn(me) {
    const btn = el("button", { class: "icon-btn avatar-btn", "aria-label": "Profile", title: "Your profile", onclick: (e) => {
      e.stopPropagation();
      const items = [
        { icon: "user", label: "View profile", onClick: () => Store.navigate("/u/" + me.uid) },
        { icon: "bookmark", label: "Saved posts", onClick: () => Store.navigate("/saved") },
        { icon: "settings", label: "Settings", onClick: () => Store.navigate("/settings") },
        "divider",
        { icon: "moon", label: Store.get().theme === "dark" ? "Light mode" : "Dark mode", onClick: () => Store.setTheme(Store.get().theme === "dark" ? "light" : "dark") },
        { icon: "logout", label: "Log out", onClick: async () => { await TQB.Auth.logout(); Store.setUser(null); UI.toast("Signed out"); Store.navigate("/login"); } },
      ];
      UI.dropdown(e.currentTarget, items);
    } }, avatar(me, "sm"));
    return btn;
  }

  // ---------- Bottom nav (mobile) ----------
  function BottomNav() {
    const me = Store.get().user;
    const route = Store.get().route;
    const nav = el("div", { class: "bottom-nav" });
    const inner = el("div", { class: "bottom-nav-inner" });

    function navItem(name, label, path, matchPrefix) {
      const active = matchPrefix ? route.startsWith(path) : route === path;
      const a = el("a", { href: "#" + path, class: active ? "active" : "", onclick: (e) => { e.preventDefault(); Store.navigate(path); } },
        icon(name), label
      );
      return a;
    }
    function navBtn(name, label, onClick) {
      return el("button", { onclick: onClick }, icon(name), label);
    }

    inner.appendChild(navItem("home", "Home", "/", true));
    inner.appendChild(navItem("search", "Search", "/search", false));
    inner.appendChild(el("button", { class: "compose-fab", "aria-label": "Compose", onclick: () => Store.navigate("/") }, icon("feather")));
    inner.appendChild(navItem("bookmark", "Saved", "/saved", false));
    inner.appendChild(navItem("user", "Profile", "/u/" + (me ? me.uid : ""), false));

    nav.appendChild(inner);
    return nav;
  }

  // ---------- Router ----------
  function renderRoute() {
    const state = Store.get();
    const me = state.user;
    let route = state.route || "/";

    // strip query for matching
    const qIdx = route.indexOf("?");
    const path = qIdx >= 0 ? route.slice(0, qIdx) : route;
    const queryStr = qIdx >= 0 ? route.slice(qIdx + 1) : "";
    const query = {};
    if (queryStr) queryStr.split("&").forEach((p) => { const [k, v] = p.split("="); query[decodeURIComponent(k)] = decodeURIComponent(v || ""); });

    clear(app);

    // auth gate
    const publicRoutes = ["/login", "/register", "/about"];
    const isPublic = publicRoutes.includes(path) || path === "/404";
    if (!me && !isPublic) {
      Store.navigate("/login");
      return;
    }
    if (me && (path === "/login" || path === "/register")) {
      Store.navigate("/");
      return;
    }

    // chrome
    app.appendChild(Header());
    const main = el("main", { class: "app-main" });
    app.appendChild(main);

    let pageNode;
    try {
      if (path === "/login") pageNode = Pages.AuthPage("login");
      else if (path === "/register") pageNode = Pages.AuthPage("register");
      else if (path === "/" ) pageNode = Pages.DiscoverPage();
      else if (path === "/search") {
        pageNode = Pages.SearchPage();
        if (query.q) {
          setTimeout(() => {
            const inp = pageNode.querySelector("input.input");
            if (inp) { inp.value = query.q; inp.dispatchEvent(new Event("input")); }
          }, 60);
        }
      }
      else if (path === "/saved") pageNode = Pages.BookmarksPage();
      else if (path === "/settings") pageNode = Pages.SettingsPage();
      else if (path === "/about") pageNode = Pages.AboutPage();
      else if (path.startsWith("/post/")) pageNode = Pages.PostDetailPage(path.split("/post/")[1].split("?")[0]);
      else if (path.startsWith("/u/")) pageNode = Pages.ProfilePage(path.split("/u/")[1].split("?")[0]);
      else if (path.startsWith("/tag/")) {
        // hashtag browse -> reuse search page results via a simple page
        pageNode = hashtagPage(decodeURIComponent(path.split("/tag/")[1]));
      }
      else pageNode = Pages.NotFoundPage();
    } catch (e) {
      console.error(e);
      pageNode = el("div", { class: "page" }, UI.emptyState({ icon: "feather", title: "Something went wrong", message: e.message }));
    }

    main.appendChild(pageNode);

    // bottom nav only when logged in
    if (me) app.appendChild(BottomNav());

    // update document title
    const titles = {
      "/": "Discover · The Quiet Blog",
      "/search": "Search · The Quiet Blog",
      "/saved": "Saved · The Quiet Blog",
      "/settings": "Settings · The Quiet Blog",
      "/about": "About · The Quiet Blog",
      "/login": "Log in · The Quiet Blog",
      "/register": "Join · The Quiet Blog",
    };
    document.title = titles[path] || "The Quiet Blog";
  }

  // simple hashtag browse page
  function hashtagPage(tag) {
    const page = el("div", { class: "page" });
    page.appendChild(el("div", { class: "mb-16" },
      el("a", { href: "#/", onclick: (e) => { e.preventDefault(); history.length > 1 ? history.back() : Store.navigate("/"); }, style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.86rem" } }, UI.icon("back"), "Back")
    ));
    page.appendChild(el("h1", { class: "page-title" }, "#" + tag));
    page.appendChild(el("p", { class: "page-sub" }, "Posts tagged with this hashtag."));
    const holder = el("div", {});
    page.appendChild(holder);
    const posts = TQB.Posts.byHashtag(tag);
    if (posts.length === 0) {
      holder.appendChild(UI.emptyState({ icon: "hash", title: "No posts yet", message: "No one has used #" + tag + " yet." }));
    } else {
      posts.forEach((p) => holder.appendChild(Components.PostCard(p, { onDeleted: () => { const np = hashtagPage(tag); page.replaceWith(np); } })));
    }
    return page;
  }

  // ---------- Seed demo content (first run) ----------
  function maybeSeed() {
    const db = TQB._db();
    if (Object.keys(db.users).length > 0) return; // already has users

    const seedUsers = [
      { displayName: "Maya Okafor", email: "maya@quiet.blog", bio: "Writing about slow mornings, books, and the small good things.", verified: true },
      { displayName: "Theo Bennett", email: "theo@quiet.blog", bio: "Photographer. Quiet observer of light and shadow.", verified: false },
      { displayName: "Lina Park", email: "lina@quiet.blog", bio: "Teacher. Believer in kind questions.", verified: false },
      { displayName: "Daniel Ortega", email: "daniel@quiet.blog", bio: "Gardener. Tea drinker. Occasional poet.", verified: true },
      { displayName: "Aisha Rahman", email: "aisha@quiet.blog", bio: "Notes from a noisy city, kept calm.", verified: false },
    ];

    const uids = [];
    seedUsers.forEach((u, i) => {
      const user = {
        uid: "u_seed" + i, displayName: u.displayName, email: u.email, password: "password",
        bio: u.bio, photoURL: "", verified: u.verified,
        createdAt: TQB.serverTimestamp(), followersCount: 0, followingCount: 0, postsCount: 0,
      };
      db.users[user.uid] = user;
      uids.push(user.uid);
    });

    const seedPosts = [
      { author: 0, text: "There's a certain kind of quiet that only comes after a long walk. The kind that settles into your bones and reminds you that you were never really in a hurry.\n\n#slowmornings #calm", images: [], daysAgo: 0 },
      { author: 1, text: "Caught this light spilling through the kitchen window this morning. Some days the ordinary feels like a gift.", images: ["assets/seed/tea-light.jpg"], daysAgo: 1 },
      { author: 2, text: "A student asked me today why the sky is blue. I almost gave the science answer, then stopped. 'Because it's trying to match the ocean,' I said. They smiled. I think that counts as learning.\n\n#teaching #wonder", images: [], daysAgo: 1 },
      { author: 3, text: "The mint has come back. Third year running. I'm beginning to think resilience looks a lot like a small green thing refusing to give up.", images: ["assets/seed/mint.jpg"], daysAgo: 2 },
      { author: 4, text: "Note to self: you don't have to respond to everything. Some things are just passing weather. Let them pass.\n\n#notetoself #mindfulness", images: [], daysAgo: 2 },
      { author: 0, text: "Finished a book today that took me three months to read. Not because it was hard, but because I didn't want it to end. That's the best kind of slow.", images: [], daysAgo: 3 },
      { author: 1, text: "Evening fog rolling over the hill. The whole world went soft for about ten minutes.", images: ["assets/seed/fog-hill.jpg"], daysAgo: 4 },
      { author: 3, text: "Three things I'm grateful for today: the first sip of tea, a letter from an old friend, and the way the rain sounds on this old roof.\n\n#gratitude", images: [], daysAgo: 5 },
    ];

    seedPosts.forEach((p, i) => {
      const post = {
        pid: "p_seed" + i, authorId: uids[p.author], text: p.text, images: p.images,
        createdAt: TQB.serverTimestamp(), editedAt: null, likeCount: 0, commentCount: 0,
      };
      post.createdAt._ts = Date.now() - (p.daysAgo * 86400000 + Math.floor(Math.random() * 36000000));
      db.posts[post.pid] = post;
      db.users[uids[p.author]].postsCount = (db.users[uids[p.author]].postsCount || 0) + 1;
    });

    // some likes & follows for realism
    db.likes["u_seed1_p_seed0"] = { uid: "u_seed1", pid: "p_seed0", ts: Date.now() - 3600000 };
    db.posts["p_seed0"].likeCount = 1;
    db.likes["u_seed2_p_seed1"] = { uid: "u_seed2", pid: "p_seed1", ts: Date.now() - 7200000 };
    db.likes["u_seed3_p_seed1"] = { uid: "u_seed3", pid: "p_seed1", ts: Date.now() - 5400000 };
    db.posts["p_seed1"].likeCount = 2;
    db.likes["u_seed0_p_seed3"] = { uid: "u_seed0", pid: "p_seed3", ts: Date.now() - 86400000 };
    db.likes["u_seed2_p_seed3"] = { uid: "u_seed2", pid: "p_seed3", ts: Date.now() - 43200000 };
    db.posts["p_seed3"].likeCount = 2;
    db.likes["u_seed4_p_seed5"] = { uid: "u_seed4", pid: "p_seed5", ts: Date.now() - 21600000 };
    db.posts["p_seed5"].likeCount = 1;

    // follows: 1->0, 2->0, 3->1, 0->3, 4->0
    const fl = [["u_seed1","u_seed0"],["u_seed2","u_seed0"],["u_seed3","u_seed1"],["u_seed0","u_seed3"],["u_seed4","u_seed0"]];
    fl.forEach(([f,t]) => {
      db.follows[f+"_"+t] = { follower: f, target: t, ts: Date.now() };
      db.users[f].followingCount = (db.users[f].followingCount||0)+1;
      db.users[t].followersCount = (db.users[t].followersCount||0)+1;
    });

    // a couple of comments
    db.comments["c_seed0"] = { cid: "c_seed0", pid: "p_seed0", authorId: "u_seed1", text: "This is beautifully put. Saving it.", parentId: null, createdAt: TQB.serverTimestamp(), editedAt: null };
    db.comments["c_seed0"].createdAt._ts = Date.now() - 1800000;
    db.comments["c_seed1"] = { cid: "c_seed1", pid: "p_seed0", authorId: "u_seed0", text: "Thank you, Theo. Means a lot.", parentId: "c_seed0", createdAt: TQB.serverTimestamp(), editedAt: null };
    db.comments["c_seed1"].createdAt._ts = Date.now() - 1200000;
    db.posts["p_seed0"].commentCount = 2;

    db.comments["c_seed2"] = { cid: "c_seed2", pid: "p_seed3", authorId: "u_seed0", text: "Mint is the most determined plant I know. Inspiring.", parentId: null, createdAt: TQB.serverTimestamp(), editedAt: null };
    db.comments["c_seed2"].createdAt._ts = Date.now() - 86400000;
    db.posts["p_seed3"].commentCount = 1;

    localStorage.setItem("tqb_db_v1", JSON.stringify(db));
  }

  // ---------- Init ----------
  function init() {
    maybeSeed();
    Store.setTheme(Store.get().theme);
    Store.subscribe(renderRoute);
    renderRoute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
