import { ProviderConfigurationError } from "./error.ts";

export const assertIssueNumber = (issueNumber: number): void => {
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    throw new ProviderConfigurationError("GitHub issue number must be a positive integer");
  }
};

export const assertIssueInput = (input: { title: string; body: string }): void => {
  if (input.title.length === 0 || input.body.length === 0) {
    throw new ProviderConfigurationError("GitHub issue title and body are required");
  }
};

export const assertCommentBody = (body: string): void => {
  if (body.length === 0) {
    throw new ProviderConfigurationError("GitHub comment body is required");
  }
};
