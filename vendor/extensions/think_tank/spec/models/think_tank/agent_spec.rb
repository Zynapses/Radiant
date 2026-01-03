# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ThinkTank::Agent do
  let(:episode) { create_episode }
  let(:agent) { described_class.new(episode) }
  
  describe '#initialize' do
    it 'stores the episode' do
      expect(agent.episode).to eq(episode)
    end
    
    it 'creates an API client' do
      expect(agent.api_client).to be_a(ThinkTank::RadiantApiClient)
    end
  end
  
  describe 'SYSTEM_PROMPT' do
    it 'instructs AI to respond with JSON' do
      expect(ThinkTank::Agent::SYSTEM_PROMPT).to include('JSON')
    end
    
    it 'specifies required fields' do
      expect(ThinkTank::Agent::SYSTEM_PROMPT).to include('slug')
      expect(ThinkTank::Agent::SYSTEM_PROMPT).to include('title')
      expect(ThinkTank::Agent::SYSTEM_PROMPT).to include('html')
    end
  end
  
  describe '#execute' do
    context 'when API is not configured' do
      before do
        allow(agent.api_client).to receive(:configured?).and_return(false)
      end
      
      it 'returns error' do
        result = agent.execute
        
        expect(result[:success]).to be false
        expect(result[:error]).to include('not configured')
      end
      
      it 'marks episode as failed' do
        agent.execute
        
        expect(episode.status).to eq('failed')
      end
    end
    
    context 'when API is configured' do
      let(:ai_response) do
        {
          success: true,
          content: {
            slug: 'test-page',
            title: 'Test Page',
            html: '<h1>Hello</h1>',
            javascript: nil,
            css: nil,
            description: 'A test page'
          }.to_json,
          usage: { 'total_tokens' => 500 },
          model: 'claude-3-haiku'
        }
      end
      
      before do
        allow(agent.api_client).to receive(:configured?).and_return(true)
        allow(agent.api_client).to receive(:chat).and_return(ai_response)
      end
      
      it 'transitions episode through statuses' do
        allow(ThinkTank::Builder).to receive(:new).and_return(
          double(morph: { success: true, page: double(url: '/test'), page_url: '/test', artifacts: {} })
        )
        
        agent.execute
        
        # Episode should end in completed state
        expect(episode.status).to eq('completed')
      end
    end
  end
  
  describe '#extract_json (private)' do
    it 'parses raw JSON' do
      json = '{"slug": "test", "title": "Test", "html": "<p>Hi</p>"}'
      result = agent.send(:extract_json, json)
      
      expect(result).to eq(json)
    end
    
    it 'extracts JSON from markdown code block' do
      content = <<~CONTENT
        Here is the page:
        ```json
        {"slug": "test", "title": "Test", "html": "<p>Hi</p>"}
        ```
      CONTENT
      
      result = agent.send(:extract_json, content)
      
      expect(JSON.parse(result)['slug']).to eq('test')
    end
    
    it 'returns nil for invalid content' do
      result = agent.send(:extract_json, 'not json at all')
      
      expect(result).to be_nil
    end
  end
  
  describe '#estimate_cost (private)' do
    it 'calculates cost for Claude Haiku' do
      cost = agent.send(:estimate_cost, 1000, 'claude-3-haiku')
      expect(cost).to eq(0.00025)
    end
    
    it 'calculates cost for Claude Opus' do
      cost = agent.send(:estimate_cost, 1000, 'claude-3-opus')
      expect(cost).to eq(0.015)
    end
    
    it 'calculates cost for GPT-4' do
      cost = agent.send(:estimate_cost, 1000, 'gpt-4')
      expect(cost).to eq(0.03)
    end
    
    it 'uses default rate for unknown models' do
      cost = agent.send(:estimate_cost, 1000, 'unknown-model')
      expect(cost).to eq(0.001)
    end
  end
end
