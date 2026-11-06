const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  console.error("❌ .env file not found. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const GITHUB_USER = process.env.GITHUB_USERNAME?.trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const GITHUB_EMAIL = process.env.GITHUB_EMAIL?.trim();
const REPO_NAME = process.env.REPO_NAME?.trim() || "contribution-graph";
const PRIVATE_REPO = process.env.PRIVATE_REPO === "true";

const COMMIT_DAY = "2014-06-19";
const COMMIT_COUNT = 9;
// Commits start at noon so the day doesn't shift when viewed from other time zones.
const COMMIT_START_HOUR = 12;
const COMMIT_TIMEZONE = "+07:00";
const README_CONTENT = "Made with fake-date-repo\n";

if (!GITHUB_USER || !GITHUB_TOKEN || !GITHUB_EMAIL) {
  console.error("❌ GITHUB_USERNAME, GITHUB_TOKEN, and GITHUB_EMAIL are required in .env");
  process.exit(1);
}

function git(args, cwd, extraEnv = {}) {
  execFileSync("git", args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

function commitDate(index) {
  const minute = String(index).padStart(2, "0");
  return `${COMMIT_DAY}T${COMMIT_START_HOUR}:${minute}:00${COMMIT_TIMEZONE}`;
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
      description: "Created with fake-date-repo",
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

function commitAndPush() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-date-repo-"));
  const readmePath = path.join(workDir, "README.md");
  const remoteUrl = `https://github.com/${GITHUB_USER}/${REPO_NAME}.git`;
  // The token is sent as a one-off header and never written to .git/config.
  const authHeader = `Authorization: Basic ${Buffer.from(`${GITHUB_USER}:${GITHUB_TOKEN}`).toString("base64")}`;

  try {
    git(["init", "-q", "-b", "main"], workDir);
    git(["config", "user.name", GITHUB_USER], workDir);
    git(["config", "user.email", GITHUB_EMAIL], workDir);
    git(["config", "core.autocrlf", "false"], workDir);

    fs.writeFileSync(readmePath, README_CONTENT);

    console.log(`🕒 Creating ${COMMIT_COUNT} commits on ${COMMIT_DAY}...`);
    for (let i = 0; i < COMMIT_COUNT; i++) {
      const date = commitDate(i);
      if (i > 0) fs.appendFileSync(readmePath, `\nContribution #${i + 1}\n`);
      git(["add", "README.md"], workDir);
      git(["commit", "-q", "-m", i === 0 ? "Initial commit" : `Contribution #${i + 1}`], workDir, {
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      });
      console.log(`   ✔ Commit ${i + 1}/${COMMIT_COUNT} @ ${date}`);
    }

    git(["remote", "add", "origin", remoteUrl], workDir);
    console.log("🚀 Pushing to GitHub...");
    git(["-c", `http.extraHeader=${authHeader}`, "push", "-u", "origin", "main"], workDir);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

(async () => {
  try {
    await createRepo();
    commitAndPush();
    console.log(`🎉 Done! View it at: https://github.com/${GITHUB_USER}/${REPO_NAME}`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
})();
