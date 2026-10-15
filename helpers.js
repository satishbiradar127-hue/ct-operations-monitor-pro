// ===============================
// CT Operations Monitor Helpers
// Version 3.0
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
 * Format numbers.
 */
CT.number = function (value) {

    if (!value) return "0";

    const n = parseFloat(
        String(value).replace(/,/g, "")
    );

    if (isNaN(n)) return value;

    return n.toLocaleString();
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

console.log("Helpers Loaded");