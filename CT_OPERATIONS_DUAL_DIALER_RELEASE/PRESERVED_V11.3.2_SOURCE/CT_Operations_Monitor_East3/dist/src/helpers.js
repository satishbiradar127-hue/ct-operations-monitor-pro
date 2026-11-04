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

console.log("Helpers Loaded (EAST-3)");
