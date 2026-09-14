const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')
);

test('Vercel runtime filters only the platform DEP0169 warning', () => {
  assert.equal(
    config.env?.NODE_OPTIONS,
    '--disable-warning=DEP0169',
    'do not broaden this to --no-deprecation or --no-warnings'
  );

  const result = spawnSync(
    process.execPath,
    [
      '-e',
      [
        "require('node:url').parse('https://example.com')",
        "process.emitWarning('control warning', { code: 'GOLDEN_TIME_CONTROL' })",
      ].join('; '),
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_OPTIONS: config.env.NODE_OPTIONS,
      },
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /DEP0169/);
  assert.match(result.stderr, /GOLDEN_TIME_CONTROL/);
});
