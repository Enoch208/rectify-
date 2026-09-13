import type { GitHubAdapter } from "./contracts.ts";
import { FixtureGitHubAdapter, type GitHubFixtureConfig } from "./github-fixture.ts";
import { RemoteGitHubAdapter } from "./github-remote.ts";

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

export type GitHubConfig = GitHubLiveConfig | GitHubArgaConfig | GitHubFixtureConfig;

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
