import { githubRemoteConfigSchema } from "./config.ts";
import {
  type GitHubAdapter,
  type GitHubIssue,
  githubIssueSchema,
  type ProviderMode,
} from "./contracts.ts";
import { ProviderConfigurationError } from "./error.ts";
import { providerUrl, requestJson } from "./http.ts";

interface GitHubRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

export interface GitHubLiveConfig {
  mode: "live";
  accessToken: string;
  owner: string;
  repo: string;
}

export interface GitHubArgaConfig {
  mode: "arga";
  accessToken: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

export interface GitHubFixtureConfig {
  mode: "local_fixture";
  owner: string;
  repo: string;
  issues: readonly GitHubIssue[];
}

export type GitHubConfig = GitHubLiveConfig | GitHubArgaConfig | GitHubFixtureConfig;

const headersFor = (accessToken: string): Record<string, string> => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
  "user-agent": "rectify",
  "x-github-api-version": "2026-03-10",
});

class RemoteGitHubAdapter implements GitHubAdapter {
  readonly mode: ProviderMode;
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #owner: string;
  readonly #repo: string;

  constructor(config: GitHubRemoteConfig) {
    const parsed = githubRemoteConfigSchema.parse(config);
    this.mode = parsed.mode;
    this.#accessToken = parsed.accessToken;
    this.#baseUrl = parsed.baseUrl;
    this.#owner = parsed.owner;
    this.#repo = parsed.repo;
  }

  #issuesUrl(suffix = ""): URL {
    const owner = encodeURIComponent(this.#owner);
    const repo = encodeURIComponent(this.#repo);
    return providerUrl(this.#baseUrl, `repos/${owner}/${repo}/issues${suffix}`);
  }

  async readIssue(issueNumber: number): Promise<GitHubIssue> {
    if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
      throw new ProviderConfigurationError("GitHub issue number must be a positive integer");
    }
    return requestJson(
      this.#issuesUrl(`/${String(issueNumber)}`),
      { headers: headersFor(this.#accessToken) },
      githubIssueSchema,
    );
  }

  createIssue(input: { title: string; body: string }): Promise<GitHubIssue> {
    if (input.title.length === 0 || input.body.length === 0) {
      throw new ProviderConfigurationError("GitHub issue title and body are required");
    }
    return requestJson(
      this.#issuesUrl(),
      {
        method: "POST",
        headers: headersFor(this.#accessToken),
        body: JSON.stringify(input),
      },
      githubIssueSchema,
    );
  }
}

class FixtureGitHubAdapter implements GitHubAdapter {
  readonly mode = "local_fixture" as const;
  readonly #owner: string;
  readonly #repo: string;
  readonly #issues = new Map<number, GitHubIssue>();

  constructor(config: GitHubFixtureConfig) {
    this.#owner = config.owner;
    this.#repo = config.repo;
    for (const issue of config.issues) {
      const parsed = githubIssueSchema.parse(issue);
      this.#issues.set(parsed.number, parsed);
    }
  }

  async readIssue(issueNumber: number): Promise<GitHubIssue> {
    const issue = this.#issues.get(issueNumber);
    if (issue === undefined) {
      throw new ProviderConfigurationError(
        `GitHub fixture issue is not configured: ${String(issueNumber)}`,
      );
    }
    return Promise.resolve(issue);
  }

  createIssue(input: { title: string; body: string }): Promise<GitHubIssue> {
    const nextNumber = Math.max(0, ...this.#issues.keys()) + 1;
    const issue = githubIssueSchema.parse({
      id: nextNumber,
      number: nextNumber,
      title: input.title,
      body: input.body,
      state: "open",
      html_url: `https://github.local/${this.#owner}/${this.#repo}/issues/${String(nextNumber)}`,
    });
    this.#issues.set(nextNumber, issue);
    return Promise.resolve(issue);
  }
}

export const createGitHubAdapter = (config: GitHubConfig): GitHubAdapter => {
  switch (config.mode) {
    case "live":
      return new RemoteGitHubAdapter({ ...config, baseUrl: "https://api.github.com" });
    case "arga":
      return new RemoteGitHubAdapter(config);
    case "local_fixture":
      return new FixtureGitHubAdapter(config);
  }
};
