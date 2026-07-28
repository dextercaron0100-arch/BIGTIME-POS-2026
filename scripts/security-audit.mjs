import { spawnSync } from 'node:child_process';

const minimumSeverity = 3;
const severityRanks = new Map([
  ['low', 1],
  ['moderate', 2],
  ['high', 3],
  ['critical', 4],
]);
const temporaryAllowances = new Map([
  [
    'GHSA-qwww-vcr4-c8h2',
    {
      expires: '2026-08-11',
      reason:
        'The affected React Router RSC mode is not used by this Vite SPA. Remove this allowance when a patched react-router-dom release is available.',
    },
  ],
]);

const auditArguments = [
  'audit',
  '--omit=dev',
  '--audit-level=high',
  '--json',
];
const npmCommand = process.env.npm_execpath ? process.execPath : 'npm';
const npmArguments = process.env.npm_execpath
  ? [process.env.npm_execpath, ...auditArguments]
  : auditArguments;
const audit = spawnSync(npmCommand, npmArguments, { encoding: 'utf8' });

if (audit.error) {
  console.error(`Unable to run npm audit: ${audit.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  process.stdout.write(audit.stdout);
  process.stderr.write(audit.stderr);
  console.error('Unable to parse npm audit output.');
  process.exit(audit.status || 1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const allowedAdvisories = new Set();
const blockedAdvisories = new Map();

function advisoryId(advisory) {
  return (
    advisory.url?.match(/GHSA-[\w-]+/)?.[0] ??
    String(advisory.source ?? advisory.name)
  );
}

function isAllowanceActive(allowance) {
  return Date.now() <= Date.parse(`${allowance.expires}T23:59:59Z`);
}

function inspectVulnerability(name, visited = new Set()) {
  if (visited.has(name)) return;
  visited.add(name);

  for (const cause of vulnerabilities[name]?.via ?? []) {
    if (typeof cause === 'string') {
      inspectVulnerability(cause, visited);
      continue;
    }

    if ((severityRanks.get(cause.severity) ?? 0) < minimumSeverity) continue;

    const id = advisoryId(cause);
    const allowance = temporaryAllowances.get(id);
    if (allowance && isAllowanceActive(allowance)) {
      allowedAdvisories.add(id);
      continue;
    }

    blockedAdvisories.set(id, {
      dependency: cause.name ?? name,
      severity: cause.severity,
      title: cause.title,
      url: cause.url,
      expired: Boolean(allowance),
    });
  }
}

for (const name of Object.keys(vulnerabilities)) {
  inspectVulnerability(name);
}

for (const id of allowedAdvisories) {
  const allowance = temporaryAllowances.get(id);
  console.warn(
    `Temporarily allowing ${id} through ${allowance.expires}: ${allowance.reason}`,
  );
}

if (blockedAdvisories.size > 0) {
  console.error('\nUnapproved high or critical production vulnerabilities:');
  for (const [id, advisory] of blockedAdvisories) {
    const expired = advisory.expired ? ' (allowance expired)' : '';
    console.error(
      `- ${id}${expired}: ${advisory.dependency} (${advisory.severity}) — ${advisory.title}`,
    );
    if (advisory.url) console.error(`  ${advisory.url}`);
  }
  process.exit(1);
}

console.log('No unapproved high or critical production vulnerabilities found.');
