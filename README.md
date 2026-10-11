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

## 💬 Slack Code Channel Integration

Built for dedicated Slack Code channels (`agents.conversations.*`):
- **Channel**: `#new-portfolio-view` (`C0C96QL1R16`)
- **Views**:
  - `Homepage` (HTML artifact preview view)
  - `Plan` (implementation & architectural specification canvas)
- **Context Bar**:
  - `[folder] jmahedy-slack/portfolio-dashboard`
  - `[branch] main`
  - `[cpu] 15.3k tokens`
