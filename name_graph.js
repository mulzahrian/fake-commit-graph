const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PREVIEW = process.argv.includes("--preview");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  console.error("❌ .env file not found. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const GITHUB_USER = process.env.GITHUB_USERNAME?.trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const GITHUB_EMAIL = process.env.GITHUB_EMAIL?.trim();
const PRIVATE_REPO = process.env.PRIVATE_REPO === "true";
const GRAPH_YEAR = Number(process.env.GRAPH_YEAR?.trim());
const GRAPH_NAME = (process.env.GRAPH_NAME || "").trim().toUpperCase();
const COMMITS_PER_PIXEL = Number(process.env.GRAPH_COMMITS_PER_PIXEL?.trim() || 2);
const REPO_NAME = process.env.REPO_NAME?.trim() || "contribution-graph";

const COMMIT_START_HOUR = 12;
const COMMIT_TIMEZONE = "+07:00";
const CHAR_WIDTH = 5;
const CHAR_GAP = 1;
const GRAPH_WEEKS = 53;

// 5x7 pixel font. Each row is 5 chars; "#" = commit, "." = empty.
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function validateConfig() {
  const errors = [];
  if (!PREVIEW && (!GITHUB_USER || !GITHUB_TOKEN || !GITHUB_EMAIL)) {
    errors.push("GITHUB_USERNAME, GITHUB_TOKEN, and GITHUB_EMAIL are required in .env");
  }
  if (!Number.isInteger(GRAPH_YEAR) || GRAPH_YEAR < 1970 || GRAPH_YEAR > 2099) {
    errors.push("GRAPH_YEAR must be a year between 1970 and 2099");
  }
  if (!GRAPH_NAME) {
    errors.push("GRAPH_NAME is required in .env");
  }
  const unsupported = [...new Set([...GRAPH_NAME].filter((ch) => !FONT[ch]))];
  if (unsupported.length) {
    errors.push(`GRAPH_NAME contains unsupported characters: ${unsupported.join(" ")} (only A-Z, 0-9 and space)`);
  }
  // The first and last weeks of a year are usually partial, so only 52 full weeks are usable.
  const maxChars = Math.floor((GRAPH_WEEKS - 1 + CHAR_GAP) / (CHAR_WIDTH + CHAR_GAP));
  if (GRAPH_NAME.length > maxChars) {
    errors.push(`GRAPH_NAME is too long (max ${maxChars} characters to fit in one year)`);
  }
  if (!Number.isInteger(COMMITS_PER_PIXEL) || COMMITS_PER_PIXEL < 1) {
    errors.push("GRAPH_COMMITS_PER_PIXEL must be a positive integer");
  }
  if (errors.length) {
    errors.forEach((e) => console.error(`❌ ${e}`));
    process.exit(1);
  }
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

// Returns the list of dates (YYYY-MM-DD) that must be "lit" to draw the name.
// The graph is a grid of weeks (columns) x weekdays (rows, Sunday = 0),
// where the first column is the week containing January 1st.
function buildPixelDates() {
  const textWidth = GRAPH_NAME.length * (CHAR_WIDTH + CHAR_GAP) - CHAR_GAP;
  const startCol = Math.floor((GRAPH_WEEKS - textWidth) / 2);
  const jan1 = new Date(Date.UTC(GRAPH_YEAR, 0, 1));
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay());

  const dates = [];
  [...GRAPH_NAME].forEach((ch, charIndex) => {
    FONT[ch].forEach((line, row) => {
      [...line].forEach((pixel, x) => {
        if (pixel !== "#") return;
        const col = startCol + charIndex * (CHAR_WIDTH + CHAR_GAP) + x;
        const date = new Date(gridStart);
        date.setUTCDate(gridStart.getUTCDate() + col * 7 + row);
        if (date.getUTCFullYear() !== GRAPH_YEAR) {
          throw new Error(`Pixel at column ${col}, row ${row} falls outside ${GRAPH_YEAR}`);
        }
        dates.push(toDateString(date));
      });
    });
  });
  return dates.sort();
}

function printPreview(dates) {
  const lit = new Set(dates);
  const jan1 = new Date(Date.UTC(GRAPH_YEAR, 0, 1));
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay());
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  console.log(`\n📅 Preview of "${GRAPH_NAME}" on the ${GRAPH_YEAR} contribution graph:\n`);
  for (let row = 0; row < 7; row++) {
    let line = `${dayLabels[row]} `;
    for (let col = 0; col < GRAPH_WEEKS + 1; col++) {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + col * 7 + row);
      if (date.getUTCFullYear() !== GRAPH_YEAR) line += " ";
      else line += lit.has(toDateString(date)) ? "█" : "·";
    }
    console.log(line);
  }
  console.log(`\n${dates.length} days × ${COMMITS_PER_PIXEL} commits = ${dates.length * COMMITS_PER_PIXEL} commits\n`);
}

function git(args, cwd, extraEnv = {}, quiet = false) {
  execFileSync("git", args, {
    cwd,
    stdio: quiet ? "ignore" : "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

// Returns the repository's default branch if it already exists, or null if it doesn't.
async function getExistingRepoBranch() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "fake-date-repo",
    },
  });
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    throw new Error(`Failed to check repository (${res.status}): ${body.message}`);
  }
  return body.default_branch || "main";
}

async function ensureRepo() {
  const branch = await getExistingRepoBranch();
  if (branch) {
    console.log(`📦 Repository '${REPO_NAME}' already exists, adding commits to '${branch}'`);
    return branch;
  }
  await createRepo();
  return "main";
}

async function createRepo() {
  console.log(`📦 Creating repository '${REPO_NAME}'...`);
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "fake-date-repo",
    },
    body: JSON.stringify({
      name: REPO_NAME,
      private: PRIVATE_REPO,
      description: `"${GRAPH_NAME}" drawn on the ${GRAPH_YEAR} contribution graph`,
    }),
  });

  if (res.status === 201) {
    console.log(`✅ Repository '${REPO_NAME}' created`);
    return;
  }
  const body = await res.json().catch(() => ({}));
  const detail = body.errors?.map((e) => e.message).join(", ");
  throw new Error(`Failed to create repository (${res.status}): ${body.message}${detail ? ` - ${detail}` : ""}`);
}

function commitAndPush(dates, branch) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "name-graph-"));
  const remoteUrl = `https://github.com/${GITHUB_USER}/${REPO_NAME}.git`;
  // The token is sent as a one-off header and never written to .git/config.
  const authHeader = `Authorization: Basic ${Buffer.from(`${GITHUB_USER}:${GITHUB_TOKEN}`).toString("base64")}`;
  const total = dates.length * COMMITS_PER_PIXEL;

  try {
    git(["init", "-q", "-b", "main"], workDir);
    git(["config", "user.name", GITHUB_USER], workDir);
    git(["config", "user.email", GITHUB_EMAIL], workDir);
    git(["config", "core.autocrlf", "false"], workDir);
    git(["remote", "add", "origin", remoteUrl], workDir);

    // Build on top of the existing history so the push is a fast-forward.
    // Fetching fails for an empty repository, in which case we start from scratch.
    try {
      git(["-c", `http.extraHeader=${authHeader}`, "fetch", "-q", "origin", branch], workDir, {}, true);
      git(["checkout", "-q", "-B", branch, "FETCH_HEAD"], workDir);
      console.log(`📥 Fetched existing history from '${branch}'`);
    } catch {
      git(["symbolic-ref", "HEAD", `refs/heads/${branch}`], workDir);
    }

    console.log(`🕒 Creating ${total} commits to draw "${GRAPH_NAME}" in ${GRAPH_YEAR}...`);
    let count = 0;
    for (const day of dates) {
      for (let i = 0; i < COMMITS_PER_PIXEL; i++) {
        const minute = String(i % 60).padStart(2, "0");
        const hour = COMMIT_START_HOUR + Math.floor(i / 60);
        const date = `${day}T${hour}:${minute}:00${COMMIT_TIMEZONE}`;
        git(["commit", "-q", "--allow-empty", "-m", `Pixel ${day} #${i + 1}`], workDir, {
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        }, true);
        count++;
      }
      process.stdout.write(`\r   ✔ ${count}/${total} commits (${day})`);
    }
    process.stdout.write("\n");

    console.log("🚀 Pushing to GitHub...");
    git(["-c", `http.extraHeader=${authHeader}`, "push", "-u", "origin", branch], workDir);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

(async () => {
  try {
    validateConfig();
    const dates = buildPixelDates();
    printPreview(dates);
    if (PREVIEW) return;

    const branch = await ensureRepo();
    commitAndPush(dates, branch);
    console.log(`🎉 Done! View it at: https://github.com/${GITHUB_USER}/${REPO_NAME}`);
  } catch (err) {
    console.error(`❌ ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ""}`);
    if (err.message === "fetch failed") {
      console.error("   Could not reach api.github.com. Try: node --use-system-ca name_graph.js");
    }
    process.exit(1);
  }
})();
