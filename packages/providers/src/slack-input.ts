import type { SlackPostInput } from "./contracts.ts";
import { ProviderConfigurationError } from "./error.ts";

export const assertSlackLimit = (limit: number): void => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ProviderConfigurationError("Slack message limit must be between 1 and 100");
  }
};

export const assertSlackPost = (input: SlackPostInput): void => {
  if (input.text.length === 0) {
    throw new ProviderConfigurationError("Slack message text cannot be empty");
  }
  if (input.threadTs?.length === 0) {
    throw new ProviderConfigurationError("Slack thread timestamp cannot be empty");
  }
};
