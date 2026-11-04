/**
 * apply_v11_3_3_goals_repair.js
 * 
 * Applies Total Goals (Outbound + Inbound) reconciliation and 
 * Insights abandonRate precision alignment across East-2 and East-3.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

const target1 = `        updateKpi("abandoned", formatNumber(stats.abandonmentTotal), stats.highestAbandoned && stats.highestAbandoned.__abandoned ? "highest: " + safeValue(stats.highestAbandoned.name) : "no current signal");
        updateKpi("goals", stats.goalsAvailable ? formatNumber(stats.goals) : "—", stats.goalsAvailable ? "CallTools campaign feed" : "Not exposed by Campaigns feed");`;

const replacement1 = `        updateKpi("abandoned", formatNumber(stats.abandonmentTotal), stats.highestAbandoned && stats.highestAbandoned.__abandoned ? "highest: " + safeValue(stats.highestAbandoned.name) : "no current signal");
        
        // TOTAL GOALS (INBOUND + OUTBOUND) RECONCILIATION
        const queues = Array.isArray(state.queues) ? state.queues : [];
        const activeQueues = queues.filter(function (q) { return !isArchivedQueue(q); });
        const inState = state.inboundSourceState || getInboundState(Date.now());
        const inboundAvailable = activeQueues.length > 0 && (inState === "LIVE" || inState === "STALE" || inState === "WAITING");
        const inboundGoals = inboundAvailable ? activeQueues.reduce(function (sum, q) { return sum + queueNumber(q, "goals"); }, 0) : null;
        const outboundGoals = stats.goalsAvailable ? stats.goals : null;

        let totalGoalsVal = "—";
        let totalGoalsNote = "Awaiting verified Goals feed";
        let totalGoalsTooltip = "Total verified goal events across campaigns and queues";

        if (outboundGoals !== null && inboundGoals !== null) {
            const combined = outboundGoals + inboundGoals;
            totalGoalsVal = formatNumber(combined);
            totalGoalsNote = "Outbound: " + formatNumber(outboundGoals) + " · Inbound: " + formatNumber(inboundGoals);
            totalGoalsTooltip = "Combined Goals: " + formatNumber(combined) + " (Outbound Campaigns: " + formatNumber(outboundGoals) + ", Inbound Queues: " + formatNumber(inboundGoals) + ")";
        } else if (outboundGoals !== null && inboundGoals === null) {
            totalGoalsVal = formatNumber(outboundGoals);
            totalGoalsNote = "PARTIAL · Outbound: " + formatNumber(outboundGoals) + " · Inbound: " + (inState === "WAITING" ? "connecting" : "unavailable");
            totalGoalsTooltip = "Partial Total: Outbound only (" + formatNumber(outboundGoals) + " goals). Inbound feed " + inState;
        } else if (outboundGoals === null && inboundGoals !== null) {
            totalGoalsVal = formatNumber(inboundGoals);
            totalGoalsNote = "PARTIAL · Outbound: unavailable · Inbound: " + formatNumber(inboundGoals);
            totalGoalsTooltip = "Partial Total: Inbound only (" + formatNumber(inboundGoals) + " goals). Outbound feed unavailable";
        }

        updateKpi("goals", totalGoalsVal, totalGoalsNote, totalGoalsTooltip);`;

const target2 = `        if (highestAbandonRate) {
            const rateTone = highestAbandonRate.rate >= 5 ? "critical" : highestAbandonRate.rate >= 2 ? "warning" : "good";
            setInsight("abandonRate", highestAbandonRate.rate.toFixed(1) + "%", highestAbandonRate.campaign.name, rateTone, rateTone === "critical" ? "CRITICAL" : rateTone === "warning" ? "WATCH" : "HEALTHY", "Highest abandon percentage from the feed, or derived from abandoned calls / attempts when the feed does not supply a percentage");
        } else {`;

const replacement2 = `        if (highestAbandonRate) {
            const rateTone = highestAbandonRate.rate >= 5 ? "critical" : highestAbandonRate.rate >= 2 ? "warning" : "good";
            const formattedRate = formatRatePercent(highestAbandonRate.campaign.__abandoned, highestAbandonRate.campaign.__outbound);
            setInsight("abandonRate", formattedRate, highestAbandonRate.campaign.name, rateTone, rateTone === "critical" ? "CRITICAL" : rateTone === "warning" ? "WATCH" : "HEALTHY", "Highest abandon percentage from the feed (2-decimal precision), or derived from abandoned calls / attempts");
        } else {`;

['East2', 'East3'].forEach(d => {
    ['src', 'dist/src'].forEach(sub => {
        const filePath = path.join(root, 'CT_Operations_Monitor_' + d, sub, 'dashboard.js');
        if (!fs.existsSync(filePath)) {
            console.error("Missing file:", filePath);
            return;
        }
        let code = fs.readFileSync(filePath, 'utf8');

        if (!code.includes(target1)) {
            console.error(`Target 1 not found in ${d}/${sub}/dashboard.js`);
        } else {
            code = code.replace(target1, replacement1);
            console.log(`Target 1 replaced successfully in ${d}/${sub}/dashboard.js`);
        }

        if (!code.includes(target2)) {
            console.error(`Target 2 not found in ${d}/${sub}/dashboard.js`);
        } else {
            code = code.replace(target2, replacement2);
            console.log(`Target 2 replaced successfully in ${d}/${sub}/dashboard.js`);
        }

        fs.writeFileSync(filePath, code, 'utf8');
    });
});

console.log("Goals repair successfully applied.");

