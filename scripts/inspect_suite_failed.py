const { execSync } = require('child_process');

try {
    const res = execSync('node CT_OPERATIONS_DUAL_DIALER_RELEASE/CT_Operations_Monitor_East3/tests/suite.test.js', { encoding: 'utf8' });
    console.log('SUCCESS! All tests passed.');
} catch (err) {
    const lines = err.stdout.split('\n');
    const fails = lines.filter(l => l.includes('✖') || l.includes('AssertionError') || l.includes('test at'));
    console.log('FAILURES:');
    console.log(fails.join('\n'));
}
