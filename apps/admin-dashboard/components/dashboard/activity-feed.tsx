'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import { 
  UserPlus, 
  Settings, 
  AlertTriangle, 
  CheckCircle,
  Clock,
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'user_created' | 'settings_changed' | 'alert' | 'approval';
  message: string;
  timestamp: string;
}

const activities: Activity[] = [
  {
    id: '1',
    type: 'user_created',
    message: 'New administrator invited: john@example.com',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'settings_changed',
    message: 'API rate limits updated for OpenAI provider',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'approval',
    message: 'Pending approval: Delete tenant request',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'alert',
    message: 'Anthropic provider experiencing degraded performance',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
];

const iconMap = {
  user_created: UserPlus,
  settings_changed: Settings,
  alert: AlertTriangle,
  approval: CheckCircle,
};

const colorMap = {
  user_created: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  settings_changed: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  alert: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
  approval: 'text-green-500 bg-green-100 dark:bg-green-900/30',
};

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = iconMap[activity.type];
            const colorClass = colorMap[activity.type];

            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
