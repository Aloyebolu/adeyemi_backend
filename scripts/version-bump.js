import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const pkgPath = path.resolve("backend/package.json");
const historyPath = path.resolve("backend/version-history.json");

// git info
const commitMessage = execSync("git log -1 --pretty=%s").toString().trim();
const commitHash = execSync("git log -1 --pretty=%h").toString().trim();
const authorName = execSync("git log -1 --pretty=%an").toString().trim();
const authorEmail = execSync("git log -1 --pretty=%ae").toString().trim();
const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
const timestamp = new Date().toISOString();

// load package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// bump version safely
const newVersion = execSync("npm version patch --no-git-tag-version")
  .toString()
  .trim()
  .replace(/^v/, "");

pkg.versionMessage = commitMessage;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// load history
let history = [];
if (fs.existsSync(historyPath)) {
  history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
}

// append entry
history.push({
  version: newVersion,
  message: commitMessage,
  author: authorName,
  email: authorEmail,
  commit: commitHash,
  branch,
  timestamp
});

fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

console.log("✅ Version and audit history updated");