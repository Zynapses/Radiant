# frozen_string_literal: true
#
# Think Tank Extension Rake Tasks

namespace :think_tank do
  desc "Run database migrations for Think Tank extension"
  task migrate: :environment do
    migration_path = File.join(ThinkTankExtension.root, 'db', 'migrate')
    ActiveRecord::Migration.verbose = true
    
    if ActiveRecord::VERSION::MAJOR >= 5
      ActiveRecord::MigrationContext.new(migration_path).migrate
    else
      ActiveRecord::Migrator.migrate(migration_path)
    end
    
    puts "Think Tank migrations completed."
  end
  
  desc "Rollback Think Tank migrations"
  task rollback: :environment do
    migration_path = File.join(ThinkTankExtension.root, 'db', 'migrate')
    ActiveRecord::Migration.verbose = true
    
    if ActiveRecord::VERSION::MAJOR >= 5
      ActiveRecord::MigrationContext.new(migration_path).rollback
    else
      ActiveRecord::Migrator.rollback(migration_path)
    end
    
    puts "Think Tank migration rolled back."
  end
  
  desc "Clean up old episodes (default: 30 days)"
  task :cleanup, [:days] => :environment do |_t, args|
    days = (args[:days] || 30).to_i
    count = ThinkTank::Episode.cleanup_old(days_old: days)
    puts "Deleted #{count} episodes older than #{days} days."
  end
  
  desc "Test RADIANT API connection"
  task test_api: :environment do
    client = ThinkTank::RadiantApiClient.new
    
    if client.configured?
      puts "Testing RADIANT API connection..."
      
      if client.healthy?
        puts "✅ API connection successful!"
        
        models = client.list_models
        if models.any?
          puts "Available models: #{models.map { |m| m['id'] }.join(', ')}"
        else
          puts "Could not fetch model list."
        end
      else
        puts "❌ API connection failed: #{client.last_error}"
      end
    else
      puts "❌ RADIANT API not configured."
      puts "Configure in Radiant admin: /admin/think_tank/settings"
    end
  end
  
  desc "Show Think Tank configuration"
  task config: :environment do
    puts "Think Tank Configuration:"
    puts "-" * 40
    
    settings = ThinkTank::Configuration.settings
    settings.each do |key, value|
      display_value = key.include?('key') ? '[REDACTED]' : value
      puts "  #{key}: #{display_value}"
    end
    
    puts "-" * 40
    puts "API Configured: #{ThinkTank::Configuration.api_configured? ? 'Yes' : 'No'}"
  end
  
  desc "Show episode statistics"
  task stats: :environment do
    puts "Think Tank Statistics:"
    puts "-" * 40
    
    total = ThinkTank::Episode.count
    completed = ThinkTank::Episode.completed.count
    failed = ThinkTank::Episode.failed.count
    in_progress = ThinkTank::Episode.in_progress.count
    
    puts "  Total episodes: #{total}"
    puts "  Completed: #{completed}"
    puts "  Failed: #{failed}"
    puts "  In Progress: #{in_progress}"
    
    if completed > 0
      avg_tokens = ThinkTank::Episode.completed.average(:tokens_used).to_i
      avg_cost = ThinkTank::Episode.completed.average(:cost_estimate).to_f
      puts "  Avg tokens/episode: #{avg_tokens}"
      puts "  Avg cost/episode: $#{avg_cost.round(4)}"
    end
    
    puts "-" * 40
    
    artifacts = ThinkTank::Artifact.count
    pages = ThinkTank::Artifact.pages.count
    snippets = ThinkTank::Artifact.snippets.count
    
    puts "  Total artifacts: #{artifacts}"
    puts "  Pages created: #{pages}"
    puts "  Snippets created: #{snippets}"
  end
  
  desc "Reset Think Tank (delete all episodes and artifacts - USE WITH CAUTION)"
  task reset: :environment do
    puts "WARNING: This will delete ALL Think Tank episodes and artifact records."
    puts "The actual Pages/Snippets will NOT be deleted."
    print "Are you sure? (yes/no): "
    
    confirmation = STDIN.gets.chomp
    
    if confirmation.downcase == 'yes'
      ThinkTank::Artifact.delete_all
      ThinkTank::Episode.delete_all
      puts "Think Tank data reset complete."
    else
      puts "Reset cancelled."
    end
  end
end
