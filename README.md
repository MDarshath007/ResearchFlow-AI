# 🔬 ResearchFlow — Research Software Engineering Assistant

[![Live Demo](https://img.shields.io/badge/Live%20Demo-research--flow--1.vercel.app-success?logo=vercel&logoColor=white)](https://research-flow-1.vercel.app/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Bootstrap](https://img.shields.io/badge/UI-Bootstrap%205.3-7952B3?logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 🌐 **Live Application**: [https://research-flow-1.vercel.app/](https://research-flow-1.vercel.app/)

**ResearchFlow** is a comprehensive full-stack platform designed to help researchers, scientists, and students adopt **Research Software Engineering (RSE)** best practices. It bridges the gap between academic code and production-grade engineering standards through automated code assessment, AI-driven mentorship, reproducibility auditing, and team collaboration.

---

## 🌟 Key Features

### 1. 📊 RSE Maturity & Quality Assessment
- Evaluates codebases across modularity, documentation, automated testing, version control, and reproducibility.
- Automated tiered grading system: **Bronze**, **Silver**, **Gold**, and **Platinum** maturity levels.
- Actionable AI-generated improvement checklists and refactoring suggestions.

### 2. 🤖 AI Research Mentor & Floating Assistant
- Interactive AI chat powered by **Google Gemini AI** (`@google/generative-ai`).
- Contextual assistance for debugging scientific code, generating documentation, structuring experiments, and packaging research software.
- Persistent floating chat bubble accessible across all dashboard pages.

### 3. 📋 Collaborative Workspace & Kanban Board
- Drag-and-drop Kanban task management (To Do, In Progress, Under Review, Completed).
- Team collaboration, activity logging, and real-time in-app notification center.

### 4. 🔄 Reproducibility & Notebook Validator
- Validates Jupyter notebooks (`.ipynb`), execution order, dependencies, and environment files (`requirements.txt`, `environment.yml`).
- Generates reproducibility health reports and highlights non-deterministic risks.

### 5. 📈 Visual Analytics & Metrics Dashboard
- Dynamic radar charts, bar charts, and historical progress tracking powered by **Chart.js** & **react-chartjs-2**.
- Deep-dive metrics on code health, test coverage, and documentation completeness.

### 6. 🎓 Scholar Profile & Official RSE Certification
- Scholar profile displaying unlocked badges, stats, and real avatar photo uploads with Multer.
- Dynamic **Certificate of Achievement** generator with PDF export / print functionality for projects reaching Gold (71+) and Platinum (91+) tiers.

### 7. 🌓 Dark & Light Mode
- Complete theme toggling with curated color palettes, accessible contrast, and glassmorphic card design.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router DOM 7, React Bootstrap 5.3, Lucide React, Chart.js, Framer Motion |
| **Backend** | Node.js, Express.js (ES Modules) |
| **Database** | MongoDB with Mongoose ODM |
| **AI Integration** | Google Gemini API (`@google/generative-ai`) |
| **Utilities** | Multer (file uploads), PDFKit (PDF generation), Adm-Zip (repo extraction), BcryptJS, JWT |

---

## 📋 System Prerequisites

Before you begin, ensure the following are installed on your machine:

| Tool | Minimum Version | Install Link |
|---|---|---|
| **Node.js** | v18.0.0 or higher | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.0.0 or higher | Bundled with Node.js |
| **MongoDB** | v6.0+ (local) **or** MongoDB Atlas | [mongodb.com](https://www.mongodb.com/) |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com/) |

> **Verify your versions:**
> ```bash
> node --version   # should print v18.x.x or higher
> npm --version    # should print 9.x.x or higher
> ```

You will also need:
- A **Google Gemini API key** — [Get one free at Google AI Studio](https://aistudio.google.com/)
- A **MongoDB connection string** — local (`mongodb://localhost:27017/researchflow`) or [Atlas](https://www.mongodb.com/atlas)

---

## 📁 Project Structure

```
Research-Flow/
├── package.json              # Root orchestration scripts
├── setup.sh                  # One-command environment setup (Unix/macOS/WSL)
├── .gitignore                # Root-level ignore rules
├── README.md                 # This file
│
├── client/                   # Frontend Application (React + Vite)
│   ├── public/               # Static assets and icons
│   ├── src/
│   │   ├── assets/           # Images and logos
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Authentication and Global State Context
│   │   ├── pages/            # Application views (Dashboard, Projects, etc.)
│   │   ├── services/         # Axios API services and endpoints
│   │   ├── App.jsx           # Route definitions and layout wrapper
│   │   ├── index.css         # Design tokens, theme variables, custom styling
│   │   └── main.jsx          # Application entry point
│   ├── .env.example          # Client environment variable template
│   ├── index.html            # HTML template
│   ├── package.json          # Frontend dependencies
│   ├── vercel.json           # Vercel deployment rewrites
│   └── vite.config.js        # Vite build configuration
│
└── server/                   # Backend Application (Node.js + Express)
    ├── config/               # MongoDB database connection
    ├── controllers/          # API request handlers
    ├── middleware/           # JWT Authentication and Multer upload middleware
    ├── models/               # Mongoose database schemas
    ├── routes/               # Express API routes
    ├── seeds/                # Database seed scripts
    ├── services/             # Business-logic service layer
    ├── tests/                # Backend test suite
    ├── .env.example          # Server environment variable template
    ├── package.json          # Backend dependencies
    └── server.js             # Express application entry point
```

---

## 🚀 Getting Started (Local Development)

### Option A — Automated Setup (Recommended, Unix/macOS/WSL)

```bash
# 1. Clone the repository
git clone https://github.com/Rathivarman-hub/final.git
cd Research-Flow

# 2. Make the setup script executable and run it
chmod +x setup.sh
./setup.sh
```

The script will:
- Validate Node.js ≥ 18 and npm ≥ 9 are present
- Install all `server/` and `client/` dependencies
- Scaffold `.env` files from their `.env.example` templates

### Option B — Manual Setup (All Platforms)

#### Step 1 — Clone the Repository

```bash
git clone https://github.com/Rathivarman-hub/final.git
cd Research-Flow
```

#### Step 2 — Install All Dependencies (from repo root)

```bash
npm run setup
```

This runs `npm install` in both `server/` and `client/` subdirectories.

Alternatively install each separately:

```bash
npm --prefix server install
npm --prefix client install
```

#### Step 3 — Configure the Server Environment

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in your values:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/researchflow
JWT_SECRET=<at-least-32-random-characters>
GEMINI_API_KEY=<your-google-gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash
GITHUB_TOKEN=          # optional
```

#### Step 4 — Configure the Client Environment

```bash
cp client/.env.example client/.env
```

The defaults work for local development — update only if your server runs on a different port:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SERVER_URL=http://localhost:5000
```

#### Step 5 — Start the Development Servers

Open **two terminal windows** (or tabs):

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# ✔ Express server running at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# ✔ Vite dev server running at http://localhost:5173
```

Or use the root-level shortcut scripts:
```bash
npm run dev:server   # starts Express backend
npm run dev:client   # starts Vite frontend
```

Open your browser at **[http://localhost:5173](http://localhost:5173)** 🎉

---

## 🏗️ Production Build & Validation

### Build the Frontend

```bash
npm run build
# Equivalent to: npm --prefix client run build
# Output: client/dist/  (ready to serve as static files)
```

### Verify the Build

```bash
npm run build:verify
# Builds and prints "Build succeeded — dist/ is ready." on success
```

### Preview the Production Build Locally

```bash
npm run preview
# Serves client/dist/ at http://localhost:4173
```

---

## 🔧 Available Root Scripts

| Script | Command | Description |
|---|---|---|
| `npm run setup` | `npm --prefix server install && npm --prefix client install` | Install all dependencies |
| `npm run dev:server` | `npm --prefix server run dev` | Start Express backend (port 5000) |
| `npm run dev:client` | `npm --prefix client run dev` | Start Vite dev server (port 5173) |
| `npm run build` | `npm --prefix client run build` | Production bundle → `client/dist/` |
| `npm run build:verify` | build + success message | Build and confirm output |
| `npm run lint` | `npm --prefix client run lint` | Lint frontend code (oxlint) |
| `npm run preview` | `npm --prefix client run preview` | Preview production build locally |
| `npm run seed` | `npm --prefix server run seed` | Seed the database with sample data |

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new scholar account |
| `POST` | `/api/auth/login` | Authenticate user and receive JWT |
| `GET` | `/api/auth/me` | Fetch authenticated user details |
| `POST` | `/api/auth/upload-avatar` | Upload profile photo (Multer) |
| `GET` | `/api/projects` | List all user research projects |
| `POST` | `/api/projects` | Create a new research project |
| `POST` | `/api/assessments/assess` | Trigger automated RSE maturity evaluation |
| `POST` | `/api/ai/ask` | Query AI Research Mentor |
| `POST` | `/api/reproducibility/check` | Analyze notebook and dependency reproducibility |
| `GET` | `/api/tasks` | Get project Kanban tasks |
| `POST` | `/api/tasks` | Create / update project Kanban tasks |
| `GET` | `/api/analytics` | Retrieve quality metrics and scoring trends |
| `GET` | `/api/collaboration/notifications` | Fetch unread user notifications |

---

## 🚢 Deployment

- **Live URL**: [https://research-flow-1.vercel.app/](https://research-flow-1.vercel.app/)
- **Frontend**: Deployed on [Vercel](https://vercel.com/) with SPA rewrites configured in [`client/vercel.json`](client/vercel.json).
- **Backend**: Deployed on [Render](https://render.com/) / [Railway](https://railway.app/).

> **Important**: Set all `server/.env` variables as environment variables in your hosting provider's dashboard. Never commit the `.env` file.

---

## 🔒 Security & Environment Variables

| File | Committed? | Purpose |
|---|---|---|
| `server/.env` | ❌ No — git-ignored | Real secrets for local development |
| `server/.env.example` | ✅ Yes | Documented template — safe to share |
| `client/.env` | ❌ No — git-ignored | Local frontend config |
| `client/.env.example` | ✅ Yes | Documented template — safe to share |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
