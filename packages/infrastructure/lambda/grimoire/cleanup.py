"""
Grimoire Cleanup Lambda Handler

RADIANT v5.0.2 - System Evolution

Scheduled Lambda that runs daily to clean up expired and low-confidence heuristics.
"""

import json
import os
import boto3
from datetime import datetime

# Import from Flyte utils (will be available in Lambda layer)
import sys
sys.path.insert(0, '/opt/python')

import psycopg2
from psycopg2 import pool

# Configuration
SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000'
CLEANUP_BATCH_SIZE = int(os.environ.get('CLEANUP_BATCH_SIZE', '1000'))
MIN_CONFIDENCE_THRESHOLD = 0.3
STALE_DAYS = 30


def get_db_connection():
    """Get database connection from secrets manager."""
    secret_arn = os.environ.get('DB_SECRET_ARN')
    
    if not secret_arn:
        raise ValueError("DB_SECRET_ARN environment variable not set")
    
    # Get secret from Secrets Manager
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_arn)
    secret = json.loads(response['SecretString'])
    
    conn = psycopg2.connect(
        host=secret['host'],
        database=secret['dbname'],
        user=secret['username'],
        password=secret['password'],
        port=secret.get('port', 5432),
        connect_timeout=10,
        options="-c statement_timeout=300000"  # 5 min timeout
    )
    
    return conn


def handler(event, context):
    """
    Lambda handler for Grimoire cleanup.
    
    Performs:
    1. Delete expired heuristics (past expires_at)
    2. Delete low-confidence heuristics older than 30 days
    3. Log cleanup statistics
    """
    print(f"Grimoire Cleanup starting at {datetime.utcnow().isoformat()}")
    
    results = {
        "expired_deleted": 0,
        "low_confidence_deleted": 0,
        "total_deleted": 0,
        "errors": []
    }
    
    conn = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Set system tenant context for cross-tenant access
        cur.execute("SET app.current_tenant_id = %s", (SYSTEM_TENANT_ID,))
        
        # 1. Delete expired heuristics
        cur.execute("""
            DELETE FROM knowledge_heuristics 
            WHERE expires_at < NOW()
            RETURNING id, tenant_id, domain
        """)
        expired_rows = cur.fetchall()
        results["expired_deleted"] = len(expired_rows)
        
        # Log by tenant for monitoring
        expired_by_tenant = {}
        for row in expired_rows:
            tenant_id = str(row[1])
            expired_by_tenant[tenant_id] = expired_by_tenant.get(tenant_id, 0) + 1
        
        print(f"Expired heuristics deleted by tenant: {expired_by_tenant}")
        
        # 2. Delete low-confidence stale heuristics
        cur.execute("""
            DELETE FROM knowledge_heuristics 
            WHERE confidence_score < %s
              AND created_at < NOW() - INTERVAL '%s days'
            RETURNING id, tenant_id, domain, confidence_score
        """, (MIN_CONFIDENCE_THRESHOLD, STALE_DAYS))
        stale_rows = cur.fetchall()
        results["low_confidence_deleted"] = len(stale_rows)
        
        # Log stale deletions
        stale_by_tenant = {}
        for row in stale_rows:
            tenant_id = str(row[1])
            stale_by_tenant[tenant_id] = stale_by_tenant.get(tenant_id, 0) + 1
        
        print(f"Low-confidence heuristics deleted by tenant: {stale_by_tenant}")
        
        # 3. Commit changes
        conn.commit()
        
        results["total_deleted"] = results["expired_deleted"] + results["low_confidence_deleted"]
        
        # 4. Log audit entry
        cur.execute("""
            INSERT INTO audit_logs (
                tenant_id, 
                action, 
                resource_type, 
                resource_id, 
                details, 
                created_at
            ) VALUES (
                %s, 
                'CLEANUP', 
                'grimoire', 
                'system', 
                %s, 
                NOW()
            )
        """, (
            SYSTEM_TENANT_ID,
            json.dumps({
                "expired_deleted": results["expired_deleted"],
                "low_confidence_deleted": results["low_confidence_deleted"],
                "total_deleted": results["total_deleted"],
                "expired_by_tenant": expired_by_tenant,
                "stale_by_tenant": stale_by_tenant
            })
        ))
        conn.commit()
        
        print(f"Grimoire Cleanup completed: {results}")
        
    except Exception as e:
        error_msg = f"Grimoire Cleanup error: {str(e)}"
        print(error_msg)
        results["errors"].append(error_msg)
        
        if conn:
            conn.rollback()
    
    finally:
        if conn:
            conn.close()
    
    return {
        "statusCode": 200 if not results["errors"] else 500,
        "body": json.dumps(results)
    }
