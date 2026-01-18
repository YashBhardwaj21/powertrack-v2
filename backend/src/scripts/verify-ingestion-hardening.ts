/**
 * Telemetry Ingestion Hardening - Verification Script
 * 
 * Tests all error scenarios and validates the hardened ingestion pipeline.
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3001/api/v1';

interface TestResult {
    name: string;
    passed: boolean;
    expected: string;
    actual: string;
    details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, expected: string, actual: string, details?: any) {
    results.push({ name, passed, expected, actual, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (!passed) {
        console.log(`   Expected: ${expected}`);
        console.log(`   Actual: ${actual}`);
        if (details) console.log(`   Details:`, details);
    }
}

async function testInvalidApiKey() {
    try {
        const response = await fetch(`${BASE_URL}/telemetry/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': 'pt_live_invalid_key_12345'
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                ts: Math.floor(Date.now() / 1000)
            })
        });

        const data: any = await response.json();

        logTest(
            'Invalid API key → 401',
            response.status === 401 && data.code === 'INVALID_API_KEY',
            '401 with INVALID_API_KEY code',
            `${response.status} with ${data.code} code`,
            data
        );
    } catch (error: any) {
        logTest('Invalid API key → 401', false, '401', `Error: ${error.message}`);
    }
}

async function testMissingApiKey() {
    try {
        const response = await fetch(`${BASE_URL}/telemetry/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                ts: Math.floor(Date.now() / 1000)
            })
        });

        const data: any = await response.json();

        logTest(
            'Missing API key → 401',
            response.status === 401 && data.code === 'INVALID_API_KEY',
            '401 with INVALID_API_KEY code',
            `${response.status} with ${data.code} code`,
            data
        );
    } catch (error: any) {
        logTest('Missing API key → 401', false, '401', `Error: ${error.message}`);
    }
}

async function testInvalidFormat() {
    try {
        const response = await fetch(`${BASE_URL}/telemetry/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': 'wrong_prefix_12345'
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                ts: Math.floor(Date.now() / 1000)
            })
        });

        const data: any = await response.json();

        logTest(
            'Invalid API key format → 401',
            response.status === 401 && data.code === 'INVALID_API_KEY',
            '401 with INVALID_API_KEY code',
            `${response.status} with ${data.code} code`,
            data
        );
    } catch (error: any) {
        logTest('Invalid API key format → 401', false, '401', `Error: ${error.message}`);
    }
}

async function testDryRunMode(validApiKey: string) {
    try {
        const response = await fetch(`${BASE_URL}/telemetry/ingest?dry_run=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': validApiKey
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                daily_kwh: 12.4,
                total_kwh: 1543.2,
                load_kw: 1.8,
                grid_import_kw: 0.6,
                grid_export_kw: 1.2,
                temp_c: 42.1,
                irradiance_wm2: 860,
                weather_condition: 'sunny',
                ts: Math.floor(Date.now() / 1000)
            })
        });

        const data: any = await response.json();

        logTest(
            'Dry-run mode returns diagnostics',
            response.status === 200 && data.dry_run === true && data.status === 'READY',
            '200 with dry_run=true and status=READY',
            `${response.status} with dry_run=${data.dry_run} and status=${data.status}`,
            data
        );
    } catch (error: any) {
        logTest('Dry-run mode', false, '200', `Error: ${error.message}`);
    }
}

async function testValidIngestion(validApiKey: string) {
    try {
        const response = await fetch(`${BASE_URL}/telemetry/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': validApiKey
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                daily_kwh: 12.4,
                total_kwh: 1543.2,
                load_kw: 1.8,
                grid_import_kw: 0.6,
                grid_export_kw: 1.2,
                temp_c: 42.1,
                irradiance_wm2: 860,
                weather_condition: 'sunny',
                ts: Math.floor(Date.now() / 1000)
            })
        });

        const data: any = await response.json();

        logTest(
            'Valid ingestion → 201',
            response.status === 201 && data.success === true,
            '201 with success=true',
            `${response.status} with success=${data.success}`,
            data
        );
    } catch (error: any) {
        logTest('Valid ingestion', false, '201', `Error: ${error.message}`);
    }
}

async function testOldTimestamp(validApiKey: string) {
    try {
        // Use timestamp from 2 years ago
        const oldTimestamp = Math.floor(Date.now() / 1000) - (365 * 2 * 24 * 60 * 60);

        const response = await fetch(`${BASE_URL}/telemetry/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': validApiKey
            },
            body: JSON.stringify({
                power_w: 2450,
                voltage: 228,
                current_a: 10.7,
                ts: oldTimestamp
            })
        });

        const data: any = await response.json();

        logTest(
            'Old timestamp includes visibility warning',
            response.status === 201 && data.warnings && data.warnings.length > 0,
            '201 with warnings array',
            `${response.status} with ${data.warnings?.length || 0} warnings`,
            data
        );
    } catch (error: any) {
        logTest('Old timestamp warning', false, '201 with warnings', `Error: ${error.message}`);
    }
}

async function runTests() {
    console.log('\n🧪 Telemetry Ingestion Hardening - Verification Tests\n');
    console.log('='.repeat(60));

    // Test invalid scenarios (should work without valid API key)
    console.log('\n📋 Testing Error Scenarios...\n');
    await testMissingApiKey();
    await testInvalidFormat();
    await testInvalidApiKey();

    // Check if we have a valid API key in environment
    const validApiKey = process.env.TEST_API_KEY;

    if (!validApiKey) {
        console.log('\n⚠️  Skipping positive tests - no TEST_API_KEY environment variable set');
        console.log('   Set TEST_API_KEY to a valid API key to test successful ingestion');
    } else {
        console.log('\n📋 Testing Valid Scenarios...\n');
        await testDryRunMode(validApiKey);
        await testValidIngestion(validApiKey);
        await testOldTimestamp(validApiKey);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary\n');

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${percentage}%\n`);

    if (passed === total) {
        console.log('✅ All tests passed!');
    } else {
        console.log('❌ Some tests failed. Review the output above.');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});
