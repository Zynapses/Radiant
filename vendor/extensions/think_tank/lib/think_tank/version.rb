# frozen_string_literal: true

module ThinkTank
  VERSION = "1.0.0"
  
  RADIANT_PROMPT_VERSION = "PROMPT-37"
  
  VERSION_INFO = {
    version: VERSION,
    prompt: RADIANT_PROMPT_VERSION,
    name: "Think Tank - Soft Morphing Agentic Framework",
    description: "AI-powered page builder for Radiant CMS using RADIANT API",
    rails_compatibility: "4.2 - 7.x",
    radiant_compatibility: "1.0+",
    api_backend: "RADIANT AWS (LiteLLM)"
  }.freeze
end
