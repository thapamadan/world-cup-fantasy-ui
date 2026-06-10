# WOW World Cup Prediction & Fantasy UI 🏆

Welcome to the frontend repository for the **WOW World Cup Prediction League**, a premium-grade, interactive web application where users can predict World Cup match scores, create private groups, and compete for the top spot on the global and group leaderboards.

---

## 🌟 Features

- **Match Score Predictions:** Predict exact scores or correct winners of upcoming World Cup matches.
- **Dynamic Leaderboard:** Climb the leaderboard with points awarded based on prediction accuracy (e.g., 5 points for exact score, 1 point for correct winner).
- **Private & Public Groups:** Create or join leagues/groups to compete with friends, colleagues, or communities.
- **Streak & Daily Bonuses:** Track prediction streaks for daily bonus points.
- **Seamless Authentication:** Sign in using traditional Email/Password or authenticate instantly via Google OAuth.
- **Premium Dark Mode UI:** Built with vibrant gradients, custom typography, rich shadows, and fluid animations for an immersive user experience.
- **Responsive Design:** Optimized for all screen sizes (mobile, tablet, desktop).

---

## 🛠️ Tech Stack

- **Core Framework:** [Next.js](https://nextjs.org/) (v15.3.5) with [React](https://react.dev/) (v19)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (v4.2.1) + [tw-animate-css](https://www.npmjs.com/package/tw-animate-css)
- **Programming Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI Components:** Built on top of [Radix UI](https://www.radix-ui.com/) and [Lucide React](https://lucide.dev/) icons
- **Form Management:** [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/) for schema validation
- **Build/Package Tooling:** Bundled and configured for execution with [Bun](https://bun.sh/) or [npm](https://www.npmjs.com/)

---

## 📂 Project Structure

```text
├── src/
│   ├── app/           # Next.js App Router (pages: dashboard, admin, groups, matches, etc.)
│   ├── assets/        # Images, logos, and static resources
│   ├── components/    # Reusable UI components (buttons, inputs, cards)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions, API clients, and branding configuration
│   └── types/         # TypeScript definitions
├── .env.example       # Example environment variables template
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── tailwind.config.js # Tailwind CSS styles and customization
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/) installed.

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd world-cup-fantasy-ui
   ```

2. **Install dependencies:**
   Using Bun:
   ```bash
   bun install
   ```
   Or using npm:
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file and configure the values:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and set the correct endpoints for your local or production server:
   - `NEXT_PUBLIC_API_BASE_URL`: Point to your prediction backend (default is `http://localhost:8000`).
   - `NEXT_PUBLIC_APP_ORIGIN`: Base URL of the UI client (default is `http://localhost:3000`).

4. **Run the Development Server:**
   Using Bun:
   ```bash
   bun dev
   ```
   Or using npm:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🔧 Available Scripts

In the project directory, you can run:

- `npm run dev` / `bun dev` - Starts the development server with hot-reloading.
- `npm run build` / `bun build` - Compiles the production build.
- `npm run start` / `bun start` - Runs the compiled Next.js server in production mode.
- `npm run lint` / `bun lint` - Runs ESLint to check code quality.
- `npm run format` / `bun format` - Formats the codebase using Prettier.
