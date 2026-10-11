# Westbrook Wealth — Portfolio Performance & Attribution Dashboard

Institutional real-time portfolio performance, **Brinson-Fachler attribution decomposition**, and **SFDR Article 8 compliance** dashboard for Ninety One asset managers and wealth advisors.

---

## 🌟 Features

- **Brinson-Fachler Attribution Decomposition**: Real-time breakdown across Allocation (+42 bps), Selection (+58 bps), and Interaction (-24 bps) effects with strict zero leakage.
- **Security-Level Alpha Contributions**: Real-time ranking of top alpha drivers (Microsoft, Novo Nordisk, ASML) and bottom detractors.
- **SFDR Article 8 Mandatory Green Ratio**: Continuous tracking against institutional compliance thresholds (> 80.0%).
- **Multi-Currency Local Return Decomposition**: Isolates underlying asset price return from currency translation impact.

---

## 📁 Repository Structure

```text
portfolio-dashboard/
├── Homepage.html        # Production standalone dashboard interface (Slack Code Artifact)
├── index.html           # Web entrypoint
└── package.json         # Project metadata
```

---

## 💬 Slack Code Integration

Built for **Slack Code** (`agents.conversations.*`):
- **Channel**: `</> Portfolio Dashboard` (`C0C8EE77YBB`)
- **Views**:
  - `Homepage` (interactive HTML preview artifact)
  - `Plan` (architectural & milestone specification canvas)
  - `Code` (real-time unified git diff)
- **Context Bar**:
  - `[folder] jmahedy-slack/portfolio-attribution`
  - `[branch] main`
  - `[cpu] commit ea8d6e4`
