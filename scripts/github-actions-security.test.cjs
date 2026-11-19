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
    const parsed = yaml.load(workflow);
    const checkouts = Object.values(parsed.jobs)
      .flatMap((job) => job.steps || [])
      .filter((step) => step.uses?.startsWith('actions/checkout@'));
    assert.ok(checkouts.length > 0, 'A checkout step must be verified');
    for (const step of checkouts) {
      assert.equal(step.with?.['persist-credentials'], false);
    }
  });

  test(`${workflowPath} pins every external action to a full commit SHA`, () => {
    const parsed = yaml.load(workflow);
    for (const job of Object.values(parsed.jobs)) {
      const references = [job.uses, ...(job.steps || []).map((step) => step.uses)]
        .filter((value) => value && !value.startsWith('./'));
      for (const reference of references) {
        assert.match(reference, /@[0-9a-f]{40}$/);
      }
    }
  });
}
