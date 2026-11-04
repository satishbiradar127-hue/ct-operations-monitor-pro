const fs = require('fs');
const dashCode = fs.readFileSync('CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East2/src/dashboard.js', 'utf8');

const checks = {
    resetOrder: [dashCode.includes('ct-order-reset-btn'), dashCode.includes('resetManualOrder')],
    arrangeCampaigns: [dashCode.includes('ct-manage-order-btn'), dashCode.includes('setOrderWorkspaceOpen')],
    manualOrdering: [dashCode.includes('data-order-action="up"'), dashCode.includes('data-order-action="down"')],
    multiSelect: [dashCode.includes('ct-operating-trigger'), dashCode.includes('persistOperatingCampaignIds')],
    refreshData: [dashCode.includes('ct-refresh-btn'), dashCode.includes('requestDataRefresh')],
    settings: [dashCode.includes('ct-threshold'), dashCode.includes('persistSettings')],
    inboundDisplaySettings: [dashCode.includes('ct-inbound-settings-btn'), dashCode.includes('persistInboundSettings')],
    collapseExpand: [dashCode.includes('ct-header-collapse'), dashCode.includes('persistCollapsedState')],
    zoomControls: [dashCode.includes('data-zoom'), dashCode.includes('persistZoomLevel')],
    filters: [dashCode.includes('ct-chip-filter'), dashCode.includes('persistFilterState')],
    notedButton: [dashCode.includes('data-noted-id'), dashCode.includes('acknowledgePersistentGoalAlert')]
};

for (const [k, v] of Object.entries(checks)) {
    console.log(k + ':', v);
}

