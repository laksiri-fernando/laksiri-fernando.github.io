# KingslakeAI — AI-Assisted Proactive Inventory Management (prototype)

A React prototype of the material-risk decision-support layer described in the
*AI-Assisted Proactive Supply Inventory Management* deck and the
*AI-Assisted Material Planning & Purchasing* functional scope (HITEC, v1).

**Live:** https://laksiri-fernando.github.io/proactive-inventory/ (served from `/proactive-inventory`, the committed build output)

## What it demonstrates

| Scope capability | Where in the prototype |
| --- | --- |
| Consolidated view of production plan, stock and open POs | **Materials**, **Production orders**, material drawer (stock projection chart) |
| Proactive risk flagging ahead of a shortage | **Overview**, **Risk alerts** (each alert explains *why* and gives a decide-by date) |
| Alternate-vendor suggestions where a qualified alternate exists | Alert detail → *Alternate vendors* (checks sector qualification, lead time, requalification time) |
| Supplier behaviour analysis (PO due vs goods receipt) | **Suppliers** — reliability score, on-time %, P50/P80/P90 delay, trend |
| Obsolescence early warning | **Obsolescence** — shelf-life expiry (FIFO vs demand), slow-moving stock, supplier EOL → last-time-buy |
| Safety-stock allocation visibility | **Reserved stock** — reservations drawn down by other orders |
| Recommended safety-buffer guidance | **Safety buffers** |
| Natural-language query interface | **Ask KingslakeAI** |
| Supplier correspondence (unstructured email) | **Supplier inbox** — extracted delay / confirmation / EOL signals that feed the projections |

The **"Plan arrivals on"** switch in the top bar shows the core idea: *PO due
date* is what the ERP alone tells you; *Typical delay* and *Cautious* use supplier
emails and delivery history to estimate real arrival dates (scope §11 open question).

Human-in-the-loop throughout: the app drafts supplier follow-ups, suggests options
and lets planners acknowledge/assign alerts — it never places orders or changes
the schedule.

## Design notes

- `src/data/` — ERP-shaped mock data (materials, BOM requirements, production
  orders with job start dates, POs, receipts history, reservations, goods
  issues, supplier emails). All names and figures are fictitious. "Today" is
  fixed at 28 Oct 2026 so the scenarios are reproducible.
- `src/engine/risk.ts` — pure functions that derive everything from that data:
  supplier stats, arrival estimates, 95-day stock projection, alerts,
  allocation conflicts, obsolescence, buffer recommendations. Swapping the mock
  data for a real ERP feed should not require view changes.
- `src/engine/nlq.ts` — deterministic intent parser for the prototype. In the
  product a managed LLM would call these same read-only functions as tools, so
  answers stay grounded and cite their sources.

## Run locally

```bash
cd apps/proactive-inventory
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build into ../../proactive-inventory (GitHub Pages)
```
