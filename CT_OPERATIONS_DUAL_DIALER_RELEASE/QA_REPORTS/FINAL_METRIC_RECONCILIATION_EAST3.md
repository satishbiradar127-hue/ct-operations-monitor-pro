# CALLTOOLS METRIC RECONCILIATION REGISTRY — EAST-3
**Dialer Host:** `east-3.calltools.io`  
**Storage Prefix:** `ct_east3_`  
**Version:** v11.3.2 Production Final  
**Date:** 2026-11-02T19:30:25.906Z  

---

## 1. OUTBOUND METRICS RECONCILIATION

| Metric Label | Native CallTools Header | Native DOM CDK Column | Parser Field | Dashboard Location | Calculation / Formula | Interpretation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Campaigns** | Name | `cdk-column-name` | `name` | KPI Card 1 | Count of active / visible | Active campaigns in dialer |
| **Waiting** | Waiting | `cdk-column-calls_waiting` | `callsWaiting` | KPI Card 2, Table Col 5 | Raw counter | Inbound/campaign queue load |
| **On Call** | On Call | `cdk-column-calls_on_call` | `callsOnCall` | KPI Card 3 | Raw counter | Live active phone calls |
| **Contact Pool** | Contacts | `cdk-column-contacts_count` | `contactsCount` | KPI Card 4 | Raw inventory | Remaining contacts in bucket |
| **Call Attempts** | Calls (Today) | `cdk-column-calls_outbound_today` | `callsOutboundToday` | KPI Card 5, Table Col 8 | Raw cumulative | Total dials launched today |
| **Human Connects** | Human | `cdk-column-calls_outbound_human` | `callsOutboundHuman` | Table Col 9 | Cumulative counter | AMD detected human voice |
| **Agent Connects** | To Agents | `cdk-column-calls_outbound_agent_connect` | `callsOutboundAgentConnect` | KPI Card 6, Table Col 10 | Cumulative counter | Dials bridged to agent headset |
| **Logged In** | Logged In | `cdk-column-logged_in_agents` | `loggedInAgents` | KPI Card 7, Table Col 4 | Live gauge | Agents staffed in campaign |
| **Max Wait** | Max Wait | `cdk-column-max_wait_time` | `maxWaitTime` | KPI Card 8 | Max duration | Longest waiting contact/call |
| **Abandoned** | Abandoned | `cdk-column-calls_abandoned` | `callsAbandoned` | KPI Card 9, Table Col 12 | Cumulative counter | Call dropped before agent answer |
| **Total Goals** | Goals (Today) | `cdk-column-goals_today` | `goalsToday` | KPI Card 10, Table Col 11 | Cumulative counter | Sales or disposition goals met |
| **Connect Rate** | Derived | — | `connectRate` | KPI Card 6 subtitle, Table Col 13 | `Human Connects ÷ Outbound Attempts` | Formatted with 2-decimal precision (e.g. 4.48%) |
| **Lead Runway** | Derived | — | `leadRunway` | Table Col 15 | `Available Leads ÷ Consumption Rate` | Estimated exhaustion time (<1m to >24h) |

---

## 2. INBOUND METRICS RECONCILIATION

| Metric Label | Native CallTools Header | Native DOM CDK Column | Parser Field | Inbound Panel Location | Reconciliation Semantics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Calls Today** | Calls (Today) | `cdk-column-calls_today` | `callsToday` | Summary Col 1 | Total inbound arrivals into queue (e.g. 477) |
| **Answered** | Answered | `cdk-column-calls_answered` | `callsAnswered` | Summary Col 2 | Calls connected to an inbound agent (e.g. 333) |
| **Not Answered** | Not Answered | `cdk-column-calls_today_not_answered` | `callsTodayNotAnswered` | Summary Col 3 | Unanswered calls (e.g. 100); fallback to `inboundNoAnswer` only if primary null |
| **Other / IVR** | Reconciled | — | `otherCalls` | Summary Col 4 | Calculated: `Calls Today - Answered - Not Answered` (477 - 333 - 100 = 44) |
| **Answer Rate** | Derived | — | `answerRate` | Summary Col 2 Subtitle | `Answered ÷ Calls Today` (333 ÷ 477 = 69.81%) |
| **Memberships** | Agents | `cdk-column-agents` | `agents` | Table Col 2 | Labeled as **Memberships** (e.g. 73 queue agent slots) |
| **Abandoned** | None | — | `—` | Displayed as `—` | CallTools Queues table has NO native Abandoned column. Rendered as `—` to avoid false mapping |

---

## 3. PRECISION VERIFICATION EXAMPLES
- **Abandoned Rate:** 9 abandoned / 39,997 attempts = **`0.02%`** (previously truncated to `0.0%`).
- **Trace Value:** Nonzero values under 0.01% format as **`<0.01%`** (never falsely `0.00%`).
- **True Zero:** 0 / 100 attempts formats as **`0.00%`**.
