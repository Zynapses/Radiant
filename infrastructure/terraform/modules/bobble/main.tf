# Bobble Global Consciousness Infrastructure
# Terraform module for deploying all Bobble components

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================================================
# Variables
# ============================================================================

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "replica_regions" {
  description = "Replica regions for global tables"
  type        = list(string)
  default     = ["eu-west-1", "ap-northeast-1"]
}

variable "shadow_self_instance_type" {
  description = "SageMaker instance type for Shadow Self"
  type        = string
  default     = "ml.g5.2xlarge"
}

variable "shadow_self_min_instances" {
  description = "Minimum Shadow Self instances"
  type        = number
  default     = 5
}

variable "shadow_self_max_instances" {
  description = "Maximum Shadow Self instances"
  type        = number
  default     = 300
}

variable "cache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r7g.xlarge"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

locals {
  common_tags = merge(var.tags, {
    Project     = "Bobble"
    Environment = var.environment
    ManagedBy   = "Terraform"
  })
}

# ============================================================================
# VPC and Networking
# ============================================================================

module "vpc" {
  source = "../networking"

  name               = "bobble-${var.environment}"
  cidr               = "10.0.0.0/16"
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"
  
  tags = local.common_tags
}

# ============================================================================
# DynamoDB Global Tables (Semantic + Working Memory)
# ============================================================================

resource "aws_dynamodb_table" "semantic_memory" {
  name             = "bobble-semantic-memory-${var.environment}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "pk"
  range_key        = "sk"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  attribute {
    name = "gsi2pk"
    type = "S"
  }

  attribute {
    name = "gsi2sk"
    type = "S"
  }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "gsi2"
    hash_key        = "gsi2pk"
    range_key       = "gsi2sk"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  dynamic "replica" {
    for_each = var.environment == "production" ? var.replica_regions : []
    content {
      region_name = replica.value
    }
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "working_memory" {
  name             = "bobble-working-memory-${var.environment}"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "pk"
  range_key        = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "config" {
  name         = "bobble-config-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "costs" {
  name         = "bobble-costs-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = local.common_tags
}

# ============================================================================
# DAX Cluster (DynamoDB Accelerator)
# ============================================================================

resource "aws_dax_cluster" "semantic_cache" {
  count = var.environment == "production" ? 1 : 0

  cluster_name       = "bobble-dax-${var.environment}"
  iam_role_arn       = aws_iam_role.dax.arn
  node_type          = "dax.r5.large"
  replication_factor = 3

  subnet_group_name    = aws_dax_subnet_group.main[0].name
  security_group_ids   = [aws_security_group.dax[0].id]

  tags = local.common_tags
}

resource "aws_dax_subnet_group" "main" {
  count = var.environment == "production" ? 1 : 0

  name       = "bobble-dax-subnet-${var.environment}"
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_security_group" "dax" {
  count = var.environment == "production" ? 1 : 0

  name        = "bobble-dax-${var.environment}"
  description = "Security group for DAX cluster"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 8111
    to_port         = 8111
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = local.common_tags
}

# ============================================================================
# ElastiCache for Valkey (Semantic Cache + Working Memory)
# ============================================================================

resource "aws_elasticache_replication_group" "semantic_cache" {
  replication_group_id       = "bobble-cache-${var.environment}"
  description                = "Semantic cache for Bobble LLM responses"
  engine                     = "valkey"
  engine_version             = "7.2"
  node_type                  = var.cache_node_type
  num_cache_clusters         = var.environment == "production" ? 3 : 1
  automatic_failover_enabled = var.environment == "production"
  
  parameter_group_name = aws_elasticache_parameter_group.valkey.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = local.common_tags
}

resource "aws_elasticache_parameter_group" "valkey" {
  family = "valkey7"
  name   = "bobble-valkey-${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "bobble-cache-subnet-${var.environment}"
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_security_group" "cache" {
  name        = "bobble-cache-${var.environment}"
  description = "Security group for ElastiCache"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id, aws_security_group.eks_nodes.id]
  }

  tags = local.common_tags
}

# ============================================================================
# OpenSearch Serverless (Episodic Memory)
# ============================================================================

resource "aws_opensearchserverless_collection" "episodic_memory" {
  name = "bobble-episodic-${var.environment}"
  type = "VECTORSEARCH"

  tags = local.common_tags
}

resource "aws_opensearchserverless_security_policy" "episodic_encryption" {
  name = "bobble-episodic-encryption-${var.environment}"
  type = "encryption"
  policy = jsonencode({
    Rules = [
      {
        Resource     = ["collection/bobble-episodic-${var.environment}"]
        ResourceType = "collection"
      }
    ]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "episodic_network" {
  name = "bobble-episodic-network-${var.environment}"
  type = "network"
  policy = jsonencode([
    {
      Rules = [
        {
          Resource     = ["collection/bobble-episodic-${var.environment}"]
          ResourceType = "collection"
        }
      ]
      AllowFromPublic = false
      SourceVPCEndpoints = [aws_opensearchserverless_vpc_endpoint.main.id]
    }
  ])
}

resource "aws_opensearchserverless_vpc_endpoint" "main" {
  name               = "bobble-opensearch-${var.environment}"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.opensearch.id]
}

resource "aws_security_group" "opensearch" {
  name        = "bobble-opensearch-${var.environment}"
  description = "Security group for OpenSearch Serverless"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id, aws_security_group.eks_nodes.id]
  }

  tags = local.common_tags
}

# ============================================================================
# Neptune (Knowledge Graph)
# ============================================================================

resource "aws_neptune_cluster" "knowledge_graph" {
  cluster_identifier                  = "bobble-graph-${var.environment}"
  engine                              = "neptune"
  backup_retention_period             = 7
  preferred_backup_window             = "02:00-03:00"
  skip_final_snapshot                 = var.environment != "production"
  iam_database_authentication_enabled = true
  vpc_security_group_ids              = [aws_security_group.neptune.id]
  neptune_subnet_group_name           = aws_neptune_subnet_group.main.name

  serverless_v2_scaling_configuration {
    min_capacity = var.environment == "production" ? 2.5 : 1.0
    max_capacity = var.environment == "production" ? 128.0 : 8.0
  }

  tags = local.common_tags
}

resource "aws_neptune_cluster_instance" "main" {
  count = var.environment == "production" ? 2 : 1

  cluster_identifier = aws_neptune_cluster.knowledge_graph.id
  instance_class     = "db.serverless"
  engine             = "neptune"

  tags = local.common_tags
}

resource "aws_neptune_subnet_group" "main" {
  name       = "bobble-neptune-${var.environment}"
  subnet_ids = module.vpc.private_subnet_ids

  tags = local.common_tags
}

resource "aws_security_group" "neptune" {
  name        = "bobble-neptune-${var.environment}"
  description = "Security group for Neptune"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 8182
    to_port         = 8182
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id, aws_security_group.eks_nodes.id]
  }

  tags = local.common_tags
}

# ============================================================================
# Kinesis Data Stream (Event Pipeline)
# ============================================================================

resource "aws_kinesis_stream" "interactions" {
  name             = "bobble-interactions-${var.environment}"
  retention_period = 24

  stream_mode_details {
    stream_mode = "ON_DEMAND"
  }

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.bobble.arn

  tags = local.common_tags
}

resource "aws_kinesis_stream" "curiosity" {
  name             = "bobble-curiosity-${var.environment}"
  retention_period = 72

  stream_mode_details {
    stream_mode = "ON_DEMAND"
  }

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.bobble.arn

  tags = local.common_tags
}

# ============================================================================
# KMS Key
# ============================================================================

resource "aws_kms_key" "bobble" {
  description             = "KMS key for Bobble encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_alias" "bobble" {
  name          = "alias/bobble-${var.environment}"
  target_key_id = aws_kms_key.bobble.key_id
}

# ============================================================================
# Security Groups
# ============================================================================

resource "aws_security_group" "lambda" {
  name        = "bobble-lambda-${var.environment}"
  description = "Security group for Lambda functions"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "eks_nodes" {
  name        = "bobble-eks-nodes-${var.environment}"
  description = "Security group for EKS nodes"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# ============================================================================
# IAM Roles
# ============================================================================

resource "aws_iam_role" "dax" {
  name = "bobble-dax-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "dax.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "dax_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.dax.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.semantic_memory.arn,
          "${aws_dynamodb_table.semantic_memory.arn}/index/*"
        ]
      }
    ]
  })
}

# ============================================================================
# Outputs
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "semantic_memory_table" {
  description = "Semantic memory DynamoDB table name"
  value       = aws_dynamodb_table.semantic_memory.name
}

output "working_memory_table" {
  description = "Working memory DynamoDB table name"
  value       = aws_dynamodb_table.working_memory.name
}

output "config_table" {
  description = "Config DynamoDB table name"
  value       = aws_dynamodb_table.config.name
}

output "costs_table" {
  description = "Costs DynamoDB table name"
  value       = aws_dynamodb_table.costs.name
}

output "cache_endpoint" {
  description = "ElastiCache endpoint"
  value       = aws_elasticache_replication_group.semantic_cache.primary_endpoint_address
}

output "opensearch_endpoint" {
  description = "OpenSearch Serverless endpoint"
  value       = aws_opensearchserverless_collection.episodic_memory.collection_endpoint
}

output "neptune_endpoint" {
  description = "Neptune cluster endpoint"
  value       = aws_neptune_cluster.knowledge_graph.endpoint
}

output "interactions_stream" {
  description = "Kinesis interactions stream name"
  value       = aws_kinesis_stream.interactions.name
}

output "curiosity_stream" {
  description = "Kinesis curiosity stream name"
  value       = aws_kinesis_stream.curiosity.name
}
