// Lightweight, high-fidelity DOM tree mock for CallTools DOM parsing tests
class MockNode {
    constructor(tagName = "div", attrs = {}, text = "") {
        this.tagName = tagName.toUpperCase();
        this.className = attrs.class || "";
        this.attrs = Object.assign({}, attrs);
        this.children = [];
        this.parentElement = null;
        this._text = text;
        this.style = {};
        this.rect = { left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 };
    }

    get innerText() {
        if (this.children.length === 0) return this._text || "";
        return this.children.map(c => c.innerText).join(" ");
    }

    get textContent() {
        return this.innerText;
    }

    set innerText(val) {
        this._text = String(val);
        this.children = [];
    }

    set textContent(val) {
        this.innerText = val;
    }

    getAttribute(name) {
        if (name === "class") return this.className;
        return this.attrs[name] !== undefined ? this.attrs[name] : null;
    }

    setAttribute(name, val) {
        if (name === "class") this.className = String(val);
        this.attrs[name] = String(val);
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr.matches(selector)) return curr;
            curr = curr.parentElement;
        }
        return null;
    }

    matches(selector) {
        const parts = selector.split(",").map(s => s.trim());
        for (const part of parts) {
            if (mockNodeMatches(this, part)) return true;
        }
        return false;
    }

    getBoundingClientRect() {
        return this.rect;
    }

    querySelector(selector) {
        const results = this.querySelectorAll(selector);
        return results[0] || null;
    }

    querySelectorAll(selector) {
        const matched = [];
        const parts = selector.split(",").map(s => s.trim());

        function walk(node) {
            for (const child of node.children) {
                let isMatch = false;
                for (const part of parts) {
                    if (mockNodeMatches(child, part)) {
                        isMatch = true;
                        break;
                    }
                }
                if (isMatch) matched.push(child);
                walk(child);
            }
        }

        walk(this);
        return matched;
    }
}

function mockNodeMatches(node, sel) {
    sel = sel.trim();
    if (!sel) return false;
    const tag = (node.tagName || "").toLowerCase();
    const clsList = ((node.className || "") + " " + (node.getAttribute("class") || "")).toLowerCase().split(/\s+/).filter(Boolean);

    // Attribute or tag+attribute selector e.g. input[name='name'], [data-campaign-id], mat-select[formcontrolname*='filter' i]
    const cleanSel = sel.replace(/\s+i\]$/, "]");
    const attrMatch = cleanSel.match(/^([a-zA-Z0-9_\-.]*)\[([a-zA-Z0-9_\-]+)([\*\^\$]?=)?['"]?([^'"\]]*)['"]?\]$/);
    if (attrMatch) {
        const targetTag = attrMatch[1].toLowerCase();
        const attrName = attrMatch[2];
        const op = attrMatch[3] || "";
        const targetVal = attrMatch[4] || "";

        if (targetTag && targetTag !== tag && !clsList.includes(targetTag.replace(/^\./, ""))) return false;
        const nodeVal = node.getAttribute(attrName) || (node.attrs && node.attrs[attrName]) || (node[attrName] !== undefined ? node[attrName] : null);
        if (nodeVal === null || nodeVal === undefined) return false;
        const valStr = String(nodeVal);

        if (!op) return true;
        if (op === "=") return valStr.toLowerCase() === targetVal.toLowerCase();
        if (op === "*=") return valStr.toLowerCase().includes(targetVal.toLowerCase());
        if (op === "^=") return valStr.toLowerCase().startsWith(targetVal.toLowerCase());
        if (op === "$=") return valStr.toLowerCase().endsWith(targetVal.toLowerCase());
        return false;
    }

    const sLower = sel.toLowerCase();
    if (sLower === tag) return true;
    if (sLower === "table" && (tag === "table" || tag === "mat-table")) return true;
    if (sLower === "mat-table" && tag === "mat-table") return true;
    if (sLower === "tr" && tag === "tr") return true;
    if (sLower === "th" && tag === "th") return true;
    if (sLower === "td" && tag === "td") return true;
    if (sLower === "thead tr" && tag === "tr" && node.parentElement && node.parentElement.tagName === "THEAD") return true;
    if (sLower === "tbody tr" && tag === "tr" && node.parentElement && node.parentElement.tagName === "TBODY") return true;
    if (sLower.startsWith(".") && clsList.includes(sLower.slice(1))) return true;
    if (sLower.includes(".")) {
        const parts = sLower.split(".");
        if (parts[0] && parts[0] !== tag) return false;
        return clsList.includes(parts[1]);
    }
    return false;
}

function createCallToolsQueuesDOM(data = []) {
    const document = new MockNode("document");
    const table = new MockNode("table", { class: "mat-table cdk-table" });
    document.appendChild(table);

    const thead = new MockNode("thead");
    table.appendChild(thead);

    // Group Header Row (Tier 1)
    const groupRow = new MockNode("tr", { class: "mat-header-row group-header-row" });
    thead.appendChild(groupRow);
    const groups = [
        { text: "Queue", colspan: 1 },
        { text: "Calls (Today)", colspan: 5 },
        { text: "Agents (Now)", colspan: 2 },
        { text: "Calls (Now)", colspan: 3 },
        { text: "Wait Time (Now)", colspan: 2 },
        { text: "Outcomes (Today)", colspan: 3 }
    ];
    for (const g of groups) {
        groupRow.appendChild(new MockNode("th", { colspan: String(g.colspan) }, g.text));
    }

    // Leaf Header Row (Tier 2)
    const leafRow = new MockNode("tr", { class: "mat-header-row mat-mdc-header-row" });
    thead.appendChild(leafRow);

    const leafHeaders = [
        { label: "Name", cls: "cdk-column-name", left: 0, width: 120 },
        { label: "Total", cls: "cdk-column-calls_today_total", left: 120, width: 60 },
        { label: "Answered", cls: "cdk-column-calls_today_answered", left: 180, width: 60 },
        { label: "Not Answered", cls: "cdk-column-calls_today_not_answered", left: 240, width: 70 },
        { label: "Inbound Machine", cls: "cdk-column-inbound_machine", left: 310, width: 70 },
        { label: "Inbound No Answer", cls: "cdk-column-inbound_no_answer", left: 380, width: 70 },
        { label: "Logged In", cls: "cdk-column-logged_in", left: 450, width: 60 },
        { label: "On Queue Calls", cls: "cdk-column-on_queue_calls", left: 510, width: 60 },
        { label: "Total", cls: "cdk-column-calls_now_total", left: 570, width: 60 },
        { label: "Waiting", cls: "cdk-column-calls_now_waiting", left: 630, width: 60 },
        { label: "Answered", cls: "cdk-column-calls_now_answered", left: 690, width: 60 },
        { label: "Average", cls: "cdk-column-wait_average", left: 750, width: 60 },
        { label: "Max", cls: "cdk-column-wait_max", left: 810, width: 60 },
        { label: "Calendar Events", cls: "cdk-column-calendar_events", left: 870, width: 70 },
        { label: "Opportunities", cls: "cdk-column-opportunities", left: 940, width: 70 },
        { label: "Goals", cls: "cdk-column-goals", left: 1010, width: 60 }
    ];

    leafHeaders.forEach(h => {
        const th = new MockNode("th", { class: "mat-header-cell " + h.cls }, h.label);
        th.rect = { left: h.left, width: h.width, right: h.left + h.width };
        leafRow.appendChild(th);
    });

    const tbody = new MockNode("tbody");
    table.appendChild(tbody);

    data.forEach((q, idx) => {
        const tr = new MockNode("tr", {
            class: "mat-row mat-mdc-row",
            "data-queue-id": q.id || ("queue-" + idx),
            "data-id": q.id || ("queue-" + idx)
        });
        tbody.appendChild(tr);

        const values = [
            { cls: "cdk-column-name", val: q.name, left: 0, width: 120 },
            { cls: "cdk-column-calls_today_total", val: q.callsTodayTotal, left: 120, width: 60 },
            { cls: "cdk-column-calls_today_answered", val: q.callsTodayAnswered, left: 180, width: 60 },
            { cls: "cdk-column-calls_today_not_answered", val: q.callsTodayNotAnswered, left: 240, width: 70 },
            { cls: "cdk-column-inbound_machine", val: q.inboundMachine, left: 310, width: 70 },
            { cls: "cdk-column-inbound_no_answer", val: q.inboundNoAnswer, left: 380, width: 70 },
            { cls: "cdk-column-logged_in", val: q.loggedIn, left: 450, width: 60 },
            { cls: "cdk-column-on_queue_calls", val: q.onQueueCalls, left: 510, width: 60 },
            { cls: "cdk-column-calls_now_total", val: q.callsNowTotal, left: 570, width: 60 },
            { cls: "cdk-column-calls_now_waiting", val: q.waiting, left: 630, width: 60 },
            { cls: "cdk-column-calls_now_answered", val: q.callsNowAnswered, left: 690, width: 60 },
            { cls: "cdk-column-wait_average", val: q.waitAverage, left: 750, width: 60 },
            { cls: "cdk-column-wait_max", val: q.waitMax, left: 810, width: 60 },
            { cls: "cdk-column-calendar_events", val: q.calendarEvents, left: 870, width: 70 },
            { cls: "cdk-column-opportunities", val: q.opportunities, left: 940, width: 70 },
            { cls: "cdk-column-goals", val: q.goals, left: 1010, width: 60 }
        ];

        values.forEach(v => {
            const td = new MockNode("td", { class: "mat-cell mat-mdc-cell " + v.cls }, String(v.val ?? ""));
            td.rect = { left: v.left, width: v.width, right: v.left + v.width };
            tr.appendChild(td);
        });
    });

    return { document, table, thead, tbody };
}

function createCallToolsCampaignsDOM(data = []) {
    const document = new MockNode("document");
    const table = new MockNode("table", { class: "mat-table cdk-table" });
    document.appendChild(table);

    const thead = new MockNode("thead");
    table.appendChild(thead);

    // Group Header Row (Tier 1) - matches live CallTools Campaigns structure
    const groupRow = new MockNode("tr", { class: "mat-header-row group-header-row" });
    thead.appendChild(groupRow);
    const groups = [
        { text: "Contact", colspan: 1 },
        { text: "Logs", colspan: 1 },
        { text: "Channels", colspan: 1 },
        { text: "Agent Wait Time (Seconds)", colspan: 3 },
        { text: "Calls (Today)", colspan: 12 },
        { text: "SMS", colspan: 2 },
        { text: "Email", colspan: 1 },
        { text: "Controls", colspan: 1 }
    ];
    for (const g of groups) {
        groupRow.appendChild(new MockNode("th", { colspan: String(g.colspan) }, g.text));
    }

    // Leaf Header Row (Tier 2) - exact 23 leaf columns as observed in live CallTools
    const leafRow = new MockNode("tr", { class: "mat-header-row mat-mdc-header-row" });
    thead.appendChild(leafRow);

    const leafHeaders = [
        { label: "Name", cls: "cdk-column-name", left: 0, width: 140 },
        { label: "Active", cls: "cdk-column-active", left: 140, width: 60 },
        { label: "Total", cls: "cdk-column-contact_count", left: 200, width: 70 },
        { label: "Per Agent", cls: "cdk-column-channels", left: 270, width: 60 },
        { label: "Now", cls: "cdk-column-wait_now", left: 330, width: 60 },
        { label: "Today", cls: "cdk-column-wait_today", left: 390, width: 60 },
        { label: "Total", cls: "cdk-column-wait_total", left: 450, width: 60 },
        { label: "Total", cls: "cdk-column-outbound", left: 510, width: 70 },
        { label: "Human", cls: "cdk-column-human", left: 580, width: 60 },
        { label: "Machine", cls: "cdk-column-machine", left: 640, width: 70 },
        { label: "To Agents", cls: "cdk-column-agent_connect", left: 710, width: 70 },
        { label: "Abandoned", cls: "cdk-column-abandoned", left: 780, width: 80 },
        { label: "No Ans", cls: "cdk-column-no_answer", left: 860, width: 60 },
        { label: "Busy", cls: "cdk-column-busy", left: 920, width: 60 },
        { label: "Failed", cls: "cdk-column-failed", left: 980, width: 60 },
        { label: "<1min", cls: "cdk-column-wait_bucket_1", left: 1040, width: 50 },
        { label: "<2min", cls: "cdk-column-wait_bucket_2", left: 1090, width: 50 },
        { label: ">3min", cls: "cdk-column-wait_bucket_3", left: 1140, width: 50 },
        { label: ">5min", cls: "cdk-column-wait_bucket_4", left: 1190, width: 50 },
        { label: "Sent", cls: "cdk-column-sms_sent", left: 1240, width: 50 },
        { label: "Received", cls: "cdk-column-sms_received", left: 1290, width: 50 },
        { label: "Sent", cls: "cdk-column-email_sent", left: 1340, width: 50 },
        { label: "Controls", cls: "cdk-column-controls", left: 1390, width: 80 }
    ];

    leafHeaders.forEach(h => {
        const th = new MockNode("th", { class: "mat-header-cell " + h.cls }, h.label);
        th.rect = { left: h.left, width: h.width, right: h.left + h.width };
        leafRow.appendChild(th);
    });

    const tbody = new MockNode("tbody");
    table.appendChild(tbody);

    data.forEach((c, idx) => {
        const tr = new MockNode("tr", {
            class: "mat-row mat-mdc-row",
            "data-campaign-id": c.id || ("campaign-" + idx),
            "data-id": c.id || ("campaign-" + idx)
        });
        tbody.appendChild(tr);

        const values = [
            { cls: "cdk-column-name", val: c.name, left: 0, width: 140 },
            { cls: "cdk-column-active", val: c.active === true ? "active" : "inactive", left: 140, width: 60 },
            { cls: "cdk-column-contact_count", val: c.contacts, left: 200, width: 70 },
            { cls: "cdk-column-channels", val: c.channels, left: 270, width: 60 },
            { cls: "cdk-column-wait_now", val: c.waitNow, left: 330, width: 60 },
            { cls: "cdk-column-wait_today", val: c.waitToday, left: 390, width: 60 },
            { cls: "cdk-column-wait_total", val: c.waitTotal, left: 450, width: 60 },
            { cls: "cdk-column-outbound", val: c.outbound, left: 510, width: 70 },
            { cls: "cdk-column-human", val: c.human, left: 580, width: 60 },
            { cls: "cdk-column-machine", val: c.machine, left: 640, width: 70 },
            { cls: "cdk-column-agent_connect", val: c.agentConnect, left: 710, width: 70 },
            { cls: "cdk-column-abandoned", val: c.abandoned, left: 780, width: 80 },
            { cls: "cdk-column-no_answer", val: c.noAnswer, left: 860, width: 60 },
            { cls: "cdk-column-busy", val: c.busy, left: 920, width: 60 },
            { cls: "cdk-column-failed", val: c.failed, left: 980, width: 60 },
            { cls: "cdk-column-wait_bucket_1", val: c.waitBucket1 || "0", left: 1040, width: 50 },
            { cls: "cdk-column-wait_bucket_2", val: c.waitBucket2 || "0", left: 1090, width: 50 },
            { cls: "cdk-column-wait_bucket_3", val: c.waitBucket3 || "0", left: 1140, width: 50 },
            { cls: "cdk-column-wait_bucket_4", val: c.waitBucket4 || "0", left: 1190, width: 50 },
            { cls: "cdk-column-sms_sent", val: c.smsSent || "0", left: 1240, width: 50 },
            { cls: "cdk-column-sms_received", val: c.smsReceived || "0", left: 1290, width: 50 },
            { cls: "cdk-column-email_sent", val: c.emailSent || "0", left: 1340, width: 50 },
            { cls: "cdk-column-controls", val: "", left: 1390, width: 80 }
        ];

        values.forEach(v => {
            const td = new MockNode("td", { class: "mat-cell mat-mdc-cell " + v.cls }, String(v.val ?? ""));
            td.rect = { left: v.left, width: v.width, right: v.left + v.width };
            tr.appendChild(td);
        });
    });

    return { document, table, thead, tbody };
}

function createCallToolsCampaignEditDOM(campaignId = "101", campaignName = "TS FRESH DATA", liveFilterName = "TS FRESH DATA Filter", options = {}) {
    const document = new MockNode("document");
    const form = new MockNode("form", { class: "campaign-edit-form", "data-campaign-id": String(campaignId) });
    document.appendChild(form);

    const nameInput = new MockNode("input", { name: "name", formcontrolname: "name", value: campaignName });
    form.appendChild(nameInput);

    const targetingSection = new MockNode("div", { class: "targeting-section form-group" });
    form.appendChild(targetingSection);

    const label = new MockNode("label", { class: "form-label" }, "Live Filter");
    targetingSection.appendChild(label);

    if (options.useNativeSelect) {
        const select = new MockNode("select", { name: "live_filter", formcontrolname: "live_filter" });
        const opt = new MockNode("option", { selected: "true", value: liveFilterName }, liveFilterName);
        select.appendChild(opt);
        select.selectedIndex = 0;
        select.options = [opt];
        targetingSection.appendChild(select);
    } else {
        const matSelect = new MockNode("mat-select", { formcontrolname: "live_filter", "aria-label": "Live Filter" });
        const valText = new MockNode("span", { class: "mat-select-value-text" }, liveFilterName || "None");
        matSelect.appendChild(valText);
        targetingSection.appendChild(matSelect);
    }

    document.document = document;
    document.form = form;
    return document;
}

function createCallToolsLiveFiltersDOM(filters = []) {
    const document = new MockNode("document");
    const table = new MockNode("table", { class: "mat-table mat-mdc-table cdk-table live-filters-table" });
    document.appendChild(table);

    const thead = new MockNode("thead");
    table.appendChild(thead);
    const headerRow = new MockNode("tr", { class: "mat-header-row mat-mdc-header-row" });
    thead.appendChild(headerRow);
    ["name", "active", "count", "total-count", "logs", "controls"].forEach(c => {
        headerRow.appendChild(new MockNode("th", { class: "mat-header-cell cdk-column-" + c }, c.toUpperCase()));
    });

    const tbody = new MockNode("tbody");
    table.appendChild(tbody);

    filters.forEach((f, idx) => {
        const tr = new MockNode("tr", {
            class: "mat-row mat-mdc-row",
            "data-id": String(f.id || `filter-${idx}`)
        });
        tbody.appendChild(tr);

        // Name cell with link
        const tdName = new MockNode("td", { class: "mat-cell cdk-column-name" });
        const nameLink = new MockNode("a", { href: `/manager/live-filters/edit/${f.id || idx}` }, f.name || `Filter ${idx}`);
        tdName.appendChild(nameLink);
        tr.appendChild(tdName);

        // Active cell
        const tdActive = new MockNode("td", { class: "mat-cell cdk-column-active" });
        if (f.activeToggle) {
            const toggle = new MockNode("mat-slide-toggle", { class: f.active ? "mat-checked" : "" });
            toggle.setAttribute("aria-checked", f.active ? "true" : "false");
            tdActive.appendChild(toggle);
        } else {
            tdActive.innerText = f.active === false ? "Inactive" : "Active";
        }
        tr.appendChild(tdActive);

        // Count cell
        const tdCount = new MockNode("td", { class: "mat-cell cdk-column-count" }, String(f.count ?? 0));
        tr.appendChild(tdCount);

        // Total count cell
        const tdTotal = new MockNode("td", { class: "mat-cell cdk-column-total-count" }, String(f.totalCount ?? f.count ?? 0));
        tr.appendChild(tdTotal);

        // Logs cell
        const tdLogs = new MockNode("td", { class: "mat-cell cdk-column-logs" });
        tdLogs.appendChild(new MockNode("button", {}, "View Change Log"));
        tr.appendChild(tdLogs);

        // Controls cell
        const tdControls = new MockNode("td", { class: "mat-cell cdk-column-controls" });
        tr.appendChild(tdControls);
    });

    return { document, table, tbody };
}

module.exports = {
    MockNode,
    createCallToolsQueuesDOM,
    createCallToolsCampaignsDOM,
    createCallToolsCampaignEditDOM,
    createCallToolsLiveFiltersDOM
};
