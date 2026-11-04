const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE');
const parser = fs.readFileSync(path.join(root, 'CT_Operations_Monitor_East2', 'src', 'parser.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'CT_Operations_Monitor_East2', 'src', 'dashboard.js'), 'utf8');

console.log("=== INSPECTING METRIC EXTRACTION IN PARSER.JS ===");

const campaignProps = [
    'name', 'active', 'contacts', 'channels', 'waitNow', 'waitToday',
    'outbound', 'human', 'machine', 'agentConnect', 'abandoned',
    'noAnswer', 'busy', 'failed', 'loggedIn', 'waiting', 'onCall',
    'postCall', 'sales', 'goals'
];

campaignProps.forEach(p => {
    const r = new RegExp(`raw${p.charAt(0).toUpperCase() + p.slice(1)}\\s*=\\s*([^;]+);`);
    const m = parser.match(r);
    console.log(`Campaign prop '${p}':`, m ? m[1].trim() : 'NOT MATCHED');
});

const queueProps = [
    'callsTodayTotal', 'callsTodayAnswered', 'callsTodayNotAnswered',
    'inboundMachine', 'inboundNoAnswer', 'loggedIn', 'onQueueCalls',
    'callsNowTotal', 'waiting', 'callsNowAnswered', 'waitAverage',
    'waitMax', 'calendarEvents', 'opportunities', 'goals', 'sales'
];

queueProps.forEach(p => {
    const r = new RegExp(`raw${p.charAt(0).toUpperCase() + p.slice(1)}\\s*=\\s*([^;]+);`);
    const m = parser.match(r);
    console.log(`Queue prop '${p}':`, m ? m[1].trim() : 'NOT MATCHED');
});

