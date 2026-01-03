# frozen_string_literal: true
#
# ThinkTank::Episode - Episodic Memory for Think Tank sessions
#
# Tracks the lifecycle of an AI-driven page/snippet creation task.
# Uses serialized JSON columns for log streaming and artifact tracking.
#
# Status Flow: pending -> thinking -> morphing -> completed/failed
#
# Rails Compatibility: 4.2+ (attr_accessible fallback for 2.3/3.0)

module ThinkTank
  class Episode < ActiveRecord::Base
    # Table name override (Radiant extensions often need this)
    self.table_name = 'think_tank_episodes'
    
    # =========================================================================
    # RAILS VERSION COMPATIBILITY
    # =========================================================================
    
    # Rails 2.3/3.0 compatibility - use attr_accessible
    # Comment out for Rails 4+ with strong_parameters
    # attr_accessible :uuid, :goal, :status, :created_by_id, :model_used
    
    # Rails 4+ uses strong parameters in controller instead
    
    # =========================================================================
    # SERIALIZATION
    # =========================================================================
    
    # Store log_stream as JSON array
    # Rails 4+: Use serialize with JSON coder
    # Rails 5+: Can use native JSON column type instead
    serialize :log_stream, Array
    
    # Store artifacts as JSON hash
    serialize :artifacts, Hash
    
    # =========================================================================
    # ASSOCIATIONS
    # =========================================================================
    
    # Track which Radiant user created this episode
    belongs_to :created_by, class_name: 'User', foreign_key: 'created_by_id', optional: true
    
    # Link to artifacts created by this episode
    has_many :think_tank_artifacts, 
             class_name: 'ThinkTank::Artifact',
             foreign_key: 'episode_id',
             dependent: :destroy
    
    # =========================================================================
    # VALIDATIONS
    # =========================================================================
    
    validates :uuid, presence: true, uniqueness: true
    validates :goal, presence: true, length: { minimum: 10, maximum: 10_000 }
    validates :status, presence: true, 
              inclusion: { in: %w[pending thinking morphing completed failed] }
    
    # =========================================================================
    # CALLBACKS
    # =========================================================================
    
    before_validation :generate_uuid, on: :create
    before_validation :initialize_log_stream, on: :create
    before_validation :initialize_artifacts, on: :create
    
    # =========================================================================
    # SCOPES
    # =========================================================================
    
    scope :pending, -> { where(status: 'pending') }
    scope :in_progress, -> { where(status: %w[thinking morphing]) }
    scope :completed, -> { where(status: 'completed') }
    scope :failed, -> { where(status: 'failed') }
    scope :recent, -> { order(created_at: :desc) }
    scope :by_user, ->(user_id) { where(created_by_id: user_id) }
    
    # =========================================================================
    # STATUS CONSTANTS
    # =========================================================================
    
    STATUSES = {
      pending: 'pending',
      thinking: 'thinking',
      morphing: 'morphing',
      completed: 'completed',
      failed: 'failed'
    }.freeze
    
    # =========================================================================
    # INSTANCE METHODS
    # =========================================================================
    
    # Append a log message and save immediately
    # This enables real-time terminal streaming via polling
    #
    # @param message [String] Log message to append
    # @param level [Symbol] :info, :warn, :error, :success
    # @return [Boolean] Save result
    def log!(message, level: :info)
      timestamp = Time.current.strftime('%H:%M:%S')
      
      log_entry = {
        time: timestamp,
        level: level.to_s,
        message: message
      }
      
      # Append to log stream
      self.log_stream ||= []
      self.log_stream << log_entry
      
      # Save immediately for real-time polling
      # Use update_column to skip callbacks and validations for speed
      update_column(:log_stream, self.class.serialized_attributes['log_stream'].dump(log_stream))
    rescue StandardError => e
      Rails.logger.error "[ThinkTank] Failed to log: #{e.message}"
      false
    end
    
    # Transition to thinking status
    def start_thinking!
      update!(
        status: STATUSES[:thinking],
        started_at: Time.current
      )
      log!('🧠 Agent is thinking...', level: :info)
    end
    
    # Transition to morphing status
    def start_morphing!
      update!(status: STATUSES[:morphing])
      log!('🔨 Building artifacts...', level: :info)
    end
    
    # Mark as completed with artifacts
    def complete!(artifact_ids = {})
      update!(
        status: STATUSES[:completed],
        artifacts: artifact_ids,
        completed_at: Time.current
      )
      log!('✅ Build complete!', level: :success)
    end
    
    # Mark as failed with error
    def fail!(error_message)
      update!(
        status: STATUSES[:failed],
        error_message: error_message,
        completed_at: Time.current
      )
      log!("❌ Failed: #{error_message}", level: :error)
    end
    
    # Get logs since a specific index (for polling)
    def logs_since(index = 0)
      return [] unless log_stream.is_a?(Array)
      log_stream[index.to_i..-1] || []
    end
    
    # Check if episode is still active
    def active?
      %w[pending thinking morphing].include?(status)
    end
    
    # Check if episode is terminal (completed or failed)
    def terminal?
      %w[completed failed].include?(status)
    end
    
    # Get primary page URL if completed
    def preview_url
      return nil unless status == 'completed' && artifacts['primary_page_url']
      artifacts['primary_page_url']
    end
    
    # Duration in seconds
    def duration
      return nil unless started_at
      end_time = completed_at || Time.current
      (end_time - started_at).to_i
    end
    
    # =========================================================================
    # CLASS METHODS
    # =========================================================================
    
    class << self
      # Create a new episode for a user prompt
      def create_for_prompt(goal:, user: nil, model: nil)
        create!(
          goal: goal,
          created_by_id: user&.id,
          model_used: model || ThinkTank::Configuration.get('default_model'),
          status: STATUSES[:pending]
        )
      end
      
      # Clean up old episodes (run via rake task)
      def cleanup_old(days_old: 30)
        where('created_at < ?', days_old.days.ago)
          .where(status: %w[completed failed])
          .destroy_all
      end
    end
    
    private
    
    def generate_uuid
      self.uuid ||= SecureRandom.uuid
    end
    
    def initialize_log_stream
      self.log_stream ||= []
    end
    
    def initialize_artifacts
      self.artifacts ||= {}
    end
  end
end
