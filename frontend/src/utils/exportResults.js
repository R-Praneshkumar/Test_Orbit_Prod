/**
 * Export test results as JUnit XML or standalone HTML report.
 */

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Generate JUnit XML from test results.
 * Compatible with Jenkins, GitHub Actions, and other CI parsers.
 */
export function generateJunitXml(results, summary, suiteName = 'TestOrbit Collection Run') {
    const totalTime = (summary.totalTime / 1000).toFixed(3);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="${escapeXml(suiteName)}" tests="${results.length}" failures="${summary.failed}" time="${totalTime}">\n`;
    xml += `  <testsuite name="${escapeXml(suiteName)}" tests="${results.length}" failures="${summary.failed}" time="${totalTime}" timestamp="${new Date().toISOString()}">\n`;

    for (const r of results) {
        const time = (r.time / 1000).toFixed(3);
        const caseName = r.name || r.url || 'Unnamed Test';
        xml += `    <testcase name="${escapeXml(caseName)}" classname="${escapeXml(r.method || 'GET')}" time="${time}">\n`;

        if (!r.success) {
            const message = r.error || `Expected ${r.expected_status || '2xx'}, got ${r.status}`;
            xml += `      <failure message="${escapeXml(message)}" type="AssertionError">\n`;
            xml += `Status: ${r.status} ${r.statusText || ''}\n`;
            if (r.expected_status) xml += `Expected: ${r.expected_status}\n`;
            xml += `URL: ${escapeXml(r.url || '')}\n`;
            xml += `Method: ${r.method || 'GET'}\n`;
            xml += `Duration: ${r.time}ms\n`;
            if (r.error) xml += `Error: ${escapeXml(r.error)}\n`;
            xml += `      </failure>\n`;
        }

        xml += `    </testcase>\n`;
    }

    xml += `  </testsuite>\n`;
    xml += `</testsuites>\n`;

    return xml;
}

/**
 * Generate a standalone HTML report with embedded CSS.
 */
export function generateHtmlReport(results, summary, suiteName = 'TestOrbit Collection Run') {
    const timestamp = new Date().toLocaleString();

    const rows = results.map(r => {
        const cls = r.success ? 'pass' : 'fail';
        const icon = r.success ? '&#10003;' : '&#10007;';
        const methodLower = (r.method || 'GET').toLowerCase();
        const preview = r.responseBody
            ? escapeHtml(typeof r.responseBody === 'string' ? r.responseBody : JSON.stringify(r.responseBody)).slice(0, 500)
            : '';
        const errorText = r.error ? escapeHtml(r.error) : (r.success ? '' : `Got ${r.status}`);

        let html = `<tr class="${cls}">`;
        html += `<td class="sc"><span class="sb ${cls}">${icon}</span></td>`;
        html += `<td><span class="m ${methodLower}">${escapeHtml(r.method || 'GET')}</span></td>`;
        html += `<td class="nc">${escapeHtml(r.name || r.url || '')}</td>`;
        html += `<td>${r.status}</td>`;
        html += `<td>${r.time}ms</td>`;
        html += `<td>${r.expected_status || '2xx'}</td>`;
        html += `<td class="ec">${errorText}</td>`;
        html += `</tr>`;
        if (preview) {
            html += `<tr class="dr ${cls}"><td colspan="7"><details><summary>Response preview</summary><pre>${preview}</pre></details></td></tr>`;
        }
        return html;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(suiteName)} - Test Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#334155;line-height:1.5}
.c{max-width:1100px;margin:0 auto;padding:24px}
h1{font-size:20px;font-weight:700;margin-bottom:4px}
.mt{font-size:12px;color:#94a3b8;margin-bottom:24px}
.cds{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.cd{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center}
.cd .v{font-size:28px;font-weight:700}
.cd .l{font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px}
.cd.p .v{color:#16a34a}
.cd.f .v{color:#dc2626}
.cd.r .v{color:#7c3aed}
.tm{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.tm .cd .v{font-size:20px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px}
th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;padding:10px 12px;text-align:left;font-weight:600}
td{padding:8px 12px;border-top:1px solid #f1f5f9;font-size:13px}
tr.fail td{background:#fef2f2}
.m{font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;display:inline-block}
.m.get{color:#059669;background:#ecfdf5}
.m.post{color:#d97706;background:#fffbeb}
.m.put{color:#2563eb;background:#eff6ff}
.m.delete{color:#e11d48;background:#fff1f2}
.m.patch{color:#7c3aed;background:#f5f3ff}
.sb{font-weight:700;font-size:14px}
.sb.pass{color:#16a34a}
.sb.fail{color:#dc2626}
.nc{max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec{font-size:11px;color:#ef4444;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dr td{padding:4px 12px;background:#f8fafc}
.dr pre{font-size:11px;max-height:120px;overflow:auto;white-space:pre-wrap;word-break:break-all;background:#f1f5f9;padding:8px;border-radius:4px;margin:4px 0 8px}
details summary{cursor:pointer;font-size:11px;color:#64748b}
.ft{text-align:center;font-size:11px;color:#94a3b8;padding:16px 0;border-top:1px solid #e2e8f0}
</style>
</head>
<body>
<div class="c">
<h1>${escapeHtml(suiteName)}</h1>
<div class="mt">Generated by TestOrbit on ${escapeHtml(timestamp)}</div>

<div class="cds">
<div class="cd"><div class="v">${summary.totalRequests}</div><div class="l">Total Tests</div></div>
<div class="cd p"><div class="v">${summary.passed}</div><div class="l">Passed</div></div>
<div class="cd f"><div class="v">${summary.failed}</div><div class="l">Failed</div></div>
<div class="cd r"><div class="v">${summary.passRate}%</div><div class="l">Pass Rate</div></div>
</div>

<div class="tm">
<div class="cd"><div class="v">${summary.totalTime}ms</div><div class="l">Total Time</div></div>
<div class="cd"><div class="v">${summary.avgTime}ms</div><div class="l">Avg Time</div></div>
<div class="cd"><div class="v">${summary.maxTime}ms</div><div class="l">Slowest</div></div>
</div>

<table>
<thead><tr><th></th><th>Method</th><th>Name</th><th>Status</th><th>Time</th><th>Expected</th><th>Error</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>

<div class="ft">Generated by TestOrbit &mdash; AI-Native API Testing Platform</div>
</div>
</body>
</html>`;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
