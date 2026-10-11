#!/usr/bin/env node
/**
 * Syncs the local Homepage.html and Git Unified Diff to the Slack Code Channel's split-view Artifact tabs.
 * Uses Slack's agents.conversations.setView and agents.conversations.setProperties APIs to update
 * the live preview and the Code/Diff tab in real time.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C0C8EE77YBB";

if (!SLACK_BOT_TOKEN) {
  console.error("❌ SLACK_BOT_TOKEN environment variable is required.");
  process.exit(1);
}

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || (() => {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch (_) {
    return "main";
  }
})();

const commitSha = (process.env.GITHUB_SHA || (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch (_) {
    return "latest";
  }
})()).slice(0, 7);

const repoName = process.env.GITHUB_REPOSITORY || "jmahedy-slack/portfolio-attribution";

// 1. Locate Homepage.html or fallback to index.html
let htmlFile = join(ROOT, "Homepage.html");
if (!existsSync(htmlFile)) {
  htmlFile = join(ROOT, "index.html");
}

let htmlContent = "";
if (existsSync(htmlFile)) {
  htmlContent = readFileSync(htmlFile, "utf8");
}

async function syncCodeChannel() {
  console.log(`[Slack Code Channel Sync] Target Channel: ${CHANNEL_ID}`);
  console.log(`[Slack Code Channel Sync] Repo: ${repoName} | Branch: ${branch} | Commit: ${commitSha}`);

  // 1. Update the HTML Homepage Preview in the split pane (if available)
  if (htmlContent) {
    const setViewRes = await fetch("https://slack.com/api/agents.conversations.setView", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel_id: CHANNEL_ID,
        type: "html",
        view_key: "homepage.html",
        name: "Homepage",
        content: htmlContent,
      }),
    });

    const setViewData = await setViewRes.json();
    if (setViewData.ok) {
      console.log("✔ agents.conversations.setView (type: html) succeeded:", setViewData.view_id);
    } else {
      console.warn("⚠ agents.conversations.setView (type: html) warning:", setViewData.error);
    }
  }

  // 2. Extract Unified Diff and publish to the Code/Diff tab in Artifacts
  let diffContent = "";
  try {
    // If on a feature branch, diff against origin/main or main
    if (branch !== "main") {
      try {
        diffContent = execSync("git diff origin/main...HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
      } catch (_) {
        diffContent = execSync("git diff main...HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
      }
    } else {
      // On main, show the last commit's diff
      diffContent = execSync("git diff HEAD~1..HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    }
  } catch (err) {
    console.warn("⚠ Git diff extraction note:", err.message);
  }

  if (diffContent) {
    console.log(`[Slack Code Channel Sync] Publishing Unified Diff (${diffContent.length} bytes) to Code tab...`);
    const setDiffRes = await fetch("https://slack.com/api/agents.conversations.setView", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel_id: CHANNEL_ID,
        type: "diff",
        content: diffContent,
        base_branch: "main",
        head_branch: branch,
      }),
    });

    const setDiffData = await setDiffRes.json();
    if (setDiffData.ok) {
      console.log("✔ agents.conversations.setView (type: diff) succeeded. Code tab populated:", setDiffData.file_id);
    } else {
      console.warn("⚠ agents.conversations.setView (type: diff) warning:", setDiffData.error);
    }
  } else {
    console.log("ℹ No changes detected between branches to publish as diff.");
  }

  // 3. Check for open PR link if possible
  let prUrl = "";
  let prLabel = "";
  try {
    const prOut = execSync(`gh pr list --head "${branch}" --repo "${repoName}" --json number,url --jq '.[0]' 2>/dev/null || true`, {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (prOut && prOut !== "null" && prOut.startsWith("{")) {
      const pr = JSON.parse(prOut);
      if (pr.url) {
        prUrl = pr.url;
        prLabel = `PR #${pr.number}`;
      }
    }
  } catch (_) {}

  // 4. Update the bottom context bar items (repo, branch, PR, commit)
  const contextItems = [
    {
      key: "repo",
      label: repoName,
      icon: "folder",
      url: `https://github.com/${repoName}`,
    },
    {
      key: "branch",
      label: branch,
      icon: "branch",
      url: `https://github.com/${repoName}/tree/${branch}`,
    },
  ];

  if (prUrl) {
    contextItems.push({
      key: "pr",
      label: prLabel,
      icon: "hierarchy",
      url: prUrl,
    });
  }

  contextItems.push({
    key: "tokens",
    label: `commit ${commitSha}`,
    icon: "terminal",
  });

  const setPropsRes = await fetch("https://slack.com/api/agents.conversations.setProperties", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel_id: CHANNEL_ID,
      code_channel: {
        host: "github.com",
        repo: repoName,
        branch: branch,
        base_branch: "main",
        language: "html",
        context_bar_items: contextItems,
      },
    }),
  });

  const setPropsData = await setPropsRes.json();
  if (setPropsData.ok) {
    console.log("✔ agents.conversations.setProperties updated context bar with items:", contextItems.map((i) => i.label));
  } else {
    console.warn("⚠ agents.conversations.setProperties warning:", setPropsData.error);
  }

  // 5. Channel status message
  if (process.env.NOTIFY_SLACK === "true" || process.env.CI) {
    const detailParts = [`branch \`${branch}\``, `commit \`${commitSha}\``];
    if (prUrl) detailParts.push(`<${prUrl}|${prLabel}>`);
    if (diffContent) detailParts.push("Code diff view updated");

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: CHANNEL_ID,
        text: `⚡ *Code Channel Updated:* Synced ${detailParts.join(" • ")}.`,
      }),
    });
  }

  console.log("✔ All Code Channel views and properties synchronized successfully.");
}

syncCodeChannel().catch((err) => {
  console.error("Fatal error syncing code channel:", err);
  process.exit(1);
});
