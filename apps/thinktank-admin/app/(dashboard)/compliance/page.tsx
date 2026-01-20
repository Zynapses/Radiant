'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, UserCheck, FileArchive } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ThinkTankCompliancePage() {
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
          <Card>
            <CardHeader>
              <CardTitle>Consent Management</CardTitle>
              <CardDescription>
                Manage user consent preferences and compliance settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Consent management component will be migrated here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gdpr">
          <Card>
            <CardHeader>
              <CardTitle>GDPR Requests</CardTitle>
              <CardDescription>
                Handle data subject requests and GDPR compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                GDPR management component will be migrated here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
