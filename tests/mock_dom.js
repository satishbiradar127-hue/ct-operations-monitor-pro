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
        const parts = selector.split(",").map(s => s.trim().toLowerCase());
        const tag = this.tagName.toLowerCase();
        const clsList = (this.className || "").toLowerCase().split(/\s+/).filter(Boolean);
        for (const part of parts) {
            if (part === tag) return true;
            if (part.startsWith(".") && clsList.includes(part.slice(1))) return true;
            if (part.startsWith("[role=") && this.getAttribute("role") === part.slice(7, -2)) return true;
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
        const parts = selector.split(",").map(s => s.trim().toLowerCase());

        function walk(node) {
            for (const child of node.children) {
                const tag = child.tagName.toLowerCase();
                const clsList = (child.className || "").toLowerCase().split(/\s+/).filter(Boolean);

                let isMatch = false;
                for (const part of parts) {
                    if (part === "table" && (tag === "table" || tag === "mat-table")) isMatch = true;
                    else if (part === "mat-table" && tag === "mat-table") isMatch = true;
                    else if (part === "tr" && tag === "tr") isMatch = true;
                    else if (part === "thead tr" && tag === "tr" && child.parentElement && child.parentElement.tagName === "THEAD") isMatch = true;
                    else if (part === "tbody tr" && tag === "tr" && child.parentElement && child.parentElement.tagName === "TBODY") isMatch = true;
                    else if (part === "tr.mat-row" && tag === "tr" && clsList.includes("mat-row")) isMatch = true;
                    else if (part === "tr.mat-mdc-row" && tag === "tr" && clsList.includes("mat-mdc-row")) isMatch = true;
                    else if (part === "tr.mat-header-row" && tag === "tr" && clsList.includes("mat-header-row")) isMatch = true;
                    else if (part === "tr.mat-mdc-header-row" && tag === "tr" && clsList.includes("mat-mdc-header-row")) isMatch = true;
                    else if (part === "th" && tag === "th") isMatch = true;
                    else if (part === "td" && tag === "td") isMatch = true;
                    else if (part === "td.mat-cell" && tag === "td" && clsList.includes("mat-cell")) isMatch = true;
                    else if (part === "td.mat-mdc-cell" && tag === "td" && clsList.includes("mat-mdc-cell")) isMatch = true;
                    else if (part === '[role="columnheader"]' && child.getAttribute("role") === "columnheader") isMatch = true;
                    else if (part === '[role="cell"]' && child.getAttribute("role") === "cell") isMatch = true;
                    else if (part === '[role="row"]' && child.getAttribute("role") === "row") isMatch = true;
                    else if (part.startsWith(".") && clsList.includes(part.slice(1))) isMatch = true;
                    else if (part.startsWith('[class*="') && child.className.includes(part.slice(9, -2))) isMatch = true;
                }

                if (isMatch) matched.push(child);
                walk(child);
            }
        }

        walk(this);
        return matched;
    }
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

module.exports = {
    MockNode,
    createCallToolsQueuesDOM
};
