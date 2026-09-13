import {
  type GitHubAdapter,
  type GitHubComment,
  type GitHubIssue,
  githubIssueSchema,
} from "./contracts.ts";
import { ProviderConfigurationError } from "./error.ts";
import { assertCommentBody, assertIssueInput, assertIssueNumber } from "./github-input.ts";

export interface GitHubFixtureConfig {
  mode: "local_fixture";
  owner: string;
  repo: string;
  issues: readonly GitHubIssue[];
}

export interface FixtureIssueComment {
  issueNumber: number;
  comment: GitHubComment;
}

export class FixtureGitHubAdapter implements GitHubAdapter {
  readonly mode = "local_fixture" as const;
  readonly #owner: string;
  readonly #repo: string;
  readonly #issues = new Map<number, GitHubIssue>();
  readonly #comments: FixtureIssueComment[] = [];
  #commentNumber = 0;

  constructor(config: GitHubFixtureConfig) {
    this.#owner = config.owner;
    this.#repo = config.repo;
    for (const issue of config.issues) {
      const parsed = githubIssueSchema.parse(issue);
      this.#issues.set(parsed.number, parsed);
    }
  }

  #requireIssue(issueNumber: number): GitHubIssue {
    assertIssueNumber(issueNumber);
    const issue = this.#issues.get(issueNumber);
    if (issue === undefined) {
      throw new ProviderConfigurationError(
        `GitHub fixture issue is not configured: ${String(issueNumber)}`,
      );
    }
    return issue;
  }

  #issueUrl(issueNumber: number): string {
    return `https://github.local/${this.#owner}/${this.#repo}/issues/${String(issueNumber)}`;
  }

  async readIssue(issueNumber: number): Promise<GitHubIssue> {
    return Promise.resolve(this.#requireIssue(issueNumber));
  }

  async createIssue(input: { title: string; body: string }): Promise<GitHubIssue> {
    assertIssueInput(input);
    const nextNumber = Math.max(0, ...this.#issues.keys()) + 1;
    const issue = githubIssueSchema.parse({
      id: nextNumber,
      number: nextNumber,
      title: input.title,
      body: input.body,
      state: "open",
      html_url: this.#issueUrl(nextNumber),
      labels: [],
      updated_at: new Date().toISOString(),
    });
    this.#issues.set(nextNumber, issue);
    return Promise.resolve(issue);
  }

  async listIssues(): Promise<GitHubIssue[]> {
    return Promise.resolve([...this.#issues.values()].sort((a, b) => b.number - a.number));
  }

  async createComment(issueNumber: number, body: string): Promise<GitHubComment> {
    this.#requireIssue(issueNumber);
    assertCommentBody(body);
    this.#commentNumber += 1;
    const comment: GitHubComment = {
      id: this.#commentNumber,
      body,
      html_url: `${this.#issueUrl(issueNumber)}#issuecomment-${String(this.#commentNumber)}`,
      created_at: new Date().toISOString(),
    };
    this.#comments.push({ issueNumber, comment });
    return Promise.resolve(comment);
  }

  async listComments(issueNumber: number): Promise<GitHubComment[]> {
    this.#requireIssue(issueNumber);
    return Promise.resolve(
      this.#comments
        .filter((entry) => entry.issueNumber === issueNumber)
        .map((entry) => ({ ...entry.comment })),
    );
  }

  listAllComments(): FixtureIssueComment[] {
    return this.#comments.map((entry) => ({
      issueNumber: entry.issueNumber,
      comment: { ...entry.comment },
    }));
  }
}
