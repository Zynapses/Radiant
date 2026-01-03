# frozen_string_literal: true
#
# Admin::ThinkTankHelper - View helpers for Think Tank admin interface

module Admin
  module ThinkTankHelper
    # Return status icon for episode status
    #
    # @param status [String] Episode status
    # @return [String] Emoji icon
    def status_icon(status)
      case status.to_s
      when 'pending'   then '⏳'
      when 'thinking'  then '🧠'
      when 'morphing'  then '🔨'
      when 'completed' then '✅'
      when 'failed'    then '❌'
      else '❓'
      end
    end
    
    # Return CSS class for episode status
    #
    # @param status [String] Episode status
    # @return [String] CSS class name
    def status_class(status)
      "tt-status-#{status}"
    end
    
    # Format duration for display
    #
    # @param seconds [Integer] Duration in seconds
    # @return [String] Formatted duration
    def format_duration(seconds)
      return 'N/A' unless seconds
      
      if seconds < 60
        "#{seconds}s"
      elsif seconds < 3600
        "#{(seconds / 60).floor}m #{seconds % 60}s"
      else
        "#{(seconds / 3600).floor}h #{((seconds % 3600) / 60).floor}m"
      end
    end
    
    # Format cost estimate for display
    #
    # @param cost [Float] Cost in dollars
    # @return [String] Formatted cost
    def format_cost(cost)
      return 'N/A' unless cost
      "$#{cost.round(4)}"
    end
    
    # Format token count for display
    #
    # @param tokens [Integer] Token count
    # @return [String] Formatted token count
    def format_tokens(tokens)
      return 'N/A' unless tokens
      
      if tokens >= 1000
        "#{(tokens / 1000.0).round(1)}K"
      else
        tokens.to_s
      end
    end
    
    # Check if API is configured
    #
    # @return [Boolean] True if API endpoint and key are set
    def api_configured?
      ThinkTank::Configuration.api_configured?
    end
    
    # Get available AI models for dropdown
    #
    # @return [Array<Array>] Array of [label, value] pairs
    def model_options
      models = %w[claude-3-haiku claude-3-sonnet claude-3-opus gpt-4-turbo gpt-3.5-turbo]
      models.map { |m| [m, m] }
    end
    
    # Get available templates for dropdown
    #
    # @return [Array<Array>] Array of [label, value] pairs
    def template_options
      templates = ThinkTank::Configuration.templates
      [['-- None --', '']] + templates.keys.map { |k| [k.to_s.titleize, k] }
    end
  end
end
