console.log("Parser Loaded");

window.CTParser = {

    // Read text from a table cell
    get(cls, row) {

        const cell = row.querySelector("." + cls);

        if (!cell) {
            return "";
        }

        // Special handling for Channels dropdown
        const select = cell.querySelector("select");
        if (select) {
            return select.value.trim();
        }

        return cell.innerText.replace(/\s+/g, " ").trim();

    },

    readCampaigns() {

        const rows = document.querySelectorAll("tr.mat-row");

        if (!rows.length) {
            return [];
        }

        const campaigns = [];

        rows.forEach(row => {

            campaigns.push({

                // Campaign Information
                name: this.get("cdk-column-campaign__name", row),
                contacts: this.get("cdk-column-total_saved_contact_count", row),
                channels: this.get("cdk-column-campaign__channels_per_agent", row),

                // Wait Metrics
                waitNow: this.get("cdk-column-cached_now_avg_wait_time", row),
                waitToday: this.get("cdk-column-recent_avg_wait_time", row),

                // Outbound Metrics
                outbound: this.get("cdk-column-calls_outbound", row),
                human: this.get("cdk-column-calls_outbound_human", row),
                machine: this.get("cdk-column-calls_outbound_machine", row),
                agentConnect: this.get("cdk-column-calls_outbound_agent_connect", row),
                abandoned: this.get("cdk-column-calls_outbound_abandoned", row),
                noAnswer: this.get("cdk-column-calls_outbound_noanswer", row),
                busy: this.get("cdk-column-calls_outbound_busy", row),
                failed: this.get("cdk-column-calls_outbound_failed", row),

                // Agent Status
                loggedIn: this.get("cdk-column-cached_logged_in_agents", row),
                waiting: this.get("cdk-column-cached_waiting_agents", row),
                onCall: this.get("cdk-column-cached_phone_call_agents", row),
                postCall: this.get("cdk-column-cached_post_call_wrap_up_agents", row)

            });

        });

        return campaigns;

    }

};