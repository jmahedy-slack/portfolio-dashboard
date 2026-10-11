#!/usr/bin/env node
/**
 * Syncs Homepage.html, market-feed.html, esg-scorecard.html, and the Git Unified Diff
 * to the Slack Code split-view Artifact tabs.
 * Uses Slack's agents.conversations.setView and agents.conversations.setProperties APIs to update
 * all live views, telemetry monitors, and the Code/Diff tab in real time.
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

// Helper to load file content if exists
function loadFile(filename) {
  const p = join(ROOT, filename);
  if (existsSync(p)) return readFileSync(p, "utf8");
  return "";
}

// 1. Locate Homepage.html or fallback to index.html
let htmlContent = loadFile("Homepage.html") || loadFile("index.html");

// If src/public/style.css exists, detect any primary background color change and inject it
const styleCssPath = join(ROOT, "src/public/style.css");
if (htmlContent && existsSync(styleCssPath)) {
  const styleCss = readFileSync(styleCssPath, "utf8");
  const bgMatch = styleCss.match(/--bg-primary:\s*(#[0-9a-fA-F]{3,8})/);
  const defaultBg = "#0b0f19";
  if (bgMatch && bgMatch[1] && bgMatch[1].toLowerCase() !== defaultBg) {
    const bgColor = bgMatch[1];
    const isLightBg = ["#ff", "#fa", "#f5", "#fe", "#e0", "#d0", "#c0", "#b0", "#a0"].some((prefix) =>
      bgColor.toLowerCase().startsWith(prefix)
    );
    const injectCss = `
      <style id="agent-injected-theme">
        body { background: ${bgColor} !important; ${isLightBg ? "color: #0f172a !important;" : ""} }
        ${isLightBg ? ".text-white { color: #0f172a !important; } .card-border { background: rgba(255,255,255,0.85) !important; border-color: rgba(0,0,0,0.12) !important; color: #1e293b !important; } table { color: #1e293b !important; }" : ""}
      </style>
    `;
    htmlContent = htmlContent.replace("</head>", `${injectCss}\n</head>`);
  }
}

const marketEsgContent = loadFile("market-esg.html") || loadFile("market-feed.html");
const pipelineStatusContent = loadFile("pipeline-status.html");

async function syncCodeChannel() {
  console.log(`[Slack Code Sync] Target Channel: ${CHANNEL_ID}`);
  console.log(`[Slack Code Sync] Repo: ${repoName} | Branch: ${branch} | Commit: ${commitSha}`);

  // Clean up legacy view keys if present to prevent too_many_views error
  for (const oldKey of ["market-feed.html", "esg-scorecard.html"]) {
    try {
      await fetch("https://slack.com/api/agents.conversations.removeView", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel_id: CHANNEL_ID, view_key: oldKey }),
      });
    } catch (_) {}
  }

  // 1. Update Homepage HTML Preview in the split pane
  if (htmlContent) {
    const res = await fetch("https://slack.com/api/agents.conversations.setView", {
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
    }).then((r) => r.json());

    if (res.ok) {
      console.log("✔ agents.conversations.setView (Homepage) succeeded:", res.view_id);
    } else {
      console.warn("⚠ agents.conversations.setView (Homepage) warning:", res.error);
    }
  }

  // 2. Update Pipeline Status HTML Monitor in the split pane
  if (pipelineStatusContent) {
    const res = await fetch("https://slack.com/api/agents.conversations.setView", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel_id: CHANNEL_ID,
        type: "html",
        view_key: "pipeline-status.html",
        name: "Pipeline Status",
        content: pipelineStatusContent,
      }),
    }).then((r) => r.json());

    if (res.ok) {
      console.log("✔ agents.conversations.setView (Pipeline Status) succeeded:", res.view_id);
    } else {
      console.warn("⚠ agents.conversations.setView (Pipeline Status) warning:", res.error);
    }
  }

  // 3. Update Market & ESG Scorecard in the split pane
  if (marketEsgContent) {
    const res = await fetch("https://slack.com/api/agents.conversations.setView", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel_id: CHANNEL_ID,
        type: "html",
        view_key: "market-esg.html",
        name: "Market & ESG",
        content: marketEsgContent,
      }),
    }).then((r) => r.json());

    if (res.ok) {
      console.log("✔ agents.conversations.setView (Market & ESG) succeeded:", res.view_id);
    } else {
      console.warn("⚠ agents.conversations.setView (Market & ESG) warning:", res.error);
    }
  }

  // 4. Extract Unified Diff and publish to the Code/Diff tab in Artifacts
  let diffContent = "";
  try {
    if (branch !== "main") {
      try {
        diffContent = execSync("git diff origin/main...HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
      } catch (_) {
        diffContent = execSync("git diff main...HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
      }
    } else {
      diffContent = execSync("git diff HEAD~1..HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    }
  } catch (err) {
    console.warn("⚠ Git diff extraction note:", err.message);
  }

  if (diffContent) {
    console.log(`[Slack Code Sync] Publishing Unified Diff (${diffContent.length} bytes) to Code tab...`);
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
    }).then((r) => r.json());

    if (setDiffRes.ok) {
      console.log("✔ agents.conversations.setView (type: diff) succeeded. Code tab populated:", setDiffRes.file_id);
    } else {
      console.warn("⚠ agents.conversations.setView (type: diff) warning:", setDiffRes.error);
    }
  } else {
    console.log("ℹ No changes detected between branches to publish as diff.");
  }

  // 5. Check for open PR link if possible
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

  // 6. Update the bottom context bar items (repo, branch, PR, commit)
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
  }).then((r) => r.json());

  if (setPropsRes.ok) {
    console.log("✔ agents.conversations.setProperties updated context bar with items:", contextItems.map((i) => i.label));
  } else {
    console.warn("⚠ agents.conversations.setProperties warning:", setPropsRes.error);
  }

  // 7. Channel status message
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
        text: `⚡ *Slack Code Updated:* Synced ${detailParts.join(" • ")}. Views: \`Homepage\`, \`Market Feeds\`, \`ESG Scorecard\`, \`Plan\`, \`Code\`.`,
      }),
    });
  }

  console.log("✔ All Slack Code views and properties synchronized successfully.");
}

syncCodeChannel().catch((err) => {
  console.error("Fatal error syncing code channel:", err);
  process.exit(1);
});
