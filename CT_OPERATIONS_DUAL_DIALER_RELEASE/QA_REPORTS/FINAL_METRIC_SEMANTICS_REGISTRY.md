# FINAL METRIC SEMANTICS REGISTRY — CT OPERATIONS MONITOR v11.3.1
## COMPREHENSIVE OUTBOUND & INBOUND DOM MAPPING SPECIFICATION

**Scope:** East-2 (`east-2.calltools.io`) and East-3 (`east-3.calltools.io`)  
**Version:** `v11.3.1`  
**Operational Mode:** STRICTLY READ-ONLY OBSERVER  

---

## 1. OUTBOUND CAMPAIGN METRICS REGISTRY

Native Table: `table.mat-table` on `/manager/campaigns`

| Metric Name | Native Table Header | DOM Parser Mapping | Metric Type | Increase Meaning | Decrease Meaning | Alert Thresholds | Missing Value Handling |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Active Status** | `Active` / Toggle Column | `c.active` (boolean) | State Flag | Campaign activated | Campaign paused / stopped | None (State toggle) | Default `false` |
| **Contact Pool** | `Contacts` | `c.contacts` | Inventory Gauge | Contacts loaded | Contacts dialed/exhausted | Abs: -2,000 / Pct: -20% | Render `0` |
| **Call Attempts** | `Outbound Calls` / `Attempts` | `c.outbound` | Cumulative Counter | New calls initiated | Counter reset / daily reset | Baseline tracking | Render `0` |
| **Connected Calls** | `Human Connect` / `Connected` | `c.human` / `c.connected` | Cumulative Counter | Live calls answered | Counter reset / daily reset | Baseline tracking | Render `0` |
| **Connect Rate** | Derived (`human ÷ outbound`) | `c.connectRate` | Derived Percentage | Efficiency increase | Efficiency drop / carrier issues | Below 3.0% (Warning) | Render `—` if attempts = 0 |
| **Waiting Calls** | `Waiting` / `Calls Waiting` | `c.waiting` | Live Gauge | Queue backlog forming | Callers answered / abandoned | > 0 (Warning), >= 5 (Critical) | Render `—` if column absent |
| **Agents on Call** | `On Call` | `c.onCall` | Live Gauge | Agents busy talking | Agents freed / dispositioning | Baseline tracking | Render `—` if column absent |
| **Logged In Agents** | `Agents` / `Logged In` | `c.loggedIn` | Capacity Gauge | Agents logged into campaign | Agents logged off | Abs: -3 & Pct: -25% (Capacity drop) | Render `—` if column absent |
| **Max Wait Time** | `Wait Time (Now)` / `Wait Now` | `c.waitNow` | Duration Gauge (sec) | Callers waiting longer | Callers serviced | >= 30s (Warning), >= 60s (Critical) | Render `0s` if no wait |
| **Abandoned Calls** | `Abandoned` | `c.abandoned` | Cumulative Counter | Callers disconnected before agent | Counter reset / daily reset | Rate > 3% or count increase | Render `0` |
| **Goals / Sales** | `Goals` / `Sales` | `c.goals` | Cumulative Counter | **NEW SALE / GOAL ACHIEVED** | Daily reset at midnight | Any increase (+1) triggers immediate persistent alert | Render `0` |

---

## 2. INBOUND QUEUE METRICS REGISTRY

Native Table: `table.mat-table` on `/manager/queues`

| Metric Name | Native Table Header | DOM Parser Mapping | Metric Type | Primary vs Fallback | Forbidden Operations | Render when Null |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Calls Today Total** | `Calls (Today) -> Total` | `q.callsTodayTotal` | Cumulative Counter | Primary | Never synthesize | `0` |
| **Answered Calls** | `Calls (Today) -> Answered` | `q.callsTodayAnswered` | Cumulative Counter | Primary | Never synthesize | `0` |
| **Not Answered Calls** | `Calls (Today) -> Not Answered` | `q.callsTodayNotAnswered` | Cumulative Counter | **PRIMARY** | Never sum with fallback; never map to Abandoned | Use fallback |
| **Inbound No Answer** | `Calls (Today) -> Inbound No Answer` | `q.inboundNoAnswer` | Cumulative Counter | **FALLBACK** | Used only when primary is null/empty; never sum | `—` |
| **Abandoned Calls** | None (Unexposed in CallTools Queues) | `q.abandoned` (`null`) | Unavailable Metric | **NOT EXPOSED** | Never map Not Answered to Abandoned | Explicitly renders `—` |
| **Waiting Now** | `Calls (Now) -> Waiting` | `q.waiting` | Live Backlog Gauge | Primary | Never synthesize | `0` |
| **On Queue Calls** | `Agents (Now) -> On Queue Calls` | `q.onQueueCalls` | Live Gauge | Primary | Never synthesize | `0` |
| **Logged In Queue** | `Agents (Now) -> Logged In` | `q.loggedIn` | Membership Gauge | Primary | Sum of memberships, not unique agents | `0` |
| **Wait Time Max** | `Wait Time (Now) -> Max` | `q.waitMax` | Duration Gauge (sec) | Primary | Highest wait while callers are holding | `0s` |
| **Queue Goals / Sales** | `Goals` / `Sales` | `q.goals` | Cumulative Counter | Primary | **NEW INBOUND SALE / GOAL ACHIEVED** | `0` |

---

## 3. STRICT FALLBACK AND CALCULATION RULES

1. **Inbound Not Answered Algorithm:**
   ```javascript
   function inboundNotAnswered(queue) {
       if (!queue) return null;
       // 1. Primary native column: "Not Answered"
       if (queue.callsTodayNotAnswered !== undefined && queue.callsTodayNotAnswered !== null && String(queue.callsTodayNotAnswered).trim() !== "") {
           const num = parseFloat(String(queue.callsTodayNotAnswered).replace(/,/g, ""));
           if (Number.isFinite(num)) return num;
       }
       // 2. Fallback secondary column: "Inbound No Answer"
       if (queue.inboundNoAnswer !== undefined && queue.inboundNoAnswer !== null && String(queue.inboundNoAnswer).trim() !== "") {
           const num = parseFloat(String(queue.inboundNoAnswer).replace(/,/g, ""));
           if (Number.isFinite(num)) return num;
       }
       // 3. Unexposed in DOM
       return null;
   }
   ```
2. **Prohibited Fallback Operations:**
   - Summing `callsTodayNotAnswered + inboundNoAnswer` is **STRICTLY PROHIBITED**.
   - Synthesizing Not Answered via `callsTodayTotal - callsTodayAnswered` is **STRICTLY PROHIBITED**.
   - Mapping `callsTodayNotAnswered` or `inboundNoAnswer` to `abandoned` is **STRICTLY PROHIBITED**.
   - When both values are unexposed or empty, the KPI displays `—` with tooltip `"unexposed in queue table"`.

3. **Persistent Sales/Goals Rules:**
   - Any increase in Outbound Goals or Inbound Goals immediately generates a persistent Alert Card in the Action Center.
   - Requires individual operator acknowledgment via `[NOTED]`.
   - Action Center `Clear All` preserves all unacknowledged Goal and Intelligence alerts.

