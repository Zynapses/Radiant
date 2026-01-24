'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, User, Mail, Crown, Zap, 
  MessageSquare, TrendingUp, Award, Settings, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { EnhancedActivityHeatmap } from '@/components/ui/enhanced-activity-heatmap';
import { useAuth } from '@/lib/auth/context';
import { analyticsService } from '@/lib/api/analytics';
import { cn, formatTokens } from '@/lib/utils';
import { useTranslation, T } from '@/lib/i18n';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const { data: analytics } = useQuery({
    queryKey: ['user-analytics'],
    queryFn: () => analyticsService.getAnalytics('month'),
    enabled: isAuthenticated,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['user-achievements'],
    queryFn: () => analyticsService.getAchievements(),
    enabled: isAuthenticated,
  });

  const currentYear = new Date().getFullYear();
  const { data: activityData = [] } = useQuery({
    queryKey: ['user-activity-heatmap', currentYear],
    queryFn: () => analyticsService.getActivityHeatmap(currentYear),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900/50 border-slate-700/50 max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">{t(T.profile.signInRequired)}</h2>
            <p className="text-slate-400 mb-6">{t(T.profile.signInRequiredDesc)}</p>
            <Link href="/login">
              <Button className="bg-violet-600 hover:bg-violet-700">{t(T.common.signIn)}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unlockedAchievements = achievements.filter((a) => a.unlockedAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative">
      <AuroraBackground colors="violet" intensity="subtle" className="fixed inset-0 pointer-events-none" />
      <header className="sticky top-0 z-10 h-14 border-b border-white/10 flex items-center px-4 bg-slate-900/60 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">{t(T.common.back)}</span>
        </Link>
        <h1 className="flex-1 text-center font-semibold text-white">{t(T.profile.title)}</h1>
        <Link href="/settings">
          <Button variant="ghost" size="icon-sm" className="text-slate-400">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Profile Card */}
        <GlassCard variant="elevated" hoverEffect={false} padding="none" className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
          <CardContent className="pt-0 -mt-12">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-[#0a0a0f] shadow-xl">
                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 pb-2">
                <h2 className="text-2xl font-bold text-white">{user.name || 'User'}</h2>
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
              </div>
              <div className="pb-2">
                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                  <Crown className="h-3 w-3 mr-1" />
                  Free Plan
                </Badge>
              </div>
            </div>
          </CardContent>
        </GlassCard>

        {/* Usage Stats */}
        <div className="grid grid-cols-4 gap-4">
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <MessageSquare className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.totalConversations || 0}</p>
                  <p className="text-xs text-slate-400">{t(T.profile.conversations)}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{formatTokens(analytics?.totalTokens || 0)}</p>
                  <p className="text-xs text-slate-400">{t(T.profile.tokensUsed)}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics?.totalMessages || 0}</p>
                  <p className="text-xs text-slate-400">{t(T.profile.messages)}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Award className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{unlockedAchievements.length}</p>
                  <p className="text-xs text-slate-400">{t(T.profile.achievements)}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Activity Heatmap */}
        <GlassCard variant="default" hoverEffect={false} padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-violet-400" />
              Activity
            </CardTitle>
            <CardDescription>
              Your conversation activity over the past year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedActivityHeatmap 
              data={activityData} 
              year={currentYear}
              colorScheme="violet"
              enableBreathing={true}
              enableAIInsights={true}
              showStreaks={true}
            />
          </CardContent>
        </GlassCard>

        {/* Achievements */}
        <GlassCard variant="default" hoverEffect={false} padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Award className="h-5 w-5 text-amber-400" />
              Achievements
            </CardTitle>
            <CardDescription>
              {unlockedAchievements.length} of {achievements.length} unlocked
            </CardDescription>
          </CardHeader>
          <CardContent>
            {achievements.length === 0 ? (
              <p className="text-slate-400 text-center py-4">{t(T.profile.noAchievements)}</p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {achievements.slice(0, 8).map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-all',
                      achievement.unlockedAt
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-800/50 border-slate-700/50 opacity-50'
                    )}
                  >
                    <div className="text-2xl mb-1">{achievement.icon || '🏆'}</div>
                    <p className="text-xs font-medium text-white truncate">{achievement.name}</p>
                    <p className="text-xs text-slate-500">{achievement.points} pts</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </GlassCard>

        {/* Top Domains */}
        {analytics?.topDomains && analytics.topDomains.length > 0 && (
          <GlassCard variant="default" hoverEffect={false} padding="none">
            <CardHeader>
              <CardTitle className="text-white">{t(T.profile.topDomains)}</CardTitle>
              <CardDescription>{t(T.settings.personalityDesc)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topDomains.slice(0, 5).map((domain, i) => (
                  <div key={domain.domain} className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 w-6">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{domain.domain}</span>
                        <span className="text-xs text-slate-400">{domain.count} conversations</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                          style={{ width: `${(domain.count / analytics.topDomains[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlassCard>
        )}

        {/* Upgrade CTA */}
        <GlassCard variant="glow" glowColor="violet" hoverEffect={false} padding="none">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{t(T.profile.upgradeToPro)}</h3>
                <p className="text-sm text-slate-300">
                  {t(T.profile.upgradeToProDesc)}
                </p>
              </div>
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
}
