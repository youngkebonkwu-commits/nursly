# 🌿 The Quiet Blog

> **Share Thoughts. Keep It Calm.**

The Quiet Blog is a clean, modern social blogging platform where people can share thoughts, stories, opinions, photos, and daily experiences in a peaceful, distraction-free environment. Unlike fast-paced social media, it focuses on meaningful conversations and quality content.

---

## ✨ Features

### Home & Authentication
- Welcoming login and registration page with a soft, calming design
- New users create an account with email; returning users log in securely
- Session persistence across reloads

### Discover (FYP)
- A constantly refreshing feed of posts from the community
- Feed is **randomized** so smaller creators gain visibility, not just the most popular posts
- Toggle between **Discover** (all community posts) and a personalized **Following** feed

### Posts
Users can:
- Write text posts
- Upload beautiful images (with automatic compression)
- Share stories, experiences, or announcements

Each post displays:
- User profile picture
- Display name
- Date and time
- Post text
- Images (if included)
- Like count
- Comment count
- Reading-time estimate

### Community Interaction
- Like posts
- Comment on posts
- Reply to other comments (nested replies)
- View posts in chronological order
- Follow / unfollow other users
- Personalized Following feed

### User Profiles
Every member has a personal profile featuring:
- Profile picture
- Display name
- Bio
- Total posts, followers, and following counts
- Personal post history (Posts / Liked / Saved tabs)
- Edit profile (bio + profile picture)
- Followers & Following lists

### Search
Quickly find:
- Other users (by name, email, or bio)
- Posts containing specific words or phrases
- Posts by **#hashtag**

### Content Management
- Edit posts
- Delete posts
- Edit comments
- Delete comments
- Save (bookmark) posts

### Design
- Minimalist interface with soft earth-tone colors and calm blue accents
- Rounded cards and clean typography (Lora serif + Inter sans-serif)
- Responsive layouts for mobile and desktop
- Smooth navigation with a distraction-free reading experience
- **Dark mode** toggle

---

## 🚀 Getting Started

This is a static single-page application — no build step required.

### Run locally
Open `index.html` in any modern browser, or serve the folder:
```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Try it
- **Register** a new account with any email and a password of at least 6 characters, **or**
- **Log in** with a seeded account, e.g. `maya@quiet.blog` / `password`

The app comes pre-seeded with sample creators, posts, comments, likes, and follows so you can explore immediately.

---

## 🏗️ Architecture

The app is built with modular vanilla JavaScript (no framework, no build step) and is structured for easy migration to a real Firebase backend.

| File | Responsibility |
|------|----------------|
| `index.html` | App shell, icon sprite, font + CSS loading |
| `css/styles.css` | Full design system (light + dark themes, responsive) |
| `js/data.js` | **Data layer** — Firebase-style API (Auth, Firestore collections, Storage) backed by localStorage |
| `js/store.js` | Reactive state + theme + hash-based router state |
| `js/ui.js` | DOM helpers, icons, toasts, modals, lightbox, dropdowns, time formatting |
| `js/components.js` | Reusable components: PostCard, Composer, CommentNode, UserRow |
| `js/pages.js` | Page views: Auth, Discover, Profile, Search, Post detail, Bookmarks, Settings, About |
| `js/app.js` | Bootstrap, router, header + bottom nav, seed data |

### Connecting real Firebase
The `js/data.js` file mirrors Firebase's API surface exactly (`TQB.Auth`, `TQB.Users`, `TQB.Posts`, `TQB.Comments`, `TQB.Likes`, `TQB.Follows`, `TQB.Bookmarks`, `TQB.Storage`). To connect a real Firebase project, reimplement the methods in `data.js` using the Firebase SDK — **every other file stays unchanged**.

---

## 🔮 Roadmap

### Planned enhancements
- Trending posts
- Hashtags and categories (foundational hashtags already supported)
- Rich text formatting
- Email verification
- Password reset
- Push notifications
- Infinite scrolling
- Progressive Web App (offline support)
- AI-powered content recommendations
- Content reporting and moderation
- Verified creator badges (UI supported)
- Analytics for creators

### Admin Dashboard (planned)
- Manage users
- Delete inappropriate posts
- Moderate comments
- Review reported content
- Ban abusive accounts
- Monitor platform activity

### Future vision
- Direct messages (DMs)
- Short videos (TikTok-style)
- Communities
- Schools
- Voice and video calls

---

## 🛡️ Security

The platform is designed around Firebase services:
- Firebase Authentication for secure login
- Cloud Firestore for storing users and posts
- Firebase Storage for images
- Firestore Security Rules to protect data
- Server timestamps for accurate post times

The local data layer mimics these services so the app is fully functional for development and demo; production deployment should swap in real Firebase credentials as described above.

---

Made with calm intentions. 🌿
