# frozen_string_literal: true
#
# ThinkTank::Artifact - Links Episodes to Created Radiant Objects
#
# Enables tracking of what Pages/Snippets/PageParts were created
# by each Think Tank session, supporting rollback and dependency tracking.

module ThinkTank
  class Artifact < ActiveRecord::Base
    self.table_name = 'think_tank_artifacts'
    
    # =========================================================================
    # ASSOCIATIONS
    # =========================================================================
    
    belongs_to :episode, class_name: 'ThinkTank::Episode', foreign_key: 'episode_id'
    
    # Polymorphic association to Radiant objects (Page, Snippet, PagePart)
    belongs_to :artifactable, polymorphic: true
    
    # =========================================================================
    # VALIDATIONS
    # =========================================================================
    
    validates :episode_id, presence: true
    validates :artifactable_type, presence: true, 
              inclusion: { in: %w[Page Snippet PagePart] }
    validates :artifactable_id, presence: true
    
    # =========================================================================
    # SCOPES
    # =========================================================================
    
    scope :pages, -> { where(artifactable_type: 'Page') }
    scope :snippets, -> { where(artifactable_type: 'Snippet') }
    scope :page_parts, -> { where(artifactable_type: 'PagePart') }
    scope :ordered, -> { order(position: :asc) }
    
    # =========================================================================
    # CLASS METHODS
    # =========================================================================
    
    class << self
      # Record a new artifact for an episode
      def record!(episode:, object:, role: nil, position: nil)
        create!(
          episode_id: episode.id,
          artifactable_type: object.class.name,
          artifactable_id: object.id,
          role: role,
          position: position || episode.think_tank_artifacts.count
        )
      end
    end
    
    # =========================================================================
    # INSTANCE METHODS
    # =========================================================================
    
    # Check if the artifact still exists in Radiant
    def exists?
      artifactable.present?
    rescue ActiveRecord::RecordNotFound
      false
    end
    
    # Get URL for page artifacts
    def url
      return nil unless artifactable_type == 'Page' && artifactable.present?
      artifactable.url
    end
  end
end
