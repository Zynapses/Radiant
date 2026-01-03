# frozen_string_literal: true
#
# Admin::ThinkTankController - Mission Control Interface
#
# Handles the Think Tank admin interface including:
# - Dashboard view
# - Episode creation (prompt submission)
# - AJAX polling for log streaming
# - Configuration management
#
# Routes:
#   GET  /admin/think_tank           -> index (dashboard)
#   POST /admin/think_tank           -> create (submit prompt)
#   GET  /admin/think_tank/poll/:id  -> poll (AJAX log streaming)
#   GET  /admin/think_tank/settings  -> settings
#   PUT  /admin/think_tank/settings  -> update_settings

class Admin::ThinkTankController < ApplicationController
  # Radiant admin authentication
  # Use before_filter for Rails 4.x, before_action for Rails 5+
  if respond_to?(:before_action)
    before_action :login_required
  else
    before_filter :login_required
  end
  
  # =========================================================================
  # DASHBOARD
  # =========================================================================
  
  # GET /admin/think_tank
  # Main dashboard with split-screen terminal/preview
  def index
    @episodes = ThinkTank::Episode.recent.limit(20)
    @current_episode = ThinkTank::Episode.find_by(uuid: params[:uuid]) if params[:uuid]
    @templates = ThinkTank::Configuration.templates
    @api_configured = ThinkTank::Configuration.api_configured?
  end
  
  # =========================================================================
  # EPISODE CREATION
  # =========================================================================
  
  # POST /admin/think_tank
  # Submit a new prompt and start the agent
  def create
    prompt = params[:prompt]
    template = params[:template]
    model = params[:model]
    
    # Validate prompt
    if prompt.blank?
      flash[:error] = 'Please enter a prompt'
      redirect_to admin_think_tank_path and return
    end
    
    # Apply template if selected
    if template.present?
      template_text = ThinkTank::Configuration.templates[template]
      prompt = "#{template_text}\n\nSpecific request: #{prompt}" if template_text
    end
    
    # Create episode
    @episode = ThinkTank::Episode.create_for_prompt(
      goal: prompt,
      user: current_user,
      model: model
    )
    
    # Execute agent (synchronous for MVP, background job for production)
    if async_enabled?
      # Queue background job
      ThinkTankJob.perform_later(@episode.id)
      flash[:notice] = 'Task started! Watch the terminal for progress.'
    else
      # Synchronous execution (MVP mode)
      execute_synchronously(@episode)
    end
    
    redirect_to admin_think_tank_path(uuid: @episode.uuid)
  end
  
  # =========================================================================
  # AJAX POLLING
  # =========================================================================
  
  # GET /admin/think_tank/poll/:uuid
  # Returns JSON with logs and status for terminal streaming
  def poll
    @episode = ThinkTank::Episode.find_by!(uuid: params[:uuid])
    last_index = params[:last_index].to_i
    
    render json: {
      uuid: @episode.uuid,
      status: @episode.status,
      logs: @episode.logs_since(last_index),
      log_count: @episode.log_stream&.length || 0,
      preview_url: @episode.preview_url,
      duration: @episode.duration,
      tokens_used: @episode.tokens_used,
      cost_estimate: @episode.cost_estimate&.round(4)
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: 'Episode not found' }, status: :not_found
  end
  
  # =========================================================================
  # EPISODE MANAGEMENT
  # =========================================================================
  
  # GET /admin/think_tank/episodes/:uuid
  # Show details of a specific episode
  def show
    @episode = ThinkTank::Episode.find_by!(uuid: params[:uuid])
    @artifacts = @episode.think_tank_artifacts.ordered.includes(:artifactable)
  end
  
  # DELETE /admin/think_tank/episodes/:uuid
  # Cancel or delete an episode (and optionally its artifacts)
  def destroy
    @episode = ThinkTank::Episode.find_by!(uuid: params[:uuid])
    
    # Optionally delete created artifacts
    if params[:delete_artifacts] == 'true'
      delete_artifacts(@episode)
    end
    
    @episode.destroy
    
    flash[:notice] = 'Episode deleted'
    redirect_to admin_think_tank_path
  end
  
  # =========================================================================
  # SETTINGS
  # =========================================================================
  
  # GET /admin/think_tank/settings
  def settings
    @settings = ThinkTank::Configuration.settings
    @available_models = fetch_available_models
  end
  
  # PUT /admin/think_tank/settings
  def update_settings
    settings_params.each do |key, value|
      ThinkTank::Configuration.set(key, value, user: current_user)
    end
    
    flash[:notice] = 'Settings saved'
    redirect_to settings_admin_think_tank_path
  end
  
  # =========================================================================
  # API TEST
  # =========================================================================
  
  # POST /admin/think_tank/test_api
  # Test RADIANT API connectivity
  def test_api
    client = ThinkTank::RadiantApiClient.new
    
    if client.healthy?
      render json: { success: true, message: 'API connection successful' }
    else
      render json: { success: false, message: client.last_error || 'Connection failed' }
    end
  end
  
  # =========================================================================
  # PRIVATE METHODS
  # =========================================================================
  
  private
  
  def execute_synchronously(episode)
    agent = ThinkTank::Agent.new(episode)
    result = agent.execute
    
    if result[:success]
      flash[:notice] = "Page created: #{result[:page_url]}"
    else
      flash[:error] = "Build failed: #{result[:error]}"
    end
  end
  
  def async_enabled?
    # Check if background job infrastructure is available
    defined?(ThinkTankJob) && 
      (defined?(Sidekiq) || defined?(Delayed::Job) || defined?(ActiveJob))
  end
  
  def delete_artifacts(episode)
    episode.think_tank_artifacts.each do |artifact|
      artifact.artifactable&.destroy
    rescue StandardError => e
      Rails.logger.warn "[ThinkTank] Failed to delete artifact: #{e.message}"
    end
  end
  
  def fetch_available_models
    client = ThinkTank::RadiantApiClient.new
    models = client.list_models
    
    # Return model IDs, or fallback defaults
    if models.any?
      models.map { |m| m['id'] }
    else
      %w[claude-3-haiku claude-3-sonnet claude-3-opus gpt-4-turbo gpt-3.5-turbo]
    end
  end
  
  def settings_params
    # Strong parameters for settings
    # Rails 3.x: Use params directly
    # Rails 4+: Use require/permit
    if params[:settings].respond_to?(:permit)
      params.require(:settings).permit(
        :radiant_api_endpoint,
        :radiant_api_key,
        :radiant_tenant_id,
        :default_model,
        :max_tokens,
        :api_timeout,
        :auto_publish,
        :default_layout,
        :snippet_prefix
      )
    else
      params[:settings] || {}
    end
  end
  
  # Helper for admin_think_tank_path compatibility
  def admin_think_tank_path(options = {})
    url_for({ controller: 'admin/think_tank', action: 'index' }.merge(options))
  end
  
  def settings_admin_think_tank_path
    url_for(controller: 'admin/think_tank', action: 'settings')
  end
end
