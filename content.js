console.log("CT Monitor v9");

function updateDashboard() {

    if (!window.CTParser) {
        console.log("Parser not loaded");
        return;
    }

    const campaigns = window.CTParser.readCampaigns();

    document.dispatchEvent(
        new CustomEvent("CT_UPDATE", {
            detail: campaigns
        })
    );

}

setInterval(updateDashboard, 3000);

updateDashboard();