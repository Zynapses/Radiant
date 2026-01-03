# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ThinkTank::RadiantApiClient do
  let(:config) do
    {
      endpoint: 'https://api.radiant.example.com',
      api_key: 'test-api-key',
      tenant_id: 'test-tenant',
      default_model: 'claude-3-haiku',
      max_tokens: 4096,
      timeout: 60
    }
  end
  
  let(:client) { described_class.new(config) }
  
  describe '#initialize' do
    it 'stores the configuration' do
      expect(client.config).to eq(config)
    end
    
    it 'uses Configuration.api_config when no config provided' do
      allow(ThinkTank::Configuration).to receive(:api_config).and_return(config)
      client = described_class.new
      expect(client.config).to eq(config)
    end
  end
  
  describe '#configured?' do
    it 'returns true when endpoint and api_key present' do
      expect(client.configured?).to be true
    end
    
    it 'returns false when endpoint missing' do
      client = described_class.new(config.merge(endpoint: ''))
      expect(client.configured?).to be false
    end
    
    it 'returns false when api_key missing' do
      client = described_class.new(config.merge(api_key: ''))
      expect(client.configured?).to be false
    end
  end
  
  describe '#chat' do
    let(:messages) { [{ role: 'user', content: 'Hello' }] }
    
    context 'when not configured' do
      let(:client) { described_class.new(endpoint: '', api_key: '') }
      
      it 'returns error response' do
        result = client.chat(messages: messages)
        
        expect(result[:success]).to be false
        expect(result[:error]).to include('not configured')
      end
    end
    
    context 'when configured' do
      before do
        # Mock HTTP request
        stub_request(:post, "#{config[:endpoint]}/v1/chat/completions")
          .to_return(
            status: 200,
            body: {
              choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
              model: 'claude-3-haiku',
              usage: { total_tokens: 100 }
            }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end
      
      it 'sends request to API endpoint' do
        result = client.chat(messages: messages)
        
        expect(result[:success]).to be true
        expect(result[:content]).to eq('Hello!')
      end
      
      it 'includes usage information' do
        result = client.chat(messages: messages)
        
        expect(result[:usage]).to eq({ 'total_tokens' => 100 })
      end
    end
    
    context 'when API returns error' do
      before do
        stub_request(:post, "#{config[:endpoint]}/v1/chat/completions")
          .to_return(
            status: 500,
            body: { error: { message: 'Internal server error' } }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end
      
      it 'returns error response' do
        result = client.chat(messages: messages)
        
        expect(result[:success]).to be false
        expect(result[:error]).to be_present
      end
      
      it 'stores last_error' do
        client.chat(messages: messages)
        
        expect(client.last_error).to be_present
      end
    end
  end
  
  describe '#healthy?' do
    context 'when API is reachable' do
      before do
        stub_request(:get, "#{config[:endpoint]}/health")
          .to_return(status: 200, body: '{"status":"ok"}')
      end
      
      it 'returns true' do
        expect(client.healthy?).to be true
      end
    end
    
    context 'when API is unreachable' do
      before do
        stub_request(:get, "#{config[:endpoint]}/health")
          .to_return(status: 500)
      end
      
      it 'returns false' do
        expect(client.healthy?).to be false
      end
    end
    
    context 'when not configured' do
      let(:client) { described_class.new(endpoint: '', api_key: '') }
      
      it 'returns false' do
        expect(client.healthy?).to be false
      end
    end
  end
  
  describe '#list_models' do
    context 'when API returns models' do
      before do
        stub_request(:get, "#{config[:endpoint]}/v1/models")
          .to_return(
            status: 200,
            body: {
              data: [
                { id: 'claude-3-haiku' },
                { id: 'claude-3-opus' }
              ]
            }.to_json
          )
      end
      
      it 'returns array of models' do
        models = client.list_models
        
        expect(models).to be_an(Array)
        expect(models.length).to eq(2)
        expect(models.first['id']).to eq('claude-3-haiku')
      end
    end
    
    context 'when not configured' do
      let(:client) { described_class.new(endpoint: '', api_key: '') }
      
      it 'returns empty array' do
        expect(client.list_models).to eq([])
      end
    end
  end
end
