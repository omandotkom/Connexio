# Connexio

> **Project-based Terminal Manager** — Organize your terminals by project, not by window.

![Version](https://img.shields.io/github/v/release/yandanp/Connexio?color=purple&label=version)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Downloads](https://img.shields.io/github/downloads/yandanp/Connexio/total?color=brightgreen)

## 🎯 Problem

When working on multiple projects, you end up with dozens of terminal windows/tabs with no clear organization. Which terminal belongs to which project? Where was that running server?

## ✨ Solution

Connexio organizes your terminals **by project**. Each project gets its own workspace with dedicated terminal tabs, persistent sessions, and productivity tools built right in.

## 🚀 Features

### Core

- **📁 Project Workspace** — Each project has its own workspace with dedicated terminals
- **📑 Multi-tab Terminals** — Multiple terminal tabs per project with rename & drag-to-reorder
- **🐚 Shell Picker** — Auto-detect available shells (PowerShell, CMD, Git Bash, WSL, Zsh, Fish, etc.)
- **💾 Session Persistence** — Tabs, layout, and active project survive app restart
- **🔀 Drag & Drop** — Reorder tabs, reorder projects, move projects between groups

### Productivity

- **📋 Task Runner** — Auto-detect scripts from `package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml` — one-click run
- **📌 Pinned Commands** — Save favorite commands per project (CRUD, drag reorder)
- **⏱️ Command Timer** — Track execution time, desktop notification when long-running commands finish (>10s)
- **🌿 Git Status** — Live branch, ahead/behind, modified/staged/untracked counts in workspace header

### Connectivity

- **🔗 SSH Manager** — Save SSH connections per project + global, one-click connect with key or password auth
- **🔄 Auto-Updater** — Check for updates via GitHub Releases, download & install with one click

### Customization

- **🎨 Themes** — Built-in themes (Dark, Light, Midnight Ocean) with full terminal color support
- **⚙️ Settings** — Font size, font family, cursor style, scrollback, copy-on-select, default shell
- **🖥️ Custom Titlebar** — Clean frameless window with app version display

## 📥 Download

| Platform | Download                                                                  |
| -------- | ------------------------------------------------------------------------- |
| Windows  | [Connexio Setup.exe](https://github.com/yandanp/Connexio/releases/latest) |
| macOS    | [Connexio.dmg](https://github.com/yandanp/Connexio/releases/latest)       |
| Linux    | [Connexio.AppImage](https://github.com/yandanp/Connexio/releases/latest)  |

Or go to [Releases](https://github.com/yandanp/Connexio/releases) for all versions.

## 📦 Tech Stack

| Technology           | Purpose                    |
| -------------------- | -------------------------- |
| **Electron**         | Cross-platform desktop app |
| **React 18**         | UI framework               |
| **TypeScript**       | Type safety                |
| **xterm.js**         | Terminal rendering         |
| **node-pty**         | Native terminal backend    |
| **Zustand**          | State management           |
| **Tailwind CSS**     | Styling                    |
| **Vite**             | Build tool                 |
| **electron-builder** | Packaging & auto-update    |
| **electron-store**   | Persistent storage         |

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm
- **Windows:** Visual Studio Build Tools (for node-pty native module)
- **macOS:** `xcode-select --install`
- **Linux:** `sudo apt install build-essential python3`

### Setup

```bash
git clone https://github.com/yandanp/Connexio.git
cd Connexio
npm install
npm run dev
```

### Scripts

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run dev`         | Start dev mode (hot-reload)     |
| `npm run build`       | Build for production            |
| `npm run build:win`   | Build Windows installer (.exe)  |
| `npm run build:mac`   | Build macOS installer (.dmg)    |
| `npm run build:linux` | Build Linux package (.AppImage) |
| `npm run typecheck`   | Type-check all TypeScript       |
| `npm start`           | Run built app                   |

### Release

```bash
npm version patch          # bump version
git push && git push --tags  # triggers GitHub Actions → auto build & release
```

## 📁 Project Structure

```
Connexio/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry, window, IPC setup
│   │   ├── preload.ts         # Context bridge API
│   │   ├── terminal.ts        # node-pty terminal management
│   │   ├── project.ts         # Project CRUD
│   │   ├── session.ts         # Session persistence
│   │   ├── workspace.ts       # Workspace state persistence
│   │   ├── settings.ts        # App settings + shell detection
│   │   ├── git.ts             # Git status detection
│   │   ├── tasks.ts           # Task runner + pinned commands
│   │   ├── ssh.ts             # SSH connection manager
│   │   ├── updater.ts         # Auto-updater (GitHub Releases)
│   │   ├── theme.ts           # Theme management
│   │   └── themes-default.ts  # Built-in themes
│   ├── renderer/              # React frontend
│   │   ├── components/        # UI components
│   │   │   ├── Workspace.tsx       # Main workspace (tabs, terminal, side panel)
│   │   │   ├── Terminal.tsx        # xterm.js terminal instance
│   │   │   ├── TerminalLayer.tsx   # Global terminal renderer (never unmounts)
│   │   │   ├── Sidebar.tsx         # Project sidebar with drag & drop
│   │   │   ├── TaskPanel.tsx       # Task runner + pinned commands
│   │   │   ├── SSHPanel.tsx        # SSH connection manager UI
│   │   │   ├── GitStatusBar.tsx    # Git status display
│   │   │   ├── CommandTimer.tsx    # Command execution timer
│   │   │   ├── SettingsModal.tsx   # Settings UI
│   │   │   ├── ShellPicker.tsx     # Shell selection dropdown
│   │   │   ├── WorkspaceTab.tsx    # Draggable, renameable tab
│   │   │   ├── UpdateNotification.tsx  # Auto-update toast
│   │   │   └── ...
│   │   ├── stores/            # Zustand state management
│   │   ├── styles/            # Global CSS
│   │   └── types/             # TypeScript declarations
│   └── shared/
│       └── types.ts           # Shared types (main ↔ renderer)
├── assets/                    # App icons (ico, png, svg)
├── .github/workflows/         # CI/CD (auto-release)
└── package.json
```

## 🎨 Themes

| Theme              | Style                                  |
| ------------------ | -------------------------------------- |
| **Connexio Dark**  | Default dark theme with purple accents |
| **Connexio Light** | Clean light theme                      |
| **Midnight Ocean** | Deep blue with teal accents            |

Themes apply to both the app UI and terminal colors.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

### Commit Convention

| Prefix   | Usage         |
| -------- | ------------- |
| `feat:`  | New feature   |
| `fix:`   | Bug fix       |
| `ci:`    | CI/CD changes |
| `chore:` | Maintenance   |

## 📄 License

MIT © [yandanp](https://github.com/yandanp)
