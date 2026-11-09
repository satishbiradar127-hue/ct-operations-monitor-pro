import re

dashboard_js_path = "CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js"
with open(dashboard_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update campaignId on line 7172
old_campaignId = """    function campaignId(campaign, index) {
        const name = String(campaign.name || "").trim();

        return name ? name.toLowerCase() : "campaign-" + index;
    }"""

new_campaignId = """    function isCampaignSelected(campaign, selectedSet, index) {
        if (!campaign || !selectedSet || !(selectedSet instanceof Set) || selectedSet.size === 0) return false;
        if (campaign.rawId && selectedSet.has(String(campaign.rawId).trim())) return true;
        if (campaign.id && selectedSet.has(String(campaign.id).trim())) return true;
        if (campaign.__id && selectedSet.has(String(campaign.__id).trim())) return true;
        const name = String(campaign.name || "").trim().toLowerCase();
        if (name && selectedSet.has(name)) return true;
        if (typeof index === "number" && selectedSet.has("campaign-" + index)) return true;
        return false;
    }

    function campaignId(campaign, index) {
        if (campaign) {
            const rawId = campaign.rawId || campaign.id;
            if (rawId && String(rawId).trim()) {
                return String(rawId).trim();
            }
            if (campaign.__id && String(campaign.__id).trim()) {
                return String(campaign.__id).trim();
            }
            const name = String(campaign.name || "").trim();
            if (name) {
                return name.toLowerCase();
            }
        }
        return typeof index === "number" ? ("campaign-" + index) : "campaign-unknown";
    }"""

assert old_campaignId in code, "old_campaignId not found"
code = code.replace(old_campaignId, new_campaignId)
print("Updated campaignId and added isCampaignSelected")

# 2. Update selectedOperatingCampaigns
old_sel_op = """    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        // Keep the user's operating selection visible even if a selected campaign
        // becomes inactive. Metrics remain source-backed and the status shows it.
        return campaigns.filter(function (c, i) {
            return ids.has(c.__id || campaignId(c, i));
        });
    }"""

new_sel_op = """    function selectedOperatingCampaigns(campaigns) {
        if (!Array.isArray(campaigns) || !campaigns.length) return [];
        const ids = new Set((state.operatingCampaigns || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean));
        if (ids.size === 0) return [];
        return campaigns.filter(function (c, i) {
            return isCampaignSelected(c, ids, i);
        });
    }"""

assert old_sel_op in code, "old_sel_op not found"
code = code.replace(old_sel_op, new_sel_op)
print("Updated selectedOperatingCampaigns")

# 3. Update focusCampaign
old_focus = """    function focusCampaign(identifier, setOperating) {
        const raw = String(identifier || "").trim().toLowerCase();
        const prepared = prepareCampaigns(state.campaigns);
        const match = prepared.find(function(c){ return c.__id === raw || String(c.name || "").trim().toLowerCase() === raw; });
        if (!match) return;
        const shouldOperate = setOperating !== false;
        if (shouldOperate) {
            const next = new Set(state.operatingCampaigns || []);
            const alreadySelected = next.has(match.__id);
            if (!alreadySelected) {
                next.add(match.__id);
                showActionNotice(safeValue(match.name) + " selected as operating campaign.");
            } else if (next.size > 1) {
                next.delete(match.__id);
                showActionNotice(safeValue(match.name) + " removed from operating set.");
            } else {
                showActionNotice(safeValue(match.name) + " is operating.");
            }
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
        } else {
            showActionNotice("Viewing " + safeValue(match.name) + ".");
        }
        state.query = "";
        if (refs.search) refs.search.value = "";
        scheduleRender();
        window.requestAnimationFrame(function () {
            const card = refs.list.querySelector('.ct-card[data-id="' + CSS.escape(match.__id) + '"]');
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                card.classList.add("ct-focus-flash");
                window.setTimeout(function(){ card.classList.remove("ct-focus-flash"); }, 1200);
            }
        });
    }"""

new_focus = """    function focusCampaign(identifier, setOperating) {
        const raw = String(identifier || "").trim().toLowerCase();
        const prepared = prepareCampaigns(state.campaigns);
        const match = prepared.find(function(c, i){
            return (c.__id && String(c.__id).trim().toLowerCase() === raw) ||
                   (c.id && String(c.id).trim().toLowerCase() === raw) ||
                   (c.rawId && String(c.rawId).trim().toLowerCase() === raw) ||
                   (c.name && String(c.name).trim().toLowerCase() === raw) ||
                   ("campaign-" + i === raw);
        });
        if (!match) return;
        const primaryId = match.rawId || match.id || match.__id || String(match.name || "").trim().toLowerCase();
        const shouldOperate = setOperating !== false;
        if (shouldOperate) {
            const next = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));
            const alreadySelected = isCampaignSelected(match, next);
            if (!alreadySelected) {
                next.add(primaryId);
                showActionNotice(safeValue(match.name) + " selected as operating campaign.");
            } else if (next.size > 1) {
                if (match.rawId) next.delete(String(match.rawId));
                if (match.id) next.delete(String(match.id));
                if (match.__id) next.delete(String(match.__id));
                if (match.name) next.delete(String(match.name).trim().toLowerCase());
                next.delete(primaryId);
                showActionNotice(safeValue(match.name) + " removed from operating set.");
            } else {
                showActionNotice(safeValue(match.name) + " is operating.");
            }
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
        } else {
            showActionNotice("Viewing " + safeValue(match.name) + ".");
        }
        state.query = "";
        if (refs.search) refs.search.value = "";
        scheduleRender();
        window.requestAnimationFrame(function () {
            const card = refs.list.querySelector('.ct-card[data-id="' + CSS.escape(match.__id) + '"]');
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                card.classList.add("ct-focus-flash");
                window.setTimeout(function(){ card.classList.remove("ct-focus-flash"); }, 1200);
            }
        });
    }"""

assert old_focus in code, "old_focus not found"
code = code.replace(old_focus, new_focus)
print("Updated focusCampaign")

# 4. Update updateOperatingSelect
old_update_op_select = """    function updateOperatingSelect(campaigns) {
        if (!refs.operatingOptions || !refs.operatingTrigger) return;
        // Selection is authoritative user state. Never remove it because a feed
        // cycle is partial, delayed, or temporarily omits a campaign.
        const current = new Set(state.operatingCampaigns || []);
        const all = Array.isArray(campaigns) && campaigns.length ? campaigns : (Array.isArray(state.campaigns) && state.campaigns.length ? state.campaigns : []);
        const signature = all.map(function (c, i) {
            const id = c.__id || campaignId(c, i);
            return [id, c.name || "", c.__active === true ? 1 : c.__active === false ? 0 : -1, numberValue(c.__loggedIn)].join("|");
        }).join("||") + "::" + Array.from(current).sort().join(",");
        if (refs.operatingOptions.dataset.signature !== signature) {
            refs.operatingOptions.innerHTML = all.map(function (c, i) {
                const id = c.__id || campaignId(c, i);
                const checked = current.has(id);
                const active = c.__active === true ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                return '<button type="button" class="ct-operating-option' + (checked ? ' is-selected' : '') + '" role="option" aria-selected="' + checked + '" data-operating-id="' + escapeHtml(id) + '">' +
                    '<span class="ct-operating-check" aria-hidden="true">' + (checked ? '✓' : '') + '</span>' +
                    '<span class="ct-operating-option-main"><b>' + escapeHtml(safeValue(c.name, "Unnamed Campaign")) + '</b><small>' + active + ' · ' + formatNumber(c.__loggedIn) + ' agents</small></span>' +
                    '</button>';
            }).join("");
            refs.operatingOptions.dataset.signature = signature;
        }
        const selectedNames = all.filter(function (c, i) { return current.has(c.__id || campaignId(c, i)); }).map(function (c) { return safeValue(c.name, "Campaign"); });
        const selectedCount = current.size;
        setText(refs.operatingTriggerText, selectedCount === 0 ? "Select campaign(s)" : selectedNames.length === 1 && selectedCount === 1 ? selectedNames[0] : selectedCount + " campaigns selected");
        setText(refs.operatingTriggerCount, String(selectedCount));
        refs.operatingTrigger.classList.toggle("has-selection", selectedCount > 0);
    }"""

new_update_op_select = """    function updateOperatingSelect(campaigns) {
        if (!refs.operatingOptions || !refs.operatingTrigger) return;
        const current = new Set((state.operatingCampaigns || []).map(function(id) { return String(id || "").trim(); }).filter(Boolean));
        const all = Array.isArray(campaigns) && campaigns.length ? campaigns : (Array.isArray(state.campaigns) && state.campaigns.length ? state.campaigns : []);
        const signature = all.map(function (c, i) {
            const id = c.rawId || c.id || c.__id || campaignId(c, i);
            const isSel = isCampaignSelected(c, current, i);
            return [id, c.name || "", c.__active === true ? 1 : c.__active === false ? 0 : -1, numberValue(c.__loggedIn), isSel ? 1 : 0].join("|");
        }).join("||") + "::" + Array.from(current).sort().join(",");
        if (refs.operatingOptions.dataset.signature !== signature) {
            refs.operatingOptions.innerHTML = all.map(function (c, i) {
                const id = c.rawId || c.id || c.__id || campaignId(c, i);
                const checked = isCampaignSelected(c, current, i);
                const active = c.__active === true ? "LIVE" : c.__active === false ? "INACTIVE" : "CHECK";
                const nativeIdBadge = (c.rawId || c.id) ? '<span class="ct-operating-option-id">#' + escapeHtml(c.rawId || c.id) + '</span>' : '';
                return '<button type="button" class="ct-operating-option' + (checked ? ' is-selected' : '') + '" role="option" aria-selected="' + checked + '" data-operating-id="' + escapeHtml(id) + '">' +
                    '<span class="ct-operating-check" aria-hidden="true">' + (checked ? '✓' : '') + '</span>' +
                    '<span class="ct-operating-option-main"><b>' + escapeHtml(safeValue(c.name, "Unnamed Campaign")) + '</b> ' + nativeIdBadge + '<small>' + active + ' · ' + formatNumber(c.__loggedIn) + ' agents</small></span>' +
                    '</button>';
            }).join("");
            refs.operatingOptions.dataset.signature = signature;
        }
        const selectedCampaigns = all.filter(function (c, i) { return isCampaignSelected(c, current, i); });
        const selectedNames = selectedCampaigns.map(function (c) { return safeValue(c.name, "Campaign"); });
        const selectedCount = selectedCampaigns.length || current.size;
        setText(refs.operatingTriggerText, selectedCount === 0 ? "Select campaign(s)" : selectedNames.length === 1 ? selectedNames[0] : selectedCount + " campaigns selected");
        setText(refs.operatingTriggerCount, String(selectedCount));
        refs.operatingTrigger.classList.toggle("has-selection", selectedCount > 0);
    }"""

assert old_update_op_select in code, "old_update_op_select not found"
code = code.replace(old_update_op_select, new_update_op_select)
print("Updated updateOperatingSelect")

# 5. Update refs.operatingMenu click listener to stopPropagation and toggle instantly
old_op_menu_listener = """        refs.operatingMenu.addEventListener("click", function (event) {
            const clear = event.target.closest('[data-operating-action="clear"]');
            if (clear) {
                writeOperatingCampaigns([]);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("Operating campaign selection cleared.");
                scheduleRender();
                return;
            }
            const option = event.target.closest('[data-operating-id]');
            if (!option) return;
            const id = option.getAttribute('data-operating-id');
            const next = new Set(state.operatingCampaigns || []);
            const adding = !next.has(id);
            if (adding) next.add(id); else next.delete(id);
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
            showActionNotice(adding ? "Campaign added to operating set." : "Campaign removed from operating set.");
            scheduleRender();
        });"""

new_op_menu_listener = """        refs.operatingMenu.addEventListener("click", function (event) {
            event.stopPropagation();
            const clear = event.target.closest('[data-operating-action="clear"]');
            if (clear) {
                event.preventDefault();
                writeOperatingCampaigns([]);
                addCurrentStateAlerts(state.campaigns);
                showActionNotice("Operating campaign selection cleared.");
                updateOperatingSelect(state.campaigns);
                scheduleRender();
                return;
            }
            const option = event.target.closest('[data-operating-id]');
            if (!option) return;
            event.preventDefault();
            const id = option.getAttribute('data-operating-id');
            const next = new Set((state.operatingCampaigns || []).map(function(v) { return String(v || "").trim(); }).filter(Boolean));
            let adding = true;
            if (next.has(id)) {
                next.delete(id);
                adding = false;
            } else {
                const all = state.campaigns || [];
                const targetCampaign = all.find(function(c, i) {
                    const cid = c.rawId || c.id || c.__id || campaignId(c, i);
                    return cid === id || String(c.name || "").trim().toLowerCase() === id.toLowerCase();
                });
                if (targetCampaign) {
                    if (isCampaignSelected(targetCampaign, next)) {
                        if (targetCampaign.rawId) next.delete(String(targetCampaign.rawId));
                        if (targetCampaign.id) next.delete(String(targetCampaign.id));
                        if (targetCampaign.__id) next.delete(String(targetCampaign.__id));
                        if (targetCampaign.name) next.delete(String(targetCampaign.name).trim().toLowerCase());
                        adding = false;
                    } else {
                        next.add(id);
                    }
                } else {
                    next.add(id);
                }
            }
            writeOperatingCampaigns(Array.from(next));
            addCurrentStateAlerts(state.campaigns);
            showActionNotice(adding ? "Campaign added to operating set." : "Campaign removed from operating set.");
            updateOperatingSelect(state.campaigns);
            scheduleRender();
        });"""

assert old_op_menu_listener in code, "old_op_menu_listener not found"
code = code.replace(old_op_menu_listener, new_op_menu_listener)
print("Updated refs.operatingMenu listener with event.stopPropagation")

with open(dashboard_js_path, "w", encoding="utf-8") as f:
    f.write(code)
print("Phase 1 of patch_dashboard_east2 applied successfully!")
