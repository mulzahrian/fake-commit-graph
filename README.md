# fake-date-repo

A Node.js script that creates a new GitHub repository containing **9 commits dated June 19, 2014**. The year 2014 then appears on your GitHub profile's contribution graph, with 9 contributions on that day.

## How it works

Git doesn't validate commit dates. A commit's date is just metadata, and you can set it to anything with the `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` environment variables. GitHub's contribution graph uses the date stored in each commit, not the time it was pushed.

[`index.js`](index.js) does the following:

1. Loads its configuration from the `.env` file.
2. Creates a new repository through the GitHub API (`POST /user/repos`).
3. Creates a temporary working folder, runs `git init`, and writes a `README.md`.
4. Makes **9 commits** on `2014-06-19`, one minute apart (`12:00` to `12:08`, UTC+7). Each commit sets both the author date and the committer date.
5. Pushes to GitHub. The token is sent as a one-off HTTP header and is **never** written to `.git/config`.
6. Deletes the temporary folder.

## Prerequisites

- **Node.js v21.7+**. The script uses the built-in `process.loadEnvFile()` and `fetch`, so `npm install` isn't needed.
- **Git**

Check your versions:

```bash
node --version
git --version
```

## Setup & Usage

### 1. Clone this repository

```bash
git clone https://github.com/<your-username>/fake-date-repo.git
cd fake-date-repo
```

### 2. Create a Personal Access Token (PAT)

1. Go to <https://github.com/settings/tokens>.
2. Click **Generate new token**, then **Generate new token (classic)**.
3. Select the **`repo`** scope.
4. Click **Generate token** and copy it right away. GitHub only shows it once.

### 3. Check your GitHub email

Go to <https://github.com/settings/emails> and pick an email that is **verified** on your account, or use your `...@users.noreply.github.com` address. If the email doesn't match your account, the commits **won't be counted** on the graph.

### 4. Create the `.env` file

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Fill in `.env`:

```env
GITHUB_USERNAME=your-username
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_EMAIL=you@example.com
REPO_NAME=contribution-graph
PRIVATE_REPO=false
```

| Variable | Required | Description |
|---|---|---|
| `GITHUB_USERNAME` | ✅ | Your GitHub username |
| `GITHUB_TOKEN` | ✅ | Personal Access Token with the `repo` scope |
| `GITHUB_EMAIL` | ✅ | A verified email on your GitHub account |
| `REPO_NAME` | ❌ | Name of the repository to create (default: `contribution-graph`). It must not already exist. |
| `PRIVATE_REPO` | ❌ | Set to `true` to make the repository private (default: `false`) |

### 5. Run it

```bash
node index.js
```

if not working using this 

```bash
 node --use-system-ca index.js
```

Output when it succeeds:

```
📦 Creating repository 'contribution-graph'...
✅ Repository 'contribution-graph' created
🕒 Creating 9 commits on 2014-06-19...
   ✔ Commit 1/9 @ 2014-06-19T12:00:00+07:00
   ...
   ✔ Commit 9/9 @ 2014-06-19T12:08:00+07:00
🚀 Pushing to GitHub...
🎉 Done! View it at: https://github.com/your-username/contribution-graph
```

### 6. Check your GitHub profile

The year **2014** shows up next to your contribution graph, and June 19 shows **9 contributions**. The graph can take anywhere from a few minutes to 24 hours to update.

> If `PRIVATE_REPO=true`, turn on **Private contributions** in your profile's contribution graph settings so the commits are counted.

## Customization

Edit these constants at the top of [`index.js`](index.js):

```js
const COMMIT_DAY = "2014-06-19";   // date of the contributions
const COMMIT_COUNT = 9;            // number of contributions
const COMMIT_START_HOUR = 12;      // time of the first commit
const COMMIT_TIMEZONE = "+07:00";  // time zone offset
```

Commits are spaced one minute apart, so keep `COMMIT_COUNT` at 60 or less. Keep the start hour around midday so the commits don't shift to a different day in other time zones.

## Draw a name on the graph (`name_graph.js`)

[`name_graph.js`](name_graph.js) writes a name in a 5×7 pixel font on the contribution graph for the year you choose. Each "pixel" is one day (columns are weeks, rows are Sunday to Saturday), and every lit day gets several commits so it shows up dark green.

Add these to `.env`:

```env
GRAPH_YEAR=2014
GRAPH_NAME=HELLO
# Optional
GRAPH_COMMITS_PER_PIXEL=2      # default: 2
```

`GRAPH_NAME` can be up to 8 characters long and may only contain `A-Z`, `0-9`, and spaces. Lowercase letters are converted to uppercase.

The commits go to the repository named in `REPO_NAME`. If it doesn't exist yet, it's created. If it already exists, the script fetches its default branch and adds the new commits on top of the existing history, so nothing is overwritten. Afterwards, run `git pull` in any local clone of that repository.

Preview the result in the terminal first (no repository is created):

```bash
node name_graph.js --preview
```

Then run it for real:

```bash
node name_graph.js
```

If you get `fetch failed`, use `node --use-system-ca name_graph.js`.

> Use a year with no other contributions so the name stands out clearly.

## Troubleshooting

| Message | Cause |
|---|---|
| `.env file not found` | `.env` is missing from the folder that contains `index.js` |
| `401 Bad credentials` | The token is wrong or has expired |
| `403` | The token doesn't have the `repo` scope |
| `422 ... name already exists` | A repository with that name already exists. Change `REPO_NAME`. |
| The script succeeds but nothing shows on the graph | `GITHUB_EMAIL` doesn't match an email on your GitHub account |

## Security

- `.env` is already listed in `.gitignore`. **Never** commit your token.
- Revoke the token at <https://github.com/settings/tokens> when you're done with it.

## Disclaimer

This project is for learning how Git commit metadata works. The real dates can still be traced, for example from the repository's creation time, so don't use it to misrepresent your work history.
