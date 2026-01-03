# frozen_string_literal: true
#
# Think Tank Extension for Radiant CMS
#
# Adds an AI-powered page builder ("Soft Morphing") that creates
# Pages and Snippets from natural language prompts via RADIANT API.
#
# Compatibility: Radiant CMS 1.0+ / Rails 4.2+

class ThinkTankExtension < Radiant::Extension
  version     "1.0.0"
  description "AI-powered page builder using RADIANT API - Soft Morphing Framework"
  url         "https://github.com/radiant/think_tank"
  
  # Extension root path helper
  def self.root
    File.expand_path('..', __FILE__)
  end
  
  # Define routes for the extension (Rails 2.3/3.x style)
  # For Rails 4+, routes are also defined in config/routes.rb
  define_routes do |map|
    map.namespace :admin do |admin|
      admin.resources :think_tank, 
        controller: 'think_tank',
        only: [:index, :create, :show, :destroy],
        collection: {
          settings: :get,
          update_settings: :put,
          test_api: :post
        },
        member: {
          poll: :get
        }
    end
  end
  
  def activate
    # Add admin tab for Think Tank
    tab 'Content' do
      add_item 'Think Tank', '/admin/think_tank', after: 'Snippets'
    end
    
    # Load extension models
    %w[episode configuration artifact builder agent radiant_api_client].each do |model|
      require_dependency File.join(ThinkTankExtension.root, 'app', 'models', 'think_tank', model)
    end
    
    # Load helper
    require_dependency File.join(ThinkTankExtension.root, 'app', 'helpers', 'admin', 'think_tank_helper')
    
    # Include helper in controller
    Admin::ThinkTankController.class_eval do
      include Admin::ThinkTankHelper
    end if defined?(Admin::ThinkTankController)
    
    # Register admin stylesheet
    if respond_to?(:admin) && admin.respond_to?(:stylesheet)
      admin.stylesheet 'admin/think_tank'
    end
  end
  
  def deactivate
    # Remove admin tab if needed
  end
end
