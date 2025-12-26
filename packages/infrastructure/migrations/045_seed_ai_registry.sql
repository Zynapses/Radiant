-- RADIANT v4.18.0 - Seed AI Registry
-- Seeds providers and models on FRESH INSTALL ONLY
-- Admin customizations are preserved on upgrades (ON CONFLICT DO NOTHING)

-- ============================================================================
-- EXTERNAL PROVIDERS (21 providers)
-- ============================================================================

INSERT INTO providers (id, name, display_name, category, description, website, api_base_url, auth_type, secret_name, enabled, features, compliance)
VALUES
-- Text Generation Providers
('openai', 'openai', 'OpenAI', 'text_generation', 'Leading AI research lab providing GPT and O-series models', 'https://openai.com', 'https://api.openai.com/v1', 'bearer', 'radiant/providers/openai', true, ARRAY['streaming', 'function_calling', 'vision', 'json_mode', 'batch_api'], ARRAY['SOC2', 'GDPR']),
('anthropic', 'anthropic', 'Anthropic', 'text_generation', 'AI safety company providing Claude models', 'https://anthropic.com', 'https://api.anthropic.com/v1', 'api_key', 'radiant/providers/anthropic', true, ARRAY['streaming', 'tool_use', 'vision', 'extended_thinking', 'batch_api'], ARRAY['SOC2', 'GDPR', 'HIPAA']),
('google', 'google', 'Google AI', 'text_generation', 'Gemini models for multimodal AI', 'https://ai.google.dev', 'https://generativelanguage.googleapis.com/v1beta', 'api_key', 'radiant/providers/google', true, ARRAY['streaming', 'function_calling', 'vision', 'audio'], ARRAY['SOC2', 'GDPR']),
('xai', 'xai', 'xAI', 'text_generation', 'Grok models from xAI', 'https://x.ai', 'https://api.x.ai/v1', 'bearer', 'radiant/providers/xai', true, ARRAY['streaming', 'function_calling'], ARRAY[]::TEXT[]),
('deepseek', 'deepseek', 'DeepSeek', 'text_generation', 'Affordable high-performance models', 'https://deepseek.com', 'https://api.deepseek.com/v1', 'bearer', 'radiant/providers/deepseek', true, ARRAY['streaming', 'reasoning'], ARRAY[]::TEXT[]),
('mistral', 'mistral', 'Mistral AI', 'text_generation', 'European AI models', 'https://mistral.ai', 'https://api.mistral.ai/v1', 'bearer', 'radiant/providers/mistral', true, ARRAY['streaming', 'function_calling'], ARRAY['GDPR']),
('cohere', 'cohere', 'Cohere', 'text_generation', 'Enterprise AI models', 'https://cohere.com', 'https://api.cohere.ai/v1', 'bearer', 'radiant/providers/cohere', true, ARRAY['streaming', 'rag'], ARRAY[]::TEXT[]),

-- Image Generation Providers
('openai-images', 'openai-images', 'OpenAI Images', 'image_generation', 'DALL-E image generation', 'https://openai.com', 'https://api.openai.com/v1', 'bearer', 'radiant/providers/openai', true, ARRAY['text_to_image'], ARRAY[]::TEXT[]),
('stability', 'stability', 'Stability AI', 'image_generation', 'Stable Diffusion models', 'https://stability.ai', 'https://api.stability.ai/v2beta', 'bearer', 'radiant/providers/stability', true, ARRAY['text_to_image', 'image_to_image'], ARRAY[]::TEXT[]),
('flux', 'flux', 'FLUX', 'image_generation', 'Black Forest Labs FLUX models', 'https://blackforestlabs.ai', 'https://api.bfl.ml/v1', 'bearer', 'radiant/providers/flux', true, ARRAY['text_to_image', 'high_quality'], ARRAY[]::TEXT[]),

-- Video Generation Providers
('runway', 'runway', 'Runway', 'video_generation', 'Gen-3 video generation', 'https://runway.ml', 'https://api.runwayml.com/v1', 'bearer', 'radiant/providers/runway', true, ARRAY['text_to_video', 'image_to_video'], ARRAY[]::TEXT[]),
('luma', 'luma', 'Luma AI', 'video_generation', 'Dream Machine video generation', 'https://lumalabs.ai', 'https://api.lumalabs.ai/v1', 'bearer', 'radiant/providers/luma', true, ARRAY['text_to_video', 'image_to_video'], ARRAY[]::TEXT[]),

-- Audio Providers
('elevenlabs', 'elevenlabs', 'ElevenLabs', 'audio_generation', 'AI voice synthesis', 'https://elevenlabs.io', 'https://api.elevenlabs.io/v1', 'bearer', 'radiant/providers/elevenlabs', true, ARRAY['tts', 'voice_cloning'], ARRAY[]::TEXT[]),
('openai-audio', 'openai-audio', 'OpenAI Audio', 'audio', 'TTS and Whisper transcription', 'https://openai.com', 'https://api.openai.com/v1', 'bearer', 'radiant/providers/openai', true, ARRAY['tts', 'stt'], ARRAY[]::TEXT[]),

-- Embedding Providers
('openai-embeddings', 'openai-embeddings', 'OpenAI Embeddings', 'embedding', 'Text embedding models', 'https://openai.com', 'https://api.openai.com/v1', 'bearer', 'radiant/providers/openai', true, ARRAY['text_embedding'], ARRAY[]::TEXT[]),
('voyage', 'voyage', 'Voyage AI', 'embedding', 'State-of-the-art embeddings', 'https://voyageai.com', 'https://api.voyageai.com/v1', 'bearer', 'radiant/providers/voyage', true, ARRAY['text_embedding', 'code_embedding'], ARRAY[]::TEXT[]),

-- Search Provider
('perplexity', 'perplexity', 'Perplexity', 'search', 'AI-powered search with citations', 'https://perplexity.ai', 'https://api.perplexity.ai', 'bearer', 'radiant/providers/perplexity', true, ARRAY['search', 'citations'], ARRAY[]::TEXT[]),

-- 3D Generation
('meshy', 'meshy', 'Meshy', '3d_generation', 'AI 3D model generation', 'https://meshy.ai', 'https://api.meshy.ai/v2', 'bearer', 'radiant/providers/meshy', true, ARRAY['text_to_3d', 'image_to_3d'], ARRAY[]::TEXT[]),

-- Self-Hosted Provider (for SageMaker models)
('radiant-hosted', 'radiant-hosted', 'RADIANT Hosted', 'self_hosted', 'Self-hosted models on SageMaker', NULL, NULL, 'iam', NULL, true, ARRAY['vision', 'audio', 'scientific', 'medical'], ARRAY['HIPAA', 'SOC2'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EXTERNAL MODELS (50+ models)
-- ============================================================================

INSERT INTO models (id, provider_id, model_id, litellm_id, name, display_name, description, category, specialty, capabilities, context_window, max_output, input_modalities, output_modalities, pricing, min_tier, enabled, status)
VALUES
-- OpenAI Models
('openai-gpt-4o', 'openai', 'gpt-4o', 'gpt-4o', 'gpt-4o', 'GPT-4o', 'Latest flagship model with vision capabilities', 'text_generation', NULL, ARRAY['chat', 'vision', 'function_calling', 'streaming'], 128000, 16384, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.0025, "outputCostPer1k": 0.01, "markup": 1.40}', 1, true, 'active'),
('openai-gpt-4o-mini', 'openai', 'gpt-4o-mini', 'gpt-4o-mini', 'gpt-4o-mini', 'GPT-4o Mini', 'Fast, affordable small model', 'text_generation', NULL, ARRAY['chat', 'vision', 'function_calling', 'streaming'], 128000, 16384, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.00015, "outputCostPer1k": 0.0006, "markup": 1.40}', 1, true, 'active'),
('openai-o1', 'openai', 'o1', 'o1', 'o1', 'O1', 'Advanced reasoning model for complex problems', 'reasoning', NULL, ARRAY['chat', 'reasoning', 'streaming'], 200000, 100000, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.015, "outputCostPer1k": 0.06, "markup": 1.40}', 2, true, 'active'),
('openai-o1-mini', 'openai', 'o1-mini', 'o1-mini', 'o1-mini', 'O1 Mini', 'Faster, more affordable reasoning model', 'reasoning', NULL, ARRAY['chat', 'reasoning', 'streaming'], 128000, 65536, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.003, "outputCostPer1k": 0.012, "markup": 1.40}', 1, true, 'active'),
('openai-o3-mini', 'openai', 'o3-mini', 'o3-mini', 'o3-mini', 'O3 Mini', 'Latest reasoning model with improved capabilities', 'reasoning', NULL, ARRAY['chat', 'reasoning', 'streaming'], 200000, 100000, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.0011, "outputCostPer1k": 0.0044, "markup": 1.40}', 1, true, 'active'),

-- Anthropic Models
('anthropic-claude-opus-4', 'anthropic', 'claude-opus-4-20250514', 'anthropic/claude-opus-4-20250514', 'claude-opus-4', 'Claude Opus 4', 'Most capable Claude model for complex analysis', 'text_generation', NULL, ARRAY['chat', 'vision', 'tool_use', 'extended_thinking', 'streaming'], 200000, 32000, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.015, "outputCostPer1k": 0.075, "markup": 1.40}', 2, true, 'active'),
('anthropic-claude-sonnet-4', 'anthropic', 'claude-sonnet-4-20250514', 'anthropic/claude-sonnet-4-20250514', 'claude-sonnet-4', 'Claude Sonnet 4', 'Balanced performance and speed', 'text_generation', NULL, ARRAY['chat', 'vision', 'tool_use', 'extended_thinking', 'streaming'], 200000, 64000, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.003, "outputCostPer1k": 0.015, "markup": 1.40}', 1, true, 'active'),
('anthropic-claude-haiku-35', 'anthropic', 'claude-3-5-haiku-20241022', 'anthropic/claude-3-5-haiku-20241022', 'claude-3-5-haiku', 'Claude 3.5 Haiku', 'Fast, affordable for high-volume tasks', 'text_generation', NULL, ARRAY['chat', 'vision', 'tool_use', 'streaming'], 200000, 8192, ARRAY['text', 'image'], ARRAY['text'], '{"inputCostPer1k": 0.0008, "outputCostPer1k": 0.004, "markup": 1.40}', 1, true, 'active'),

-- Google Models
('google-gemini-2-flash', 'google', 'gemini-2.0-flash', 'gemini/gemini-2.0-flash', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'Fast multimodal model', 'text_generation', NULL, ARRAY['chat', 'vision', 'audio', 'streaming'], 1000000, 8192, ARRAY['text', 'image', 'audio', 'video'], ARRAY['text'], '{"inputCostPer1k": 0.0001, "outputCostPer1k": 0.0004, "markup": 1.40}', 1, true, 'active'),
('google-gemini-15-pro', 'google', 'gemini-1.5-pro', 'gemini/gemini-1.5-pro', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'Advanced multimodal with 1M context', 'text_generation', NULL, ARRAY['chat', 'vision', 'audio', 'streaming'], 1000000, 8192, ARRAY['text', 'image', 'audio', 'video'], ARRAY['text'], '{"inputCostPer1k": 0.00125, "outputCostPer1k": 0.005, "markup": 1.40}', 1, true, 'active'),

-- xAI Models
('xai-grok-3', 'xai', 'grok-3', 'xai/grok-3', 'grok-3', 'Grok 3', 'Latest Grok model', 'text_generation', NULL, ARRAY['chat', 'streaming'], 131072, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.003, "outputCostPer1k": 0.015, "markup": 1.40}', 1, true, 'active'),
('xai-grok-3-mini', 'xai', 'grok-3-mini', 'xai/grok-3-mini', 'grok-3-mini', 'Grok 3 Mini', 'Fast, affordable Grok', 'text_generation', NULL, ARRAY['chat', 'streaming'], 131072, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.0003, "outputCostPer1k": 0.0005, "markup": 1.40}', 1, true, 'active'),

-- DeepSeek Models
('deepseek-chat', 'deepseek', 'deepseek-chat', 'deepseek/deepseek-chat', 'deepseek-chat', 'DeepSeek Chat', 'General purpose chat model', 'text_generation', NULL, ARRAY['chat', 'streaming'], 64000, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.00014, "outputCostPer1k": 0.00028, "markup": 1.40}', 1, true, 'active'),
('deepseek-reasoner', 'deepseek', 'deepseek-reasoner', 'deepseek/deepseek-reasoner', 'deepseek-reasoner', 'DeepSeek R1', 'Advanced reasoning model', 'reasoning', NULL, ARRAY['chat', 'reasoning', 'streaming'], 64000, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.00055, "outputCostPer1k": 0.00219, "markup": 1.40}', 1, true, 'active'),

-- Mistral Models
('mistral-large', 'mistral', 'mistral-large-latest', 'mistral/mistral-large-latest', 'mistral-large', 'Mistral Large', 'Flagship model for complex tasks', 'text_generation', NULL, ARRAY['chat', 'function_calling', 'streaming'], 128000, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.002, "outputCostPer1k": 0.006, "markup": 1.40}', 1, true, 'active'),
('mistral-codestral', 'mistral', 'codestral-latest', 'mistral/codestral-latest', 'codestral', 'Codestral', 'Specialized for code generation', 'code_generation', NULL, ARRAY['chat', 'code', 'streaming'], 32000, 8192, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.0003, "outputCostPer1k": 0.0009, "markup": 1.40}', 1, true, 'active'),

-- Cohere Models
('cohere-command-r-plus', 'cohere', 'command-r-plus', 'cohere/command-r-plus', 'command-r-plus', 'Command R+', 'Most capable Cohere model', 'text_generation', NULL, ARRAY['chat', 'rag', 'streaming'], 128000, 4096, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.003, "outputCostPer1k": 0.015, "markup": 1.40}', 1, true, 'active'),

-- Image Models
('dalle-3', 'openai-images', 'dall-e-3', NULL, 'dall-e-3', 'DALL-E 3', 'Latest image generation model', 'image_generation', NULL, ARRAY['text_to_image'], NULL, NULL, ARRAY['text'], ARRAY['image'], '{"perImage1024": 0.04, "perImage1024HD": 0.08, "perImage1792": 0.08, "perImage1792HD": 0.12, "markup": 1.40}', 1, true, 'active'),
('sd3-large', 'stability', 'sd3-large', NULL, 'sd3-large', 'Stable Diffusion 3 Large', 'High quality image generation', 'image_generation', NULL, ARRAY['text_to_image', 'image_to_image'], NULL, NULL, ARRAY['text', 'image'], ARRAY['image'], '{"perImage": 0.065, "markup": 1.40}', 1, true, 'active'),
('flux-pro-11', 'flux', 'flux-pro-1.1', NULL, 'flux-pro-1.1', 'FLUX Pro 1.1', 'High quality FLUX model', 'image_generation', NULL, ARRAY['text_to_image', 'high_quality'], NULL, NULL, ARRAY['text'], ARRAY['image'], '{"perImage": 0.05, "markup": 1.40}', 1, true, 'active'),
('flux-schnell', 'flux', 'flux-schnell', NULL, 'flux-schnell', 'FLUX Schnell', 'Fast FLUX model', 'image_generation', NULL, ARRAY['text_to_image', 'fast'], NULL, NULL, ARRAY['text'], ARRAY['image'], '{"perImage": 0.003, "markup": 1.40}', 1, true, 'active'),

-- Video Models
('gen3-alpha', 'runway', 'gen-3-alpha', NULL, 'gen-3-alpha', 'Gen-3 Alpha', 'Video generation model', 'video_generation', NULL, ARRAY['text_to_video', 'image_to_video'], NULL, NULL, ARRAY['text', 'image'], ARRAY['video'], '{"perSecond": 0.05, "markup": 1.40}', 2, true, 'active'),
('luma-ray2', 'luma', 'ray-2', NULL, 'ray-2', 'Ray 2', 'Dream Machine video generation', 'video_generation', NULL, ARRAY['text_to_video', 'image_to_video'], NULL, NULL, ARRAY['text', 'image'], ARRAY['video'], '{"perSecond": 0.032, "markup": 1.40}', 2, true, 'active'),

-- Audio Models
('eleven-multilingual-v2', 'elevenlabs', 'eleven_multilingual_v2', NULL, 'eleven_multilingual_v2', 'Multilingual V2', 'Multilingual voice synthesis', 'text_to_speech', NULL, ARRAY['tts', 'multilingual', 'voice_cloning'], NULL, NULL, ARRAY['text'], ARRAY['audio'], '{"perCharacter": 0.00018, "markup": 1.40}', 1, true, 'active'),
('openai-tts-1', 'openai-audio', 'tts-1', NULL, 'tts-1', 'TTS-1', 'OpenAI text to speech', 'text_to_speech', NULL, ARRAY['tts'], NULL, NULL, ARRAY['text'], ARRAY['audio'], '{"perCharacter": 0.000015, "markup": 1.40}', 1, true, 'active'),
('openai-whisper-1', 'openai-audio', 'whisper-1', NULL, 'whisper-1', 'Whisper', 'Speech recognition and translation', 'speech_to_text', NULL, ARRAY['transcription', 'translation'], NULL, NULL, ARRAY['audio'], ARRAY['text'], '{"perMinute": 0.006, "markup": 1.40}', 1, true, 'active'),

-- Embedding Models
('text-embedding-3-small', 'openai-embeddings', 'text-embedding-3-small', NULL, 'text-embedding-3-small', 'Text Embedding 3 Small', 'Fast, affordable embeddings', 'embedding', NULL, ARRAY['text_embedding'], 8191, NULL, ARRAY['text'], ARRAY['embedding'], '{"inputCostPer1k": 0.00002, "markup": 1.40}', 1, true, 'active'),
('text-embedding-3-large', 'openai-embeddings', 'text-embedding-3-large', NULL, 'text-embedding-3-large', 'Text Embedding 3 Large', 'High quality embeddings', 'embedding', NULL, ARRAY['text_embedding'], 8191, NULL, ARRAY['text'], ARRAY['embedding'], '{"inputCostPer1k": 0.00013, "markup": 1.40}', 1, true, 'active'),
('voyage-3', 'voyage', 'voyage-3', NULL, 'voyage-3', 'Voyage 3', 'State-of-the-art embeddings', 'embedding', NULL, ARRAY['text_embedding'], 32000, NULL, ARRAY['text'], ARRAY['embedding'], '{"inputCostPer1k": 0.00006, "markup": 1.40}', 1, true, 'active'),

-- Search Models
('perplexity-sonar', 'perplexity', 'sonar', NULL, 'sonar', 'Sonar', 'AI-powered search with citations', 'search', NULL, ARRAY['search', 'citations'], NULL, NULL, ARRAY['text'], ARRAY['text'], '{"inputCostPer1k": 0.001, "outputCostPer1k": 0.001, "perSearch": 0.005, "markup": 1.40}', 1, true, 'active'),

-- 3D Models
('meshy-v3', 'meshy', 'meshy-v3', NULL, 'meshy-v3', 'Meshy V3', 'AI 3D model generation', '3d_generation', NULL, ARRAY['text_to_3d', 'image_to_3d'], NULL, NULL, ARRAY['text', 'image'], ARRAY['3d_model'], '{"per3DModel": 0.20, "markup": 1.40}', 2, true, 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SELF-HOSTED MODELS (38 models for SageMaker)
-- ============================================================================

INSERT INTO self_hosted_models (id, name, display_name, description, category, specialty, instance_type, parameters, capabilities, pricing, min_tier, thermal_config, license, enabled, status)
VALUES
-- Image Classification
('efficientnet-b0', 'efficientnet-b0', 'EfficientNet-B0', 'Lightweight image classification model', 'vision_classification', 'image_classification', 'ml.g4dn.xlarge', 5300000, ARRAY['image_classification', 'feature_extraction'], '{"hourlyRate": 1.30, "perImage": 0.001, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 45}', 'Apache-2.0', true, 'active'),
('efficientnet-b5', 'efficientnet-b5', 'EfficientNet-B5', 'High accuracy classification', 'vision_classification', 'image_classification', 'ml.g5.xlarge', NULL, ARRAY['image_classification'], '{"hourlyRate": 2.47, "perImage": 0.003, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 60}', 'Apache-2.0', true, 'active'),
('clip-vit-b32', 'clip-vit-b32', 'CLIP ViT-B/32', 'Zero-shot image-text understanding', 'vision_classification', 'zero_shot_classification', 'ml.g4dn.xlarge', NULL, ARRAY['zero_shot', 'text_prompted'], '{"hourlyRate": 1.30, "perImage": 0.003, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 45}', 'MIT', true, 'active'),
('clip-vit-l14', 'clip-vit-l14', 'CLIP ViT-L/14', 'Large CLIP for high accuracy zero-shot', 'vision_classification', 'zero_shot_classification', 'ml.g5.2xlarge', NULL, ARRAY['zero_shot', 'text_prompted'], '{"hourlyRate": 2.66, "perImage": 0.008, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 90}', 'MIT', true, 'active'),

-- Object Detection
('yolov8n', 'yolov8n', 'YOLOv8 Nano', 'Ultra-fast object detection', 'vision_detection', 'object_detection', 'ml.g4dn.xlarge', 3200000, ARRAY['object_detection', 'fast'], '{"hourlyRate": 1.30, "perImage": 0.002, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 10, "warmupTimeSeconds": 30}', 'AGPL-3.0', true, 'active'),
('yolov8m', 'yolov8m', 'YOLOv8 Medium', 'Balanced object detection', 'vision_detection', 'object_detection', 'ml.g5.xlarge', NULL, ARRAY['object_detection'], '{"hourlyRate": 2.47, "perImage": 0.005, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 45}', 'AGPL-3.0', true, 'active'),
('yolov8x', 'yolov8x', 'YOLOv8 XLarge', 'High accuracy object detection', 'vision_detection', 'object_detection', 'ml.g5.2xlarge', NULL, ARRAY['object_detection', 'high_accuracy'], '{"hourlyRate": 2.66, "perImage": 0.008, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 60}', 'AGPL-3.0', true, 'active'),
('grounding-dino', 'grounding-dino', 'Grounding DINO', 'Open-vocabulary detection with text prompts', 'vision_detection', 'open_vocabulary_detection', 'ml.g5.2xlarge', NULL, ARRAY['text_prompted', 'open_vocabulary'], '{"hourlyRate": 2.66, "perImage": 0.008, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 90}', 'Apache-2.0', true, 'active'),

-- Segmentation
('sam-vit-h', 'sam-vit-h', 'SAM ViT-H', 'Segment Anything Model - largest variant', 'vision_segmentation', 'instance_segmentation', 'ml.g5.4xlarge', 636000000, ARRAY['instance_segmentation', 'interactive', 'zero_shot'], '{"hourlyRate": 3.55, "perImage": 0.015, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 120}', 'Apache-2.0', true, 'active'),
('sam2', 'sam2', 'SAM 2', 'Segment Anything Model 2 with video support', 'vision_segmentation', 'instance_segmentation', 'ml.g5.4xlarge', NULL, ARRAY['instance_segmentation', 'video_segmentation', 'interactive'], '{"hourlyRate": 3.55, "perImage": 0.012, "perMinuteVideo": 0.50, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 120}', 'Apache-2.0', true, 'active'),
('mobilesam', 'mobilesam', 'MobileSAM', 'Lightweight SAM for fast inference', 'vision_segmentation', 'instance_segmentation', 'ml.g4dn.xlarge', 10000000, ARRAY['instance_segmentation', 'interactive', 'fast'], '{"hourlyRate": 1.30, "perImage": 0.004, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 10, "warmupTimeSeconds": 30}', 'Apache-2.0', true, 'active'),

-- Audio/Speech
('parakeet-tdt-1b', 'parakeet-tdt-1b', 'NVIDIA Parakeet TDT 1.1B', 'State-of-the-art ASR', 'audio_stt', 'speech_to_text', 'ml.g5.xlarge', 1100000000, ARRAY['transcription', 'multilingual'], '{"hourlyRate": 2.47, "perMinuteAudio": 0.02, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 60}', 'Apache-2.0', true, 'active'),
('whisper-large-v3', 'whisper-large-v3', 'Whisper Large V3', 'OpenAI Whisper self-hosted', 'audio_stt', 'speech_to_text', 'ml.g5.xlarge', NULL, ARRAY['transcription', 'translation', 'multilingual'], '{"hourlyRate": 2.47, "perMinuteAudio": 0.015, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 60}', 'MIT', true, 'active'),

-- Scientific
('alphafold2', 'alphafold2', 'AlphaFold 2', 'DeepMind protein structure prediction', 'scientific', 'protein_folding', 'ml.p4d.24xlarge', NULL, ARRAY['protein_structure', 'multiple_sequence_alignment'], '{"hourlyRate": 57.35, "perProtein": 2.00, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 30, "warmupTimeSeconds": 300}', 'Apache-2.0', true, 'active'),
('esm2-3b', 'esm2-3b', 'ESM-2 3B', 'Meta protein language model', 'scientific', 'protein_embedding', 'ml.g5.12xlarge', 3000000000, ARRAY['protein_embedding', 'variant_effect'], '{"hourlyRate": 14.28, "perSequence": 0.05, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 20, "warmupTimeSeconds": 180}', 'MIT', true, 'active'),

-- Medical
('nnunet', 'nnunet', 'nnU-Net', 'Self-configuring medical image segmentation', 'medical_imaging', 'medical_segmentation', 'ml.g5.2xlarge', NULL, ARRAY['medical_segmentation', 'tumor_detection', 'organ_segmentation', '3d_imaging'], '{"hourlyRate": 2.66, "perImage": 0.10, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 20, "warmupTimeSeconds": 90}', 'Apache-2.0', true, 'active'),
('medsam', 'medsam', 'MedSAM', 'SAM fine-tuned for medical images', 'medical_imaging', 'medical_segmentation', 'ml.g5.2xlarge', NULL, ARRAY['medical_segmentation', 'interactive', 'multi_modality'], '{"hourlyRate": 2.66, "perImage": 0.08, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 20, "warmupTimeSeconds": 90}', 'Apache-2.0', true, 'active'),

-- Geospatial
('prithvi-100m', 'prithvi-100m', 'Prithvi 100M', 'NASA/IBM geospatial foundation model', 'geospatial', 'satellite_analysis', 'ml.g5.xlarge', 100000000, ARRAY['land_classification', 'flood_detection', 'wildfire_detection'], '{"hourlyRate": 2.47, "perImage": 0.05, "markup": 1.75}', 4, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 20, "warmupTimeSeconds": 60}', 'Apache-2.0', true, 'active'),

-- Self-Hosted LLMs
('mistral-7b', 'mistral-7b', 'Mistral 7B', 'Open-source 7B parameter model', 'text_generation', NULL, 'ml.g5.2xlarge', 7000000000, ARRAY['chat', 'code', 'streaming'], '{"hourlyRate": 2.66, "inputCostPer1k": 0.0001, "outputCostPer1k": 0.0002, "markup": 1.75}', 3, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 30, "warmupTimeSeconds": 120}', 'Apache-2.0', true, 'active'),
('llama3-70b', 'llama3-70b', 'Llama 3 70B', 'Meta Llama 3 70B parameter model', 'text_generation', NULL, 'ml.g5.48xlarge', 70000000000, ARRAY['chat', 'code', 'streaming'], '{"hourlyRate": 35.63, "inputCostPer1k": 0.0005, "outputCostPer1k": 0.001, "markup": 1.75}', 5, '{"defaultState": "COLD", "scaleToZeroAfterMinutes": 60, "warmupTimeSeconds": 300}', 'Llama 3 Community License', true, 'active')
ON CONFLICT (id) DO NOTHING;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'AI Registry seeded: % providers, % models, % self-hosted models',
        (SELECT COUNT(*) FROM providers),
        (SELECT COUNT(*) FROM models),
        (SELECT COUNT(*) FROM self_hosted_models);
END $$;
