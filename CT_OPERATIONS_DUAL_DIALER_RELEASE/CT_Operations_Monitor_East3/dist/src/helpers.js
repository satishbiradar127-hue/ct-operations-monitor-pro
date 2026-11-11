// ===============================
// CT Operations Monitor Helpers (EAST-3)
// Version 11.2.0
// ===============================

window.CT = window.CT || {};

/**
 * Safely get text from an element.
 */
CT.text = function (el) {
    if (!el) return "";
    return el.textContent.trim();
};

/**
 * Get text using a selector inside a parent.
 */
CT.get = function (parent, selector) {
    return CT.text(parent.querySelector(selector));
};

/**
 * Escape HTML.
 */
CT.escape = function (value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

/**
 * Format numbers without coercing missing values to zero.
 */
CT.number = function (value, fallback) {
    const emptyFallback = fallback !== undefined ? fallback : "—";
    if (value === null || value === undefined || String(value).trim() === "") {
        return emptyFallback;
    }

    const n = parseFloat(
        String(value).replace(/,/g, "")
    );

    if (isNaN(n)) return String(value).trim() || emptyFallback;

    return n.toLocaleString();
};

/**
 * Categorize a metric into explicit validity states:
 * VALID_ZERO, VALID_NONZERO, MISSING, or MALFORMED.
 */
CT.parseMetric = function (value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return { raw: value, value: null, state: "MISSING", isValid: false };
    }
    const clean = String(value).replace(/,/g, "").trim();
    const n = parseFloat(clean);
    if (isNaN(n)) {
        return { raw: value, value: null, state: "MALFORMED", isValid: false };
    }
    if (n === 0) {
        return { raw: value, value: 0, state: "VALID_ZERO", isValid: true };
    }
    return { raw: value, value: n, state: "VALID_NONZERO", isValid: true };
};

/**
 * Return status color.
 */
CT.waitColor = function (wait) {
    const n = parseFloat(wait);
    if (isNaN(n)) return "#777";
    if (n >= 60) return "#d32f2f";
    if (n >= 30) return "#f57c00";
    return "#2e7d32";
};

/**
 * Strip trailing CallTools UI suffixes such as "(Count: 123)" or "(Not Active)".
 */
CT.cleanCanonicalFilterName = function (rawName) {
    if (rawName === null || rawName === undefined) return "";
    return String(rawName)
        .replace(/\s*[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/gi, "")
        .replace(/\s*\(\s*Not\s+Active\s*\)\s*$/gi, "")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * Validate whether a canonical Live Filter name is non-empty, non-placeholder, and not truncated.
 */
CT.isCanonicalFilterNameValid = function (rawName) {
    const clean = CT.cleanCanonicalFilterName(rawName);
    if (!clean) {
        return { valid: false, reason: "missing", cleanName: null };
    }
    const lower = clean.toLowerCase();
    if (
        lower === "none" ||
        lower === "unassigned" ||
        lower === "no filter assigned" ||
        lower === "unknown" ||
        lower === "filter source unavailable" ||
        lower === "filter unavailable" ||
        lower === "none assigned" ||
        lower === "—" ||
        lower === "-"
    ) {
        return { valid: false, reason: "unassigned", cleanName: null };
    }
    if (clean.endsWith("...") || clean.endsWith("…") || clean.includes("...")) {
        return { valid: false, reason: "truncated", cleanName: null };
    }
    return { valid: true, reason: null, cleanName: clean };
};

/**
 * Resolve Assigned Live Filter and its exact Available Contacts strictly from
 * numeric campaign ID -> numeric filter ID -> Live Filter Inventory item[filterId].
 */
CT.resolveAuthoritativeAssignedFilterCopy = function (options = {}) {
    const opts = options && typeof options === "object" ? options : {};
    const prefix = opts.prefix || "ct_east3_";
    const storage = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
    const freshnessWindowMs = Number.isFinite(Number(opts.freshnessWindowMs)) ? Number(opts.freshnessWindowMs) : 120000;
    const cid = String(opts.campaignId ?? "").trim();

    if (!/^[0-9]+$/.test(cid)) {
        return {
            ok: false,
            unavailableFields: ["Campaign ID"],
            errorReason: "Immutable numeric Campaign ID unavailable"
        };
    }

    let verifiedRegistry = opts.verifiedRegistry || null;
    if (!verifiedRegistry && storage && typeof storage.getItem === "function") {
        try {
            verifiedRegistry = JSON.parse(storage.getItem(prefix + "verified_campaign_filters_v1") || "{}");
        } catch (e) {
            verifiedRegistry = {};
        }
    }
    if (!verifiedRegistry || typeof verifiedRegistry !== "object") verifiedRegistry = {};

    let inventory = opts.inventory || null;
    if (!inventory && storage && typeof storage.getItem === "function") {
        try {
            inventory = JSON.parse(storage.getItem(prefix + "live_filters_inventory_v1") || "{}");
        } catch (e) {
            inventory = {};
        }
    }
    if (!inventory || typeof inventory !== "object") inventory = {};
    const invItems = (inventory.items && typeof inventory.items === "object") ? inventory.items : {};

    let filterIdMap = opts.filterIdMap || null;
    if (!filterIdMap && storage && typeof storage.getItem === "function") {
        try {
            filterIdMap = JSON.parse(storage.getItem(prefix + "filter_id_map_v1") || "{}");
        } catch (e) {
            filterIdMap = {};
        }
    }
    if (!filterIdMap || typeof filterIdMap !== "object") filterIdMap = {};

    const regEntry = verifiedRegistry[cid] || null;
    if (!regEntry || regEntry.status === "NONE") {
        return {
            ok: false,
            campaignId: cid,
            unavailableFields: ["Assigned Live Filter"],
            errorReason: "Assigned Live Filter is not verified for Campaign #" + cid
        };
    }

    const regTimestamp = Number(regEntry.timestamp || regEntry.observedAt || 0);
    if (!regTimestamp || (now - regTimestamp) > freshnessWindowMs) {
        return {
            ok: false,
            campaignId: cid,
            unavailableFields: ["Assigned Live Filter (Stale)"],
            errorReason: "Assigned Live Filter observation is stale or unverified for Campaign #" + cid
        };
    }

    const regNameCheck = CT.isCanonicalFilterNameValid(regEntry.liveFilter || regEntry.filter);
    if (!regNameCheck.valid) {
        return {
            ok: false,
            campaignId: cid,
            unavailableFields: ["Assigned Live Filter Name"],
            errorReason: regNameCheck.reason === "truncated"
                ? "Assigned Live Filter name is truncated; awaiting full canonical name"
                : "Assigned Live Filter is unavailable"
        };
    }

    let filterId = String(regEntry.filterId || regEntry.liveFilterId || "").trim();
    if (!/^[0-9]+$/.test(filterId)) {
        const mapped = filterIdMap[regNameCheck.cleanName.toLowerCase()];
        if (mapped && mapped.filterId && /^[0-9]+$/.test(String(mapped.filterId).trim())) {
            filterId = String(mapped.filterId).trim();
        }
    }
    if (!/^[0-9]+$/.test(filterId)) {
        return {
            ok: false,
            campaignId: cid,
            filterName: regNameCheck.cleanName,
            unavailableFields: ["Filter ID"],
            errorReason: "Verified Filter ID is unavailable for Campaign #" + cid
        };
    }

    const invRecord = invItems[filterId] || null;
    if (!invRecord || typeof invRecord !== "object") {
        return {
            ok: false,
            campaignId: cid,
            filterId: filterId,
            filterName: regNameCheck.cleanName,
            unavailableFields: ["Available Contacts"],
            errorReason: "Live Filter Inventory record unavailable for Filter #" + filterId
        };
    }

    let canonicalName = regNameCheck.cleanName;
    if (invRecord.name) {
        const invNameCheck = CT.isCanonicalFilterNameValid(invRecord.name);
        if (!invNameCheck.valid) {
            return {
                ok: false,
                campaignId: cid,
                filterId: filterId,
                unavailableFields: ["Canonical Live Filter Name"],
                errorReason: "Inventory Live Filter name is invalid or truncated for Filter #" + filterId
            };
        }
        if (invNameCheck.cleanName.toLowerCase() !== regNameCheck.cleanName.toLowerCase()) {
            return {
                ok: false,
                campaignId: cid,
                filterId: filterId,
                unavailableFields: ["Filter Name / Inventory Mismatch"],
                errorReason: "Verified filter name mismatch between Edit DOM and Live Filter Inventory for Filter #" + filterId
            };
        }
        canonicalName = invNameCheck.cleanName;
    }

    const invObservedAt = Number(invRecord.observedAt || inventory.lastObservedAt || 0);
    if (!invObservedAt || (now - invObservedAt) > freshnessWindowMs) {
        return {
            ok: false,
            campaignId: cid,
            filterId: filterId,
            filterName: canonicalName,
            unavailableFields: ["Available Contacts (Stale)"],
            errorReason: "Live Filter Inventory count is stale for Filter #" + filterId
        };
    }

    if (invRecord.count === null || invRecord.count === undefined || String(invRecord.count).trim() === "") {
        return {
            ok: false,
            campaignId: cid,
            filterId: filterId,
            filterName: canonicalName,
            unavailableFields: ["Available Contacts"],
            errorReason: "Available Contacts missing in Live Filter Inventory for Filter #" + filterId
        };
    }
    const rawCount = Number(String(invRecord.count).replace(/,/g, ""));
    if (!Number.isFinite(rawCount) || rawCount < 0) {
        return {
            ok: false,
            campaignId: cid,
            filterId: filterId,
            filterName: canonicalName,
            unavailableFields: ["Available Contacts"],
            errorReason: "Available Contacts is non-numeric for Filter #" + filterId
        };
    }

    const countInt = Math.trunc(rawCount);
    const formattedCount = countInt.toLocaleString("en-US");
    return {
        ok: true,
        campaignId: cid,
        filterId: filterId,
        filterName: canonicalName,
        availableContacts: countInt,
        formattedAvailableContacts: formattedCount,
        text: "Live Filter: " + canonicalName + " | Available Leads: " + formattedCount,
        verificationSource: regEntry.source || "CAMPAIGN_EDIT_DOM",
        inventorySource: invRecord.source || "LIVE_FILTERS_PAGE",
        observedAt: invObservedAt,
        filterTimestamp: regTimestamp
    };
};

/**
 * Resolve Latest Verified Targeting Transition (FROM / TO full canonical filter names only).
 */
CT.resolveAuthoritativeTransitionCopy = function (options = {}) {
    const opts = options && typeof options === "object" ? options : {};
    const dialer = opts.dialer || "EAST-3";
    const prefix = opts.prefix || "ct_east3_";
    const storage = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const cid = String(opts.campaignId ?? "").trim();

    if (!/^[0-9]+$/.test(cid)) {
        return {
            ok: false,
            unavailableFields: ["Verified Targeting Transition"],
            errorReason: "NO VERIFIED TRANSITION"
        };
    }

    let changeHistory = Array.isArray(opts.changeHistory) ? opts.changeHistory : null;
    if (!changeHistory && storage && typeof storage.getItem === "function") {
        try {
            changeHistory = JSON.parse(storage.getItem(prefix + "live_filter_change_history_v1") || "[]");
        } catch (e) {
            changeHistory = [];
        }
    }
    let intelHistory = Array.isArray(opts.intelligenceHistory) ? opts.intelligenceHistory : null;
    if (!intelHistory && storage && typeof storage.getItem === "function") {
        try {
            intelHistory = JSON.parse(storage.getItem(prefix + "intelligence_history_v1") || "[]");
        } catch (e) {
            intelHistory = [];
        }
    }
    let inventory = opts.inventory || null;
    if (!inventory && storage && typeof storage.getItem === "function") {
        try {
            inventory = JSON.parse(storage.getItem(prefix + "live_filters_inventory_v1") || "{}");
        } catch (e) {
            inventory = {};
        }
    }
    const invItems = (inventory && inventory.items && typeof inventory.items === "object") ? inventory.items : {};

    const candidates = [];
    if (Array.isArray(changeHistory)) {
        changeHistory.forEach(function (h) {
            if (!h) return;
            if (h.dialer && h.dialer !== dialer) return;
            if (String(h.campaignId || h.targetId || "").trim() === cid) {
                candidates.push(h);
            }
        });
    }
    if (Array.isArray(intelHistory)) {
        intelHistory.forEach(function (h) {
            if (!h || h.category !== "LIVE_FILTER") return;
            if (h.dialer && h.dialer !== dialer) return;
            if (String(h.campaignId || h.targetId || "").trim() === cid) {
                candidates.push(h);
            }
        });
    }
    candidates.sort(function (a, b) {
        return Number(b.timestamp || 0) - Number(a.timestamp || 0);
    });

    const resolveCanonical = function (rawName, filterId) {
        if (filterId && invItems[String(filterId)] && invItems[String(filterId)].name) {
            const invCheck = CT.isCanonicalFilterNameValid(invItems[String(filterId)].name);
            if (invCheck.valid) return invCheck;
        }
        return CT.isCanonicalFilterNameValid(rawName);
    };

    for (let i = 0; i < candidates.length; i++) {
        const rec = candidates[i];
        const prevCheck = resolveCanonical(rec.previousFilter || rec.previous, rec.previousFilterId);
        const currCheck = resolveCanonical(rec.currentFilter || rec.current, rec.currentFilterId);
        if (!prevCheck.valid || !currCheck.valid) {
            // If newest recorded event lacks a verified previous filter (e.g., initial assignment from None),
            // stop here rather than skipping backward over an unrelated older transition.
            if (i === 0 && !prevCheck.valid) {
                break;
            }
            continue;
        }
        if (prevCheck.cleanName.toLowerCase() === currCheck.cleanName.toLowerCase()) {
            continue;
        }
        return {
            ok: true,
            campaignId: cid,
            filterFrom: prevCheck.cleanName,
            filterTo: currCheck.cleanName,
            text: prevCheck.cleanName + " → " + currCheck.cleanName,
            timestamp: Number(rec.timestamp || 0) || null,
            confirmedAt: rec.confirmedAt || null,
            source: rec.source || "CAMPAIGN_EDIT_DOM",
            previousCount: rec.previousCount ?? null,
            currentCount: rec.currentCount ?? null
        };
    }

    return {
        ok: false,
        campaignId: cid,
        unavailableFields: ["Verified Targeting Transition"],
        errorReason: "NO VERIFIED TRANSITION"
    };
};

/**
 * Write text cleanly to clipboard, surfacing genuine rejection states rather than faking success.
 */
CT.writeTextToClipboard = async function (text, clipboardOverride) {
    if (typeof text !== "string" || !text.trim()) {
        return { ok: false, error: "Nothing verified to copy" };
    }
    const clipboard = clipboardOverride || (typeof navigator !== "undefined" ? navigator.clipboard : null);
    if (!clipboard || typeof clipboard.writeText !== "function") {
        return { ok: false, error: "Browser clipboard API unavailable" };
    }
    try {
        await clipboard.writeText(text);
        return { ok: true, text: text };
    } catch (err) {
        return { ok: false, error: (err && err.message) ? String(err.message) : "Clipboard write permission denied" };
    }
};

/**
 * Normalize persisted Live Filter Inventory view preference ("active" | "all" | "inactive").
 * Defaults strictly to "active" when missing, empty, or invalid/corrupted.
 */
CT.normalizeLfiInventoryFilter = function (raw) {
    const val = String(raw || "").trim().toLowerCase();
    return (val === "active" || val === "all" || val === "inactive") ? val : "active";
};

console.log("Helpers Loaded (EAST-3)");
