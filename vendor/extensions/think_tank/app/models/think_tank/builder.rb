# frozen_string_literal: true
#
# ThinkTank::Builder - The Soft Morphing Engine
#
# This is the core service that translates AI-generated content into
# Radiant CMS database records. It creates Pages, Snippets, and PageParts
# that are immediately renderable without server restart.
#
# The "Soft Morphing" pattern uses the database as a mutable filesystem,
# bypassing the Rails "Restart Wall" constraint.
#
# Usage:
#   builder = ThinkTank::Builder.new(episode)
#   result = builder.morph(
#     slug: 'mortgage-calculator',
#     title: 'Mortgage Calculator',
#     html_body: '<h1>Calculator</h1><div id="app"></div>',
#     js_logic: 'function calculate() { ... }',
#     css_styles: '.calculator { ... }'
#   )

module ThinkTank
  class Builder
    attr_reader :episode, :errors
    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def initialize(episode)
      @episode = episode
      @errors = []
      @created_artifacts = {
        pages: [],
        snippets: [],
        page_parts: []
      }
    end
    
    # =========================================================================
    # MAIN MORPHING METHOD
    # =========================================================================
    
    # Create a complete page with assets from AI-generated content
    #
    # @param slug [String] URL slug for the page (e.g., 'mortgage-calculator')
    # @param title [String] Page title
    # @param html_body [String] Main HTML content
    # @param js_logic [String] JavaScript code (optional)
    # @param css_styles [String] CSS styles (optional)
    # @param parent_slug [String] Parent page slug (optional, default: '/')
    # @param layout [String] Radiant layout name (optional)
    # @return [Hash] Result with :success, :page, :artifacts
    def morph(slug:, title:, html_body:, js_logic: nil, css_styles: nil, parent_slug: '/', layout: nil)
      @errors = []
      
      ActiveRecord::Base.transaction do
        episode.log!("Creating page: #{slug}", level: :info)
        
        # Step 1: Create asset snippet if JS or CSS provided
        asset_snippet = nil
        if js_logic.present? || css_styles.present?
          asset_snippet = create_asset_snippet(slug, js_logic, css_styles)
          raise BuildError, @errors.join(', ') unless asset_snippet
        end
        
        # Step 2: Create the page
        page = create_page(
          slug: slug,
          title: title,
          parent_slug: parent_slug,
          layout: layout
        )
        raise BuildError, @errors.join(', ') unless page
        
        # Step 3: Create the body PagePart with content
        body_content = build_body_content(html_body, asset_snippet)
        page_part = create_page_part(page, 'body', body_content)
        raise BuildError, @errors.join(', ') unless page_part
        
        # Step 4: Record artifacts
        record_artifacts(page, asset_snippet, page_part)
        
        # Step 5: Publish if auto_publish enabled
        publish_page(page) if Configuration.get('auto_publish')
        
        episode.log!("✅ Page created: #{page.url}", level: :success)
        
        {
          success: true,
          page: page,
          page_url: page.url,
          artifacts: @created_artifacts
        }
      end
    rescue BuildError => e
      episode.log!("❌ Build failed: #{e.message}", level: :error)
      { success: false, errors: @errors }
    rescue StandardError => e
      @errors << e.message
      episode.log!("❌ Unexpected error: #{e.message}", level: :error)
      Rails.logger.error "[ThinkTank::Builder] #{e.message}\n#{e.backtrace.first(10).join("\n")}"
      { success: false, errors: @errors }
    end
    
    # =========================================================================
    # COMPONENT BUILDERS
    # =========================================================================
    
    # Create a Snippet containing JS and CSS assets
    #
    # @param base_slug [String] Base slug for naming
    # @param js_logic [String] JavaScript code
    # @param css_styles [String] CSS styles
    # @return [Snippet, nil] Created snippet or nil on failure
    def create_asset_snippet(base_slug, js_logic, css_styles)
      prefix = Configuration.get('snippet_prefix', 'tt_')
      snippet_name = "#{prefix}#{sanitize_slug(base_slug)}_assets"
      
      # Check for naming collision
      if Snippet.exists?(name: snippet_name)
        # Append timestamp for uniqueness
        snippet_name = "#{snippet_name}_#{Time.current.to_i}"
      end
      
      content = build_asset_content(js_logic, css_styles)
      
      snippet = Snippet.new(
        name: snippet_name,
        content: content
      )
      
      if snippet.save
        episode.log!("Created snippet: #{snippet_name}", level: :info)
        @created_artifacts[:snippets] << snippet.id
        snippet
      else
        @errors << "Failed to create snippet: #{snippet.errors.full_messages.join(', ')}"
        nil
      end
    end
    
    # Create a Page in Radiant
    #
    # @param slug [String] URL slug
    # @param title [String] Page title
    # @param parent_slug [String] Parent page slug
    # @param layout [String] Layout name
    # @return [Page, nil] Created page or nil on failure
    def create_page(slug:, title:, parent_slug: '/', layout: nil)
      clean_slug = sanitize_slug(slug)
      
      # Find parent page
      parent = find_parent_page(parent_slug)
      unless parent
        @errors << "Parent page not found: #{parent_slug}"
        return nil
      end
      
      # Check for slug collision under this parent
      if Page.exists?(slug: clean_slug, parent_id: parent.id)
        # Append timestamp for uniqueness
        clean_slug = "#{clean_slug}-#{Time.current.to_i}"
      end
      
      # Find layout
      layout_obj = find_layout(layout)
      
      page = Page.new(
        title: title,
        slug: clean_slug,
        breadcrumb: title,
        parent_id: parent.id,
        layout_id: layout_obj&.id,
        status_id: Status[:draft].id,  # Start as draft
        class_name: ''  # Use default Page class
      )
      
      if page.save
        episode.log!("Created page: /#{clean_slug}", level: :info)
        @created_artifacts[:pages] << page.id
        page
      else
        @errors << "Failed to create page: #{page.errors.full_messages.join(', ')}"
        nil
      end
    end
    
    # Create a PagePart for a Page
    #
    # @param page [Page] Parent page
    # @param name [String] Part name (usually 'body')
    # @param content [String] Part content
    # @return [PagePart, nil] Created part or nil on failure
    def create_page_part(page, name, content)
      page_part = PagePart.new(
        name: name,
        content: content,
        page_id: page.id
      )
      
      if page_part.save
        episode.log!("Created page part: #{name}", level: :info)
        @created_artifacts[:page_parts] << page_part.id
        page_part
      else
        @errors << "Failed to create page part: #{page_part.errors.full_messages.join(', ')}"
        nil
      end
    end
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    private
    
    # Build the body content, injecting snippet reference if present
    def build_body_content(html_body, asset_snippet)
      if asset_snippet
        # Inject snippet at the end of body content
        # The <r:snippet> tag tells Radiant to include the snippet
        "#{html_body}\n\n<r:snippet name=\"#{asset_snippet.name}\" />"
      else
        html_body
      end
    end
    
    # Build asset snippet content with JS and CSS
    def build_asset_content(js_logic, css_styles)
      parts = []
      
      if css_styles.present?
        parts << "<style>\n#{css_styles}\n</style>"
      end
      
      if js_logic.present?
        parts << "<script>\n#{js_logic}\n</script>"
      end
      
      parts.join("\n\n")
    end
    
    # Find parent page by slug
    def find_parent_page(slug)
      if slug == '/' || slug.blank?
        # Find root page (homepage)
        Page.find_by(parent_id: nil) || Page.first
      else
        # Find by slug path
        Page.find_by_path(slug.gsub(/^\//, ''))
      end
    end
    
    # Find layout by name
    def find_layout(name)
      return nil if name.blank?
      
      # Try exact match first
      layout = Layout.find_by(name: name)
      return layout if layout
      
      # Try default layout from config
      default_name = Configuration.get('default_layout')
      Layout.find_by(name: default_name)
    end
    
    # Sanitize slug for URL safety
    def sanitize_slug(slug)
      slug.to_s
          .downcase
          .gsub(/[^a-z0-9\-_]/, '-')
          .gsub(/-+/, '-')
          .gsub(/^-|-$/, '')
    end
    
    # Publish a page (set status to Published)
    def publish_page(page)
      published_status = Status[:published]
      page.update(status_id: published_status.id) if published_status
    end
    
    # Record artifacts for tracking
    def record_artifacts(page, snippet, page_part)
      ThinkTank::Artifact.record!(episode: episode, object: page, role: 'primary_page')
      ThinkTank::Artifact.record!(episode: episode, object: snippet, role: 'asset_snippet') if snippet
      ThinkTank::Artifact.record!(episode: episode, object: page_part, role: 'body_content') if page_part
      
      # Update episode with artifact IDs for quick access
      episode.update!(
        artifacts: {
          primary_page_id: page.id,
          primary_page_url: page.url,
          snippet_ids: @created_artifacts[:snippets],
          page_part_ids: @created_artifacts[:page_parts]
        }
      )
    end
    
    # Custom error class for build failures
    class BuildError < StandardError; end
  end
end
