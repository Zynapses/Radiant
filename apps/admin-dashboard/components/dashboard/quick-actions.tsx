'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Cpu, 
  RefreshCw,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/administrators/invitations">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Administrator
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/models">
            <Cpu className="h-4 w-4 mr-2" />
            Manage Models
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Providers
        </Button>
      </CardContent>
    </Card>
  );
}
