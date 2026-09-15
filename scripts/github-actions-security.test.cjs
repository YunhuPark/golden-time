const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const yaml = require('js-yaml');

const workflowPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/ai-crawler.yml',
];

for (const workflowPath of workflowPaths) {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  // GitHub silently refuses to run a workflow whose YAML is invalid, and the
  // regex assertions below still pass on such a file.
  test(`${workflowPath} is valid YAML without duplicate keys`, () => {
    assert.doesNotThrow(() => yaml.load(workflow, { filename: workflowPath }));
  });

  test(`${workflowPath} grants the GitHub token read-only repository contents`, () => {
    assert.match(workflow, /^permissions:\s*\n\s{2}contents:\s*read\s*$/m);
    assert.doesNotMatch(workflow, /^\s*write-all\s*$/m);
  });

  test(`${workflowPath} does not persist checkout credentials`, () => {
    assert.match(
      workflow,
      /uses:\s*actions\/checkout@v4[\s\S]{0,160}?persist-credentials:\s*false/
    );
  });
}
