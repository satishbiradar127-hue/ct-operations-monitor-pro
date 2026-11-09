content_js_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/content.js"
with open(content_js_path, "r", encoding="utf-8") as f:
    code = f.read()

old_refresh = """        if (route === "campaigns") {
            publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
            readAndPublish("manual-campaign-refresh", true);
            const campaigns = window.CTParser && window.CTParser.readCampaigns ? window.CTParser.readCampaigns() : [];
            recordsRead = campaigns.length;
            unavailableSources = ["/manager/live-filters"];
        } else if (route === "live_filters") {
            observeLiveFiltersPage();
            const filters = window.CTParser && window.CTParser.readLiveFilters ? window.CTParser.readLiveFilters(document) : [];
            recordsRead = filters.length;
            unavailableSources = ["/manager/campaigns"];
        } else if (route === "queues") {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            const queues = window.CTParser && window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            recordsRead = queues.length;
            unavailableSources = ["/manager/campaigns", "/manager/live-filters"];
        } else {
            result = "PARTIAL";
            failureReason = "Current page (" + route + ") does not contain primary operational tables";
            unavailableSources = ["/manager/campaigns", "/manager/live-filters", "/manager/queues"];
        }

        const detail = {
            requestAt: now,
            completedAt: Date.now(),
            source: route,
            result: result,
            recordsRead: recordsRead,
            failureReason: failureReason,
            unavailableSources: unavailableSources
        };"""

new_refresh = """        const sourceDetails = {};
        if (route === "campaigns") {
            publishFeedStatus("VERIFYING", { reason: "Manual campaign feed re-check requested", route: "campaigns" });
            readAndPublish("manual-campaign-refresh", true);
            const campaigns = window.CTParser && window.CTParser.readCampaigns ? window.CTParser.readCampaigns() : [];
            recordsRead = campaigns.length;
            sourceDetails.campaigns = { status: campaigns.length > 0 ? "SUCCESS" : "EMPTY", count: campaigns.length, timestamp: now };
            unavailableSources = ["Live Filter Inventory (requires navigation to /manager/live-filters)"];

            // Also refresh Inbound feed if iframe bridge is embedded on page
            const inboundFrame = document.querySelector("#ct-inbound-bridge, iframe[data-ct-inbound]");
            if (inboundFrame && inboundFrame.contentWindow) {
                try {
                    inboundFrame.contentWindow.postMessage({ type: "CT_EAST_2_REFRESH_INBOUND_FEED" }, window.location.origin);
                    sourceDetails.inboundBridge = "REFRESH_DISPATCHED";
                } catch (e) {}
            }
        } else if (route === "live_filters") {
            observeLiveFiltersPage();
            const filters = window.CTParser && window.CTParser.readLiveFilters ? window.CTParser.readLiveFilters(document) : [];
            recordsRead = filters.length;
            sourceDetails.liveFilters = { status: filters.length > 0 ? "SUCCESS" : "EMPTY", count: filters.length, timestamp: now };
            unavailableSources = ["Campaigns Table (requires navigation to /manager/campaigns)"];
        } else if (route === "queues") {
            publishFeedStatus("VERIFYING", { reason: "Manual queue feed re-check requested", route: "queues" });
            readAndPublish("manual-queue-refresh-check", true);
            const queues = window.CTParser && window.CTParser.readQueues ? window.CTParser.readQueues() : [];
            recordsRead = queues.length;
            sourceDetails.queues = { status: queues.length > 0 ? "SUCCESS" : "EMPTY", count: queues.length, timestamp: now };
            unavailableSources = ["Campaigns Table (requires navigation to /manager/campaigns)", "Live Filter Inventory (requires navigation to /manager/live-filters)"];
        } else {
            result = "PARTIAL";
            failureReason = "Current page (" + route + ") does not contain primary operational tables";
            unavailableSources = ["Campaigns Table", "Live Filter Inventory", "Queues Table"];
        }

        const detail = {
            requestAt: now,
            completedAt: Date.now(),
            source: route,
            result: result,
            recordsRead: recordsRead,
            failureReason: failureReason,
            unavailableSources: unavailableSources,
            sourceDetails: sourceDetails
        };"""

assert old_refresh in code, "old_refresh not found in content.js"
code = code.replace(old_refresh, new_refresh)

with open(content_js_path, "w", encoding="utf-8") as f:
    f.write(code)
print("Updated content.js refresh handler successfully!")

