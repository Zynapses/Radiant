# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ThinkTank::Episode do
  describe 'validations' do
    it 'requires a uuid' do
      episode = build_episode(uuid: nil)
      expect(episode).not_to be_valid
      expect(episode.errors[:uuid]).to include("can't be blank")
    end
    
    it 'requires a goal' do
      episode = build_episode(goal: nil)
      expect(episode).not_to be_valid
    end
    
    it 'requires goal to be at least 10 characters' do
      episode = build_episode(goal: 'short')
      expect(episode).not_to be_valid
      expect(episode.errors[:goal]).to include('is too short (minimum is 10 characters)')
    end
    
    it 'requires a valid status' do
      episode = build_episode(status: 'invalid')
      expect(episode).not_to be_valid
      expect(episode.errors[:status]).to include('is not included in the list')
    end
    
    it 'accepts valid statuses' do
      %w[pending thinking morphing completed failed].each do |status|
        episode = build_episode(status: status)
        expect(episode).to be_valid
      end
    end
  end
  
  describe 'callbacks' do
    it 'generates uuid on create if not provided' do
      episode = ThinkTank::Episode.new(goal: 'Test goal that is long enough')
      episode.valid?
      expect(episode.uuid).to be_present
      expect(episode.uuid).to match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    end
    
    it 'initializes log_stream as empty array' do
      episode = build_episode
      episode.valid?
      expect(episode.log_stream).to eq([])
    end
    
    it 'initializes artifacts as empty hash' do
      episode = build_episode
      episode.valid?
      expect(episode.artifacts).to eq({})
    end
  end
  
  describe '#log!' do
    let(:episode) { create_episode }
    
    it 'appends log entry with timestamp' do
      episode.log!('Test message')
      
      expect(episode.log_stream.length).to eq(1)
      expect(episode.log_stream.first[:message]).to eq('Test message')
      expect(episode.log_stream.first[:level]).to eq('info')
      expect(episode.log_stream.first[:time]).to match(/^\d{2}:\d{2}:\d{2}$/)
    end
    
    it 'supports different log levels' do
      episode.log!('Info message', level: :info)
      episode.log!('Warning message', level: :warn)
      episode.log!('Error message', level: :error)
      episode.log!('Success message', level: :success)
      
      expect(episode.log_stream.map { |l| l[:level] }).to eq(%w[info warn error success])
    end
  end
  
  describe 'status transitions' do
    let(:episode) { create_episode }
    
    describe '#start_thinking!' do
      it 'changes status to thinking' do
        episode.start_thinking!
        expect(episode.status).to eq('thinking')
      end
      
      it 'sets started_at timestamp' do
        episode.start_thinking!
        expect(episode.started_at).to be_present
      end
      
      it 'logs the transition' do
        episode.start_thinking!
        expect(episode.log_stream.last[:message]).to include('thinking')
      end
    end
    
    describe '#start_morphing!' do
      it 'changes status to morphing' do
        episode.start_morphing!
        expect(episode.status).to eq('morphing')
      end
    end
    
    describe '#complete!' do
      it 'changes status to completed' do
        episode.complete!({ page_id: 1 })
        expect(episode.status).to eq('completed')
      end
      
      it 'stores artifacts' do
        episode.complete!({ page_id: 1, snippet_ids: [2, 3] })
        expect(episode.artifacts).to eq({ page_id: 1, snippet_ids: [2, 3] })
      end
      
      it 'sets completed_at timestamp' do
        episode.complete!
        expect(episode.completed_at).to be_present
      end
    end
    
    describe '#fail!' do
      it 'changes status to failed' do
        episode.fail!('Something went wrong')
        expect(episode.status).to eq('failed')
      end
      
      it 'stores error message' do
        episode.fail!('Something went wrong')
        expect(episode.error_message).to eq('Something went wrong')
      end
    end
  end
  
  describe '#active?' do
    it 'returns true for pending status' do
      expect(build_episode(status: 'pending').active?).to be true
    end
    
    it 'returns true for thinking status' do
      expect(build_episode(status: 'thinking').active?).to be true
    end
    
    it 'returns true for morphing status' do
      expect(build_episode(status: 'morphing').active?).to be true
    end
    
    it 'returns false for completed status' do
      expect(build_episode(status: 'completed').active?).to be false
    end
    
    it 'returns false for failed status' do
      expect(build_episode(status: 'failed').active?).to be false
    end
  end
  
  describe '#terminal?' do
    it 'returns true for completed status' do
      expect(build_episode(status: 'completed').terminal?).to be true
    end
    
    it 'returns true for failed status' do
      expect(build_episode(status: 'failed').terminal?).to be true
    end
    
    it 'returns false for active statuses' do
      %w[pending thinking morphing].each do |status|
        expect(build_episode(status: status).terminal?).to be false
      end
    end
  end
  
  describe '#logs_since' do
    let(:episode) { create_episode }
    
    before do
      episode.log!('Message 1')
      episode.log!('Message 2')
      episode.log!('Message 3')
    end
    
    it 'returns all logs when index is 0' do
      expect(episode.logs_since(0).length).to eq(3)
    end
    
    it 'returns logs after the specified index' do
      logs = episode.logs_since(1)
      expect(logs.length).to eq(2)
      expect(logs.first[:message]).to eq('Message 2')
    end
    
    it 'returns empty array when index equals log count' do
      expect(episode.logs_since(3)).to eq([])
    end
  end
  
  describe '.create_for_prompt' do
    it 'creates episode with the given goal' do
      episode = ThinkTank::Episode.create_for_prompt(goal: 'Build a test page with content')
      
      expect(episode).to be_persisted
      expect(episode.goal).to eq('Build a test page with content')
      expect(episode.status).to eq('pending')
    end
  end
end
