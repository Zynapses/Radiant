# frozen_string_literal: true
#
# Think Tank Extension - Spec Helper
#
# Configure RSpec for Think Tank extension testing

require 'rubygems'
require 'bundler/setup'

# Load Rails environment if available
begin
  require File.expand_path('../../config/environment', __dir__)
rescue LoadError
  # Running outside of Rails, set up minimal environment
  $LOAD_PATH.unshift File.expand_path('../../app/models', __dir__)
  $LOAD_PATH.unshift File.expand_path('../../lib', __dir__)
end

require 'rspec/rails' if defined?(RSpec::Rails)

# Load Think Tank models
require 'think_tank/episode'
require 'think_tank/configuration'
require 'think_tank/artifact'
require 'think_tank/builder'
require 'think_tank/agent'
require 'think_tank/radiant_api_client'

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.disable_monkey_patching!
  config.warnings = true
  config.order = :random
  
  # Database cleaner (if using)
  config.before(:suite) do
    # Setup test database if needed
  end
  
  config.around(:each) do |example|
    # Wrap each test in a transaction for cleanup
    if defined?(ActiveRecord::Base)
      ActiveRecord::Base.transaction do
        example.run
        raise ActiveRecord::Rollback
      end
    else
      example.run
    end
  end
end

# Factory helpers
module ThinkTankFactories
  def build_episode(attrs = {})
    ThinkTank::Episode.new({
      uuid: SecureRandom.uuid,
      goal: 'Build a test calculator',
      status: 'pending'
    }.merge(attrs))
  end
  
  def create_episode(attrs = {})
    episode = build_episode(attrs)
    episode.save!
    episode
  end
end

RSpec.configure do |config|
  config.include ThinkTankFactories
end
