/* ============================================================
   THE QUIET BLOG — Data Layer
   Firebase-style API (Auth + Firestore + Storage) backed by
   localStorage so the app works fully offline / on static hosts.
   To migrate to real Firebase, reimplement these methods with
   the Firebase SDK — the rest of the app stays the same.
   ============================================================ */

(function (global) {
  "use strict";

  const DB_KEY = "tqb_db_v1";
  const SESSION_KEY = "tqb_session_v1";

  // ---- internal store schema ----
  function freshDB() {
    return {
      users: {},        // uid -> user
      posts: {},        // pid -> post
      comments: {},     // cid -> comment
      likes: {},        // likeId('uid_pid') -> {uid, pid, ts}
      follows: {},      // followId('uid_targetUid') -> {follower, target, ts}
      bookmarks: {},    // bmId('uid_pid') -> {uid, pid, ts}
      counters: {},     // postLikeCount:pid, commentCount:pid ...
    };
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return freshDB();
      const db = JSON.parse(raw);
      // shallow merge to be safe against schema additions
      return Object.assign(freshDB(), db);
    } catch (e) {
      return freshDB();
    }
  }
  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  let db = loadDB();

  // ---- helpers ----
  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function now() { return Date.now(); }
  function serverTimestamp() { return { _ts: now(), __serverTimestamp: true }; }
  function tsOf(x) { return (x && (x._ts || x)) || now(); }

  function safeEmail(e) { return (e || "").trim().toLowerCase(); }

  // image -> dataURL with compression (mimics Firebase Storage upload)
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1280;
    quality = quality || 0.82;
    if (!file.type.startsWith("image/")) return fileToDataURL(file);
    const dataUrl = await fileToDataURL(file);
    // tiny images: keep as-is
    if (file.size < 120 * 1024 && file.type !== "image/png") return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const out = c.toDataURL("image/jpeg", quality);
        resolve(out);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // ---- counters helpers (firestore-style aggregate) ----
  function getCounter(key) { return db.counters[key] || 0; }
  function setCounter(key, v) { db.counters[key] = v; }
  function bumpCounter(key, delta) { db.counters[key] = (db.counters[key] || 0) + delta; }

  // =============== AUTH ===============
  const authCallbacks = [];
  let currentUser = null;

  function notifyAuth() {
    authCallbacks.forEach((cb) => { try { cb(currentUser); } catch (e) {} });
  }

  function restoreSession() {
    const sid = localStorage.getItem(SESSION_KEY);
    if (sid && db.users[sid]) {
      currentUser = db.users[sid];
    }
  }

  const Auth = {
    onAuthStateChanged(cb) {
      authCallbacks.push(cb);
      // call immediately with current state
      try { cb(currentUser); } catch (e) {}
      return () => {
        const i = authCallbacks.indexOf(cb);
        if (i >= 0) authCallbacks.splice(i, 1);
      };
    },
    currentUser() { return currentUser; },
    currentUserUid() { return currentUser ? currentUser.uid : null; },

    async register({ displayName, email, password }) {
      email = safeEmail(email);
      if (!displayName || !displayName.trim()) throw new Error("Please enter your name.");
      if (!email) throw new Error("Please enter a valid email.");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
      const exists = Object.values(db.users).find((u) => u.email === email);
      if (exists) throw new Error("An account with this email already exists.");
      const user = {
        uid: uid("u"),
        displayName: displayName.trim(),
        email,
        password, // note: real Firebase never stores plaintext; this is local-only
        bio: "",
        photoURL: "",
        verified: false,
        createdAt: serverTimestamp(),
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
      };
      db.users[user.uid] = user;
      saveDB(db);
      currentUser = user;
      localStorage.setItem(SESSION_KEY, user.uid);
      notifyAuth();
      return user;
    },

    async login({ email, password }) {
      email = safeEmail(email);
      const user = Object.values(db.users).find((u) => u.email === email);
      if (!user || user.password !== password) throw new Error("Incorrect email or password.");
      currentUser = user;
      localStorage.setItem(SESSION_KEY, user.uid);
      notifyAuth();
      return user;
    },

    async logout() {
      currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      notifyAuth();
    },

    async updateProfile(patch) {
      if (!currentUser) throw new Error("Not signed in.");
      Object.assign(currentUser, patch);
      db.users[currentUser.uid] = currentUser;
      saveDB(db);
      notifyAuth();
      return currentUser;
    },
  };

  // =============== USERS (Firestore collection) ===============
  const Users = {
    get(uid) { return db.users[uid] || null; },
    all() { return Object.values(db.users); },
    byHandle(query) {
      const q = query.toLowerCase();
      return Object.values(db.users).filter((u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.bio || "").toLowerCase().includes(q)
      );
    },
  };

  // =============== POSTS (Firestore collection) ===============
  const Posts = {
    all() { return Object.values(db.posts); },
    get(pid) { return db.posts[pid] || null; },

    async create({ text, images }) {
      if (!currentUser) throw new Error("Not signed in.");
      if (!text && (!images || images.length === 0)) throw new Error("Write something or add an image.");
      const post = {
        pid: uid("p"),
        authorId: currentUser.uid,
        text: (text || "").trim(),
        images: images || [],
        createdAt: serverTimestamp(),
        editedAt: null,
        likeCount: 0,
        commentCount: 0,
      };
      db.posts[post.pid] = post;
      // bump author posts count
      const author = db.users[currentUser.uid];
      if (author) { author.postsCount = (author.postsCount || 0) + 1; }
      saveDB(db);
      return post;
    },

    async update(pid, patch) {
      const post = db.posts[pid];
      if (!post) throw new Error("Post not found.");
      if (post.authorId !== currentUserUid()) throw new Error("Not allowed.");
      Object.assign(post, patch, { editedAt: now() });
      saveDB(db);
      return post;
    },

    async delete(pid) {
      const post = db.posts[pid];
      if (!post) return;
      if (post.authorId !== currentUserUid()) throw new Error("Not allowed.");
      // delete related
      Object.keys(db.comments).forEach((cid) => { if (db.comments[cid].pid === pid) delete db.comments[cid]; });
      Object.keys(db.likes).forEach((lid) => { if (db.likes[lid].pid === pid) delete db.likes[lid]; });
      Object.keys(db.bookmarks).forEach((bid) => { if (db.bookmarks[bid].pid === pid) delete db.bookmarks[bid]; });
      delete db.posts[pid];
      const author = db.users[post.authorId];
      if (author && author.postsCount) author.postsCount = Math.max(0, author.postsCount - 1);
      saveDB(db);
    },

    byAuthor(uid) {
      return Object.values(db.posts).filter((p) => p.authorId === uid).sort((a, b) => tsOf(b.createdAt) - tsOf(a.createdAt));
    },
    search(query) {
      const q = query.toLowerCase();
      return Object.values(db.posts).filter((p) => (p.text || "").toLowerCase().includes(q)).sort((a, b) => tsOf(b.createdAt) - tsOf(a.createdAt));
    },
    followingFeed(uid) {
      const followingIds = new Set(Object.values(db.follows).filter((f) => f.follower === uid).map((f) => f.target));
      followingIds.add(uid); // include self
      return Object.values(db.posts).filter((p) => followingIds.has(p.authorId)).sort((a, b) => tsOf(b.createdAt) - tsOf(a.createdAt));
    },
    discoverFeed() {
      // randomized to surface smaller creators
      const arr = Object.values(db.posts);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    byHashtag(tag) {
      const t = tag.toLowerCase();
      return Object.values(db.posts).filter((p) => (p.text || "").toLowerCase().includes("#" + t)).sort((a, b) => tsOf(b.createdAt) - tsOf(a.createdAt));
    },
  };

  // =============== COMMENTS ===============
  const Comments = {
    byPost(pid) {
      return Object.values(db.comments)
        .filter((c) => c.pid === pid)
        .sort((a, b) => tsOf(a.createdAt) - tsOf(b.createdAt));
    },
    async create({ pid, text, parentId }) {
      if (!currentUser) throw new Error("Not signed in.");
      if (!text || !text.trim()) throw new Error("Comment can't be empty.");
      const comment = {
        cid: uid("c"),
        pid,
        authorId: currentUser.uid,
        text: text.trim(),
        parentId: parentId || null,
        createdAt: serverTimestamp(),
        editedAt: null,
      };
      db.comments[comment.cid] = comment;
      const post = db.posts[pid];
      if (post) { post.commentCount = (post.commentCount || 0) + 1; }
      saveDB(db);
      return comment;
    },
    async update(cid, text) {
      const c = db.comments[cid];
      if (!c) throw new Error("Comment not found.");
      if (c.authorId !== currentUserUid()) throw new Error("Not allowed.");
      c.text = text.trim();
      c.editedAt = now();
      saveDB(db);
      return c;
    },
    async delete(cid) {
      const c = db.comments[cid];
      if (!c) return;
      if (c.authorId !== currentUserUid()) throw new Error("Not allowed.");
      // also delete child replies
      Object.keys(db.comments).forEach((id) => { if (db.comments[id].parentId === cid) delete db.comments[id]; });
      delete db.comments[cid];
      const post = db.posts[c.pid];
      if (post) post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
      saveDB(db);
    },
  };

  // =============== LIKES ===============
  const Likes = {
    isLiked(uid, pid) { return !!db.likes[uid + "_" + pid]; },
    async toggle(uid, pid) {
      const id = uid + "_" + pid;
      if (db.likes[id]) {
        delete db.likes[id];
        const post = db.posts[pid];
        if (post) post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
        saveDB(db);
        return false;
      } else {
        db.likes[id] = { uid, pid, ts: now() };
        const post = db.posts[pid];
        if (post) post.likeCount = (post.likeCount || 0) + 1;
        saveDB(db);
        return true;
      }
    },
    likedPids(uid) { return Object.values(db.likes).filter((l) => l.uid === uid).map((l) => l.pid); },
  };

  // =============== FOLLOWS ===============
  const Follows = {
    isFollowing(follower, target) { return !!db.follows[follower + "_" + target]; },
    async toggle(follower, target) {
      if (follower === target) throw new Error("Can't follow yourself.");
      const id = follower + "_" + target;
      if (db.follows[id]) {
        delete db.follows[id];
        const fU = db.users[follower], tU = db.users[target];
        if (fU) fU.followingCount = Math.max(0, (fU.followingCount || 0) - 1);
        if (tU) tU.followersCount = Math.max(0, (tU.followersCount || 0) - 1);
        saveDB(db);
        return false;
      } else {
        db.follows[id] = { follower, target, ts: now() };
        const fU = db.users[follower], tU = db.users[target];
        if (fU) fU.followingCount = (fU.followingCount || 0) + 1;
        if (tU) tU.followersCount = (tU.followersCount || 0) + 1;
        saveDB(db);
        return true;
      }
    },
    followersOf(uid) { return Object.values(db.follows).filter((f) => f.target === uid).map((f) => f.follower); },
    followingOf(uid) { return Object.values(db.follows).filter((f) => f.follower === uid).map((f) => f.target); },
  };

  // =============== BOOKMARKS ===============
  const Bookmarks = {
    isSaved(uid, pid) { return !!db.bookmarks[uid + "_" + pid]; },
    async toggle(uid, pid) {
      const id = uid + "_" + pid;
      if (db.bookmarks[id]) {
        delete db.bookmarks[id];
        saveDB(db);
        return false;
      } else {
        db.bookmarks[id] = { uid, pid, ts: now() };
        saveDB(db);
        return true;
      }
    },
    savedPids(uid) { return Object.values(db.bookmarks).filter((b) => b.uid === uid).sort((a,b)=>b.ts-a.ts).map((b) => b.pid); },
  };

  // =============== STORAGE (images) ===============
  const Storage = {
    async uploadImage(file, opts) {
      const dataUrl = await compressImage(file, opts && opts.maxDim, opts && opts.quality);
      return dataUrl; // returns a usable URL (dataURL)
    },
  };

  // =============== EXPORT ===============
  const TQB = {
    Auth, Users, Posts, Comments, Likes, Follows, Bookmarks, Storage,
    _db: () => db,
    _seed: null,
    uid, now, serverTimestamp, tsOf, fileToDataURL, compressImage,
  };
  global.TQB = TQB;

  // restore session as soon as script loads
  restoreSession();

})(window);
