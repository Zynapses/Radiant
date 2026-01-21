"""
RADIANT Flyte Utilities

v5.0.2 - System Evolution
"""

from .db import (
    get_safe_db_connection,
    get_system_db_connection,
    get_readonly_connection,
    close_pool,
    health_check,
    SYSTEM_TENANT_ID
)

from .embeddings import (
    generate_embedding,
    generate_embeddings_batch,
    cosine_similarity,
    cosine_distance,
    EmbeddingCache,
    EMBEDDING_DIMENSIONS
)

from .cato_client import (
    CatoClient,
    CatoRisk
)

from .hitl_tasks import (
    ask_confirmation,
    ask_choice,
    ask_batch,
    ask_free_text,
    QuestionType,
    Urgency,
    VOIComponents,
    QuestionOption,
    BatchQuestion,
    HITLResponse,
)

__all__ = [
    # Database
    'get_safe_db_connection',
    'get_system_db_connection', 
    'get_readonly_connection',
    'close_pool',
    'health_check',
    'SYSTEM_TENANT_ID',
    # Embeddings
    'generate_embedding',
    'generate_embeddings_batch',
    'cosine_similarity',
    'cosine_distance',
    'EmbeddingCache',
    'EMBEDDING_DIMENSIONS',
    # Cato
    'CatoClient',
    'CatoRisk',
    # HITL Tasks
    'ask_confirmation',
    'ask_choice',
    'ask_batch',
    'ask_free_text',
    'QuestionType',
    'Urgency',
    'VOIComponents',
    'QuestionOption',
    'BatchQuestion',
    'HITLResponse',
]
