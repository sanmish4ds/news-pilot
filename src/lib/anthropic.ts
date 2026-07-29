import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  }
  return new Anthropic({ apiKey });
}

/** Extracts the text from a Claude Messages API response. */
export function claudeText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Requests structured JSON via a forced tool call instead of asking the model
 * to write raw JSON text — the API parses and validates the tool arguments
 * itself, so there's no hand-rolled JSON.parse() to break on an occasional
 * malformed/truncated text response.
 */
export async function claudeStructured<T>(
  client: Anthropic,
  options: {
    system: string;
    userContent: string;
    maxTokens: number;
    toolName: string;
    toolDescription: string;
    inputSchema: Anthropic.Tool.InputSchema;
  }
): Promise<T> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: [{ role: "user", content: options.userContent }],
    tools: [
      {
        name: options.toolName,
        description: options.toolDescription,
        input_schema: options.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: options.toolName },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Claude did not return a tool call");
  }
  return toolUse.input as T;
}
