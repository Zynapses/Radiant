# frozen_string_literal: true
#
# ThinkTank::Agent - AI Orchestration for Page Generation
#
# Coordinates the AI reasoning process and translates natural language
# prompts into structured page specifications that the Builder can morph.
#
# Workflow:
#   1. User prompt → Agent analyzes intent
#   2. Agent calls RADIANT API for AI reasoning
#   3. Agent extracts structured output (slug, HTML, JS, CSS)
#   4. Agent invokes Builder to create Radiant objects
#
# Usage:
#   agent = ThinkTank::Agent.new(episode)
#   result = agent.execute("Build a mortgage calculator")

module ThinkTank
  class Agent
    attr_reader :episode, :api_client
    
    # System prompt for the AI agent
    SYSTEM_PROMPT = <<~PROMPT
      You are an expert web developer assistant integrated into Radiant CMS.
      Your job is to create complete, functional web pages based on user requests.
      
      When asked to build something, you MUST respond with a JSON object containing:
      {
        "slug": "url-friendly-page-slug",
        "title": "Human Readable Page Title",
        "html": "<complete HTML markup for the page body>",
        "javascript": "complete JavaScript code (or null if not needed)",
        "css": "complete CSS styles (or null if not needed)",
        "description": "Brief description of what you built"
      }
      
      Guidelines:
      - Create complete, working code - no placeholders
      - Use vanilla JavaScript (no frameworks)
      - Use responsive CSS
      - Include accessibility attributes (aria-labels, semantic HTML)
      - Make the UI visually appealing with modern styling
      - Handle edge cases and errors gracefully
      - The HTML will be wrapped in Radiant's layout, so don't include <html>, <head>, or <body> tags
      
      IMPORTANT: Your entire response must be valid JSON. No markdown, no explanations outside the JSON.
    PROMPT
    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def initialize(episode)
      @episode = episode
      @api_client = RadiantApiClient.new
    end
    
    # =========================================================================
    # MAIN EXECUTION
    # =========================================================================
    
    # Execute the agent workflow for a given prompt
    #
    # @param prompt [String] User's natural language request
    # @return [Hash] Result with :success and :page or :error
    def execute(prompt = nil)
      prompt ||= episode.goal
      
      # Validate API configuration
      unless api_client.configured?
        return fail_with('RADIANT API not configured. Please configure in Think Tank settings.')
      end
      
      # Phase 1: Thinking
      episode.start_thinking!
      
      # Call AI for reasoning
      ai_response = call_ai(prompt)
      
      unless ai_response[:success]
        return fail_with("AI request failed: #{ai_response[:error]}")
      end
      
      # Parse the structured response
      spec = parse_ai_response(ai_response[:content])
      
      unless spec[:success]
        return fail_with("Failed to parse AI response: #{spec[:error]}")
      end
      
      # Record token usage
      update_usage(ai_response[:usage], ai_response[:model])
      
      # Phase 2: Morphing
      episode.start_morphing!
      
      # Build the page using the Builder service
      builder = Builder.new(episode)
      result = builder.morph(
        slug: spec[:slug],
        title: spec[:title],
        html_body: spec[:html],
        js_logic: spec[:javascript],
        css_styles: spec[:css]
      )
      
      if result[:success]
        episode.complete!(result[:artifacts])
        {
          success: true,
          page: result[:page],
          page_url: result[:page_url],
          description: spec[:description]
        }
      else
        fail_with(result[:errors].join(', '))
      end
      
    rescue StandardError => e
      Rails.logger.error "[ThinkTank::Agent] #{e.message}\n#{e.backtrace.first(10).join("\n")}"
      fail_with("Unexpected error: #{e.message}")
    end
    
    # =========================================================================
    # AI INTERACTION
    # =========================================================================
    
    private
    
    def call_ai(prompt)
      episode.log!('Sending request to RADIANT API...', level: :info)
      
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
      
      api_client.chat(
        messages: messages,
        model: episode.model_used || Configuration.get('default_model'),
        temperature: 0.7
      )
    end
    
    def parse_ai_response(content)
      episode.log!('Parsing AI response...', level: :info)
      
      # Try to extract JSON from the response
      json_content = extract_json(content)
      
      unless json_content
        return { success: false, error: 'No valid JSON found in response' }
      end
      
      spec = JSON.parse(json_content)
      
      # Validate required fields
      missing = %w[slug title html].reject { |f| spec[f].present? }
      
      if missing.any?
        return { success: false, error: "Missing required fields: #{missing.join(', ')}" }
      end
      
      {
        success: true,
        slug: spec['slug'],
        title: spec['title'],
        html: spec['html'],
        javascript: spec['javascript'],
        css: spec['css'],
        description: spec['description'] || ''
      }
    rescue JSON::ParserError => e
      { success: false, error: "JSON parse error: #{e.message}" }
    end
    
    def extract_json(content)
      # Try direct parse first
      return content if valid_json?(content)
      
      # Try to find JSON in markdown code blocks
      if content =~ /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        return $1 if valid_json?($1)
      end
      
      # Try to find raw JSON object
      if content =~ /(\{[\s\S]*\})/
        candidate = $1
        return candidate if valid_json?(candidate)
      end
      
      nil
    end
    
    def valid_json?(str)
      JSON.parse(str)
      true
    rescue JSON::ParserError
      false
    end
    
    def update_usage(usage, model)
      return unless usage.is_a?(Hash)
      
      tokens = usage['total_tokens'] || 0
      
      # Estimate cost (rough approximation based on model)
      cost = estimate_cost(tokens, model)
      
      episode.update(
        tokens_used: tokens,
        cost_estimate: cost,
        model_used: model
      )
      
      episode.log!("Tokens used: #{tokens} (~$#{cost.round(4)})", level: :info)
    end
    
    def estimate_cost(tokens, model)
      # Cost per 1K tokens (rough estimates)
      rates = {
        'claude-3-opus' => 0.015,
        'claude-3-sonnet' => 0.003,
        'claude-3-haiku' => 0.00025,
        'gpt-4' => 0.03,
        'gpt-4-turbo' => 0.01,
        'gpt-3.5-turbo' => 0.0015
      }
      
      rate = rates[model] || 0.001
      (tokens / 1000.0) * rate
    end
    
    def fail_with(message)
      episode.fail!(message)
      { success: false, error: message }
    end
  end
end
