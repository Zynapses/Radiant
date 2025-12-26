'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageErrorBoundary } from '@/components/common/error-boundaries';
import { ThinkTankConsentManager } from '@/components/thinktank/thinktank-consent-manager';
import { ThinkTankGDPRManager } from '@/components/thinktank/thinktank-gdpr-manager';
import { Shield, UserCheck, FileArchive, Scale } from 'lucide-react';

function ThinkTankComplianceContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6" />
          Think Tank Compliance
        </h1>
        <p className="text-muted-foreground">
          GDPR, SOC2, and regulatory compliance management for Think Tank
        </p>
      </div>

      {/* Compliance Tabs */}
      <Tabs defaultValue="consent" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="consent" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Consent Management
          </TabsTrigger>
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <FileArchive className="h-4 w-4" />
            GDPR Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consent">
          <ThinkTankConsentManager />
        </TabsContent>

        <TabsContent value="gdpr">
          <ThinkTankGDPRManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ThinkTankCompliancePage() {
  return (
    <PageErrorBoundary>
      <ThinkTankComplianceContent />
    </PageErrorBoundary>
  );
}
