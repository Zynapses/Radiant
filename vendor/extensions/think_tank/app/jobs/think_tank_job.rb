# frozen_string_literal: true
#
# ThinkTankJob - Background job for async agent execution
#
# Executes the Think Tank agent in the background to prevent
# request timeouts on complex builds.
#
# Compatible with:
# - Sidekiq
# - Delayed::Job
# - Resque
# - Any ActiveJob adapter

class ThinkTankJob < ApplicationJob
  queue_as :default
  
  # Retry configuration
  retry_on StandardError, wait: 5.seconds, attempts: 3
  discard_on ActiveRecord::RecordNotFound
  
  def perform(episode_id)
    episode = ThinkTank::Episode.find(episode_id)
    
    # Skip if already processed
    return if episode.terminal?
    
    # Execute the agent
    agent = ThinkTank::Agent.new(episode)
    agent.execute
    
  rescue StandardError => e
    Rails.logger.error "[ThinkTankJob] Failed: #{e.message}"
    
    # Mark episode as failed if not already
    episode = ThinkTank::Episode.find_by(id: episode_id)
    episode&.fail!("Background job error: #{e.message}") unless episode&.terminal?
    
    raise # Re-raise for retry mechanism
  end
end
