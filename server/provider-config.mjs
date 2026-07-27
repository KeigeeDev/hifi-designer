import { HttpError } from "./security.mjs";

export const PROVIDERS = Object.freeze({
  codex: Object.freeze({
    id: "codex",
    name: "OpenAI Codex",
    subscriptionLabel: "ChatGPT subscription",
    defaultModel: "gpt-5.6-sol",
    models: Object.freeze([
      Object.freeze({ id: "gpt-5.6-sol", name: "GPT-5.6 Sol", description: "Highest-quality design generation" }),
      Object.freeze({ id: "gpt-5.6-terra", name: "GPT-5.6 Terra", description: "Balanced speed and capability" }),
    ]),
  }),
  claude: Object.freeze({
    id: "claude",
    name: "Anthropic Claude",
    subscriptionLabel: "Claude subscription",
    defaultModel: "default",
    models: Object.freeze([
      Object.freeze({ id: "default", name: "Account default", description: "Recommended for your Claude plan" }),
      Object.freeze({ id: "sonnet", name: "Sonnet", description: "Fast, capable design iteration" }),
      Object.freeze({ id: "opus", name: "Opus", description: "Complex visual reasoning" }),
      Object.freeze({ id: "haiku", name: "Haiku", description: "Fastest lightweight option" }),
    ]),
  }),
});

export function validateProviderSelection(providerValue, modelValue) {
  const provider = String(providerValue || "codex").toLowerCase();
  const definition = PROVIDERS[provider];
  if (!definition) throw new HttpError(400, "Choose a supported agent provider.", "invalid_provider");
  const model = String(modelValue || definition.defaultModel);
  if (!definition.models.some((candidate) => candidate.id === model)) {
    throw new HttpError(400, `Choose a supported ${definition.name} model.`, "invalid_model", { provider });
  }
  return { provider, model, authMode: "subscription" };
}

export function publicProviderDefinition(id, status = {}) {
  const definition = PROVIDERS[id];
  return {
    id,
    name: definition.name,
    subscriptionLabel: definition.subscriptionLabel,
    defaultModel: definition.defaultModel,
    models: definition.models,
    connected: Boolean(status.connected),
    method: status.method || null,
    plan: status.plan || null,
    reason: status.reason || null,
  };
}
