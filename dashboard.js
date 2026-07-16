console.log("Dashboard Loaded");

const panel = document.createElement("div");
panel.id = "ct-operations-monitor-panel";

panel.style.position = "fixed";
panel.style.top = "20px";
panel.style.right = "20px";
panel.style.width = "360px";
panel.style.maxHeight = "92vh";
panel.style.overflowY = "auto";
panel.style.background = "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)";
panel.style.border = "1px solid #e2e8f0";
panel.style.borderRadius = "14px";
panel.style.padding = "16px";
panel.style.boxShadow = "0 18px 45px rgba(15, 23, 42, 0.18)";
panel.style.zIndex = "999999";
panel.style.fontFamily = "Inter, Arial, sans-serif";
panel.style.fontSize = "13px";
panel.style.lineHeight = "1.45";
panel.style.color = "#0f172a";

if (document.body) {
    document.body.appendChild(panel);
}

function waitColor(wait) {
    const n = parseInt(wait, 10) || 0;

    if (n >= 60) return "#dc2626";
    if (n >= 30) return "#f59e0b";

    return "#16a34a";
}

function safeNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function formatValue(value, fallback = "-") {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }

    return value;
}

document.addEventListener("CT_UPDATE", function (e) {

    const detail = e && e.detail;
    const data = Array.isArray(detail) ? detail : (detail ? [detail] : []);

    let totalLoggedIn = 0;
    let highestWait = null;
    let highestAbandoned = null;

    data.forEach(c => {
        const campaign = c || {};

        totalLoggedIn += safeNumber(campaign.loggedIn);

        if (!highestWait || safeNumber(campaign.waitNow) > safeNumber(highestWait.waitNow)) {
            highestWait = campaign;
        }

        const match = String(campaign.abandoned || "").match(/^\s*(\d+)/);
        const abandonedCount = match ? parseInt(match[1], 10) : 0;

        if (!highestAbandoned || abandonedCount > highestAbandoned.count) {
            highestAbandoned = {
                campaign: campaign,
                count: abandonedCount,
                display: formatValue(campaign.abandoned, "-")
            };
        }
    });

    let html = "";

    html += `
    <div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:16px;font-weight:700;color:#0f172a;">CT Operations Monitor</div>
            <div style="font-size:11px;font-weight:600;padding:4px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;">
                Live
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Campaigns</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px;">${data.length}</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Logged In</div>
                <div style="font-size:16px;font-weight:700;margin-top:2px;">${totalLoggedIn}</div>
            </div>
        </div>
    </div>
    `;

    html += `
    <div style="margin-bottom:14px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
        <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Key Insights</div>
        <div style="font-size:12px;color:#334155;line-height:1.6;">
            <div><b>Highest Wait:</b> ${highestWait ? highestWait.name + " (" + highestWait.waitNow + "s)" : "-"}</div>
            <div><b>Highest Abandoned:</b> ${highestAbandoned ? highestAbandoned.campaign.name + " - " + highestAbandoned.display : "-"}</div>
        </div>
    </div>
    `;

    if (!data.length) {
        html += `
        <div style="padding:18px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#64748b;background:#f8fafc;">
            Waiting for CallTools data...
        </div>
        `;
        panel.innerHTML = html;
        return;
    }

    data.forEach(c => {
        const campaign = c || {};
        const waitNow = safeNumber(campaign.waitNow);
        const loggedIn = safeNumber(campaign.loggedIn);
        const waiting = safeNumber(campaign.waiting);
        const onCall = safeNumber(campaign.onCall);
        const postCall = safeNumber(campaign.postCall);

        html += `
        <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#ffffff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:700;color:#0f172a;">${formatValue(campaign.name, "Unnamed Campaign")}</div>
                <div style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:${waitColor(waitNow)}20;color:${waitColor(waitNow)};">
                    ${waitNow}s
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Contacts</div>
                    <div style="font-size:13px;font-weight:700;margin-top:2px;">${formatValue(campaign.contacts, "0")}</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Channels</div>
                    <div style="font-size:13px;font-weight:700;margin-top:2px;">${formatValue(campaign.channels, "0")}</div>
                </div>
            </div>

            <div style="margin-bottom:8px;">
                <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:5px;">Wait</div>
                <div style="font-size:12px;color:#334155;">
                    <span style="color:${waitColor(waitNow)};font-weight:700;">Wait Now : ${formatValue(campaign.waitNow, "0")}</span><br>
                    Wait Today : ${formatValue(campaign.waitToday, "0")}
                </div>
            </div>

            <div style="margin-bottom:8px;">
                <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:5px;">Calls</div>
                <div style="font-size:12px;color:#334155;line-height:1.6;">
                    Outbound : ${formatValue(campaign.outbound, "0")}<br>
                    Human : ${formatValue(campaign.human, "0")}<br>
                    Machine : ${formatValue(campaign.machine, "0")}<br>
                    Agent Connect : ${formatValue(campaign.agentConnect, "0")}<br>
                    Abandoned : ${formatValue(campaign.abandoned, "0")}<br>
                    No Answer : ${formatValue(campaign.noAnswer, "0")}<br>
                    Busy : ${formatValue(campaign.busy, "0")}<br>
                    Failed : ${formatValue(campaign.failed, "0")}
                </div>
            </div>

            <div>
                <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:5px;">Agents</div>
                <div style="font-size:12px;color:#334155;line-height:1.6;">
                    Logged In : ${loggedIn}<br>
                    Waiting : ${waiting}<br>
                    On Call : ${onCall}<br>
                    Post Call : ${postCall}
                </div>
            </div>
        </div>
        `;
    });

    panel.innerHTML = html;

});