"""
Database Utilities for Flyte Tasks

RADIANT v5.0.2 - System Evolution

Provides RLS-safe database connections with automatic pgvector registration.
All Flyte tasks should use get_safe_db_connection() for database access.

Usage:
    from radiant.flyte.utils.db import get_safe_db_connection
    
    with get_safe_db_connection(tenant_id) as (conn, cur):
        cur.execute("SELECT * FROM my_table")
        rows = cur.fetchall()
    # Connection automatically committed and closed
"""

import os
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from typing import Tuple, Generator, Optional

# Attempt to import pgvector - graceful fallback if not installed
try:
    from pgvector.psycopg2 import register_vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    print("Warning: pgvector not installed. Vector operations will fail.")

# Connection pool (lazy initialized)
_connection_pool: Optional[pool.ThreadedConnectionPool] = None

# System tenant ID for maintenance operations
SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000'


def _get_pool() -> pool.ThreadedConnectionPool:
    """Get or create the connection pool"""
    global _connection_pool
    
    if _connection_pool is None:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=os.environ.get("DB_HOST", "localhost"),
            database=os.environ.get("DB_NAME", "radiant"),
            user=os.environ.get("DB_USER", "radiant"),
            password=os.environ.get("DB_PASSWORD", ""),
            port=int(os.environ.get("DB_PORT", "5432")),
            connect_timeout=10,
            options="-c statement_timeout=30000"
        )
    
    return _connection_pool


def _register_vector_if_available(conn) -> None:
    """Register pgvector types if available"""
    if HAS_PGVECTOR:
        register_vector(conn)


@contextmanager
def get_safe_db_connection(tenant_id: str) -> Generator[Tuple, None, None]:
    """
    Context manager that provides an RLS-safe database connection.
    
    Features:
    - Automatic pgvector registration
    - RLS tenant context enforcement
    - Transaction management (commit on success, rollback on error)
    - Connection pooling
    - Automatic cleanup
    
    Args:
        tenant_id: UUID of the tenant. Use '00000000-0000-0000-0000-000000000000'
                   for system maintenance operations.
    
    Yields:
        Tuple of (connection, cursor)
        
    Example:
        with get_safe_db_connection('tenant-uuid') as (conn, cur):
            cur.execute("SELECT * FROM knowledge_heuristics WHERE domain = %s", ('medical',))
            rows = cur.fetchall()
        # Automatically committed and connection returned to pool
    """
    db_pool = _get_pool()
    conn = db_pool.getconn()
    
    try:
        # 1. Register pgvector types (must be done per connection)
        _register_vector_if_available(conn)
        
        # 2. Create cursor
        cur = conn.cursor()
        
        # 3. Set RLS context - CRITICAL for multi-tenant security
        cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
        
        # 4. Yield connection and cursor to caller
        yield conn, cur
        
        # 5. Commit transaction on successful completion
        conn.commit()
        
    except Exception as e:
        # Rollback on any error
        conn.rollback()
        raise e
        
    finally:
        # Always return connection to pool
        db_pool.putconn(conn)


@contextmanager  
def get_system_db_connection() -> Generator[Tuple, None, None]:
    """
    Context manager for system-level operations (no RLS).
    
    WARNING: Use only for maintenance tasks that need cross-tenant access.
    The calling Lambda must have appropriate IAM permissions.
    
    Yields:
        Tuple of (connection, cursor)
    """
    db_pool = _get_pool()
    conn = db_pool.getconn()
    
    try:
        _register_vector_if_available(conn)
        cur = conn.cursor()
        
        # Set system tenant ID (has special RLS policy for maintenance)
        cur.execute("SET app.current_tenant_id = %s", (SYSTEM_TENANT_ID,))
        
        yield conn, cur
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise e
        
    finally:
        db_pool.putconn(conn)


@contextmanager
def get_readonly_connection(tenant_id: str) -> Generator[Tuple, None, None]:
    """
    Context manager for read-only operations.
    Sets transaction to read-only mode for safety.
    
    Args:
        tenant_id: UUID of the tenant
        
    Yields:
        Tuple of (connection, cursor)
    """
    db_pool = _get_pool()
    conn = db_pool.getconn()
    
    try:
        _register_vector_if_available(conn)
        cur = conn.cursor()
        
        # Set read-only transaction
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
        
        yield conn, cur
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise e
        
    finally:
        db_pool.putconn(conn)


def close_pool() -> None:
    """Close the connection pool. Call during Lambda shutdown."""
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None


def health_check() -> bool:
    """
    Verify database connectivity.
    
    Returns:
        True if database is accessible, False otherwise
    """
    try:
        db_pool = _get_pool()
        conn = db_pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            result = cur.fetchone()
            return result[0] == 1
        finally:
            db_pool.putconn(conn)
    except Exception as e:
        print(f"Database health check failed: {e}")
        return False
