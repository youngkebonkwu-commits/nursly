/* ============================================================
   THE QUIET BLOG — Reusable components
   PostCard, Comments, Composer, UserRow, etc.
   ============================================================ */

(function (global) {
  "use strict";
  const { el, clear, icon, avatar, avatarLink, timeAgo, dateTime, readingTime, renderText,
    toast, modal, confirmDialog, lightbox, dropdown, emptyState, fileInput } = UI;

  // ---------- User Row (search / follow lists) ----------
  function UserRow(user, opts) {
    opts = opts || {};
    const me = Store.get().user;
    const row = el("div", { class: "user-row" },
      avatarLink(user, "md"),
      el("div", { class: "u-info" },
        el("div", { class: "u-name" },
          el("a", { href: "#/u/" + user.uid, onclick: (e) => { e.preventDefault(); Store.navigate("/u/" + user.uid); } }, user.displayName),
          user.verified ? el("span", { class: "verified-badge", title: "Verified creator" }, icon("verified")) : null
        ),
        el("div", { class: "u-handle" }, "@" + (user.email || "").split("@")[0]),
        user.bio ? el("div", { class: "u-bio" }, user.bio) : null
      )
    );
    if (opts.showFollow && me && me.uid !== user.uid) {
      const following = TQB.Follows.isFollowing(me.uid, user.uid);
      const btn = el("button", { class: "btn btn-sm " + (following ? "btn-secondary" : ""), onclick: handleFollow }, following ? "Following" : "Follow");
      row.appendChild(btn);
      async function handleFollow() {
        const isFollowing = await TQB.Follows.toggle(me.uid, user.uid);
        btn.textContent = isFollowing ? "Following" : "Follow";
        btn.className = "btn btn-sm " + (isFollowing ? "btn-secondary" : "");
        toast(isFollowing ? "Following " + user.displayName : "Unfollowed");
      }
    }
    return row;
  }

  // ---------- Composer (inline on discover / profile) ----------
  function Composer(opts) {
    opts = opts || {};
    const me = Store.get().user;
    let pendingImages = [];

    const input = el("textarea", { class: "composer-input", placeholder: opts.placeholder || "Share a calm thought…", rows: 1 });
    const thumbRow = el("div", { class: "composer-thumb-row hidden" });
    const postBtn = el("button", { class: "btn btn-sm", disabled: true, onclick: doPost }, "Post");

    function updateBtn() {
      const has = input.value.trim() || pendingImages.length;
      postBtn.disabled = !has;
    }
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(240, input.scrollHeight) + "px";
      updateBtn();
    });

    async function doPost() {
      if (postBtn.disabled) return;
      postBtn.disabled = true;
      postBtn.textContent = "Posting…";
      try {
        await TQB.Posts.create({ text: input.value, images: pendingImages });
        input.value = ""; input.style.height = "auto";
        pendingImages = []; thumbRow.classList.add("hidden"); clear(thumbRow);
        toast("Posted to your feed");
        if (opts.onPosted) opts.onPosted();
      } catch (e) { toast(e.message); }
      postBtn.textContent = "Post";
      updateBtn();
    }

    function addImages(files) {
      const arr = Array.from(files).slice(0, 4 - pendingImages.length);
      arr.forEach((f) => {
        TQB.Storage.uploadImage(f, { maxDim: 1280, quality: 0.82 }).then((url) => {
          if (!url) return;
          pendingImages.push(url);
          renderThumbs();
          updateBtn();
        });
      });
    }
    function renderThumbs() {
      clear(thumbRow);
      thumbRow.classList.toggle("hidden", pendingImages.length === 0);
      pendingImages.forEach((url, i) => {
        const t = el("div", { class: "composer-thumb" },
          el("img", { src: url, alt: "" }),
          el("button", { class: "rm", "aria-label": "Remove", onclick: () => { pendingImages.splice(i, 1); renderThumbs(); updateBtn(); } }, "×")
        );
        thumbRow.appendChild(t);
      });
    }

    const fileBtn = el("button", { class: "composer-file-btn", type: "button", onclick: () => fileInput("image/*", true, addImages) },
      icon("image"), "Photo"
    );

    const tools = el("div", { class: "composer-tools" },
      fileBtn,
      el("div", { class: "composer-spacer" }),
      el("span", { class: "muted", style: { fontSize: "0.78rem" } }, pendingImages.length + "/4"),
      postBtn
    );

    return el("div", { class: "composer" },
      el("div", { class: "composer-top" },
        avatarLink(me, "sm"),
        el("div", { class: "grow" }, input)
      ),
      thumbRow,
      tools
    );
  }

  // ---------- Post Card ----------
  function PostCard(post, opts) {
    opts = opts || {};
    const me = Store.get().user;
    const author = TQB.Users.get(post.authorId);
    const isOwner = me && post.authorId === me.uid;
    const liked = me && TQB.Likes.isLiked(me.uid, post.pid);
    const saved = me && TQB.Bookmarks.isSaved(me.uid, post.pid);
    const rt = readingTime(post.text);

    // header
    const head = el("div", { class: "post-head" },
      avatarLink(author, "sm"),
      el("div", { class: "meta" },
        el("div", { class: "name" },
          author ? el("a", { href: "#/u/" + author.uid, onclick: (e) => { e.preventDefault(); Store.navigate("/u/" + author.uid); } }, author.displayName) : "Unknown",
          author && author.verified ? el("span", { class: "verified-badge", title: "Verified creator" }, icon("verified")) : null
        ),
        el("div", { class: "date" }, timeAgo(post.createdAt) + (post.editedAt ? " · edited" : "") + (rt ? " · " + rt : ""))
      )
    );
    if (me) {
      const menuBtn = el("button", { class: "menu-trigger", "aria-label": "More", onclick: (e) => { e.stopPropagation(); openMenu(e.currentTarget); } }, icon("more"));
      head.appendChild(menuBtn);
    }

    function openMenu(anchor) {
      const items = [];
      items.push({ icon: "bookmark", label: saved ? "Remove bookmark" : "Save post", onClick: toggleSave });
      items.push({ icon: "share", label: "Copy link", onClick: copyLink });
      if (isOwner) {
        items.push("divider");
        items.push({ icon: "edit", label: "Edit post", onClick: () => editPost() });
        items.push({ icon: "trash", label: "Delete post", danger: true, onClick: () => deletePost() });
      } else {
        items.push("divider");
        items.push({ icon: "shield", label: "Report post", onClick: () => toast("Report submitted. Thank you.") });
      }
      dropdown(anchor, items);
    }

    async function toggleSave() {
      const isSaved = await TQB.Bookmarks.toggle(me.uid, post.pid);
      toast(isSaved ? "Saved to bookmarks" : "Removed from bookmarks");
      rerender();
    }
    function copyLink() {
      const link = location.origin + location.pathname + "#/post/" + post.pid;
      navigator.clipboard.writeText(link).then(() => toast("Link copied")).catch(() => toast(link));
    }
    function editPost() {
      const ta = el("textarea", { class: "textarea", rows: 5 }, post.text || "");
      const imgsRow = el("div", { class: "composer-thumb-row mt-8" });
      const curImgs = (post.images || []).slice();
      function renderImgs() {
        clear(imgsRow);
        curImgs.forEach((url, i) => {
          imgsRow.appendChild(el("div", { class: "composer-thumb" },
            el("img", { src: url }),
            el("button", { class: "rm", onclick: () => { curImgs.splice(i, 1); renderImgs(); } }, "×")
          ));
        });
      }
      renderImgs();
      const m = modal({
        title: "Edit post",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Text"), ta),
          el("label", { class: "mb-8", style: { display: "block", fontSize: "0.84rem", fontWeight: 600, color: "var(--text-soft)" } }, "Images"),
          imgsRow
        ),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancel"),
          el("button", { class: "btn", onclick: save }, "Save"),
        ],
      });
      async function save() {
        try {
          await TQB.Posts.update(post.pid, { text: ta.value.trim(), images: curImgs });
          m.close();
          toast("Post updated");
          rerender();
        } catch (e) { toast(e.message); }
      }
    }
    async function deletePost() {
      const ok = await confirmDialog({ title: "Delete post?", message: "This post and its comments will be permanently removed.", confirmText: "Delete", danger: true });
      if (!ok) return;
      await TQB.Posts.delete(post.pid);
      toast("Post deleted");
      if (opts.onDeleted) opts.onDeleted(post.pid);
      else rerender();
    }

    // body
    const body = el("div", { class: "post-body" });
    if (post.text) {
      const textDiv = el("div", { class: "post-text", html: renderText(post.text) });
      body.appendChild(textDiv);
    }
    if (post.images && post.images.length) {
      const grid = el("div", { class: "post-images " + (post.images.length === 1 ? "one" : post.images.length === 2 ? "two" : "three") });
      post.images.slice(0, 4).forEach((src) => {
        const im = el("img", { src, alt: "", loading: "lazy", onclick: () => lightbox(src) });
        grid.appendChild(im);
      });
      body.appendChild(grid);
    }

    // actions
    const likeBtn = el("button", { class: "action-btn" + (liked ? " liked" : ""), onclick: toggleLike },
      icon(liked ? "heart-fill" : "heart"),
      el("span", { class: "count" }, formatCount(post.likeCount || 0))
    );
    const commentBtn = el("button", { class: "action-btn", onclick: toggleComments },
      icon("comment"),
      el("span", { class: "count" }, formatCount(post.commentCount || 0))
    );
    const saveBtn = el("button", { class: "action-btn" + (saved ? " saved" : ""), onclick: toggleSave },
      icon(saved ? "bookmark-fill" : "bookmark"), "Save"
    );
    const shareBtn = el("button", { class: "action-btn", onclick: copyLink }, icon("share"), "Share");

    const actions = el("div", { class: "post-actions" }, likeBtn, commentBtn, saveBtn, shareBtn);

    // comments section
    let commentsOpen = false;
    const commentsWrap = el("div", { class: "comments hidden" });
    function toggleComments() {
      commentsOpen = !commentsOpen;
      commentsWrap.classList.toggle("hidden", !commentsOpen);
      if (commentsOpen) renderComments();
      else clear(commentsWrap);
    }
    function renderComments() {
      clear(commentsWrap);
      const all = TQB.Comments.byPost(post.pid);
      const roots = all.filter((c) => !c.parentId);
      if (roots.length === 0 && !opts.fullView) {
        commentsWrap.appendChild(el("div", { class: "muted center", style: { padding: "8px 0 4px", fontSize: "0.84rem" } }, "Be the first to comment"));
      }
      roots.forEach((c) => commentsWrap.appendChild(CommentNode(c, all)));

      // compose
      if (me) {
        const ta = el("textarea", { placeholder: "Write a kind comment…", rows: 1 });
        ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
        const submit = el("button", { class: "btn btn-sm", disabled: true, onclick: async () => {
          if (!ta.value.trim()) return;
          submit.disabled = true;
          try { await TQB.Comments.create({ pid: post.pid, text: ta.value }); ta.value = ""; ta.style.height = "auto"; toast("Comment added"); renderComments(); rerenderCounts(); }
          catch (e) { toast(e.message); }
          submit.disabled = false;
        } }, "Post");
        ta.addEventListener("input", () => { submit.disabled = !ta.value.trim(); });
        commentsWrap.appendChild(el("div", { class: "comment-compose" }, avatarLink(me, "sm"), el("div", { class: "grow" }, ta), submit));
      }
    }
    function rerenderCounts() {
      const p = TQB.Posts.get(post.pid);
      if (!p) return;
      commentBtn.querySelector(".count").textContent = formatCount(p.commentCount || 0);
      likeBtn.querySelector(".count").textContent = formatCount(p.likeCount || 0);
    }

    async function toggleLike() {
      if (!me) { Store.navigate("/login"); return; }
      const isLiked = await TQB.Likes.toggle(me.uid, post.pid);
      likeBtn.classList.toggle("liked", isLiked);
      likeBtn.querySelector("svg use").setAttribute("href", "#i-" + (isLiked ? "heart-fill" : "heart"));
      likeBtn.querySelector(".count").textContent = formatCount(TQB.Posts.get(post.pid).likeCount || 0);
      if (opts.onLike) opts.onLike();
    }

    function rerender() {
      const fresh = TQB.Posts.get(post.pid);
      if (!fresh) { if (opts.onDeleted) opts.onDeleted(post.pid); card.remove(); return; }
      post = fresh;
      // rebuild minimal
      const newNode = PostCard(post, opts);
      card.replaceWith(newNode);
    }

    const card = el("div", { class: "post-card", id: "post-" + post.pid }, head, body, actions, commentsWrap);
    if (opts.fullView) { commentsOpen = true; commentsWrap.classList.remove("hidden"); renderComments(); }
    if (opts.openComments) { toggleComments(); }
    return card;
  }

  // ---------- Comment node ----------
  function CommentNode(comment, allComments) {
    const author = TQB.Users.get(comment.authorId);
    const me = Store.get().user;
    const isOwner = me && comment.authorId === me.uid;
    const replies = (allComments || TQB.Comments.byPost(comment.pid)).filter((c) => c.parentId === comment.cid);

    const node = el("div", { class: "comment" });
    node.appendChild(avatarLink(author, "sm"));
    const body = el("div", { class: "c-body" });
    const head = el("div", { class: "c-head" },
      el("span", { class: "c-name" },
        author ? el("a", { href: "#/u/" + author.uid, onclick: (e) => { e.preventDefault(); Store.navigate("/u/" + author.uid); } }, author.displayName) : "Unknown",
        author && author.verified ? el("span", { class: "verified-badge" }, icon("verified")) : null
      ),
      el("span", { class: "c-date" }, timeAgo(comment.createdAt) + (comment.editedAt ? " · edited" : ""))
    );
    const text = el("div", { class: "c-text", html: renderText(comment.text) });
    body.appendChild(head); body.appendChild(text);

    const actions = el("div", { class: "c-actions" });
    if (me) {
      const replyBtn = el("button", { onclick: () => toggleReply() }, "Reply");
      actions.appendChild(replyBtn);
      let replyOpen = false;
      const replyWrap = el("div", { class: "hidden", style: { marginTop: "8px" } });
      function toggleReply() {
        replyOpen = !replyOpen;
        replyWrap.classList.toggle("hidden", !replyOpen);
        if (replyOpen) {
          clear(replyWrap);
          const ta = el("textarea", { placeholder: "Reply to " + (author ? author.displayName : "comment") + "…", rows: 1 });
          ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(100, ta.scrollHeight) + "px"; });
          const sub = el("button", { class: "btn btn-sm", disabled: true, onclick: async () => {
            if (!ta.value.trim()) return;
            try { await TQB.Comments.create({ pid: comment.pid, text: ta.value, parentId: comment.cid }); toast("Reply added"); rerenderPost(); }
            catch (e) { toast(e.message); }
          } }, "Reply");
          ta.addEventListener("input", () => { sub.disabled = !ta.value.trim(); });
          replyWrap.appendChild(el("div", { class: "comment-compose" }, avatarLink(me, "sm"), el("div", { class: "grow" }, ta), sub));
          setTimeout(() => ta.focus(), 30);
        }
      }
      body.appendChild(actions);
      body.appendChild(replyWrap);

      if (isOwner) {
        const editBtn = el("button", { onclick: () => editComment() }, "Edit");
        const delBtn = el("button", { onclick: () => deleteComment() }, "Delete");
        actions.appendChild(editBtn); actions.appendChild(delBtn);
      }
    }

    function editComment() {
      const ta = el("textarea", { class: "textarea", rows: 3 }, comment.text);
      const m = modal({
        title: "Edit comment", size: "sm",
        body: ta,
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancel"),
          el("button", { class: "btn btn-sm", onclick: async () => {
            try { await TQB.Comments.update(comment.cid, ta.value); m.close(); toast("Comment updated"); rerenderPost(); }
            catch (e) { toast(e.message); }
          } }, "Save"),
        ],
      });
    }
    async function deleteComment() {
      const ok = await confirmDialog({ title: "Delete comment?", message: "This comment and any replies will be removed.", confirmText: "Delete", danger: true });
      if (!ok) return;
      await TQB.Comments.delete(comment.cid);
      toast("Comment deleted");
      rerenderPost();
    }
    function rerenderPost() {
      // re-render the whole post card's comments
      const card = document.getElementById("post-" + comment.pid);
      if (card) {
        const wrap = card.querySelector(".comments");
        if (wrap && !wrap.classList.contains("hidden")) {
          clear(wrap);
          const all = TQB.Comments.byPost(comment.pid);
          all.filter((c) => !c.parentId).forEach((c) => wrap.appendChild(CommentNode(c, all)));
          // re-add compose
          const me2 = Store.get().user;
          if (me2) {
            const ta = el("textarea", { placeholder: "Write a kind comment…", rows: 1 });
            const submit = el("button", { class: "btn btn-sm", disabled: true, onclick: async () => {
              if (!ta.value.trim()) return;
              try { await TQB.Comments.create({ pid: comment.pid, text: ta.value }); ta.value = ""; toast("Comment added"); rerenderPost(); updateCount(); }
              catch (e) { toast(e.message); }
            } }, "Post");
            ta.addEventListener("input", () => { submit.disabled = !ta.value.trim(); ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
            wrap.appendChild(el("div", { class: "comment-compose" }, avatarLink(me2, "sm"), el("div", { class: "grow" }, ta), submit));
          }
          updateCount();
        }
      }
    }
    function updateCount() {
      const card = document.getElementById("post-" + comment.pid);
      if (card) {
        const cnt = card.querySelector(".post-actions .action-btn:nth-child(2) .count");
        if (cnt) cnt.textContent = formatCount(TQB.Posts.get(comment.pid).commentCount || 0);
      }
    }

    node.appendChild(body);
    replies.forEach((r) => {
      node.appendChild(el("div", { class: "reply" }, CommentNode(r, allComments)));
    });
    return node;
  }

  // ---------- count formatting ----------
  function formatCount(n) {
    if (n == null) return "0";
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0).replace(/\.0$/, "") + "K";
    return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }

  global.Components = { PostCard, Composer, UserRow, CommentNode, formatCount };
})(window);
