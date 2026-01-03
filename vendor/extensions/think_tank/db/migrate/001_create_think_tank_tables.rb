# frozen_string_literal: true
#
# Think Tank Extension - Database Migration
# Creates Tri-State Memory tables for Soft Morphing architecture
#
# State 1 (Structural): Uses existing Radiant Pages/Snippets/PageParts
# State 2 (Episodic): think_tank_episodes - Session/task tracking
# State 3 (Semantic): think_tank_configurations - Settings singleton
#
# Rails Compatibility: 4.2+ through 7.x
# Legacy fallback patterns included for Rails 2.3/3.0 if needed

class CreateThinkTankTables < ActiveRecord::Migration[5.0]
  # For Rails 4.x compatibility, use this instead:
  # class CreateThinkTankTables < ActiveRecord::Migration
  
  def up
    # =========================================================================
    # STATE 2: EPISODIC MEMORY
    # Tracks Think Tank sessions - the "stream" of consciousness
    # =========================================================================
    create_table :think_tank_episodes do |t|
      # Unique session identifier (UUID for distributed systems)
      t.string :uuid, null: false, limit: 36
      
      # The user's original prompt/goal
      t.text :goal, null: false
      
      # Current processing status
      # pending -> thinking -> morphing -> completed/failed
      t.string :status, null: false, default: 'pending', limit: 20
      
      # JSON array of log messages for terminal display
      # Serialized in model as Array
      t.text :log_stream
      
      # JSON object storing created artifacts
      # { pages: [id, id], snippets: [id, id], page_parts: [id, id] }
      t.text :artifacts
      
      # Error message if status is 'failed'
      t.text :error_message
      
      # Metadata
      t.integer :created_by_id  # User who initiated (references users table)
      t.string :model_used, limit: 100  # Which AI model was used
      t.integer :tokens_used, default: 0
      t.decimal :cost_estimate, precision: 10, scale: 6, default: 0
      
      # Timing
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps null: false
    end
    
    # Indexes for efficient querying
    add_index :think_tank_episodes, :uuid, unique: true
    add_index :think_tank_episodes, :status
    add_index :think_tank_episodes, :created_by_id
    add_index :think_tank_episodes, :created_at
    
    # =========================================================================
    # STATE 3: SEMANTIC MEMORY  
    # Configuration singleton - global settings and learned patterns
    # =========================================================================
    create_table :think_tank_configurations do |t|
      # Configuration key (e.g., "global_settings", "api_config", "templates")
      t.string :key, null: false, limit: 100
      
      # JSON payload for the configuration
      t.text :value
      
      # Optional description for admin UI
      t.string :description, limit: 500
      
      # Track changes
      t.integer :updated_by_id
      t.timestamps null: false
    end
    
    add_index :think_tank_configurations, :key, unique: true
    
    # =========================================================================
    # ARTIFACT TRACKING
    # Links episodes to the Pages/Snippets they create
    # Enables rollback and dependency tracking
    # =========================================================================
    create_table :think_tank_artifacts do |t|
      t.integer :episode_id, null: false
      
      # Polymorphic association to Radiant objects
      t.string :artifactable_type, null: false, limit: 50  # 'Page', 'Snippet', 'PagePart'
      t.integer :artifactable_id, null: false
      
      # What role does this artifact play?
      t.string :role, limit: 50  # 'primary_page', 'asset_snippet', 'style_snippet', etc.
      
      # Ordering for multi-artifact episodes
      t.integer :position, default: 0
      
      t.timestamps null: false
    end
    
    add_index :think_tank_artifacts, :episode_id
    add_index :think_tank_artifacts, [:artifactable_type, :artifactable_id], 
              name: 'idx_think_tank_artifacts_polymorphic'
    
    # Foreign key (skip if Rails < 4.2 or using legacy Radiant)
    if ActiveRecord::Base.connection.supports_foreign_keys?
      add_foreign_key :think_tank_artifacts, :think_tank_episodes, 
                      column: :episode_id, on_delete: :cascade
    end
    
    # =========================================================================
    # SEED DEFAULT CONFIGURATION
    # =========================================================================
    execute <<-SQL
      INSERT INTO think_tank_configurations (key, value, description, created_at, updated_at)
      VALUES (
        'global_settings',
        '{"radiant_api_endpoint": "", "radiant_api_key": "", "default_model": "claude-3-haiku", "auto_publish": false, "max_tokens": 4096}',
        'Global Think Tank settings including RADIANT API configuration',
        NOW(),
        NOW()
      );
    SQL
    
    execute <<-SQL
      INSERT INTO think_tank_configurations (key, value, description, created_at, updated_at)
      VALUES (
        'templates',
        '{"calculator": "Create a web calculator with the specified functionality", "form": "Create an HTML form with validation", "landing_page": "Create a landing page with the specified content"}',
        'Predefined prompt templates for common tasks',
        NOW(),
        NOW()
      );
    SQL
  end
  
  def down
    # Remove in reverse order due to foreign keys
    drop_table :think_tank_artifacts if table_exists?(:think_tank_artifacts)
    drop_table :think_tank_configurations if table_exists?(:think_tank_configurations)
    drop_table :think_tank_episodes if table_exists?(:think_tank_episodes)
  end
  
  private
  
  def table_exists?(table_name)
    ActiveRecord::Base.connection.table_exists?(table_name)
  end
end
