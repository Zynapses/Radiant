#!/usr/bin/env python3
"""
Migration Consolidation Script for RADIANT
Combines all incremental migrations into a single comprehensive schema.
"""

import os
import re
from pathlib import Path
from collections import OrderedDict

MIGRATIONS_DIR = Path(__file__).parent.parent.parent / "packages/infrastructure/migrations"
OUTPUT_FILE = MIGRATIONS_DIR / "000_consolidated_schema.sql"

def extract_enum_definitions(content: str) -> dict:
    """Extract all CREATE TYPE ... AS ENUM definitions."""
    enums = OrderedDict()
    # Match CREATE TYPE name AS ENUM (...)
    pattern = r"CREATE TYPE(?:\s+IF NOT EXISTS)?\s+(\w+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        name = match.group(1).lower()
        values = match.group(2).strip()
        enums[name] = f"CREATE TYPE IF NOT EXISTS {name} AS ENUM ({values});"
    return enums

def extract_table_definitions(content: str) -> dict:
    """Extract all CREATE TABLE definitions."""
    tables = OrderedDict()
    # Match CREATE TABLE name (...) with various endings
    pattern = r"(CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\([^;]+(?:;|\)\s*(?:PARTITION BY|INHERITS|WITH)[^;]*;))"
    for match in re.finditer(pattern, content, re.IGNORECASE | re.DOTALL):
        full_stmt = match.group(1)
        name = match.group(2).lower()
        # Skip partition tables (they're created by parent)
        if "PARTITION OF" in full_stmt.upper():
            continue
        # Normalize to IF NOT EXISTS
        if "IF NOT EXISTS" not in full_stmt.upper():
            full_stmt = full_stmt.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1)
        tables[name] = full_stmt
    return tables

def extract_indexes(content: str) -> list:
    """Extract all CREATE INDEX definitions."""
    indexes = []
    pattern = r"(CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?(?:\s+CONCURRENTLY)?\s+\w+\s+ON[^;]+;)"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        stmt = match.group(1)
        if "IF NOT EXISTS" not in stmt.upper():
            stmt = stmt.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS", 1)
            stmt = stmt.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS", 1)
        indexes.append(stmt)
    return indexes

def extract_rls_policies(content: str) -> list:
    """Extract all RLS policy definitions."""
    policies = []
    # Enable RLS
    pattern = r"(ALTER TABLE\s+\w+\s+ENABLE ROW LEVEL SECURITY;)"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        policies.append(match.group(1))
    # Create policies
    pattern = r"(CREATE POLICY(?:\s+IF NOT EXISTS)?\s+\w+\s+ON[^;]+;)"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        policies.append(match.group(1))
    return policies

def extract_functions(content: str) -> list:
    """Extract all CREATE FUNCTION definitions."""
    functions = []
    pattern = r"(CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+[\s\S]*?\$\$\s*LANGUAGE\s+\w+;)"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        functions.append(match.group(1))
    return functions

def extract_triggers(content: str) -> list:
    """Extract all CREATE TRIGGER definitions."""
    triggers = []
    pattern = r"(CREATE(?:\s+OR\s+REPLACE)?\s+TRIGGER\s+\w+[\s\S]*?;)"
    for match in re.finditer(pattern, content, re.IGNORECASE):
        triggers.append(match.group(1))
    return triggers

def main():
    print("RADIANT Migration Consolidation")
    print("=" * 50)
    
    # Read all migration files
    all_content = ""
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    migration_files = [f for f in migration_files if f.name != "000_consolidated_schema.sql"]
    
    print(f"Found {len(migration_files)} migration files")
    
    for f in migration_files:
        with open(f, 'r') as file:
            all_content += f"\n-- Source: {f.name}\n"
            all_content += file.read()
            all_content += "\n"
    
    # Extract components
    print("Extracting enums...")
    enums = extract_enum_definitions(all_content)
    print(f"  Found {len(enums)} unique enums")
    
    print("Extracting tables...")
    tables = extract_table_definitions(all_content)
    print(f"  Found {len(tables)} unique tables")
    
    print("Extracting indexes...")
    indexes = extract_indexes(all_content)
    print(f"  Found {len(indexes)} indexes")
    
    print("Extracting RLS policies...")
    policies = extract_rls_policies(all_content)
    print(f"  Found {len(policies)} RLS policies")
    
    print("Extracting functions...")
    functions = extract_functions(all_content)
    print(f"  Found {len(functions)} functions")
    
    print("Extracting triggers...")
    triggers = extract_triggers(all_content)
    print(f"  Found {len(triggers)} triggers")
    
    # Generate consolidated schema
    print("\nGenerating consolidated schema...")
    
    with open(OUTPUT_FILE, 'w') as f:
        f.write("""-- ============================================================================
-- RADIANT v6.6.0 - Consolidated Database Schema
-- ============================================================================
-- Generated: Consolidation of 260 migration files
-- This is the complete database schema for fresh deployments.
-- For existing deployments, use individual migration files.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- SECTION 1: ENUM TYPES
-- ============================================================================

""")
        for name, definition in sorted(enums.items()):
            f.write(f"-- Enum: {name}\n")
            f.write(definition)
            f.write("\n\n")
        
        f.write("""
-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

""")
        for name, definition in sorted(tables.items()):
            f.write(f"-- Table: {name}\n")
            f.write(definition)
            f.write("\n\n")
        
        f.write("""
-- ============================================================================
-- SECTION 3: INDEXES
-- ============================================================================

""")
        seen_indexes = set()
        for idx in indexes:
            # Dedupe indexes by name
            idx_name_match = re.search(r"INDEX\s+(?:IF NOT EXISTS\s+)?(?:CONCURRENTLY\s+)?(\w+)", idx, re.IGNORECASE)
            if idx_name_match:
                idx_name = idx_name_match.group(1).lower()
                if idx_name not in seen_indexes:
                    seen_indexes.add(idx_name)
                    f.write(idx)
                    f.write("\n")
        
        f.write("""
-- ============================================================================
-- SECTION 4: FUNCTIONS
-- ============================================================================

""")
        seen_functions = set()
        for func in functions:
            func_name_match = re.search(r"FUNCTION\s+(\w+)", func, re.IGNORECASE)
            if func_name_match:
                func_name = func_name_match.group(1).lower()
                if func_name not in seen_functions:
                    seen_functions.add(func_name)
                    f.write(func)
                    f.write("\n\n")
        
        f.write("""
-- ============================================================================
-- SECTION 5: TRIGGERS
-- ============================================================================

""")
        seen_triggers = set()
        for trigger in triggers:
            trigger_name_match = re.search(r"TRIGGER\s+(\w+)", trigger, re.IGNORECASE)
            if trigger_name_match:
                trigger_name = trigger_name_match.group(1).lower()
                if trigger_name not in seen_triggers:
                    seen_triggers.add(trigger_name)
                    f.write(trigger)
                    f.write("\n")
        
        f.write("""
-- ============================================================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================================================

""")
        seen_policies = set()
        for policy in policies:
            policy_hash = hash(policy.lower().replace(" ", ""))
            if policy_hash not in seen_policies:
                seen_policies.add(policy_hash)
                f.write(policy)
                f.write("\n")
        
        f.write("""
-- ============================================================================
-- END OF CONSOLIDATED SCHEMA
-- ============================================================================
""")
    
    # Get file size
    size = os.path.getsize(OUTPUT_FILE)
    print(f"\nConsolidated schema written to: {OUTPUT_FILE}")
    print(f"File size: {size / 1024:.1f} KB")
    print(f"\nSummary:")
    print(f"  - {len(enums)} enums")
    print(f"  - {len(tables)} tables")
    print(f"  - {len(seen_indexes)} indexes")
    print(f"  - {len(seen_functions)} functions")
    print(f"  - {len(seen_triggers)} triggers")
    print(f"  - {len(seen_policies)} RLS policies")

if __name__ == "__main__":
    main()
