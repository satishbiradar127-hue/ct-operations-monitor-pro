/**
 * repair_dashboard.js
 * 
 * Applies the 6-state connection state machine, dialer event naming isolation,
 * and live subtitle updates to dashboard.js in East-2 and East-3.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

const dialers = [
    {
        name: 'East2',
        titleTag: 'EAST-2',
        dialerName: 'East-2',
        updateEvent: 'CT_EAST_2_UPDATE',
        feedStatusEvent: 'CT_EAST_2_FEED_STATUS',
        requestRefreshEvent: 'CT_EAST_2_REQUEST_REFRESH',
        requestInboundRefreshEvent: 'CT_EAST_2_REQUEST_INBOUND_REFRESH',
        storagePrefix: 'ct_east2_'
    },
    {
        name: 'East3',
        titleTag: 'EAST-3',
        dialerName: 'East-3',
        updateEvent: 'CT_EAST_3_UPDATE',
        feedStatusEvent: 'CT_EAST_3_FEED_STATUS',
        requestRefreshEvent: 'CT_EAST_3_REQUEST_REFRESH',
        requestInboundRefreshEvent: 'CT_EAST_3_REQUEST_INBOUND_REFRESH',
        storagePrefix: 'ct_east3_'
    }
];

function repairDashboard(cfg) {
    const dir = path.join(root, 'CT_Operations_Monitor_' + cfg.name);
    const dashPath = path.join(dir, 'src', 'dashboard.js');
    let code = fs.readFileSync(dashPath, 'utf8');

    console.log(`Repairing dashboard.js for ${cfg.name}...`);

    // 1. Ensure dialer constants at the top
    const topConstBlock = `    const DIALER_ID = "${cfg.dialerName.toLowerCase()}";
    const DIALER_NAME = "${cfg.dialerName}";
    const DIALER_TAG = "${cfg.titleTag}";
    const UPDATE_EVENT = "${cfg.updateEvent}";
    const FEED_STATUS_EVENT = "${cfg.feedStatusEvent}";
    const REQUEST_REFRESH_EVENT = "${cfg.requestRefreshEvent}";
    const REQUEST_INBOUND_REFRESH_EVENT = "${cfg.requestInboundRefreshEvent}";`;

    if (!code.includes('const UPDATE_EVENT =')) {
        code = code.replace(/const INBOUND_HEARTBEAT_STALE_MS = 15000;/, `const INBOUND_HEARTBEAT_STALE_MS = 15000;\n${topConstBlock}`);
    }

    // 2. Add state properties to state object
    if (!code.includes('connectionState: "INITIALIZING"')) {
        code = code.replace(/sourceState: "WAITING",\s*feedStatus: "WAITING",/, `sourceState: "WAITING",
        feedStatus: "WAITING",
        connectionState: "INITIALIZING",
        lastSuccessfulObservationAt: null,
        lastSuccessfulOutboundAt: null,
        lastSuccessfulInboundAt: null,
        authRequired: false,
        tableMissing: false,
        parserActive: false,`);
    }

    // 3. Replace onCtUpdate
    const onCtUpdateRegex = /const onCtUpdate = function \(event\) \{[\s\S]*?\n\s*scheduleRender\(\);\s*\n\s*\};/;
    const newOnCtUpdate = `const onCtUpdate = function (event) {
        const detail = event && event.detail;
        const now = Date.now();
        const route = String((detail && detail.route) || state.route || "campaigns");
        state.route = route;
        state.lastEventAt = now;
        state.parserActive = true;

        const meta = (detail && detail.meta) || {};
        if (meta.authRequired) {
            state.authRequired = true;
            updateConnectionState(now);
            scheduleRender();
            return;
        }
        if (meta.tableMissing) {
            state.tableMissing = true;
            updateConnectionState(now);
            scheduleRender();
            return;
        }

        state.authRequired = false;
        state.tableMissing = false;
        const obsTime = Number(meta.observationAt) || now;
        state.lastSuccessfulObservationAt = obsTime;

        if (route === "queues" || (detail && Array.isArray(detail.queues) && detail.queues.length && !detail.campaigns?.length)) {
            state.lastSuccessfulInboundAt = obsTime;
            const nextQueues = detail && Array.isArray(detail.queues) ? detail.queues : [];
            const signature = queueDataSignature(nextQueues);
            const changed = signature !== queueDataSignature(state.queues);
            if (changed || !state.queues.length) {
                state.previousQueuesById = snapshotQueuesById(state.queues);
                state.queues = nextQueues;
                state.queueLastUpdated = new Date(now);
                recordInboundHistory(nextQueues, now);
                addInboundAlerts(nextQueues);
                persistLastKnownQueues(nextQueues, now);
            }
            updateConnectionState(now);
            scheduleRender();
            return;
        }

        // Campaigns route
        state.lastSuccessfulOutboundAt = obsTime;
        const nextCampaigns = Array.isArray(detail)
            ? detail
            : (detail && Array.isArray(detail.campaigns) ? detail.campaigns : []);
        const signature = dataSignature(nextCampaigns);
        const changed = signature !== state.lastDataSignature;

        state.lastFeedHeartbeatAt = obsTime;
        if (refs && refs.feedHeartbeat) setText(refs.feedHeartbeat, "0s");

        if (changed || !state.campaigns.length) {
            const previousById = state.campaigns.length ? snapshotById(state.campaigns) : new Map();
            state.previousById = previousById;
            state.campaigns = nextCampaigns;
            state.lastDataSignature = signature;
            state.lastDataChangeAt = obsTime;
            state.lastUpdated = new Date(obsTime);
            state.recoveryInFlightUntil = 0;
            recordRunwaySamples(nextCampaigns, obsTime);
            addCurrentStateAlerts(nextCampaigns);
            persistLastKnownCampaigns(nextCampaigns, obsTime);
        } else {
            recordRunwaySamples(nextCampaigns, obsTime);
        }

        updateConnectionState(now);
        scheduleRender();
    };`;
    code = code.replace(onCtUpdateRegex, newOnCtUpdate);

    // 4. Replace onCtFeedStatus
    const onCtFeedStatusRegex = /const onCtFeedStatus = function \(event\) \{[\s\S]*?\n\s*if \(state\.feedStatus !== previousStatus\) scheduleRender\(\);\s*\n\s*\};/;
    const newOnCtFeedStatus = `const onCtFeedStatus = function (event) {
        const detail = event && event.detail ? event.detail : {};
        const now = Date.now();
        state.lastEventAt = Number(detail.lastCheckAt) || now;
        state.parserActive = true;
        if (detail.route) state.route = String(detail.route);
        if (detail.authRequired || detail.status === "AUTH_REQUIRED") {
            state.authRequired = true;
        }
        if (detail.tableMissing || detail.status === "SOURCE_ERROR") {
            state.tableMissing = true;
        }
        if (detail.status === "LIVE" && (detail.rowCount > 0 || state.campaigns.length > 0 || state.queues.length > 0)) {
            state.authRequired = false;
            state.tableMissing = false;
            const checkAt = Number(detail.lastCheckAt) || now;
            state.lastSuccessfulObservationAt = checkAt;
            if (state.route === "campaigns") state.lastSuccessfulOutboundAt = checkAt;
            if (state.route === "queues") state.lastSuccessfulInboundAt = checkAt;
        }
        if (state.route === "queues") state.queueLastFeedHeartbeatAt = new Date(state.lastEventAt);
        state.lastFeedHeartbeatAt = state.lastEventAt;
        if (detail.status) {
            const status = String(detail.status).toUpperCase();
            state.feedStatus = status;
        }
        updateConnectionState(now);
    };`;
    code = code.replace(onCtFeedStatusRegex, newOnCtFeedStatus);

    // 5. Replace event listeners with constant names
    code = code.replace(/document\.addEventListener\("CT_EAST_[23]_UPDATE", onCtUpdate\);/, 'document.addEventListener(UPDATE_EVENT, onCtUpdate);');
    code = code.replace(/document\.addEventListener\("CT_EAST_[23]_FEED_STATUS", onCtFeedStatus\);/, 'document.addEventListener(FEED_STATUS_EVENT, onCtFeedStatus);');
    code = code.replace(/document\.removeEventListener\("CT_EAST_[23]_UPDATE", onCtUpdate\);/, 'document.removeEventListener(UPDATE_EVENT, onCtUpdate);');
    code = code.replace(/document\.removeEventListener\("CT_EAST_[23]_FEED_STATUS", onCtFeedStatus\);/, 'document.removeEventListener(FEED_STATUS_EVENT, onCtFeedStatus);');

    // 6. Replace freshness watchdog interval: 1000ms instead of 2000ms
    code = code.replace(/const freshnessTimer = setInterval\(updateSourceWatchdog, 2000\);/, 'const freshnessTimer = setInterval(function () { updateConnectionState(Date.now()); }, 1000);');

    // 7. Update updateSummary to call updateConnectionState(now)
    const updateSummaryHeaderRegex = /function updateSummary\(stats, filteredCount, ordered\) \{[\s\S]*?setText\(refs\.updated,[\s\S]*?\);\s*\n\s*const activeCampaigns/;
    const newSummaryHeader = `function updateSummary(stats, filteredCount, ordered) {
        updateConnectionState(Date.now());
        const activeCampaigns`;
    code = code.replace(updateSummaryHeaderRegex, newSummaryHeader);

    // 8. Replace updateSourceWatchdog with updateConnectionState implementation
    const watchdogRegex = /function updateSourceWatchdog\(\) \{[\s\S]*?\n\s*function requestPageRefresh/;
    const newConnectionStateMachine = `function updateConnectionState(now) {
        now = now || Date.now();
        let stateName = "INITIALIZING";
        let badgeClass = "ct-live is-warning";
        let subtitleText = "Initializing monitor · Awaiting CallTools DOM";

        const isCampaigns = (state.route || "campaigns") === "campaigns";
        const lastObs = state.lastSuccessfulObservationAt;
        const obsAgeSec = lastObs ? Math.max(0, Math.floor((now - lastObs) / 1000)) : null;
        const obsTimeStr = lastObs ? formatDateTime(new Date(lastObs)) : "";
        const obsAgeStr = obsAgeSec !== null ? formatAge(obsAgeSec) + " ago" : "";

        const inboundAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
        const outboundAgeSec = state.lastSuccessfulOutboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulOutboundAt) / 1000)) : null;
        const inboundAgeStr = inboundAgeSec !== null ? formatAge(inboundAgeSec) + " ago" : "connecting";
        const outboundAgeStr = outboundAgeSec !== null ? formatAge(outboundAgeSec) + " ago" : "connecting";

        if (state.authRequired) {
            stateName = "AUTH LOST";
            badgeClass = "ct-live is-critical";
            subtitleText = "Authentication required · Log in to CallTools to resume monitoring";
        } else if (state.tableMissing) {
            stateName = "SOURCE ERROR";
            badgeClass = "ct-live is-critical";
            subtitleText = "CallTools table not found · Check page URL";
        } else if (!lastObs) {
            if (state.parserActive || state.lastEventAt) {
                stateName = "WAITING";
                badgeClass = "ct-live is-warning";
                subtitleText = "Waiting for verified CallTools data";
            } else {
                stateName = "INITIALIZING";
                badgeClass = "ct-live is-warning";
                subtitleText = "Initializing monitor · Awaiting CallTools DOM";
            }
        } else if (obsAgeSec >= 15) {
            stateName = "STALE";
            badgeClass = "ct-live is-critical";
            subtitleText = "STALE · Last observed " + obsAgeStr + " (" + obsTimeStr + ")";
        } else {
            stateName = "LIVE";
            badgeClass = "ct-live is-good";
            if (isCampaigns) {
                subtitleText = "LIVE · Observed " + obsAgeStr + " (" + obsTimeStr + ") · Inbound: " + inboundAgeStr;
            } else {
                subtitleText = "LIVE · Observed " + obsAgeStr + " (" + obsTimeStr + ") · Outbound: " + outboundAgeStr;
            }
        }

        state.connectionState = stateName;
        state.sourceState = stateName;

        if (refs && refs.live) {
            setText(refs.live, stateName);
            setClass(refs.live, badgeClass);
        }
        if (refs && refs.updated) {
            setText(refs.updated, subtitleText);
        }

        if (stateName === "STALE") {
            upsertOperationalAlert("SOURCE_STALE", "CallTools Page Health", "critical", 
                "No CallTools feed heartbeat for " + (obsAgeSec !== null ? formatAge(obsAgeSec) : "15s") + ".", 
                "Live monitoring is passive. Verify CallTools connectivity; no automatic page reload will be performed.", 
                "critical|SOURCE_STALE");
        } else if (stateName === "LIVE") {
            dismissOperationalAlert("SOURCE_STALE");
            dismissOperationalAlert("SOURCE_RECOVERY");
            if (state.dismissedConditions) {
                state.dismissedConditions.delete("SOURCE_STALE");
                state.dismissedConditions.delete("SOURCE_RECOVERY");
            }
        }

        if (refs && refs.calltoolsHealth) {
            setText(refs.calltoolsHealth, stateName);
            setClass(refs.calltoolsHealth, "ct-command-value " + (stateName === "LIVE" ? "is-good" : (stateName === "STALE" || stateName === "AUTH LOST" || stateName === "SOURCE ERROR") ? "is-critical" : "is-warning"));
        }
        if (refs && refs.dataConfidence) {
            setText(refs.dataConfidence, stateName === "LIVE" ? "VERIFIED" : stateName === "STALE" ? "STALE" : "WAITING");
        }
        if (refs && refs.systemHealth) {
            setText(refs.systemHealth, stateName === "LIVE" ? "Live monitoring active" : stateName === "STALE" ? "CallTools feed stale — watching" : stateName === "AUTH LOST" ? "Authentication required" : "Waiting for data");
        }

        return stateName;
    }

    function updateSourceWatchdog() {
        return updateConnectionState(Date.now());
    }

    function requestPageRefresh`;
    code = code.replace(watchdogRegex, newConnectionStateMachine);

    // 9. Replace requestPageRefresh and event dispatches with constants
    code = code.replace(/document\.dispatchEvent\(new CustomEvent\("CT_EAST_[23]_REQUEST_REFRESH"\)\);/g, 'document.dispatchEvent(new CustomEvent(REQUEST_REFRESH_EVENT));');
    code = code.replace(/document\.dispatchEvent\(new CustomEvent\("CT_EAST_[23]_REQUEST_INBOUND_REFRESH"\)\);/g, 'document.dispatchEvent(new CustomEvent(REQUEST_INBOUND_REFRESH_EVENT));');

    // 10. Wire headerRefresh click listener
    if (!code.includes('refs.headerRefresh.addEventListener("click"')) {
        code = code.replace(/refs\.refresh\.addEventListener\("click", function \(\) \{ requestPageRefresh\("button"\); \}\);/, `refs.refresh.addEventListener("click", function () { requestPageRefresh("button"); });
        if (refs.headerRefresh) {
            refs.headerRefresh.addEventListener("click", function () { requestPageRefresh("header refresh"); });
        }`);
    }

    // 11. Initial call to updateConnectionState on mount
    if (!code.includes('updateConnectionState(Date.now());')) {
        code = code.replace(/scheduleRender\(\);\s*\n\s*return root;/, 'updateConnectionState(Date.now());\n        scheduleRender();\n        return root;');
    }

    // Save
    fs.writeFileSync(dashPath, code, 'utf8');
    fs.writeFileSync(path.join(dir, 'dist', 'src', 'dashboard.js'), code, 'utf8');
    console.log(`Saved dashboard.js to src and dist for ${cfg.name}.`);
}

dialers.forEach(repairDashboard);

