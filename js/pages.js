/* ============================================================
   THE QUIET BLOG — Pages
   Auth, Discover, Profile, Search, Post detail, Bookmarks, Settings, About
   ============================================================ */

(function (global) {
  "use strict";
  const { el, clear, icon, avatar, avatarLink, timeAgo, dateTime, readingTime, renderText,
    toast, modal, confirmDialog, lightbox, dropdown, skeleton, loadingNode, emptyState, fileInput, debounce } = UI;
  const { PostCard, Composer, UserRow, formatCount } = Components;

  // ============================================================
  // AUTH PAGE (login / register)
  // ============================================================
  function AuthPage(mode) {
    const wrap = el("div", { class: "auth-wrap" });
    const card = el("div", { class: "auth-card" });
    const errBox = el("div", { class: "auth-error" });

    function build(isRegister) {
      clear(card);
      card.appendChild(el("div", { class: "auth-mark" }, icon("leaf")));
      card.appendChild(el("h1", {}, isRegister ? "Join The Quiet Blog" : "Welcome back"));
      card.appendChild(el("p", { class: "auth-sub" }, isRegister ? "Share thoughts. Keep it calm." : "Share thoughts. Keep it calm."));
      const errC = el("div", {}); errC.appendChild(errBox);
      card.appendChild(errC);

      const nameField = el("div", { class: "field" },
        el("label", { for: "a-name" }, "Display name"),
        el("input", { class: "input", id: "a-name", type: "text", placeholder: "Your name", autocomplete: "name" })
      );
      const emailField = el("div", { class: "field" },
        el("label", { for: "a-email" }, "Email"),
        el("input", { class: "input", id: "a-email", type: "email", placeholder: "you@example.com", autocomplete: "email" })
      );
      const passField = el("div", { class: "field" },
        el("label", { for: "a-pass" }, "Password"),
        el("input", { class: "input", id: "a-pass", type: "password", placeholder: "At least 6 characters", autocomplete: isRegister ? "new-password" : "current-password" })
      );

      if (isRegister) card.appendChild(nameField);
      card.appendChild(emailField);
      card.appendChild(passField);

      const submit = el("button", { class: "btn btn-block", onclick: doSubmit }, isRegister ? "Create account" : "Log in");
      card.appendChild(submit);

      card.appendChild(el("div", { class: "auth-switch" },
        isRegister ? "Already have an account? " : "New to The Quiet Blog? ",
        el("a", { href: isRegister ? "#/login" : "#/register", onclick: (e) => { e.preventDefault(); Store.navigate(isRegister ? "/login" : "/register"); } }, isRegister ? "Log in" : "Create an account")
      ));

      setTimeout(() => {
        const first = card.querySelector(isRegister ? "#a-name" : "#a-email");
        if (first) first.focus();
      }, 40);
    }

    function showErr(msg) { errBox.textContent = msg; errBox.classList.add("show"); }
    function clearErr() { errBox.classList.remove("show"); }

    async function doSubmit() {
      clearErr();
      const isReg = (location.hash || "").includes("register");
      const name = document.getElementById("a-name");
      const email = document.getElementById("a-email");
      const pass = document.getElementById("a-pass");
      const btn = card.querySelector(".btn-block");
      btn.disabled = true; btn.textContent = "Please wait…";
      try {
        if (isReg) await TQB.Auth.register({ displayName: name.value, email: email.value, password: pass.value });
        else await TQB.Auth.login({ email: email.value, password: pass.value });
        Store.setUser(TQB.Auth.currentUser());
        toast("Welcome to The Quiet Blog");
        Store.navigate("/");
      } catch (e) { showErr(e.message); }
      btn.disabled = false; btn.textContent = isReg ? "Create account" : "Log in";
    }

    build(mode === "register");
    wrap.appendChild(card);

    // enter key submits
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") doSubmit(); });

    return wrap;
  }

  // ============================================================
  // DISCOVER (FYP)
  // ============================================================
  function DiscoverPage() {
    const me = Store.get().user;
    const page = el("div", { class: "page" });
    let feed = "discover";
    let posts = [];

    const hero = el("div", { class: "discover-hero" },
      el("h2", {}, "Discover"),
      el("p", {}, "A calming stream of thoughts from the community. Refresh for something new.")
    );

    const seg = el("div", { class: "segmented" });
    const allBtn = el("button", { class: "active", onclick: () => switchFeed("discover") }, "Discover");
    const followingBtn = el("button", { onclick: () => switchFeed("following") }, "Following");
    seg.appendChild(allBtn); seg.appendChild(followingBtn);

    const composerHolder = el("div", {});
    composerHolder.appendChild(Composer({ onPosted: () => loadFeed() }));

    const feedHolder = el("div", {});
    const refreshBtn = el("button", { class: "btn btn-ghost btn-sm", style: { marginBottom: "16px" }, onclick: () => loadFeed() }, icon("refresh"), "Refresh");

    function switchFeed(f) {
      feed = f;
      allBtn.classList.toggle("active", f === "discover");
      followingBtn.classList.toggle("active", f === "following");
      loadFeed();
    }

    function loadFeed() {
      clear(feedHolder);
      // skeletons
      for (let i = 0; i < 3; i++) feedHolder.appendChild(skeleton());
      setTimeout(() => {
        clear(feedHolder);
        posts = feed === "following" ? TQB.Posts.followingFeed(me.uid) : TQB.Posts.discoverFeed();
        if (posts.length === 0) {
          if (feed === "following") {
            feedHolder.appendChild(emptyState({
              icon: "users", title: "Your following feed is quiet",
              message: "Follow some writers to see their posts here, or explore the Discover feed.",
              action: el("button", { class: "btn", onclick: () => switchFeed("discover") }, icon("home"), "Browse Discover")
            }));
          } else {
            feedHolder.appendChild(emptyState({
              icon: "feather", title: "Be the first to share",
              message: "The community is waiting for your thoughts. Write your first post above."
            }));
          }
          return;
        }
        feedHolder.appendChild(refreshBtn);
        posts.forEach((p) => feedHolder.appendChild(PostCard(p, { onDeleted: () => loadFeed() })));
      }, 280);
    }

    page.appendChild(hero);
    page.appendChild(seg);
    page.appendChild(composerHolder);
    page.appendChild(feedHolder);
    loadFeed();
    return page;
  }

  // ============================================================
  // POST DETAIL
  // ============================================================
  function PostDetailPage(pid) {
    const page = el("div", { class: "page" });
    const post = TQB.Posts.get(pid);
    if (!post) {
      page.appendChild(emptyState({ icon: "feather", title: "Post not found", message: "This post may have been deleted.", action: el("a", { class: "btn", href: "#/" }, "Back to Discover") }));
      return page;
    }
    page.appendChild(el("div", { class: "mb-16" },
      el("a", { href: "#/", onclick: (e) => { e.preventDefault(); history.length > 1 ? history.back() : Store.navigate("/"); }, style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.86rem" } }, icon("back"), "Back")
    ));
    page.appendChild(PostCard(post, { fullView: true, onDeleted: () => Store.navigate("/") }));
    return page;
  }

  // ============================================================
  // PROFILE
  // ============================================================
  function ProfilePage(uidParam) {
    const me = Store.get().user;
    const page = el("div", { class: "page" });
    const user = TQB.Users.get(uidParam);
    if (!user) {
      page.appendChild(emptyState({ icon: "user", title: "User not found", message: "This profile doesn't exist.", action: el("a", { class: "btn", href: "#/" }, "Back to Discover") }));
      return page;
    }
    const isMe = me && me.uid === user.uid;
    const following = me && TQB.Follows.isFollowing(me.uid, user.uid);

    const cover = el("div", { class: "profile-cover" });
    const head = el("div", { class: "profile-head" },
      el("div", { class: "profile-top" },
        avatar(user, "xl"),
        el("div", { class: "profile-info" },
          el("div", { class: "pn" }, user.displayName, user.verified ? el("span", { class: "verified-badge", title: "Verified creator" }, icon("verified")) : null),
          el("div", { class: "profile-handle" }, "@" + (user.email || "").split("@")[0]),
          user.bio ? el("div", { class: "profile-bio" }, user.bio) : null
        )
      ),
      el("div", { class: "profile-stats" },
        statBox(user.postsCount || 0, "Posts", () => switchTab("posts")),
        statBox(user.followersCount || 0, "Followers", () => showFollowers()),
        statBox(user.followingCount || 0, "Following", () => showFollowing())
      )
    );

    function statBox(n, label, onClick) {
      return el("div", { class: "stat", onclick: onClick },
        el("div", { class: "n" }, formatCount(n)),
        el("div", { class: "l" }, label)
      );
    }

    // actions
    const actionsRow = el("div", { class: "profile-actions" });
    if (isMe) {
      actionsRow.appendChild(el("button", { class: "btn btn-secondary", onclick: () => editProfile() }, icon("edit"), "Edit profile"));
      actionsRow.appendChild(el("button", { class: "btn btn-ghost", onclick: () => Store.navigate("/settings") }, icon("settings")));
    } else if (me) {
      const followBtn = el("button", { class: "btn " + (following ? "btn-secondary" : ""), onclick: handleFollow }, following ? "Following" : "Follow");
      actionsRow.appendChild(followBtn);
      async function handleFollow() {
        const f = await TQB.Follows.toggle(me.uid, user.uid);
        followBtn.textContent = f ? "Following" : "Follow";
        followBtn.className = "btn " + (f ? "btn-secondary" : "");
        // update stats
        const u2 = TQB.Users.get(uidParam);
        head.querySelector(".profile-stats").replaceWith(
          el("div", { class: "profile-stats" },
            statBox(u2.postsCount || 0, "Posts", () => switchTab("posts")),
            statBox(u2.followersCount || 0, "Followers", () => showFollowers()),
            statBox(u2.followingCount || 0, "Following", () => showFollowing())
          )
        );
        toast(f ? "Following " + user.displayName : "Unfollowed " + user.displayName);
      }
    }

    // tabs
    const tabs = el("div", { class: "profile-tabs" });
    const tabPosts = el("button", { class: "profile-tab active", onclick: () => switchTab("posts") }, "Posts");
    const tabLiked = el("button", { class: "profile-tab", onclick: () => switchTab("liked") }, "Liked");
    const tabSaved = isMe ? el("button", { class: "profile-tab", onclick: () => switchTab("saved") }, "Saved") : null;
    tabs.appendChild(tabPosts); tabs.appendChild(tabLiked); if (tabSaved) tabs.appendChild(tabSaved);

    const content = el("div", {});

    function switchTab(t) {
      tabPosts.classList.toggle("active", t === "posts");
      tabLiked.classList.toggle("active", t === "liked");
      if (tabSaved) tabSaved.classList.toggle("active", t === "saved");
      renderTab(t);
    }
    function renderTab(t) {
      clear(content);
      let list = [];
      if (t === "posts") list = TQB.Posts.byAuthor(uidParam);
      else if (t === "liked") list = TQB.Likes.likedPids(uidParam).map((pid) => TQB.Posts.get(pid)).filter(Boolean);
      else if (t === "saved") list = TQB.Bookmarks.savedPids(uidParam).map((pid) => TQB.Posts.get(pid)).filter(Boolean);

      if (list.length === 0) {
        const msgs = {
          posts: isMe ? "You haven't shared any thoughts yet." : user.displayName + " hasn't posted yet.",
          liked: "No liked posts to show.",
          saved: "No saved posts yet.",
        };
        content.appendChild(emptyState({ icon: t === "saved" ? "bookmark" : "feather", title: "Nothing here yet", message: msgs[t] || "" }));
        return;
      }
      list.forEach((p) => content.appendChild(PostCard(p, { onDeleted: () => renderTab(t) })));
    }

    function showFollowers() {
      const ids = TQB.Follows.followersOf(uidParam);
      showUserListModal("Followers", ids, user);
    }
    function showFollowing() {
      const ids = TQB.Follows.followingOf(uidParam);
      showUserListModal("Following", ids, user);
    }
    function showUserListModal(title, ids, profileUser) {
      const list = el("div", { class: "follow-list" });
      if (ids.length === 0) list.appendChild(emptyState({ icon: "users", title: "No one yet", message: "" }));
      ids.forEach((id) => { const u = TQB.Users.get(id); if (u) list.appendChild(UserRow(u, { showFollow: true })); });
      modal({ title: title + " · " + ids.length, body: list });
    }

    function editProfile() {
      const ta = el("textarea", { class: "textarea", rows: 3, placeholder: "Write a short bio…" }, user.bio || "");
      const previewBox = el("div", { class: "preview-box" });
      let newPhoto = user.photoURL || null;
      function renderPreview() {
        clear(previewBox);
        if (newPhoto) previewBox.appendChild(el("img", { src: newPhoto }));
        else previewBox.appendChild(el("div", { class: "ph" }, "No photo"));
      }
      renderPreview();
      const uploadBtn = el("button", { class: "btn btn-secondary btn-sm", onclick: () => fileInput("image/*", false, async (files) => {
        if (!files[0]) return;
        const url = await TQB.Storage.uploadImage(files[0], { maxDim: 400, quality: 0.85 });
        newPhoto = url; renderPreview();
      }) }, icon("image"), "Upload");
      const removeBtn = el("button", { class: "btn btn-ghost btn-sm", onclick: () => { newPhoto = null; renderPreview(); } }, "Remove");

      const m = modal({
        title: "Edit profile",
        body: el("div", {},
          el("div", { class: "field" },
            el("label", {}, "Profile picture"),
            el("div", { class: "upload-preview mt-8" },
              previewBox,
              el("div", {}, el("div", { class: "row" }, uploadBtn, removeBtn))
            )
          ),
          el("div", { class: "field" },
            el("label", {}, "Bio"),
            ta
          )
        ),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancel"),
          el("button", { class: "btn", onclick: async () => {
            try {
              await TQB.Auth.updateProfile({ bio: ta.value.trim(), photoURL: newPhoto });
              m.close();
              toast("Profile updated");
              // re-render profile
              const fresh = TQB.Users.get(uidParam);
              Store.patchUser({ bio: fresh.bio, photoURL: fresh.photoURL });
              rerenderProfile();
            } catch (e) { toast(e.message); }
          } }, "Save"),
        ],
      });
    }
    function rerenderProfile() {
      const newPage = ProfilePage(uidParam);
      page.replaceWith(newPage);
    }

    page.appendChild(cover);
    page.appendChild(head);
    page.appendChild(actionsRow);
    page.appendChild(tabs);
    page.appendChild(content);
    renderTab("posts");
    return page;
  }

  // ============================================================
  // SEARCH
  // ============================================================
  function SearchPage() {
    const page = el("div", { class: "page" });
    page.appendChild(el("h1", { class: "page-title" }, "Search"));
    page.appendChild(el("p", { class: "page-sub" }, "Find people and posts across The Quiet Blog."));

    const input = el("input", { class: "input", placeholder: "Search by name, word, or #hashtag…", style: { marginBottom: "18px" } });
    page.appendChild(input);

    const seg = el("div", { class: "segmented" });
    const peopleBtn = el("button", { class: "active", onclick: () => switchTab("people") }, "People");
    const postsBtn = el("button", { onclick: () => switchTab("posts") }, "Posts");
    seg.appendChild(peopleBtn); seg.appendChild(postsBtn);
    page.appendChild(seg);

    const results = el("div", {});
    page.appendChild(results);

    let tab = "people";
    function switchTab(t) {
      tab = t;
      peopleBtn.classList.toggle("active", t === "people");
      postsBtn.classList.toggle("active", t === "posts");
      runSearch(input.value);
    }
    const runSearch = debounce((q) => {
      clear(results);
      q = (q || "").trim();
      if (!q) {
        results.appendChild(emptyState({ icon: "search", title: "Start searching", message: "Type a name or a few words to find people and posts." }));
        return;
      }
      if (tab === "people") {
        const users = TQB.Users.byHandle(q);
        if (users.length === 0) { results.appendChild(emptyState({ icon: "user", title: "No people found", message: "Try a different name." })); return; }
        const card = el("div", { class: "card" });
        users.forEach((u) => card.appendChild(UserRow(u, { showFollow: true })));
        results.appendChild(card);
      } else {
        // hashtag shortcut
        let posts;
        if (q.startsWith("#")) posts = TQB.Posts.byHashtag(q.slice(1));
        else posts = TQB.Posts.search(q);
        if (posts.length === 0) { results.appendChild(emptyState({ icon: "feather", title: "No posts found", message: "Try different words or a hashtag." })); return; }
        posts.forEach((p) => results.appendChild(PostCard(p, { onDeleted: () => runSearch(input.value) })));
      }
    }, 180);

    input.addEventListener("input", () => runSearch(input.value));
    runSearch("");
    setTimeout(() => input.focus(), 50);
    return page;
  }

  // ============================================================
  // BOOKMARKS
  // ============================================================
  function BookmarksPage() {
    const me = Store.get().user;
    const page = el("div", { class: "page" });
    page.appendChild(el("h1", { class: "page-title" }, "Saved"));
    page.appendChild(el("p", { class: "page-sub" }, "Posts you've bookmarked for later reading."));
    const holder = el("div", {});
    page.appendChild(holder);
    const pids = TQB.Bookmarks.savedPids(me.uid);
    const posts = pids.map((pid) => TQB.Posts.get(pid)).filter(Boolean);
    if (posts.length === 0) {
      holder.appendChild(emptyState({ icon: "bookmark", title: "No saved posts yet", message: "Tap the bookmark icon on any post to save it here." }));
    } else {
      posts.forEach((p) => holder.appendChild(PostCard(p, { onDeleted: () => { const np = BookmarksPage(); page.replaceWith(np); } })));
    }
    return page;
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  function SettingsPage() {
    const me = Store.get().user;
    const page = el("div", { class: "page" });
    page.appendChild(el("h1", { class: "page-title" }, "Settings"));
    page.appendChild(el("p", { class: "page-sub" }, "Manage your account and preferences."));

    // appearance
    const appear = el("div", { class: "card settings-section" });
    appear.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Dark mode", el("small", {}, "Easier on the eyes at night")),
      (() => {
        const sw = el("label", { class: "switch" },
          el("input", { type: "checkbox", checked: Store.get().theme === "dark", onchange: (e) => Store.setTheme(e.target.checked ? "dark" : "light") }),
          el("span", { class: "slider" })
        );
        return sw;
      })()
    ));
    page.appendChild(el("div", { class: "settings-section" }, el("h3", {}, "Appearance"), appear));

    // account
    const acct = el("div", { class: "card settings-section" });
    acct.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Email", el("small", {}, me.email)),
      el("span", { class: "muted", style: { fontSize: "0.8rem" } }, me.verified ? "Verified" : "Unverified")
    ));
    acct.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Display name", el("small", {}, me.displayName)),
      el("button", { class: "btn btn-ghost btn-sm", onclick: () => editName() }, "Edit")
    ));
    acct.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Profile", el("small", {}, "Update bio and picture")),
      el("button", { class: "btn btn-ghost btn-sm", onclick: () => Store.navigate("/u/" + me.uid) }, "Open profile")
    ));
    page.appendChild(el("div", { class: "settings-section" }, el("h3", {}, "Account"), acct));

    // security
    const sec = el("div", { class: "card settings-section" });
    sec.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Email verification", el("small", {}, "Planned feature")),
      el("span", { class: "badge" }, "Soon")
    ));
    sec.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Password reset", el("small", {}, "Planned feature")),
      el("span", { class: "badge" }, "Soon")
    ));
    page.appendChild(el("div", { class: "settings-section" }, el("h3", {}, "Security"), sec));

    // data
    const data = el("div", { class: "card settings-section" });
    data.appendChild(el("div", { class: "set-row" },
      el("div", { class: "set-label" }, "Reset demo data", el("small", {}, "Clears all local posts and accounts on this device")),
      el("button", { class: "btn btn-danger btn-sm", onclick: resetData }, "Reset")
    ));
    page.appendChild(el("div", { class: "settings-section" }, el("h3", {}, "Data"), data));

    // about
    const about = el("div", { class: "card settings-section" });
    about.appendChild(el("div", { class: "set-row", onclick: () => Store.navigate("/about"), style: { cursor: "pointer" } },
      el("div", { class: "set-label" }, "About The Quiet Blog", el("small", {}, "Our calm mission")),
      icon("arrow-right")
    ));
    page.appendChild(el("div", { class: "settings-section" }, el("h3", {}, "About"), about));

    // logout
    page.appendChild(el("div", { class: "mt-24" },
      el("button", { class: "btn btn-secondary btn-block", onclick: async () => {
        await TQB.Auth.logout();
        Store.setUser(null);
        toast("Signed out");
        Store.navigate("/login");
      } }, icon("logout"), "Log out")
    ));

    function editName() {
      const inp = el("input", { class: "input", value: me.displayName });
      const m = modal({ title: "Edit display name", size: "sm", body: el("div", { class: "field", style: { marginBottom: "0" } }, inp), footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancel"),
        el("button", { class: "btn", onclick: async () => {
          if (!inp.value.trim()) return toast("Name can't be empty");
          await TQB.Auth.updateProfile({ displayName: inp.value.trim() });
          m.close(); toast("Name updated");
          Store.patchUser({ displayName: inp.value.trim() });
          const np = SettingsPage(); page.replaceWith(np);
        } }, "Save"),
      ] });
      setTimeout(() => inp.focus(), 40);
    }

    async function resetData() {
      const ok = await confirmDialog({ title: "Reset all data?", message: "This permanently deletes all posts, comments, and accounts on this device. This cannot be undone.", confirmText: "Reset everything", danger: true });
      if (!ok) return;
      localStorage.removeItem("tqb_db_v1");
      localStorage.removeItem("tqb_session_v1");
      await TQB.Auth.logout();
      Store.setUser(null);
      toast("Data reset. Reloading…");
      setTimeout(() => location.reload(), 800);
    }

    return page;
  }

  // ============================================================
  // ABOUT
  // ============================================================
  function AboutPage() {
    const page = el("div", { class: "page" });
    page.appendChild(el("div", { class: "mb-16" },
      el("a", { href: "#/settings", onclick: (e) => { e.preventDefault(); Store.navigate("/settings"); }, style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.86rem" } }, icon("back"), "Back to settings")
    ));
    page.appendChild(el("div", { class: "center", style: { padding: "10px 0 24px" } },
      el("div", { class: "auth-mark", style: { margin: "0 auto 16px" } }, icon("leaf")),
      el("h1", { class: "page-title", style: { fontSize: "1.8rem" } }, "The Quiet Blog"),
      el("p", { class: "muted" }, "Share Thoughts. Keep It Calm.")
    ));
    page.appendChild(el("div", { class: "card", style: { padding: "22px" } },
      el("p", { class: "soft", style: { marginBottom: "14px" } }, "The Quiet Blog is a clean, modern social blogging platform where people share thoughts, stories, opinions, photos, and daily experiences in a peaceful, distraction-free environment. Unlike fast-paced social media, it focuses on meaningful conversations and quality content."),
      el("div", { class: "divider" }),
      el("h3", { style: { fontFamily: "var(--font-serif)", marginBottom: "10px" } }, "What's here"),
      el("p", { class: "soft", style: { marginBottom: "8px" } }, "Discover feed, posts with images, likes, comments and nested replies, follow system, personalized following feed, user profiles, search, bookmarks, edit and delete for posts and comments, dark mode, and reading-time estimates."),
      el("h3", { style: { fontFamily: "var(--font-serif)", margin: "18px 0 10px" } }, "On the horizon"),
      el("p", { class: "soft", style: { marginBottom: "8px" } }, "Direct messages, short videos, communities, schools, voice and video calls, trending posts, hashtags and categories, rich text formatting, push notifications, image compression, infinite scrolling, progressive web app support, AI-powered recommendations, content reporting and moderation, verified creator badges, and creator analytics.")
    ));
    return page;
  }

  // ============================================================
  // 404
  // ============================================================
  function NotFoundPage() {
    return el("div", { class: "page" },
      emptyState({ icon: "feather", title: "Page not found", message: "The page you're looking for doesn't exist.", action: el("a", { class: "btn", href: "#/" }, "Back to Discover") })
    );
  }

  global.Pages = {
    AuthPage, DiscoverPage, PostDetailPage, ProfilePage,
    SearchPage, BookmarksPage, SettingsPage, AboutPage, NotFoundPage,
  };
})(window);
