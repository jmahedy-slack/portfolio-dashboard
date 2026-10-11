#!/usr/bin/env node
/**
 * Syncs the local Homepage.html to the Slack Code Channel's split-view Artifact tab.
 * Uses Slack's agents.conversations.setView API to update the live preview in real time.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C0C8EE77YBB";

if (!SLACK_BOT_TOKEN) {
  console.error("❌ SLACK_BOT_TOKEN environment variable is required.");
  process.exit(1);
}

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "main";
const commitSha = (process.env.GITHUB_SHA || "").slice(0, 7) || "latest";
const repoName = process.env.GITHUB_REPOSITORY || "jmahedy-slack/portfolio-dashboard";

// 1. Locate Homepage.html or fallback to index.html
let htmlFile = join(ROOT, "Homepage.html");
if (!existsSync(htmlFile)) {
  htmlFile = join(ROOT, "index.html");
}

if (!existsSync(htmlFile)) {
  console.error("❌ No Homepage.html or index.html found to sync.");
  process.exit(1);
}

const htmlContent = readFileSync(htmlFile, "utf8");

async function syncPreview() {
  console.log(`[Slack Preview Sync] Target Channel: ${CHANNEL_ID}`);
  console.log(`[Slack Preview Sync] Branch: ${branch} | Commit: ${commitSha}`);

  // 1. Update the HTML view in the split pane
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
  if (!setViewData.ok) {
    console.error("❌ agents.conversations.setView failed:", setViewData);
    process.exit(1);
  }
  console.log("✔ agents.conversations.setView succeeded:", setViewData.view_id);

  // 2. Update context bar with current branch & repo
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
        context_bar_items: [
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
          {
            key: "tokens",
            label: `commit ${commitSha}`,
            icon: "terminal",
          },
        ],
      },
    }),
  });

  const setPropsData = await setPropsRes.json();
  if (setPropsData.ok) {
    console.log("✔ agents.conversations.setProperties updated context bar.");
  } else {
    console.warn("⚠ agents.conversations.setProperties warning:", setPropsData.error);
  }

  // 3. Optional notification in channel
  if (process.env.NOTIFY_SLACK === "true" || process.env.CI) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: CHANNEL_ID,
        text: `⚡ *Preview Updated:* Refreshed \`Homepage\` artifact with latest changes from \`${branch}\` (\`${commitSha}\`).`,
      }),
    });
  }

  console.log("✔ Preview synchronization completed successfully.");
}

syncPreview().catch((err) => {
  console.error("Fatal error syncing preview:", err);
  process.exit(1);
});
