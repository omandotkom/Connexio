# Connexio

> **Project-based Terminal Manager** — Organize your terminals by project, not by window.

![Connexio](https://img.shields.io/badge/version-0.1.0-purple) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Problem

When working on multiple projects, you end up with dozens of terminal windows/tabs with no clear organization. Which terminal belongs to which project? Where was that running server?

## ✨ Solution

Connexio organizes your terminals **by project**. Each project gets its own workspace with dedicated terminal tabs, so you always know where you are.

## 🚀 Features

- **📁 Project Sidebar** — All projects organized by group (Work, Personal, etc.)
- **📑 Multi-tab Terminals** — Each project can have multiple terminal tabs
- **💾 Session Save/Restore** — Close the app, reopen, everything is still there
- **🎨 Themes** — Multiple built-in themes (Dark, Light, Midnight Ocean)
- **🔍 Fuzzy Search** — Find projects instantly
- **⌨️ Custom Titlebar** — Clean, modern look
- **🖥️ Cross-platform** — Windows, macOS, Linux

## 📦 Tech Stack

- **Electron** — Cross-platform desktop app
- **React + TypeScript** — UI framework
- **xterm.js** — Terminal emulator
- **node-pty** — Native terminal backend
- **Zustand** — State management
- **Tailwind CSS** — Styling
- **Vite** — Build tool

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Windows: Visual Studio Build Tools (for node-pty)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/connexio.git
cd connexio

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Scripts

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `npm run dev`         | Start dev mode (renderer + main) |
| `npm run build`       | Build for production             |
| `npm run build:win`   | Build Windows installer          |
| `npm run build:mac`   | Build macOS DMG                  |
| `npm run build:linux` | Build Linux AppImage             |

## 📁 Project Structure

```
connexio/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry, window creation
│   │   ├── preload.ts  # Context bridge API
│   │   ├── terminal.ts # node-pty terminal management
│   │   ├── project.ts  # Project CRUD (electron-store)
│   │   ├── session.ts  # Session save/load
│   │   ├── theme.ts    # Theme management
│   │   └── themes-default.ts
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components
│   │   ├── stores/     # Zustand stores
│   │   ├── styles/     # CSS
│   │   ├── types/      # TypeScript declarations
│   │   ├── App.tsx     # Root component
│   │   └── main.tsx    # Entry point
│   └── shared/         # Shared types between main & renderer
│       └── types.ts
├── package.json
├── tsconfig.json       # Renderer TypeScript config
├── tsconfig.main.json  # Main process TypeScript config
├── vite.config.ts      # Vite bundler config
├── tailwind.config.js  # Tailwind CSS config
└── postcss.config.js
```

## 🎨 Themes

Built-in themes:

- **Connexio Dark** — Default dark theme with purple accents
- **Connexio Light** — Clean light theme
- **Midnight Ocean** — Deep blue with teal accents

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Connexio
