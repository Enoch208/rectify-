import type { VercelAITelemetryIntegration } from "@uselemma/tracing";
import type { Telemetry } from "ai";

export const adaptLemmaTelemetry = (lemma: VercelAITelemetryIntegration): Telemetry => ({
  onStart: (event) =>
    lemma.onStart?.({
      model: { provider: event.provider, modelId: event.modelId },
      ...("prompt" in event && event.prompt !== undefined ? { prompt: event.prompt } : {}),
      ...("messages" in event && event.messages !== undefined ? { messages: event.messages } : {}),
    }),
  onStepStart: (event) =>
    lemma.onStepStart?.({
      callId: event.callId,
      provider: event.provider,
      modelId: event.modelId,
      stepNumber: event.stepNumber,
      ...(event.instructions !== undefined ? { instructions: event.instructions } : {}),
      messages: event.messages,
    }),
  onLanguageModelCallStart: (event) =>
    lemma.onLanguageModelCallStart?.({
      callId: event.callId,
      provider: event.provider,
      modelId: event.modelId,
      messages: event.messages,
      ...(event.tools !== undefined ? { tools: event.tools } : {}),
    }),
  onLanguageModelCallEnd: (event) =>
    lemma.onLanguageModelCallEnd?.({
      callId: event.callId,
      provider: event.provider,
      modelId: event.modelId,
      content: event.content,
      performance: { responseTimeMs: event.performance.responseTimeMs },
      usage: event.usage,
    }),
  onToolExecutionStart: (event) =>
    lemma.onToolExecutionStart?.({
      callId: event.callId,
      toolCall: {
        toolCallId: event.toolCall.toolCallId,
        toolName: event.toolCall.toolName,
        input: event.toolCall.input,
      },
    }),
  onToolExecutionEnd: (event) =>
    lemma.onToolExecutionEnd?.({
      callId: event.callId,
      toolCall: {
        toolCallId: event.toolCall.toolCallId,
        toolName: event.toolCall.toolName,
        input: event.toolCall.input,
      },
      toolExecutionMs: event.toolExecutionMs,
      toolOutput:
        event.toolOutput.type === "tool-result"
          ? { type: "tool-result", output: event.toolOutput.output }
          : { type: "tool-error", error: event.toolOutput.error },
    }),
  onStepEnd: (event) =>
    lemma.onStepEnd?.({
      callId: event.callId,
      stepNumber: event.stepNumber,
      model: event.model,
      text: event.text,
      content: event.content,
      performance: event.performance,
      toolCalls: event.toolCalls,
      usage: event.usage,
    }),
  onEnd: (event) =>
    lemma.onEnd?.({
      ...("text" in event ? { text: event.text } : {}),
      ...("content" in event ? { content: event.content } : {}),
      ...("usage" in event ? { usage: event.usage } : {}),
    }),
});
