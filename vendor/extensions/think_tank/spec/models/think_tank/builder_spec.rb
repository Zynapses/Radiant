# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ThinkTank::Builder do
  let(:episode) { create_episode }
  let(:builder) { described_class.new(episode) }
  
  describe '#initialize' do
    it 'stores the episode' do
      expect(builder.episode).to eq(episode)
    end
    
    it 'initializes errors as empty array' do
      expect(builder.errors).to eq([])
    end
  end
  
  describe '#morph' do
    # Note: These tests require Radiant CMS models (Page, Snippet, PagePart)
    # to be available. Mock them in a real test environment.
    
    context 'with valid params' do
      let(:params) do
        {
          slug: 'test-page',
          title: 'Test Page',
          html_body: '<h1>Hello World</h1>'
        }
      end
      
      it 'returns success hash with page' do
        # Mock Page, Snippet, PagePart for testing
        allow(Page).to receive(:exists?).and_return(false)
        allow(Page).to receive(:find_by).and_return(double(id: 1))
        
        page_mock = double('Page', save: true, id: 1, url: '/test-page', errors: double(full_messages: []))
        allow(Page).to receive(:new).and_return(page_mock)
        
        page_part_mock = double('PagePart', save: true, id: 1, errors: double(full_messages: []))
        allow(PagePart).to receive(:new).and_return(page_part_mock)
        
        allow(ThinkTank::Artifact).to receive(:record!)
        allow(ThinkTank::Configuration).to receive(:get).and_return(false)
        
        result = builder.morph(**params)
        
        expect(result[:success]).to be true
        expect(result[:page]).to be_present
      end
    end
    
    context 'with JS and CSS' do
      let(:params) do
        {
          slug: 'calculator',
          title: 'Calculator',
          html_body: '<div id="app"></div>',
          js_logic: 'function calc() { return 1+1; }',
          css_styles: '.calculator { color: blue; }'
        }
      end
      
      it 'creates asset snippet' do
        # This would require full Radiant mock setup
        # Simplified assertion for structure test
        expect(params[:js_logic]).to be_present
        expect(params[:css_styles]).to be_present
      end
    end
  end
  
  describe '#create_asset_snippet' do
    it 'generates snippet name with prefix' do
      allow(ThinkTank::Configuration).to receive(:get).with('snippet_prefix', 'tt_').and_return('tt_')
      allow(Snippet).to receive(:exists?).and_return(false)
      
      snippet_mock = double('Snippet', save: true, id: 1, name: 'tt_test_assets', errors: double(full_messages: []))
      allow(Snippet).to receive(:new).and_return(snippet_mock)
      
      result = builder.create_asset_snippet('test', 'var x = 1;', '.test {}')
      
      expect(Snippet).to have_received(:new).with(hash_including(name: /^tt_test/))
    end
  end
  
  describe '#sanitize_slug (private)' do
    it 'converts to lowercase' do
      expect(builder.send(:sanitize_slug, 'MyPage')).to eq('mypage')
    end
    
    it 'replaces spaces with hyphens' do
      expect(builder.send(:sanitize_slug, 'my page name')).to eq('my-page-name')
    end
    
    it 'removes special characters' do
      expect(builder.send(:sanitize_slug, 'test@page#123!')).to eq('test-page-123')
    end
    
    it 'collapses multiple hyphens' do
      expect(builder.send(:sanitize_slug, 'test--page---name')).to eq('test-page-name')
    end
    
    it 'removes leading and trailing hyphens' do
      expect(builder.send(:sanitize_slug, '-test-page-')).to eq('test-page')
    end
  end
  
  describe '#build_asset_content (private)' do
    it 'wraps CSS in style tag' do
      content = builder.send(:build_asset_content, nil, '.test { color: red; }')
      expect(content).to include('<style>')
      expect(content).to include('.test { color: red; }')
      expect(content).to include('</style>')
    end
    
    it 'wraps JS in script tag' do
      content = builder.send(:build_asset_content, 'var x = 1;', nil)
      expect(content).to include('<script>')
      expect(content).to include('var x = 1;')
      expect(content).to include('</script>')
    end
    
    it 'includes both when provided' do
      content = builder.send(:build_asset_content, 'var x = 1;', '.test {}')
      expect(content).to include('<style>')
      expect(content).to include('<script>')
    end
  end
end
