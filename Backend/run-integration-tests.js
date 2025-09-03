#!/usr/bin/env node

/**
 * Integration Test Runner
 * Runs only the integration tests for the enhanced scanner
 */

const { spawn } = require('child_process');
const path = require('path');

const integrationTestFiles = [
    'tests/integration/end-to-end.test.js',
    'tests/integration/performance-benchmarks.test.js',
    'tests/integration/ai-analysis-integration.test.js',
    'tests/integration/system-validation.test.js'
];

console.log('🚀 Running Integration Tests for Enhanced Scanner...\n');

const jestArgs = [
    '--testPathPattern=integration',
    '--verbose',
    '--runInBand', // Run tests serially to avoid resource conflicts
    '--detectOpenHandles',
    '--forceExit'
];

const jest = spawn('npx', ['jest', ...jestArgs], {
    stdio: 'inherit',
    cwd: __dirname
});

jest.on('close', (code) => {
    console.log(`\n📊 Integration tests completed with exit code: ${code}`);

    if (code === 0) {
        console.log('✅ All integration tests passed!');
    } else {
        console.log('❌ Some integration tests failed.');
        console.log('💡 This is expected for tests that require external services or network access.');
        console.log('📝 Check the test output above for specific failures and their causes.');
    }

    process.exit(code);
});

jest.on('error', (error) => {
    console.error('❌ Failed to start integration tests:', error);
    process.exit(1);
});