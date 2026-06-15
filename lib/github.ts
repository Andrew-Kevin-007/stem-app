import { App } from '@octokit/app';

function getOctokitApp() {
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey,
    webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET! },
  });
}

async function getInstallationOctokit(owner: string, repo: string) {
  const app = getOctokitApp();
  const octokit = await app.getInstallationOctokit(
    await getInstallationId(app, owner, repo)
  );
  return octokit;
}

async function getInstallationId(app: App, owner: string, repo: string): Promise<number> {
  const octokit = await app.octokit;
  const res = await octokit.request('GET /repos/{owner}/{repo}/installation', { owner, repo });
  return res.data.id;
}

export async function postBranchComment(
  owner: string,
  repo: string,
  prNumber: number,
  data: {
    cloneId: string;
    anonymizedCols: string[];
    costPerDay: number;
    readyInSeconds: number;
  }
) {
  const octokit = await getInstallationOctokit(owner, repo);

  const body = buildComment(data);

  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

export async function postMaskingNeeded(owner: string, repo: string, prNumber: number, cloneId: string) {
  const octokit = await getInstallationOctokit(owner, repo);
  const body =
    `## 🌿 Stem — Masking Configuration Needed\n\n` +
    `The clone \`${cloneId}\` was provisioned, but Stem detected **no PII columns** ` +
    `it recognized in this database, so the branch was **not** exposed — Stem will ` +
    `never hand out a clone it could not anonymize.\n\n` +
    `Add masking rules for this schema (or rename columns to recognized patterns ` +
    `such as \`email\`, \`phone\`, \`ssn\`, \`*_name\`, \`card_number\`, \`address\`), ` +
    `then reopen the PR.\n\n` +
    `---\n*Posted by Stem · fail-closed: no unmasked data is ever served*`;

  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

export async function postCloneDestroyed(owner: string, repo: string, prNumber: number) {
  const octokit = await getInstallationOctokit(owner, repo);

  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: prNumber,
    body: `## 🌿 Stem Branch Destroyed\n\nPR closed — Aurora clone deleted. Production database was never touched.`,
  });
}

function buildComment(data: {
  cloneId: string;
  anonymizedCols: string[];
  costPerDay: number;
  readyInSeconds: number;
}): string {
  let comment = `## 🌿 Stem Branch Ready\n\n`;
  comment += `| | |\n|---|---|\n`;
  comment += `| Ready in | ${data.readyInSeconds}s |\n`;
  comment += `| Branch ID | \`${data.cloneId}\` |\n`;
  comment += `| Cost | ~$${data.costPerDay.toFixed(2)}/day |\n\n`;

  if (data.anonymizedCols.length > 0) {
    comment += `### 🔒 ${data.anonymizedCols.length} column(s) anonymized\n`;
    comment += data.anonymizedCols.map(c => `- \`${c}\``).join('\n');
    comment += `\n\n> Real customer data replaced with realistic fake data. Safe for contractors and external reviewers.\n\n`;
  }

  comment += `---\n*Posted by Stem · Branch auto-expires on PR close*`;
  return comment;
}