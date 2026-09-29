# Daybook — Activity Management & Gamified Habit Tracker

Daybook is an activity management and habit tracking system with gamified quest boards, mentors (One Piece, Bleach, Naruto, Black Clover), XP leveling, and achievements.

The application is fully configured to run simultaneously in **Google AI Studio** and on **Vercel**.

---

## 🚀 Deploying to Vercel (Step-by-Step)

You can deploy Daybook to Vercel in just a few clicks!

### Method 1: Deploy via GitHub (Recommended)

1. **Push this repository to GitHub**:
   - Create a new GitHub repository (e.g., `daybook`).
   - Push your code to GitHub:
     ```bash
     git add .
     git commit -m "Configure Vercel deployment"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/daybook.git
     git push -u origin main
     ```

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** → **"Project"**.
   - Select your `daybook` repository from GitHub.
   - Framework Preset: **Other** (leave build command and output directory as default).

3. **Configure Environment Variables (Optional for shared database)**:
   - In the Vercel project configuration, expand **Environment Variables**:
     - `SUPABASE_URL` = your Supabase project URL (e.g., `https://xyz.supabase.co`)
     - `SUPABASE_KEY` = your Supabase service role or anon key
     - `DATABASE_URL` = your Supabase connection string (optional)
   *(Note: Setting Supabase credentials ensures both AI Studio and Vercel share the same real-time persistent database).*

4. **Click "Deploy"**:
   - Vercel will build and deploy the application in under 30 seconds!
   - You will get a live URL like `https://daybook-xyz.vercel.app`.

---

### Method 2: Deploy via Vercel CLI

If you prefer deploying directly from your terminal:

1. Install the Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Run the deploy command from the project root:
   ```bash
   vercel
   ```

3. When deploying for production:
   ```bash
   vercel --prod
   ```

---

## 🛠️ Architecture & Vercel Compatibility

- **Serverless API Handler**: `/api/index.js` wraps the Express app (`server.js`) into a standard Vercel serverless function.
- **Routing & Rewrites**: `vercel.json` serves frontend assets (`index.html`, `style.css`, `script.js`, `manifest.json`, `assets/`) through Vercel's global CDN and routes `/api/*` to the serverless function.
- **Dual Execution**: When running locally or in AI Studio, `server.js` listens on port 3000. When running on Vercel, serverless function invocation handles HTTP requests automatically without port binding conflicts.
- **Database Storage**: Uses Supabase PostgreSQL when credentials are provided, with resilient fallback handling in serverless environments.
