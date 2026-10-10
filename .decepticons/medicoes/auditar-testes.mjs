import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

// Primeiro: node scripts/test.mjs run --reporter=json --outputFile=.tmp/testes-executados.json
const report = JSON.parse(readFileSync('.tmp/testes-executados.json', 'utf8'));
const rows = report.testResults.map(file => ({ file: relative(process.cwd(), file.name).replaceAll('\\', '/'), tests: file.assertionResults }));
const files = rows.map(row => row.file);
const identities = new Map();
for (const row of rows) for (const test of row.tests) {
  const key = row.file + ' :: ' + test.fullName;
  identities.set(key, (identities.get(key) ?? 0) + 1);
}
const result = {
  recordedTotal: report.numTotalTests,
  executedCases: rows.reduce((n, row) => n + row.tests.length, 0),
  passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests,
  files: files.length, uniqueFiles: new Set(files).size,
  duplicateNames: [...identities].filter(([, count]) => count > 1),
  outsideInclude: files.filter(file => !/^(client\/src|shared|server)\/.+\.test\.ts$/.test(file)),
  domains: ['client/', 'shared/', 'server/'].map(domain => ({ domain, tests: rows.filter(row => row.file.startsWith(domain)).reduce((n, row) => n + row.tests.length, 0) })),
  largest: rows.map(row => ({ file: row.file, tests: row.tests.length })).sort((a, b) => b.tests - a.tests).slice(0, 12),
};
writeFileSync('.tmp/auditoria-executada.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.recordedTotal !== result.executedCases || result.uniqueFiles !== result.files || result.outsideInclude.length || result.failed) process.exitCode = 1;
