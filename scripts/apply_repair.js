/**
 * apply_repair.js
 * 
 * Applies the live feed recovery, zero-click observer-only refresh, and 6-state machine
 * repairs to East-2 and East-3 source trees.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');

const dialers = [
    {
        name: 'East2',
        titleTag: 'EAST-2',
        dialerName: 'East-2',
        prefix: 'CT_EAST_2_',
        updateEvent: 'CT_EAST_2_UPDATE',
        feedStatusEvent: 'CT_EAST_2_FEED_STATUS',
        requestRefreshEvent: 'CT_EAST_2_REQUEST_REFRESH',
        requestInboundRefreshEvent: 'CT_EAST_2_REQUEST_INBOUND_REFRESH',
        refreshInboundMsg: 'CT_EAST_2_REFRESH_INBOUND_FEED',
        host: 'east-2.calltools.io',
        storagePrefix: 'ct_east2_'
    },
    {
        name: 'East3',
        titleTag: 'EAST-3',
        dialerName: 'East-3',
        prefix: 'CT_EAST_3_',
        updateEvent: 'CT_EAST_3_UPDATE',
        feedStatusEvent: 'CT_EAST_3_FEED_STATUS',
        requestRefreshEvent: 'CT_EAST_3_REQUEST_REFRESH',
        requestInboundRefreshEvent: 'CT_EAST_3_REQUEST_INBOUND_REFRESH',
        refreshInboundMsg: 'CT_EAST_3_REFRESH_INBOUND_FEED',
        host: 'east-3.calltools.io',
        storagePrefix: 'ct_east3_'
    }
];

function repairContent(cfg) {
    const dir = path.join(root, 'CT_Operations_Monitor_' + cfg.name);
    const contentPath = path.join(dir, 'src', 'content.js');
    let code = fs.readFileSync(contentPath, 'utf8');

    console.log(`Repairing content.js for ${cfg.name}...`);

    // Replace bottom listeners block from "if (typeof chrome !== "undefined"" to "init();"
    const bottomListenersRegex = /if \(typeof chrome !== "undefined"[\s\S]*?init\(\);/;
    const newBottomListeners = `if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (!message || message.type !== "${cfg.refreshInboundMsg}" || !isQueuesPage()) return;
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
        });
    }

    window.addEventListener("message", function (event) {
        if (!isInboundMonitorFrame() || event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== "${cfg.refreshInboundMsg}") return;
        lastSourceRefreshAt = Date.now();
        publishFeedStatus("VERIFYING", { reason: "Inbound feed re-check requested from Operations Monitor", route: "queues" });
        readAndPublish("manual-inbound-refresh-check", true);
    });

    document.addEventListener("${cfg.requestInboundRefreshEvent}", function () {
        if (isQueuesPage()) {
            lastSourceRefreshAt = Date.now();
            publishFeedStatus("VERIFYING", { reason: "Manual inbound feed re-check requested", route: "queues" });
            readAndPublish("manual-inbound-refresh-check", true);
            return;
        }
        requestInboundIframeRefresh();
    });

    document.addEventListener("${cfg.requestRefreshEvent}", function () {
        lastSourceRefreshAt = Date.now();
        if (isQueuesPage()) {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            return;
        }
        publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
        readAndPublish("manual-campaign-refresh", true);
    });

    init();`;

    if (bottomListenersRegex.test(code)) {
        code = code.replace(bottomListenersRegex, newBottomListeners);
    } else {
        console.warn(`Could not find bottom listeners block in ${cfg.name}`);
    }

    // Verify 0 occurrences of .click( in code
    const clickMatches = code.match(/\.click\s*\(/g);
    if (clickMatches) {
        console.error(`ERROR: ${clickMatches.length} .click() calls remain in content.js for ${cfg.name}!`);
    } else {
        console.log(`VERIFIED: 0 .click() calls in content.js for ${cfg.name}.`);
    }

    fs.writeFileSync(contentPath, code, 'utf8');
    fs.writeFileSync(path.join(dir, 'dist', 'src', 'content.js'), code, 'utf8');
    console.log(`Saved content.js to src and dist for ${cfg.name}.`);
}

dialers.forEach(repairContent);
