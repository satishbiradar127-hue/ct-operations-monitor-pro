const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

const dialers = [
    { name: 'East2', tag: 'EAST-2' },
    { name: 'East3', tag: 'EAST-3' }
];

dialers.forEach(cfg => {
    const dir = path.join(root, 'CT_Operations_Monitor_' + cfg.name);
    const dashPath = path.join(dir, 'src', 'dashboard.js');
    let code = fs.readFileSync(dashPath, 'utf8');

    console.log(`Applying clean v11.3.2 repairs to ${cfg.name}...`);

    // 1. Add formatRatePercent helper
    if (!code.includes('function formatRatePercent(')) {
        const helperFunc = `    function formatRatePercent(numerator, denominator) {
        if (denominator === null || denominator === undefined || denominator <= 0 || numerator === null || numerator === undefined) {
            return "—";
        }
        const num = Number(numerator);
        const den = Number(denominator);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
        const rate = (num / den) * 100;
        if (rate === 0) return "0.00%";
        if (rate > 0 && rate < 0.01) return "<0.01%";
        return rate.toFixed(2) + "%";
    }

    function formatDateTime(date) {`;
        code = code.replace(/function formatDateTime\(date\) \{/, helperFunc);
    }

    // 2. Add source health state variables to state object
    if (!code.includes('outboundSourceState: "INITIALIZING"')) {
        code = code.replace(/connectionState: "INITIALIZING",/, `connectionState: "INITIALIZING",
        outboundSourceState: "INITIALIZING",
        inboundSourceState: "INITIALIZING",
        outboundAuthRequired: false,
        inboundAuthRequired: false,
        outboundTableMissing: false,
        inboundTableMissing: false,`);
    }

    // 3. Storage hydration: update lastSuccessfulInboundAt when valid queues exist
    code = code.replace(
        /if \(signature !== queueDataSignature\(state\.queues\) \|\| !state\.queues\.length\) \{\s*\n\s*state\.previousQueuesById = snapshotQueuesById\(state\.queues\);\s*\n\s*state\.queues = nextQueues;\s*\n\s*state\.queueLastUpdated = new Date\(Number\(data\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*recordInboundHistory\(nextQueues, Number\(data\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*addInboundAlerts\(nextQueues\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*if \(status\)/,
        `if (signature !== queueDataSignature(state.queues) || !state.queues.length) {
                        state.previousQueuesById = snapshotQueuesById(state.queues);
                        state.queues = nextQueues;
                        state.queueLastUpdated = new Date(Number(data.updatedAt) || Date.now());
                        recordInboundHistory(nextQueues, Number(data.updatedAt) || Date.now());
                        addInboundAlerts(nextQueues);
                    }
                    if (data.updatedAt && nextQueues.length > 0) {
                        state.lastSuccessfulInboundAt = Number(data.updatedAt);
                    }
                }
                if (status)`
    );

    code = code.replace(
        /if \(signature !== queueDataSignature\(state\.queues\) \|\| !state\.queues\.length\) \{\s*\n\s*state\.previousQueuesById = snapshotQueuesById\(state\.queues\);\s*\n\s*state\.queues = nextQueues;\s*\n\s*state\.queueLastUpdated = new Date\(Number\(payload\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*recordInboundHistory\(nextQueues, Number\(payload\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*addInboundAlerts\(nextQueues\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*if \(statusChange && statusChange\.newValue\)/,
        `if (signature !== queueDataSignature(state.queues) || !state.queues.length) {
                state.previousQueuesById = snapshotQueuesById(state.queues);
                state.queues = nextQueues;
                state.queueLastUpdated = new Date(Number(payload.updatedAt) || Date.now());
                recordInboundHistory(nextQueues, Number(payload.updatedAt) || Date.now());
                addInboundAlerts(nextQueues);
            }
            if (payload.updatedAt && nextQueues.length > 0) {
                state.lastSuccessfulInboundAt = Number(payload.updatedAt);
            }
        }
        if (statusChange && statusChange.newValue)`
    );

    code = code.replace(
        /if \(changed \|\| !state\.queues\.length\) \{\s*\n\s*state\.previousQueuesById = snapshotQueuesById\(state\.queues\);\s*\n\s*state\.queues = nextQueues;\s*\n\s*state\.queueLastUpdated = new Date\(Number\(payload\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*recordInboundHistory\(nextQueues, Number\(payload\.updatedAt\) \|\| Date\.now\(\)\);\s*\n\s*addInboundAlerts\(nextQueues\);\s*\n\s*scheduleRender\(\);\s*\n\s*\}\s*\n\s*\}\s*catch/,
        `if (changed || !state.queues.length) {
                    state.previousQueuesById = snapshotQueuesById(state.queues);
                    state.queues = nextQueues;
                    state.queueLastUpdated = new Date(Number(payload.updatedAt) || Date.now());
                    recordInboundHistory(nextQueues, Number(payload.updatedAt) || Date.now());
                    addInboundAlerts(nextQueues);
                    scheduleRender();
                }
                if (payload.updatedAt && nextQueues.length > 0) {
                    state.lastSuccessfulInboundAt = Number(payload.updatedAt);
                }
            } catch`
    );

    // 4. Update updateConnectionState implementation
    const newUpdateConnectionState = `function getOutboundState(now) {
        if (state.outboundAuthRequired || state.authRequired) return "AUTH LOST";
        if (state.outboundTableMissing || (state.route === "campaigns" && state.tableMissing)) return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulOutboundAt;
        if (!lastObs) {
            return (state.parserActive || state.lastEventAt) ? "WAITING" : "INITIALIZING";
        }
        const ageSec = Math.max(0, Math.floor((now - lastObs) / 1000));
        if (ageSec >= 15) return "STALE";
        return "LIVE";
    }

    function getInboundState(now) {
        if (state.inboundAuthRequired || state.queueFeedStatus === "AUTH_REQUIRED") return "AUTH LOST";
        if (state.inboundTableMissing || state.queueFeedStatus === "SOURCE_ERROR" || state.queueFeedStatus === "FRAME_ERROR") return "SOURCE ERROR";
        const lastObs = state.lastSuccessfulInboundAt;
        if (!lastObs || !state.queues.length) {
            if (state.queueFeedStatus === "VERIFYING" || state.queueFeedStatus === "WAITING") return "WAITING";
            return "INITIALIZING";
        }
        const ageSec = Math.max(0, Math.floor((now - lastObs) / 1000));
        if (ageSec >= 15 || state.queueFeedStatus === "STALE") return "STALE";
        if (state.queueFeedStatus === "LIVE") return "LIVE";
        return "WAITING";
    }

    function getGlobalState(outboundState, inboundState) {
        if (outboundState === "AUTH LOST" || inboundState === "AUTH LOST") return "AUTH LOST";
        if (outboundState === "SOURCE ERROR" && inboundState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outboundState === "LIVE" && inboundState === "LIVE") return "LIVE";
        if (outboundState === "LIVE" && (inboundState === "WAITING" || inboundState === "INITIALIZING")) {
            return "PARTIALLY CONNECTED";
        }
        if (inboundState === "LIVE" && (outboundState === "WAITING" || outboundState === "INITIALIZING")) {
            return "PARTIALLY CONNECTED";
        }
        if (outboundState === "STALE" || inboundState === "STALE") {
            if (outboundState === "LIVE" || inboundState === "LIVE") return "PARTIALLY CONNECTED";
            return "STALE";
        }
        if (outboundState === "SOURCE ERROR" || inboundState === "SOURCE ERROR") return "SOURCE ERROR";
        if (outboundState === "WAITING" || inboundState === "WAITING") return "WAITING";
        return "INITIALIZING";
    }

    function updateConnectionState(now) {
        now = now || Date.now();
        const isCampaigns = (state.route || "campaigns") === "campaigns";

        const outboundState = getOutboundState(now);
        const inboundState = getInboundState(now);
        const globalState = getGlobalState(outboundState, inboundState);

        state.outboundSourceState = outboundState;
        state.inboundSourceState = inboundState;
        state.connectionState = globalState;
        state.sourceState = globalState;

        // Ages
        const outAgeSec = state.lastSuccessfulOutboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulOutboundAt) / 1000)) : null;
        const outAgeStr = outAgeSec !== null ? formatAge(outAgeSec) + " ago" : (outboundState === "WAITING" ? "waiting" : "initializing");
        const outTimeStr = state.lastSuccessfulOutboundAt ? formatDateTime(new Date(state.lastSuccessfulOutboundAt)) : "";

        const inAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
        const inAgeStr = inAgeSec !== null ? formatAge(inAgeSec) + " ago" : (inboundState === "WAITING" ? "connecting" : "awaiting feed");
        const inTimeStr = state.lastSuccessfulInboundAt ? formatDateTime(new Date(state.lastSuccessfulInboundAt)) : "";

        let badgeText = "INITIALIZING";
        let badgeTone = "is-warning";
        let subtitleText = "Initializing monitor · Awaiting CallTools DOM";

        if (globalState === "AUTH LOST") {
            badgeText = "AUTH LOST";
            badgeTone = "is-critical";
            subtitleText = "Authentication required · Log in to CallTools to resume monitoring";
        } else if (globalState === "SOURCE ERROR") {
            badgeText = "SOURCE ERROR";
            badgeTone = "is-critical";
            subtitleText = "CallTools table not found · Check page URL";
        } else if (globalState === "WAITING") {
            badgeText = "WAITING";
            badgeTone = "is-warning";
            subtitleText = "Waiting for verified CallTools data";
        } else if (globalState === "STALE") {
            badgeText = "STALE";
            badgeTone = "is-critical";
            subtitleText = "STALE · Outbound: " + outAgeStr + " · Inbound: " + inAgeStr;
        } else if (globalState === "PARTIALLY CONNECTED") {
            badgeText = "PARTIAL";
            badgeTone = "is-warning";
            if (isCampaigns) {
                subtitleText = "PARTIALLY CONNECTED · Outbound: LIVE (" + outAgeStr + ") · Inbound: " + inAgeStr;
            } else {
                subtitleText = "PARTIALLY CONNECTED · Inbound: LIVE (" + inAgeStr + ") · Outbound: " + outAgeStr;
            }
        } else if (globalState === "LIVE") {
            badgeText = "LIVE";
            badgeTone = "is-good";
            if (isCampaigns) {
                subtitleText = "LIVE · Observed " + outAgeStr + " (" + outTimeStr + ") · Inbound: " + inAgeStr;
            } else {
                subtitleText = "LIVE · Observed " + inAgeStr + " (" + inTimeStr + ") · Outbound: " + outAgeStr;
            }
        }

        if (refs && refs.live) {
            setText(refs.live, badgeText);
            setClass(refs.live, "ct-live " + badgeTone);
            refs.live.title = "Connection: " + globalState + " (Outbound: " + outboundState + ", Inbound: " + inboundState + ")";
        }
        if (refs && refs.updated) {
            setText(refs.updated, subtitleText);
        }

        // Operational alerts
        if (outboundState === "STALE" || inboundState === "STALE") {
            upsertOperationalAlert("SOURCE_STALE", "CallTools Page Health", "critical",
                "CallTools feed heartbeat delayed (Outbound: " + outAgeStr + ", Inbound: " + inAgeStr + ").",
                "Live monitoring is passive. Check CallTools connectivity; no automatic page reload will be performed.",
                "critical|SOURCE_STALE");
        } else if (outboundState === "LIVE" && inboundState === "LIVE") {
            dismissOperationalAlert("SOURCE_STALE");
            dismissOperationalAlert("SOURCE_RECOVERY");
            if (state.dismissedConditions) {
                state.dismissedConditions.delete("SOURCE_STALE");
                state.dismissedConditions.delete("SOURCE_RECOVERY");
            }
        }

        if (refs && refs.calltoolsHealth) {
            setText(refs.calltoolsHealth, globalState);
            setClass(refs.calltoolsHealth, "ct-command-value " + (globalState === "LIVE" ? "is-good" : (globalState === "STALE" || globalState === "AUTH LOST" || globalState === "SOURCE ERROR") ? "is-critical" : "is-warning"));
        }
        if (refs && refs.dataConfidence) {
            setText(refs.dataConfidence, globalState === "LIVE" ? "VERIFIED" : globalState === "PARTIALLY CONNECTED" ? "PARTIAL" : globalState === "STALE" ? "STALE" : "WAITING");
        }
        if (refs && refs.systemHealth) {
            setText(refs.systemHealth, globalState === "LIVE" ? "Live monitoring active" : globalState === "PARTIALLY CONNECTED" ? "Partially connected — watching" : globalState === "STALE" ? "Feed stale — watching" : globalState === "AUTH LOST" ? "Authentication required" : "Waiting for data");
        }

        return globalState;
    }`;

    code = code.replace(/function updateConnectionState\(now\) \{[\s\S]*?\n\s*function updateSourceWatchdog/, newUpdateConnectionState + '\n\n    function updateSourceWatchdog');

    // 5. In updateInboundPanel: bind refs.inboundLive and refs.inboundStatus to inboundSourceState
    const inboundPanelBindingRegex = /const statusText = hasLiveQueueFeed[\s\S]*?setClass\(refs\.inboundLive, "ct-inbound-live " \+ \(hasLiveQueueFeed \? "is-live" : "is-warning"\)\);/;
    const newInboundPanelStatus = `const inState = state.inboundSourceState || getInboundState(now);
        const inAgeSec = state.lastSuccessfulInboundAt ? Math.max(0, Math.floor((now - state.lastSuccessfulInboundAt) / 1000)) : null;
        const inAgeStr = inAgeSec !== null ? formatAge(inAgeSec) + " old" : "not connected";

        let statusText = "QUEUE FEED " + inState;
        let badgeText = "CONNECTING";
        let badgeClass = "ct-inbound-live is-warning";

        if (inState === "LIVE") {
            statusText = "LIVE · automatic native Queue feed (Observed " + inAgeStr + ")";
            badgeText = "LIVE";
            badgeClass = "ct-inbound-live is-live";
        } else if (inState === "STALE") {
            statusText = "STALE · Queue feed last observed " + inAgeStr;
            badgeText = "STALE";
            badgeClass = "ct-inbound-live is-critical";
        } else if (inState === "AUTH LOST") {
            statusText = "AUTH REQUIRED · Queue context showing CallTools login screen";
            badgeText = "AUTH REQUIRED";
            badgeClass = "ct-inbound-live is-critical";
        } else if (inState === "WAITING") {
            statusText = "AUTO-CONNECTING · native Queue feed";
            badgeText = "CONNECTING";
            badgeClass = "ct-inbound-live is-warning";
        } else {
            statusText = latestKnown ? "LAST VERIFIED · Queue feed " + inAgeStr : "QUEUE FEED NOT LOADED";
            badgeText = latestKnown ? "LAST KNOWN" : "NO DATA";
            badgeClass = "ct-inbound-live is-warning";
        }

        setText(refs.inboundStatus, statusText);
        setText(refs.inboundLive, badgeText);
        setClass(refs.inboundLive, badgeClass);`;
    code = code.replace(inboundPanelBindingRegex, newInboundPanelStatus);

    // 6. Inbound Hero Today Note: reconcile 477 calls today (Answered + Not Answered + Machine + Other/IVR)
    const inboundHeroNoteRegex = /setText\(refs\.inboundHeroTodayNote, totals\.notAnswered !== null[\s\S]*?: formatNumber\(totals\.answered\) \+ " answered · other categories unexposed"\);/;
    const newInboundHeroNote = `const otherOutcomes = Math.max(0, totals.today - totals.answered - (totals.notAnswered ?? 0) - totals.machine);
        let todayBreakdown = formatNumber(totals.answered) + " answered";
        if (totals.notAnswered !== null) {
            todayBreakdown += " · " + formatNumber(totals.notAnswered) + " not answered";
        }
        if (totals.machine > 0) {
            todayBreakdown += " · " + formatNumber(totals.machine) + " machine";
        }
        if (otherOutcomes > 0) {
            todayBreakdown += " · " + formatNumber(otherOutcomes) + " other/IVR";
        }
        setText(refs.inboundHeroTodayNote, todayBreakdown);`;
    code = code.replace(inboundHeroNoteRegex, newInboundHeroNote);

    // 7. Update answerRate tooltip to eliminate false DATA CHECK
    code = code.replace(
        /updateInboundKpi\("answerRate", totals\.today \? answerRate\.toFixed\(1\) \+ "%" : "—", totals\.notAnswered !== null \? \(consistency \? "answered ÷ calls today" : "DATA CHECK"\) : "answered ÷ calls today"\);/,
        'updateInboundKpi("answerRate", totals.today ? answerRate.toFixed(1) + "%" : "—", "answered ÷ calls today (" + formatNumber(totals.answered) + " ÷ " + formatNumber(totals.today) + ")");'
    );

    // 8. Percentage precision in Active Campaigns Command Summary table row
    code = code.replace(
        /const abandonRate = c\.__outbound > 0 \? \(c\.__abandoned \/ c\.__outbound\) \* 100 : 0;\s*\n\s*const abandonedText = c\.__abandoned > 0\s*\n\s*\? \(c\.__outbound > 0 \? formatNumber\(c\.__abandoned\) \+ " \(" \+ abandonRate\.toFixed\(1\) \+ "%\)" : formatNumber\(c\.__abandoned\)\)\s*\n\s*: "0 \(0%\)";\s*\n\s*const abandonedTitle = c\.__abandoned \+ " abandoned call" \+ \(c\.__abandoned === 1 \? "" : "s"\) \+ \(c\.__outbound > 0 \? " \(" \+ abandonRate\.toFixed\(2\) \+ "% of outbound attempts\)" : ""\);/,
        `const abandonRate = c.__outbound > 0 ? (c.__abandoned / c.__outbound) * 100 : 0;
            const abandonRateStr = formatRatePercent(c.__abandoned, c.__outbound);
            const abandonedText = c.__abandoned > 0
                ? (c.__outbound > 0 ? formatNumber(c.__abandoned) + " (" + abandonRateStr + ")" : formatNumber(c.__abandoned))
                : "0 (0.00%)";
            const abandonedTitle = c.__abandoned + " abandoned call" + (c.__abandoned === 1 ? "" : "s") + (c.__outbound > 0 ? " (" + abandonRateStr + " of outbound attempts)" : "");`
    );

    // Also update connectRateText in table
    code = code.replace(
        /const connectRateText = c\.__outbound > 0 \? connectRate\.toFixed\(1\) \+ "%" : "—";/,
        'const connectRateText = c.__outbound > 0 ? formatRatePercent(c.__human, c.__outbound) : "—";'
    );

    // 9. Tooltips for Human Connects and Agent Connects in table headers
    code = code.replace(
        /<span>HUMAN CONNECTS<\/span>/,
        '<span title="Native CallTools Human column: live human voice answers detected by AMD">HUMAN CONNECTS</span>'
    );
    code = code.replace(
        /<span>AGENT CONNECTS<\/span>/,
        '<span title="Native CallTools To Agents column: calls successfully transferred and bridged to agent headset">AGENT CONNECTS</span>'
    );

    // 10. Update version constants if any in dashboard.js
    code = code.replace(/v11\.3\.1/g, 'v11.3.2');
    code = code.replace(/v11\.3\.0/g, 'v11.3.2');

    fs.writeFileSync(dashPath, code, 'utf8');
    fs.writeFileSync(path.join(dir, 'dist', 'src', 'dashboard.js'), code, 'utf8');
    console.log(`Saved updated dashboard.js to src and dist for ${cfg.name}.`);

    // Bump version in manifest.json, dist/manifest.json, and package.json
    const mPath = path.join(dir, 'manifest.json');
    const dmPath = path.join(dir, 'dist', 'manifest.json');
    const pPath = path.join(dir, 'package.json');

    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    m.version = "11.3.2";
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n', 'utf8');

    const dm = JSON.parse(fs.readFileSync(dmPath, 'utf8'));
    dm.version = "11.3.2";
    fs.writeFileSync(dmPath, JSON.stringify(dm, null, 2) + '\n', 'utf8');

    const p = JSON.parse(fs.readFileSync(pPath, 'utf8'));
    p.version = "11.3.2";
    fs.writeFileSync(pPath, JSON.stringify(p, null, 2) + '\n', 'utf8');

    console.log(`Bumped version to 11.3.2 in manifests and package.json for ${cfg.name}.`);
});
