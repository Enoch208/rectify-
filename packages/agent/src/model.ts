import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export const createRectifyModel = (apiKey: string, modelId: string): LanguageModel => {
  if (apiKey.length === 0 || modelId.length === 0) {
    throw new Error("OpenAI API key and model ID are required");
  }
  return createOpenAI({ apiKey })(modelId);
};
