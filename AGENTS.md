# Agent Guidance: Slack Code & Portfolio Dashboard

## Architecture Overview
This repository powers both the **Ninety One Portfolio Performance Attribution Engine** and the **Slack Code** live preview.

### UI & Frontend Artifact
- The Slack Code split-pane artifact view displays **`Homepage.html`**.
- When the user asks for frontend UI changes (e.g. *"change the background to blue"*, *"make the buttons green"*, *"restyle the cards"*), **always modify `Homepage.html`**.
- Any push to a branch or pull request automatically triggers `.github/workflows/sync-slack-preview.yml`, which extracts the unified git diff and publishes the updated `Homepage.html` directly to Slack's `agents.conversations.setView` API.

### Backend Engine & Mathematical Invariants
- The core calculation engine is in `src/engine/brinson.js`.
- CI quality gates and unit tests are in `test/*.test.js` (`npm test`).
