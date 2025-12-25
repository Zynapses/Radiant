#!/bin/bash

# Script to migrate dashboard pages to server/client component pattern
# This script creates client components and updates pages to be server components

DASHBOARD_DIR="apps/admin-dashboard/app/(dashboard)"

# Pages to migrate (excluding already migrated health page)
PAGES=(
  "administrators:Administrators:Manage admin users and invitations"
  "analytics:Analytics:View platform analytics and metrics"
  "audit-logs:Audit Logs:Track all administrative actions"
  "billing:Billing & Credits:Manage subscriptions and billing"
  "compliance:Compliance:Monitor compliance status"
  "configuration:Configuration:Manage system configuration"
  "cost:Cost Management:Track and optimize costs"
  "deployments:Deployments:Manage infrastructure deployments"
  "experiments:A/B Experiments:Manage feature experiments"
  "geographic:Geographic:View geographic distribution"
  "localization:Localization:Manage translations"
  "migrations:Migrations:Database migration management"
  "models:AI Models:Manage AI model configurations"
  "multi-region:Multi-Region:Manage multi-region deployment"
  "notifications:Notifications:Manage system notifications"
  "orchestration:Orchestration:AI orchestration settings"
  "providers:Providers:Manage AI providers"
  "security:Security:Security monitoring and settings"
  "services:Services:Manage platform services"
  "settings:Settings:Manage account preferences"
  "storage:Storage:Manage storage quotas"
  "time-machine:Time Machine:Version history and rollback"
)

for page_info in "${PAGES[@]}"; do
  IFS=':' read -r page title description <<< "$page_info"
  
  PAGE_DIR="$DASHBOARD_DIR/$page"
  PAGE_FILE="$PAGE_DIR/page.tsx"
  CLIENT_FILE="$PAGE_DIR/${page}-client.tsx"
  
  if [ ! -f "$PAGE_FILE" ]; then
    echo "Skipping $page - page.tsx not found"
    continue
  fi
  
  # Check if already migrated (no 'use client' in page.tsx)
  if ! grep -q "'use client'" "$PAGE_FILE"; then
    echo "Skipping $page - already migrated"
    continue
  fi
  
  echo "Migrating $page..."
  
  # Create client component by copying existing page
  cp "$PAGE_FILE" "$CLIENT_FILE"
  
  # Update client component: rename export
  sed -i '' "s/export default function.*Page/export function ${page^}Client/g" "$CLIENT_FILE"
  
  # Create new server component page
  cat > "$PAGE_FILE" << EOF
import type { Metadata } from 'next';
import { ${page^}Client } from './${page}-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: '${title}',
  description: '${description}',
};

export default function ${page^}Page() {
  return (
    <PageErrorBoundary>
      <${page^}Client />
    </PageErrorBoundary>
  );
}
EOF

  echo "  ✓ Created $CLIENT_FILE"
  echo "  ✓ Updated $PAGE_FILE"
done

echo "Migration complete!"
