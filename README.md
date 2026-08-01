# <img src="./src-tauri/icons/128x128.png" width="48" align="center" /> Splice-Tab

> **A modern, lightning-fast, authentication-free desktop client for the Splice sample library.**

[![Tauri 2.0](https://img.shields.io/badge/Tauri-v2.0-blue?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Svelte 5](https://img.shields.io/badge/Svelte-v5.0-orange?logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()

---

## 📌 Overview

**Splice-Tab** is a sleek, high-performance alternative desktop client for browsing, auditioning, and downloading sample libraries from [Splice](https://splice.com/features/sounds). Designed without mandatory user authentication, it empowers music producers to instantly search sound catalogs, preview waveform audio, and drag-and-drop sample files straight into DAWs (Ableton Live, FL Studio, Logic Pro, Studio One, Reaper, and more).

Maintained by **[Vincent (adittamavincent)](https://github.com/adittamavincent)**, this project is built on top of **Tauri 2.0** and **Svelte 5**, featuring native **macOS Apple Silicon (ARM64)** optimization, custom tabbed navigation, and updated compatibility patches for Splice's latest GraphQL API security headers.

---

## ✨ Features

- 🔓 **Zero Authentication**: Browse and audition sample libraries freely without signing in.
- 🎛️ **Direct Drag-and-Drop**: Drag decoded sample audio (WAV/MP3) directly into your DAW or file system.
- 🔍 **Smart Search & Autocomplete**: Real-time search suggestions with tag and category recommendations.
- 🏷️ **Comprehensive Filters**: Filter samples by **Genre**, **BPM range**, **Key**, **Chord Type**, and popularity.
- 🌊 **Interactive Waveform Player**: Instant audio auditioning with seekable waveforms, volume control, and auto-prefetching.
- 📂 **Multi-Tab Workspace**: Open multiple packs, search queries, or category lists in separate tabs simultaneously.
- ⚡ **Ultra Lightweight**: Minimal memory footprint powered by Tauri 2.0 (Rust) compared to heavy Electron apps.
- 🌗 **Customizable UI**: Full support for Dark & Light themes, customizable UI scale, and responsive layouts.

---

## 🚀 Quick Start

### Download Binary Releases
Get the latest pre-built installer for macOS (ARM64 / Universal) or Windows:  
👉 **[Download Latest Releases](https://github.com/adittamavincent/Splice-Tab/releases)**

---

## 🔧 Installation & Local Development

### Prerequisites
Make sure you have installed:
- [Node.js](https://nodejs.org/) (v18+) & [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) & [Tauri 2.0 Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Setup & Run Locally
```bash
# 1. Clone the repository
git clone https://github.com/adittamavincent/Splice-Tab.git
cd Splice-Tab

# 2. Install dependencies & approve build scripts
pnpm install
pnpm approve-builds --all

# 3. Start development server
pnpm tauri dev
```

### Build Distribution Bundles
```bash
# Build for macOS Apple Silicon (ARM64)
pnpm build:macos

# Build Universal macOS Bundle (.app & .dmg)
pnpm build:universal

# Build for Windows (.exe / .msi)
pnpm build:windows
```

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | [Svelte 5](https://svelte.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/) |
| **Desktop Runtime** | [Tauri 2.0](https://v2.tauri.app/) (Rust) |
| **Audio Processing** | Web Audio API + Custom Audio Descrambler (XOR decoding) |
| **UI Components** | Bits UI, Lucide Svelte, Mode Watcher |

---

## 🙏 Credits & Acknowledgements

- Maintained & updated by [adittamavincent](https://github.com/adittamavincent).
- Forked & adapted from [robert-k/splice-tab](https://github.com/robert-k/splice-tab).
- Originally inspired by [ascpixi/splicedd](https://github.com/ascpixi/splicedd).

---

<p align="center">
  Crafted with ❤️ for Music Producers & Sound Designers
</p>
