# frozen_string_literal: true
#
# ThinkTank::Configuration - Semantic Memory Singleton
#
# Stores global settings and learned patterns for the Think Tank.
# Implements a simple key-value store with JSON values.
#
# Usage:
#   ThinkTank::Configuration.get('radiant_api_endpoint')
#   ThinkTank::Configuration.set('default_model', 'claude-3-opus')
#   ThinkTank::Configuration.settings  # Returns full global_settings hash

module ThinkTank
  class Configuration < ActiveRecord::Base
    self.table_name = 'think_tank_configurations'
    
    # =========================================================================
    # SERIALIZATION
    # =========================================================================
    
    # Value is stored as JSON
    serialize :value, Hash
    
    # =========================================================================
    # VALIDATIONS
    # =========================================================================
    
    validates :key, presence: true, uniqueness: true, length: { maximum: 100 }
    
    # =========================================================================
    # ASSOCIATIONS
    # =========================================================================
    
    belongs_to :updated_by, class_name: 'User', foreign_key: 'updated_by_id', optional: true
    
    # =========================================================================
    # CLASS METHODS - SINGLETON PATTERN
    # =========================================================================
    
    class << self
      # Get a specific setting from global_settings
      #
      # @param key [String] Setting key
      # @param default [Object] Default value if not found
      # @return [Object] Setting value
      def get(key, default = nil)
        settings[key.to_s] || default
      end
      
      # Set a specific setting in global_settings
      #
      # @param key [String] Setting key
      # @param value [Object] Setting value
      # @param user [User] User making the change (optional)
      def set(key, value, user: nil)
        config = find_or_create_by(key: 'global_settings')
        current = config.value || {}
        current[key.to_s] = value
        config.update!(value: current, updated_by_id: user&.id)
        
        # Clear cache
        @settings_cache = nil
        
        value
      end
      
      # Get all global settings as a hash
      #
      # @return [Hash] All settings
      def settings
        @settings_cache ||= begin
          config = find_by(key: 'global_settings')
          config&.value || default_settings
        end
      end
      
      # Force reload settings (clear cache)
      def reload_settings!
        @settings_cache = nil
        settings
      end
      
      # Get templates configuration
      def templates
        config = find_by(key: 'templates')
        config&.value || {}
      end
      
      # Add or update a template
      def set_template(name, prompt_template, user: nil)
        config = find_or_create_by(key: 'templates')
        current = config.value || {}
        current[name.to_s] = prompt_template
        config.update!(value: current, updated_by_id: user&.id)
      end
      
      # Check if RADIANT API is configured
      def api_configured?
        endpoint = get('radiant_api_endpoint')
        api_key = get('radiant_api_key')
        
        endpoint.present? && api_key.present?
      end
      
      # Get RADIANT API configuration
      def api_config
        {
          endpoint: get('radiant_api_endpoint'),
          api_key: get('radiant_api_key'),
          tenant_id: get('radiant_tenant_id'),
          default_model: get('default_model', 'claude-3-haiku'),
          max_tokens: get('max_tokens', 4096).to_i,
          timeout: get('api_timeout', 60).to_i
        }
      end
      
      private
      
      def default_settings
        {
          'radiant_api_endpoint' => '',
          'radiant_api_key' => '',
          'radiant_tenant_id' => '',
          'default_model' => 'claude-3-haiku',
          'auto_publish' => false,
          'max_tokens' => 4096,
          'api_timeout' => 60,
          'default_layout' => 'Normal',
          'snippet_prefix' => 'tt_'
        }
      end
    end
  end
end
