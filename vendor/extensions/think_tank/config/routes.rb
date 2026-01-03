# frozen_string_literal: true
#
# Think Tank Extension Routes (Rails 4+)
#
# For Rails 2.3/3.x, routes are defined in think_tank_extension.rb
# This file provides modern routing for Rails 4+ applications

Rails.application.routes.draw do
  namespace :admin do
    # Main Think Tank routes
    resources :think_tank, controller: 'think_tank', only: [:index, :create, :show, :destroy] do
      collection do
        get :settings
        put :settings, action: :update_settings
        post :test_api
      end
      
      member do
        get :poll
      end
    end
    
    # Convenience route for polling with UUID in path
    get 'think_tank/poll/:uuid', to: 'think_tank#poll', as: :think_tank_poll
  end
end
