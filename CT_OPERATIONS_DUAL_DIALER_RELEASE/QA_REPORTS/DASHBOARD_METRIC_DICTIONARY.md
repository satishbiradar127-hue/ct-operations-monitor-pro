# CT OPERATIONS MONITOR PRO — DASHBOARD METRIC DICTIONARY
## Canonical Formulas, Operational Sources, Numerators, Denominators & Aggregation Rules

**Project:** CT Operations Monitor Pro — Dual Dialer  
**Release Version:** v11.3.4  
**Dialers:** EAST-2 (`https://east-2.calltools.io`) and EAST-3 (`https://east-3.calltools.io`)  
**Security Model:** 100% Strict Read-Only Boundary  
**Date of Document:** November 2026  

---

## 1. OPERATIONAL KPI METRICS

### 1.1 Running Campaigns
- **Definition:** Count of dialer campaigns currently in an operational, dialing, or agent-staffed state.
- **Source:** `/manager/campaigns` table rows.
- **Formula:** `count(campaigns where isRunning === true)`
- **Evaluation Rule:** `isRunning = (active === true || state === "ACTIVE" || state === "RUNNING" || loggedIn > 0)`
- **Units:** Integer count.
- **Time Window:** Current live state.
- **Missing Data Behavior:** If table unobserved, returns `0` with status `WAITING`. Never fabricates numbers.

### 1.2 Logged-In Agents
- **Definition:** Total agent memberships currently logged into running campaigns.
- **Source:** `.cdk-column-logged_in_agents` or `.cdk-column-cached_logged_in_agents`.
- **Formula:** `sum(campaign.loggedIn for active campaigns)`
- **Units:** Integer count of agent seats.
- **Time Window:** Current live state.
- **Missing Data Behavior:** If column is absent in CallTools table layout, returns `—` with tooltip `"Not exposed in Campaigns feed"`.

### 1.3 Waiting Agents / Queue Load
- **Definition:** Aggregate queue load representing callers waiting for agents or agents waiting for calls.
- **Source:** `.cdk-column-waiting_agents` or `.cdk-column-cached_waiting_agents`.
- **Formula:** `sum(campaign.waiting for active campaigns)`
- **Units:** Integer count.
- **Missing Data Behavior:** If column absent, returns `—` with tooltip `"Queue load not exposed in CallTools Campaigns table"`.

### 1.4 Current Contact Pool
- **Definition:** Total callable, un-exhausted leads remaining in active campaign queues.
- **Source:** `.cdk-column-contact_count` or `.cdk-column-total_saved_contact_count`.
- **Formula:** `sum(campaign.contacts for active campaigns)`
- **Units:** Integer contact count (formatted with commas, e.g. `42,342`).
- **Aggregation Boundary:** Never summed with Filter Catalog contact counts.

### 1.5 Outbound Attempts
- **Definition:** Total outbound calls dialed today by CallTools telephony engine across active campaigns.
- **Source:** `.cdk-column-outbound` or `.cdk-column-calls_today`.
- **Formula:** `sum(campaign.outbound for active campaigns)`
- **Units:** Integer call attempts.
- **Time Window:** Midnight to current observation (today's cumulative total).
- **Missing Data Behavior:** Valid 0 preserved; missing returns `—`.

### 1.6 Human Connects
- **Definition:** Outbound calls answered by a live human recipient.
- **Source:** `.cdk-column-human` or `.cdk-column-calls_outbound_human`.
- **Formula:** `sum(campaign.human for active campaigns)`
- **Units:** Integer human answers.
- **Time Window:** Today's cumulative total.

### 1.7 Agent Connects
- **Definition:** Outbound calls where a human was answered and successfully bridged to an agent.
- **Source:** `.cdk-column-agent_connect` or `.cdk-column-calls_outbound_agent_connect`.
- **Formula:** `sum(campaign.agentConnect for active campaigns)`
- **Units:** Integer agent bridges.
- **Time Window:** Today's cumulative total.

### 1.8 Connection Rate (%)
- **Definition:** Percentage of outbound call attempts that resulted in a verified human answered connection.
- **Formula:** `(Human Connects / Outbound Attempts) * 100`
- **Numerator:** `Human Connects` (today's answered human calls).
- **Denominator:** `Outbound Attempts` (today's total outbound dials).
- **Units:** Percentage formatted to 2 decimal places (e.g. `12.45%`).
- **Missing Data Behavior:** If Outbound Attempts is 0 or null, returns `—` (avoids divide-by-zero). If `< 0.01%`, returns `<0.01%`.

### 1.9 Total Goals (Reconciled)
- **Definition:** Total conversions / disposition milestones achieved across outbound campaigns and inbound queues.
- **Formula:** `Outbound Goals + Inbound Goals`
- **Numerator:** Sum of verified disposition goals.
- **Source Attribution:** 
  - Outbound Campaign Goals from `.cdk-column-goals`.
  - Inbound Queue Goals from queue feed `.cdk-column-goals`.
- **Reconciliation Transparency:** If both feeds are live, displays combined total with subtitle `"Outbound: X · Inbound: Y"`. If only outbound is live, displays `"PARTIAL · Outbound: X · Inbound: connecting"`.
- **Time Window:** Today's cumulative total.

### 1.10 Abandoned Calls & Abandon Rate (%)
- **Definition:** Total calls placed by dialer where a contact answered but no agent was available to bridge.
- **Formula (Count):** `sum(campaign.abandoned for active campaigns)`
- **Formula (Rate %):** `(Abandoned Calls / Outbound Attempts) * 100`
- **Units:** Combined display: `Count (Percentage)` (e.g. `23 (1.85%)`).
- **Missing Data Behavior:** If outbound is 0, displays `0 (0.00%)`.

---

## 2. TIMING & RUNWAY METRICS

### 2.1 Wait Now
- **Definition:** Average caller waiting time right now.
- **Source:** `.cdk-column-wait_now` or `.cdk-column-cached_now_avg_wait_time`.
- **Units:** Seconds (e.g. `14s`).

### 2.2 Wait Today
- **Definition:** Maximum / average caller wait time recorded today.
- **Source:** `.cdk-column-wait_today` or `.cdk-column-cached_today_avg_wait_time`.
- **Units:** Seconds.

### 2.3 Contact Runway
- **Definition:** Estimated time until campaign contact pool is completely depleted at observed dial velocity.
- **Formula:** `Remaining Contacts / Observed Depletion Rate per Minute`
- **Units:** Hours / Minutes (e.g. `3h 45m` or `Exhausted`).
- **Initial State:** Displays `Measuring…` during initial baseline calibration.

---

## 3. LIVE FILTER INTELLIGENCE METRICS

### 3.1 Catalog Filters Count
- **Definition:** Total live targeting filter rules registered in CallTools account catalog.
- **Source:** `/manager/live-filters` table rows.
- **Formula:** `count(filter_items in ct_eastX_live_filters_inventory_v1)`
- **Missing Data Behavior:** Returns `null` if route unobserved; displayed as `Awaiting Catalog Visit (/manager/live-filters)`. Never displays `0`.

### 3.2 Active Catalog Rules
- **Definition:** Count of catalog filters where toggle switch is active (`active === true`).
- **Source:** `/manager/live-filters` `.mat-slide-toggle`.
- **Missing Data Behavior:** Returns `null` if unobserved; displayed as `Awaiting Catalog Visit`.

### 3.3 Available Filter Contacts
- **Definition:** Sum of queryable contacts across observed live filters in catalog.
- **Source:** `/manager/live-filters` `.cdk-column-contact_count`.
- **Formula:** `sum(filter.count for f in inventory)`
- **Isolation Rule:** Never summed with active campaign contact pools.

### 3.4 Verified Targeting Configurations
- **Definition:** Count of running campaigns verified to have an active live filter targeting assignment.
- **Source:** Cross-referencing running campaigns with `ct_eastX_verified_campaign_filters_v1`.
- **Formula:** `count(active campaigns where filter_status === "VERIFIED ACTIVE")`

### 3.5 Native Refill Time
- **Definition:** Timestamp of when lead inventory was natively refilled into the filter or campaign.
- **Status:** **UNAVAILABLE FROM PERMITTED SOURCES.** CallTools does not expose native refill timestamps in DOM tables.
- **Enforced Display:** `"Native refill time: Not available from permitted source"`. Observation timestamp is strictly forbidden from being substituted.
