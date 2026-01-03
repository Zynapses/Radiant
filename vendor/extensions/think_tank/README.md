# Think Tank Extension for Radiant CMS

**Version**: 1.0.0  
**RADIANT PROMPT**: PROMPT-37  
**Compatibility**: Radiant CMS 1.0+ / Rails 4.2 - 7.x

## Overview

Think Tank is an AI-powered page builder extension for Radiant CMS that uses **Soft Morphing** architecture to create Pages, Snippets, and PageParts from natural language prompts via the RADIANT AWS API.

### The Problem

Radiant CMS is a **rigid, synchronous system** built on Ruby on Rails. You cannot change Ruby code at runtime without restarting the server - the "Restart Wall".

### The Solution

**Soft Morphing** uses the database (`Pages`, `Snippets`, `PageParts`) as a **mutable filesystem** to build features live. The AI agent writes to database tables, which Radiant renders dynamically without restart.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    THINK TANK EXTENSION                         │
├─────────────────────────────────────────────────────────────────┤
│  MISSION CONTROL (Admin UI)                                     │
│  ├── Terminal Pane (AJAX Polling)                               │
│  └── Preview Pane (iframe)                                      │
│                                                                 │
│  SOFT MORPHING ENGINE                                           │
│  ├── Builder Service (Page/Snippet creation)                    │
│  ├── Episode Tracker (Session management)                       │
│  └── Configuration Singleton (Settings)                         │
│                                                                 │
│  TRI-STATE MEMORY                                               │
│  ├── Structural (Pages/Snippets/PageParts)                      │
│  ├── Episodic (think_tank_episodes)                             │
│  └── Semantic (think_tank_configurations)                       │
│                                                                 │
│  RADIANT AWS API (LiteLLM Proxy)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

1. Copy the extension to your Radiant extensions directory:

```bash
cp -r think_tank vendor/extensions/
```

2. Run the migrations:

```bash
rake think_tank:migrate
```

3. Restart your Radiant server.

4. Configure the RADIANT API in admin: `/admin/think_tank/settings`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `radiant_api_endpoint` | (empty) | RADIANT API base URL |
| `radiant_api_key` | (empty) | API authentication key |
| `radiant_tenant_id` | (empty) | Your tenant ID |
| `default_model` | `claude-3-haiku` | AI model for generation |
| `max_tokens` | `4096` | Max response tokens |
| `api_timeout` | `60` | Request timeout (seconds) |
| `auto_publish` | `false` | Auto-publish created pages |
| `default_layout` | `Normal` | Layout for new pages |
| `snippet_prefix` | `tt_` | Prefix for created snippets |

## Usage

1. Navigate to `/admin/think_tank` in your Radiant admin
2. Enter a prompt describing what you want to build
3. Optionally select a template and model
4. Click "Build It" and watch the terminal for progress
5. Preview the result in the iframe

### Example Prompts

- "Build a mortgage calculator with principal, interest rate, and term inputs"
- "Create a contact form with name, email, and message fields"
- "Build a landing page for a coffee shop"

## Rake Tasks

```bash
# Run migrations
rake think_tank:migrate

# Rollback migrations
rake think_tank:rollback

# Clean up old episodes (default: 30 days)
rake think_tank:cleanup[30]

# Test API connection
rake think_tank:test_api

# Show configuration
rake think_tank:config

# Show statistics
rake think_tank:stats

# Reset all data (use with caution)
rake think_tank:reset
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `think_tank_episodes` | Episodic memory - session tracking |
| `think_tank_configurations` | Semantic memory - settings singleton |
| `think_tank_artifacts` | Links episodes to created Radiant objects |

## License

MIT License - See LICENSE file for details.

## Credits

- RADIANT PROMPT-37: Radiant CMS Think Tank Extension
- Soft Morphing Agentic Framework v1.0.0
- Cross-AI Validated Implementation
