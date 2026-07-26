/**
 * Rasterises the Safarly PWA icons from their SVG sources.
 *
 * The SVGs in `artifacts/safarly/public/icons/` are the source of truth; the
 * PNGs next to them are build output that happens to be committed, because
 * installability can't wait on a build step — a browser reads the manifest's
 * icons directly off the static host.
 *
 * PNG (not SVG) is what the manifest points at deliberately: Chrome on Android
 * accepts SVG icons but Safari's "Add to Home Screen" does not, and an iOS
 * install with no usable icon falls back to a screenshot of the page.
 *
 * Rasterising needs a chrome-headless-shell binary, which is why this is a
 * script you run on demand rather than part of `pnpm build`. Point CHROME_PATH
 * at one if it isn't in the list probed below.
 *
 *   pnpm --filter @workspace/scripts run icons
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(here, '../../artifacts/safarly/public/icons');

interface IconJob {
  /** SVG source, relative to `iconsDir`. */
  source: string;
  /** PNG output, relative to `iconsDir`. */
  out: string;
  size: number;
}

const JOBS: IconJob[] = [
  // `purpose: "any"` — the icon a launcher shows as-is.
  { source: 'icon.svg', out: 'pwa-192.png', size: 192 },
  { source: 'icon.svg', out: 'pwa-512.png', size: 512 },
  // `purpose: "maskable"` — extra padding so Android's adaptive mask can crop.
  { source: 'icon-maskable.svg', out: 'pwa-maskable-512.png', size: 512 },
  // iOS home screen. 180 is the largest size Safari asks for; it applies its
  // own corner rounding, so the source is a full square with no transparency.
  { source: 'icon.svg', out: 'apple-touch-icon.png', size: 180 },
];

/**
 * `chrome-headless-shell`, NOT a full Chrome binary.
 *
 * This matters and is easy to get wrong. Full Chrome's new headless mode maps
 * `--window-size=512,512` to a viewport ~60px shorter, because the window still
 * accounts for browser UI that is never drawn. The screenshot is then padded
 * back out to the requested size, so a 512x512 icon comes out as 512x452 of
 * artwork over a white band — it looks plausible enough to commit by accident.
 * The headless shell is the old headless implementation, maps the viewport 1:1,
 * and is what Chrome's own docs point at for `--screenshot`.
 *
 * Playwright and Puppeteer both install one; the paths below cover their
 * layouts. Set CHROME_PATH if yours lives elsewhere.
 */
const SHELL_GLOBS = [
  '/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell',
  `${process.env.HOME ?? ''}/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell`,
  `${process.env.HOME ?? ''}/.cache/puppeteer/chrome-headless-shell-*/*/chrome-headless-shell`,
];

function findShell(): string {
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH does not exist: ${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }

  for (const pattern of SHELL_GLOBS) {
    // `globSync` resolves the version-numbered directories these tools install into.
    const [match] = globSync(pattern).sort().reverse();
    if (match) return match;
  }

  throw new Error(
    'No chrome-headless-shell binary found. Tried:\n  ' +
      SHELL_GLOBS.join('\n  ') +
      '\n\nInstall one with `npx playwright install chromium` (it ships the shell ' +
      'alongside Chromium), or set CHROME_PATH.\n' +
      'Note that a full Chrome binary will NOT do — see the comment above ' +
      'SHELL_GLOBS for why it silently produces short icons.',
  );
}

/**
 * Inlines the SVG into a bare HTML page rather than pointing an <img> at the
 * file: a file:// page loading a file:// image is subject to Chrome's local
 * file access rules, and inlining sidesteps them entirely. The source's own
 * width/height are overridden so the artwork fills the screenshot viewport;
 * the viewBox does the scaling.
 */
function buildPage(svg: string, size: number): string {
  const sized = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\swidth="\d+"/, ` width="${size}"`)
    .replace(/\sheight="\d+"/, ` height="${size}"`);

  return `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}svg{display:block}</style>
${sized}`;
}

/** Reads width/height straight out of the PNG's IHDR, which is always first. */
function pngSize(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

function main(): void {
  const shell = findShell();
  const work = mkdtempSync(path.join(tmpdir(), 'safarly-icons-'));

  try {
    for (const job of JOBS) {
      const svg = readFileSync(path.join(iconsDir, job.source), 'utf8');
      const page = path.join(work, `${job.out}.html`);
      const target = path.join(iconsDir, job.out);
      writeFileSync(page, buildPage(svg, job.size));

      execFileSync(
        shell,
        [
          '--disable-gpu',
          '--no-sandbox',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          `--window-size=${job.size},${job.size}`,
          `--screenshot=${target}`,
          page,
        ],
        { stdio: 'ignore' },
      );

      const { width, height } = pngSize(target);
      if (width !== job.size || height !== job.size) {
        throw new Error(
          `${job.out} came out ${width}x${height}, expected ${job.size}x${job.size}. ` +
            'The binary at ' + shell + ' is probably a full Chrome rather than a headless shell.',
        );
      }

      console.log(`  ${job.out}  ${job.size}x${job.size}  <- ${job.source}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`\nWrote ${JOBS.length} icons to ${iconsDir}`);
}

main();
