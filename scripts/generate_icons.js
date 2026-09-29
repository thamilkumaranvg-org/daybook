import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const iconsDir = path.join(rootDir, "assets", "icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Square Icon SVG (Emblem only, centered for app icon)
const squareIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.12" />
    </filter>
  </defs>

  <!-- Clean Background -->
  <rect width="512" height="512" rx="104" fill="#ffffff" />

  <!-- Radiating Energy Sparks above Book -->
  <g fill="#2563eb">
    <!-- Center ray -->
    <rect x="250" y="70" width="12" height="34" rx="6" />
    <!-- Left ray -->
    <rect x="200" y="86" width="12" height="30" rx="6" transform="rotate(-30 206 101)" />
    <!-- Right ray -->
    <rect x="300" y="86" width="12" height="30" rx="6" transform="rotate(30 306 101)" />
  </g>

  <!-- Open Book Emblem Base -->
  <g transform="translate(68, 120) scale(0.74)" filter="url(#shadow)">
    <!-- Book Backing Outline / Pages Base (Navy) -->
    <path d="M 40 40 
             Q 150 10 255 70 
             Q 360 10 470 40 
             L 485 360 
             Q 365 330 255 385 
             Q 145 330 25 360 
             Z" 
          fill="#0f172a" />

    <!-- Open Spine Valley Accent -->
    <path d="M 255 70 L 255 385" stroke="#ffffff" stroke-width="14" stroke-linecap="round" />

    <!-- Left Page Interior (Navy background with white bullet tasks) -->
    <g fill="#ffffff">
      <!-- Bullet 1 -->
      <circle cx="95" cy="140" r="16" />
      <rect x="130" y="128" width="85" height="24" rx="12" />
      <!-- Bullet 2 -->
      <circle cx="95" cy="205" r="16" />
      <rect x="130" y="193" width="85" height="24" rx="12" />
      <!-- Bullet 3 -->
      <circle cx="95" cy="270" r="16" />
      <rect x="130" y="258" width="85" height="24" rx="12" />
    </g>

    <!-- Right Page: Distinct Blue 'X' with Upward Arrow -->
    <g>
      <!-- Downward stroke of X -->
      <path d="M 300 120 L 420 305" stroke="url(#blueGrad)" stroke-width="42" stroke-linecap="round" />
      <!-- Upward stroke of X with Arrowhead -->
      <path d="M 300 305 L 425 120" stroke="url(#blueGrad)" stroke-width="42" stroke-linecap="round" />
      <!-- Arrow Head pointing top-right -->
      <path d="M 380 102 L 450 102 L 450 172 Z" fill="url(#blueGrad)" />
    </g>
  </g>
</svg>
`;

// 2. Maskable Icon SVG (Generous 20% safe padding for Android squircles)
const maskableIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="blueGradM" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
  </defs>

  <!-- Full bleed background -->
  <rect width="512" height="512" fill="#ffffff" />

  <!-- Scaled down 62% inside safe zone -->
  <g transform="translate(100, 115) scale(0.60)">
    <!-- Radiating Energy Sparks above Book -->
    <g fill="#2563eb">
      <rect x="250" y="70" width="12" height="34" rx="6" />
      <rect x="200" y="86" width="12" height="30" rx="6" transform="rotate(-30 206 101)" />
      <rect x="300" y="86" width="12" height="30" rx="6" transform="rotate(30 306 101)" />
    </g>

    <!-- Book Backing Outline -->
    <path d="M 40 40 
             Q 150 10 255 70 
             Q 360 10 470 40 
             L 485 360 
             Q 365 330 255 385 
             Q 145 330 25 360 
             Z" 
          fill="#0f172a" />

    <!-- Open Spine Valley Accent -->
    <path d="M 255 70 L 255 385" stroke="#ffffff" stroke-width="14" stroke-linecap="round" />

    <!-- Left Page Interior -->
    <g fill="#ffffff">
      <circle cx="95" cy="140" r="16" />
      <rect x="130" y="128" width="85" height="24" rx="12" />
      <circle cx="95" cy="205" r="16" />
      <rect x="130" y="193" width="85" height="24" rx="12" />
      <circle cx="95" cy="270" r="16" />
      <rect x="130" y="258" width="85" height="24" rx="12" />
    </g>

    <!-- Right Page: Blue 'X' with Upward Arrow -->
    <g>
      <path d="M 300 120 L 420 305" stroke="url(#blueGradM)" stroke-width="42" stroke-linecap="round" />
      <path d="M 300 305 L 425 120" stroke="url(#blueGradM)" stroke-width="42" stroke-linecap="round" />
      <path d="M 380 102 L 450 102 L 450 172 Z" fill="url(#blueGradM)" />
    </g>
  </g>
</svg>
`;

// 3. Full Horizontal Logo SVG matching the user's attachment
const horizontalLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500">
  <defs>
    <linearGradient id="logoBlueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
  </defs>

  <rect width="1000" height="500" fill="#ffffff" />

  <!-- Book Icon on Left -->
  <g transform="translate(30, 40) scale(0.78)">
    <!-- Radiating Energy Sparks above Book -->
    <g fill="#2563eb">
      <rect x="250" y="70" width="12" height="34" rx="6" />
      <rect x="200" y="86" width="12" height="30" rx="6" transform="rotate(-30 206 101)" />
      <rect x="300" y="86" width="12" height="30" rx="6" transform="rotate(30 306 101)" />
    </g>

    <!-- Book Backing Outline -->
    <path d="M 40 40 
             Q 150 10 255 70 
             Q 360 10 470 40 
             L 485 360 
             Q 365 330 255 385 
             Q 145 330 25 360 
             Z" 
          fill="#0f172a" />

    <!-- Open Spine Valley Accent -->
    <path d="M 255 70 L 255 385" stroke="#ffffff" stroke-width="14" stroke-linecap="round" />

    <!-- Left Page Interior -->
    <g fill="#ffffff">
      <circle cx="95" cy="140" r="16" />
      <rect x="130" y="128" width="85" height="24" rx="12" />
      <circle cx="95" cy="205" r="16" />
      <rect x="130" y="193" width="85" height="24" rx="12" />
      <circle cx="95" cy="270" r="16" />
      <rect x="130" y="258" width="85" height="24" rx="12" />
    </g>

    <!-- Right Page: Blue 'X' with Upward Arrow -->
    <g>
      <path d="M 300 120 L 420 305" stroke="url(#logoBlueGrad)" stroke-width="42" stroke-linecap="round" />
      <path d="M 300 305 L 425 120" stroke="url(#logoBlueGrad)" stroke-width="42" stroke-linecap="round" />
      <path d="M 380 102 L 450 102 L 450 172 Z" fill="url(#logoBlueGrad)" />
    </g>
  </g>

  <!-- Typography: Daybook in Dark Navy, X in Vibrant Blue -->
  <text x="450" y="295" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="142" font-weight="900" fill="#0f172a" letter-spacing="-2">Daybook<tspan fill="#2563eb">X</tspan></text>
</svg>
`;

async function generateAssets() {
  console.log("Generating PWA and brand icon assets...");

  // Write SVGs
  fs.writeFileSync(path.join(iconsDir, "icon.svg"), squareIconSvg.trim());
  fs.writeFileSync(path.join(iconsDir, "icon-maskable.svg"), maskableIconSvg.trim());
  fs.writeFileSync(path.join(iconsDir, "daybookx-logo.svg"), horizontalLogoSvg.trim());

  // Generate 512x512 standard icon PNG
  await sharp(Buffer.from(squareIconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-512.png"));

  // Generate 192x192 standard icon PNG
  await sharp(Buffer.from(squareIconSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "icon-192.png"));

  // Generate 512x512 maskable icon PNG
  await sharp(Buffer.from(maskableIconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-maskable-512.png"));

  // Generate 180x180 Apple touch icon PNG
  await sharp(Buffer.from(squareIconSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, "apple-touch-icon.png"));

  // Generate 32x32 Favicon PNG
  await sharp(Buffer.from(squareIconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, "favicon-32.png"));

  // Generate full horizontal logo PNG
  await sharp(Buffer.from(horizontalLogoSvg))
    .resize(800, 400)
    .png()
    .toFile(path.join(iconsDir, "daybookx-logo.png"));

  console.log("All PWA icons and DaybookX assets successfully generated in assets/icons/");
}

generateAssets().catch((err) => {
  console.error("Error generating icon assets:", err);
  process.exit(1);
});
