import { z } from "zod";
import { githubRemoteConfigSchema } from "./config.ts";
import {
  type GitHubAdapter,
  type GitHubComment,
  githubCommentSchema,
  type GitHubIssue,
  type ProviderMode,
} from "./contracts.ts";
import { assertCommentBody, assertIssueInput, assertIssueNumber } from "./github-input.ts";
import { providerUrl, requestJson } from "./http.ts";

export interface GitHubRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

const githubIssueResponseSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.number().int().positive(),
    title: z.string().min(1),
    body: z.string().nullable(),
    state: z.enum(["open", "closed"]),
    html_url: z.url(),
    labels: z.array(z.union([z.string(), z.object({ name: z.string() })])).default([]),
    updated_at: z.string().min(1),
  })
  .transform((issue): GitHubIssue => ({
    ...issue,
    labels: issue.labels.map((label) => (typeof label === "string" ? label : label.name)),
  }));

const githubIssueListSchema = z
  .array(z.record(z.string(), z.unknown()))
  .transform((entries) => entries.filter((entry) => !Object.hasOwn(entry, "pull_request")))
  .pipe(z.array(githubIssueResponseSchema));

const headersFor = (accessToken: string): Record<string, string> => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
  "user-agent": "rectify",
  "x-github-api-version": "2026-03-10",
});

export class RemoteGitHubAdapter implements GitHubAdapter {
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

  #issuesUrl(suffix = "", query: Record<string, string> = {}): URL {
    const owner = encodeURIComponent(this.#owner);
    const repo = encodeURIComponent(this.#repo);
    const url = providerUrl(this.#baseUrl, `repos/${owner}/${repo}/issues${suffix}`);
    url.search = new URLSearchParams(query).toString();
    return url;
  }

  async readIssue(issueNumber: number): Promise<GitHubIssue> {
    assertIssueNumber(issueNumber);
    return requestJson(
      this.#issuesUrl(`/${String(issueNumber)}`),
      { headers: headersFor(this.#accessToken) },
      githubIssueResponseSchema,
    );
  }

  async createIssue(input: { title: string; body: string }): Promise<GitHubIssue> {
    assertIssueInput(input);
    return requestJson(
      this.#issuesUrl(),
      {
        method: "POST",
        headers: headersFor(this.#accessToken),
        body: JSON.stringify({ title: input.title, body: input.body }),
      },
      githubIssueResponseSchema,
    );
  }

  async listIssues(): Promise<GitHubIssue[]> {
    return requestJson(
      this.#issuesUrl("", { state: "all", per_page: "50", sort: "created", direction: "desc" }),
      { headers: headersFor(this.#accessToken) },
      githubIssueListSchema,
    );
  }

  async createComment(issueNumber: number, body: string): Promise<GitHubComment> {
    assertIssueNumber(issueNumber);
    assertCommentBody(body);
    return requestJson(
      this.#issuesUrl(`/${String(issueNumber)}/comments`),
      {
        method: "POST",
        headers: headersFor(this.#accessToken),
        body: JSON.stringify({ body }),
      },
      githubCommentSchema,
    );
  }

  async listComments(issueNumber: number): Promise<GitHubComment[]> {
    assertIssueNumber(issueNumber);
    return requestJson(
      this.#issuesUrl(`/${String(issueNumber)}/comments`, { per_page: "100" }),
      { headers: headersFor(this.#accessToken) },
      z.array(githubCommentSchema),
    );
  }
}
