# frozen_string_literal: true
#
# ThinkTank::RadiantApiClient - Integration with RADIANT AWS API
#
# Connects to the RADIANT platform's LiteLLM proxy to access AI models.
# Supports all models available through the RADIANT unified gateway.
#
# Usage:
#   client = ThinkTank::RadiantApiClient.new
#   response = client.chat(
#     messages: [{ role: 'user', content: 'Build a calculator' }],
#     model: 'claude-3-opus'
#   )

require 'net/http'
require 'json'
require 'uri'

module ThinkTank
  class RadiantApiClient
    attr_reader :config, :last_error
    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def initialize(config = nil)
      @config = config || Configuration.api_config
      @last_error = nil
    end
    
    # =========================================================================
    # API METHODS
    # =========================================================================
    
    # Send a chat completion request to RADIANT API
    #
    # @param messages [Array<Hash>] Chat messages array
    # @param model [String] Model identifier (optional)
    # @param max_tokens [Integer] Max response tokens (optional)
    # @param temperature [Float] Sampling temperature (optional)
    # @param stream [Boolean] Stream response (not supported yet)
    # @return [Hash] Response with :success, :content, :usage, :model
    def chat(messages:, model: nil, max_tokens: nil, temperature: 0.7, stream: false)
      @last_error = nil
      
      unless configured?
        @last_error = 'RADIANT API not configured. Please set endpoint and API key.'
        return error_response(@last_error)
      end
      
      payload = {
        model: model || config[:default_model],
        messages: messages,
        max_tokens: max_tokens || config[:max_tokens],
        temperature: temperature
      }
      
      # Add tenant ID if configured
      payload[:metadata] = { tenant_id: config[:tenant_id] } if config[:tenant_id].present?
      
      response = make_request('/v1/chat/completions', payload)
      parse_chat_response(response)
    rescue StandardError => e
      @last_error = e.message
      Rails.logger.error "[ThinkTank::RadiantApiClient] #{e.message}"
      error_response(e.message)
    end
    
    # List available models from RADIANT API
    #
    # @return [Array<Hash>] List of available models
    def list_models
      @last_error = nil
      
      unless configured?
        return []
      end
      
      response = make_request('/v1/models', nil, method: :get)
      
      if response[:success] && response[:data].is_a?(Hash)
        response[:data]['data'] || []
      else
        []
      end
    rescue StandardError => e
      Rails.logger.error "[ThinkTank::RadiantApiClient] list_models: #{e.message}"
      []
    end
    
    # Check API health/connectivity
    #
    # @return [Boolean] True if API is reachable
    def healthy?
      return false unless configured?
      
      response = make_request('/health', nil, method: :get)
      response[:success]
    rescue StandardError
      false
    end
    
    # =========================================================================
    # CONFIGURATION
    # =========================================================================
    
    # Check if API is properly configured
    def configured?
      config[:endpoint].present? && config[:api_key].present?
    end
    
    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================
    
    private
    
    def make_request(path, payload, method: :post)
      uri = URI.join(config[:endpoint], path)
      
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      http.open_timeout = 10
      http.read_timeout = config[:timeout] || 60
      
      request = build_request(uri, payload, method)
      
      response = http.request(request)
      
      {
        success: response.is_a?(Net::HTTPSuccess),
        status: response.code.to_i,
        data: parse_json(response.body)
      }
    end
    
    def build_request(uri, payload, method)
      case method
      when :get
        request = Net::HTTP::Get.new(uri)
      when :post
        request = Net::HTTP::Post.new(uri)
        request.body = payload.to_json if payload
      else
        raise ArgumentError, "Unsupported method: #{method}"
      end
      
      request['Content-Type'] = 'application/json'
      request['Authorization'] = "Bearer #{config[:api_key]}"
      request['X-Tenant-ID'] = config[:tenant_id] if config[:tenant_id].present?
      request['User-Agent'] = 'ThinkTank-RadiantCMS/1.0'
      
      request
    end
    
    def parse_json(body)
      JSON.parse(body)
    rescue JSON::ParserError
      { 'error' => 'Invalid JSON response', 'raw' => body }
    end
    
    def parse_chat_response(response)
      unless response[:success]
        error_msg = response[:data]['error']&.dig('message') || "API error: #{response[:status]}"
        @last_error = error_msg
        return error_response(error_msg)
      end
      
      data = response[:data]
      choice = data['choices']&.first
      
      unless choice
        @last_error = 'No response from model'
        return error_response(@last_error)
      end
      
      {
        success: true,
        content: choice.dig('message', 'content'),
        role: choice.dig('message', 'role'),
        finish_reason: choice['finish_reason'],
        model: data['model'],
        usage: data['usage'] || {},
        raw: data
      }
    end
    
    def error_response(message)
      {
        success: false,
        error: message,
        content: nil
      }
    end
  end
end
