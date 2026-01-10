# Cato SageMaker Endpoints
# Shadow Self (Llama-3-8B) and NLI (DeBERTa) endpoints

# ============================================================================
# ECR Repositories
# ============================================================================

resource "aws_ecr_repository" "shadow_self" {
  name                 = "cato-shadow-self-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.cato.arn
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "nli_model" {
  name                 = "cato-nli-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.cato.arn
  }

  tags = local.common_tags
}

# ============================================================================
# S3 Bucket for Models
# ============================================================================

resource "aws_s3_bucket" "models" {
  bucket = "cato-models-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "models" {
  bucket = aws_s3_bucket.models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "models" {
  bucket = aws_s3_bucket.models.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.cato.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

data "aws_caller_identity" "current" {}

# ============================================================================
# IAM Role for SageMaker
# ============================================================================

resource "aws_iam_role" "sagemaker" {
  name = "cato-sagemaker-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "sagemaker_full" {
  role       = aws_iam_role.sagemaker.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_iam_role_policy" "sagemaker_s3" {
  name = "s3-model-access"
  role = aws_iam_role.sagemaker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.models.arn,
          "${aws_s3_bucket.models.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "sagemaker_ecr" {
  name = "ecr-access"
  role = aws_iam_role.sagemaker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = [
          aws_ecr_repository.shadow_self.arn,
          aws_ecr_repository.nli_model.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "sagemaker_kms" {
  name = "kms-access"
  role = aws_iam_role.sagemaker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.cato.arn]
      }
    ]
  })
}

# ============================================================================
# Shadow Self Model (Llama-3-8B)
# ============================================================================

resource "aws_sagemaker_model" "shadow_self" {
  name               = "cato-shadow-self-${var.environment}"
  execution_role_arn = aws_iam_role.sagemaker.arn

  primary_container {
    image          = "${aws_ecr_repository.shadow_self.repository_url}:latest"
    model_data_url = "s3://${aws_s3_bucket.models.id}/llama-3-8b-instruct/model.tar.gz"
    environment = {
      MODEL_PATH                = "/opt/ml/model"
      CUDA_VISIBLE_DEVICES      = "0"
      TRANSFORMERS_CACHE        = "/tmp/transformers"
      HF_HOME                   = "/tmp/huggingface"
    }
  }

  vpc_config {
    subnets            = module.vpc.private_subnet_ids
    security_group_ids = [aws_security_group.sagemaker.id]
  }

  tags = local.common_tags
}

resource "aws_sagemaker_endpoint_configuration" "shadow_self" {
  name = "cato-shadow-self-config-${var.environment}"

  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.shadow_self.name
    instance_type          = var.shadow_self_instance_type
    initial_instance_count = var.shadow_self_min_instances

    managed_instance_scaling {
      status                     = "ENABLED"
      min_instance_count         = var.shadow_self_min_instances
      max_instance_count         = var.shadow_self_max_instances
    }

    routing_config {
      routing_strategy = "LEAST_OUTSTANDING_REQUESTS"
    }
  }

  tags = local.common_tags
}

resource "aws_sagemaker_endpoint" "shadow_self" {
  name                 = "cato-shadow-self-${var.environment}"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.shadow_self.name

  tags = local.common_tags
}

# ============================================================================
# NLI Model (DeBERTa-large-MNLI) - Multi-Model Endpoint
# ============================================================================

resource "aws_sagemaker_model" "nli" {
  name               = "cato-nli-${var.environment}"
  execution_role_arn = aws_iam_role.sagemaker.arn

  primary_container {
    image          = "${aws_ecr_repository.nli_model.repository_url}:latest"
    model_data_url = "s3://${aws_s3_bucket.models.id}/deberta-large-mnli/model.tar.gz"
    mode           = "MultiModel"
    environment = {
      SAGEMAKER_MULTI_MODEL = "true"
    }
  }

  vpc_config {
    subnets            = module.vpc.private_subnet_ids
    security_group_ids = [aws_security_group.sagemaker.id]
  }

  tags = local.common_tags
}

resource "aws_sagemaker_endpoint_configuration" "nli" {
  name = "cato-nli-config-${var.environment}"

  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.nli.name
    instance_type          = "ml.g4dn.xlarge"
    initial_instance_count = var.environment == "production" ? 2 : 1

    managed_instance_scaling {
      status                     = "ENABLED"
      min_instance_count         = var.environment == "production" ? 2 : 1
      max_instance_count         = var.environment == "production" ? 20 : 2
    }
  }

  tags = local.common_tags
}

resource "aws_sagemaker_endpoint" "nli" {
  name                 = "cato-nli-mme-${var.environment}"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.nli.name

  tags = local.common_tags
}

# ============================================================================
# Security Group for SageMaker
# ============================================================================

resource "aws_security_group" "sagemaker" {
  name        = "cato-sagemaker-${var.environment}"
  description = "Security group for SageMaker endpoints"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id, aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# ============================================================================
# CloudWatch Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "shadow_self_latency" {
  alarm_name          = "cato-shadow-self-high-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ModelLatency"
  namespace           = "AWS/SageMaker"
  period              = 60
  statistic           = "p99"
  threshold           = 500000  # 500ms in microseconds
  alarm_description   = "Shadow Self latency exceeds 500ms"

  dimensions = {
    EndpointName = aws_sagemaker_endpoint.shadow_self.name
    VariantName  = "primary"
  }

  alarm_actions = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "shadow_self_errors" {
  alarm_name          = "cato-shadow-self-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Invocation5XXErrors"
  namespace           = "AWS/SageMaker"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Shadow Self experiencing errors"

  dimensions = {
    EndpointName = aws_sagemaker_endpoint.shadow_self.name
    VariantName  = "primary"
  }

  alarm_actions = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  tags = local.common_tags
}

# ============================================================================
# SNS Topic for Alerts
# ============================================================================

resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0

  name = "cato-alerts-${var.environment}"

  tags = local.common_tags
}

# ============================================================================
# Outputs
# ============================================================================

output "shadow_self_endpoint" {
  description = "Shadow Self SageMaker endpoint name"
  value       = aws_sagemaker_endpoint.shadow_self.name
}

output "nli_endpoint" {
  description = "NLI SageMaker endpoint name"
  value       = aws_sagemaker_endpoint.nli.name
}

output "models_bucket" {
  description = "S3 bucket for model artifacts"
  value       = aws_s3_bucket.models.id
}

output "shadow_self_ecr_repo" {
  description = "ECR repository for Shadow Self container"
  value       = aws_ecr_repository.shadow_self.repository_url
}

output "nli_ecr_repo" {
  description = "ECR repository for NLI container"
  value       = aws_ecr_repository.nli_model.repository_url
}
