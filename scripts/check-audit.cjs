const fs = require('node:fs');
const lines = fs.readFileSync(process.argv[2] || 'audit.json', 'utf8').trim().split('\n');
let summary = false;
let failed = false;
const seen = new Set();
for (const line of lines) {
  const event = JSON.parse(line);
  if (event.type === 'auditSummary') {
    summary = true;
    const counts = event.data.vulnerabilities;
    if (counts.high > 0 || counts.critical > 0) failed = true;
  }
  if (event.type === 'error') {
    console.error(event.data);
    failed = true;
  }
  if (event.type === 'auditAdvisory') {
    const advisory = event.data.advisory;
    if (!seen.has(advisory.id)) {
      seen.add(advisory.id);
      console.error(`${advisory.severity}: ${advisory.module_name}: ${advisory.title}`);
    }
    if (['high', 'critical'].includes(advisory.severity)) failed = true;
  }
}
if (!summary || failed) process.exit(1);
