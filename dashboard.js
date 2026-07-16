console.log("Dashboard Loaded");

const panel = document.createElement("div");

panel.style.position = "fixed";
panel.style.top = "20px";
panel.style.right = "20px";
panel.style.width = "340px";
panel.style.maxHeight = "90vh";
panel.style.overflowY = "auto";
panel.style.background = "#ffffff";
panel.style.padding = "15px";
panel.style.boxShadow = "0 0 15px rgba(0,0,0,.3)";
panel.style.zIndex = "999999";
panel.style.fontFamily = "Arial, sans-serif";
panel.style.fontSize = "13px";
panel.style.lineHeight = "1.4";

document.body.appendChild(panel);

function waitColor(wait) {
    const n = parseInt(wait) || 0;

    if (n >= 60) return "#d32f2f";
    if (n >= 30) return "#ff9800";

    return "#2e7d32";
}

document.addEventListener("CT_UPDATE", function (e) {

    const data = e.detail || [];

    let totalLoggedIn = 0;
    let highestWait = null;
    let highestAbandoned = null;

    data.forEach(c => {

        totalLoggedIn += parseInt(c.loggedIn || 0);

        if (!highestWait || Number(c.waitNow) > Number(highestWait.waitNow)) {
            highestWait = c;
        }

        // Extract ONLY the first number before the percentage
        const match = String(c.abandoned).match(/^\s*(\d+)/);
        const abandonedCount = match ? parseInt(match[1], 10) : 0;

        if (!highestAbandoned || abandonedCount > highestAbandoned.count) {
            highestAbandoned = {
                campaign: c,
                count: abandonedCount,
                display: c.abandoned
            };
        }

    });

    let html = "";

    html += "<h2 style='margin-top:0'>CT Operations Monitor</h2>";

    html += `
    <div style="margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #ddd;">
        <b>Campaigns :</b> ${data.length}<br>
        <b>Total Logged In :</b> ${totalLoggedIn}<br>
        <b>Highest Wait :</b> ${highestWait ? highestWait.name + " (" + highestWait.waitNow + "s)" : "-"}<br>
        <b>Highest Abandoned :</b> ${
            highestAbandoned
                ? highestAbandoned.campaign.name + " - " + highestAbandoned.display
                : "-"
        }
    </div>
    `;

    data.forEach(c => {

        html += `
        <div style="margin-bottom:18px;border:1px solid #ddd;border-radius:6px;padding:10px;">

            <div style="font-size:15px;font-weight:bold;margin-bottom:8px;">
                ${c.name}
            </div>

            <b>Campaign</b><br>
            Contacts : ${c.contacts}<br>
            Channels : ${c.channels}<br><br>

            <b>Wait</b><br>

            <span style="color:${waitColor(c.waitNow)};font-weight:bold;">
                Wait Now : ${c.waitNow}
            </span><br>

            Wait Today : ${c.waitToday}<br><br>

            <b>Calls</b><br>

            Outbound : ${c.outbound}<br>
            Human : ${c.human}<br>
            Machine : ${c.machine}<br>
            Agent Connect : ${c.agentConnect}<br>
            Abandoned : ${c.abandoned}<br>
            No Answer : ${c.noAnswer}<br>
            Busy : ${c.busy}<br>
            Failed : ${c.failed}<br><br>

            <b>Agents</b><br>

            Logged In : ${c.loggedIn}<br>
            Waiting : ${c.waiting}<br>
            On Call : ${c.onCall}<br>
            Post Call : ${c.postCall}

        </div>
        `;

    });

    panel.innerHTML = html;

});