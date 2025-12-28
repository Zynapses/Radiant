import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    
    const response = await fetch(`${API_URL}/api/admin/delight/statistics`, {
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-Admin': 'true',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(getMockStatistics());
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(getMockStatistics());
  }
}

function getMockStatistics() {
  const today = new Date();
  const dailyStats = [];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      messagesShown: Math.floor(Math.random() * 500) + 100,
      achievementsUnlocked: Math.floor(Math.random() * 20),
      easterEggsDiscovered: Math.floor(Math.random() * 10),
      soundsPlayed: Math.floor(Math.random() * 200),
      activeUsers: Math.floor(Math.random() * 50) + 10,
      messagesByCategory: {
        domain_loading: Math.floor(Math.random() * 100),
        time_awareness: Math.floor(Math.random() * 80),
        model_dynamics: Math.floor(Math.random() * 60),
        complexity_signals: Math.floor(Math.random() * 40),
        wellbeing: Math.floor(Math.random() * 20),
      },
      messagesByInjectionPoint: {
        pre_execution: Math.floor(Math.random() * 150),
        during_execution: Math.floor(Math.random() * 100),
        post_execution: Math.floor(Math.random() * 50),
      },
      usersByPersonalityMode: {
        professional: Math.floor(Math.random() * 20),
        subtle: Math.floor(Math.random() * 30),
        expressive: Math.floor(Math.random() * 40),
        playful: Math.floor(Math.random() * 10),
      },
    });
  }

  const weeklyTrends = [];
  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    weeklyTrends.push({
      weekStart: weekStart.toISOString(),
      messagesShown: Math.floor(Math.random() * 3000) + 500,
      achievementsUnlocked: Math.floor(Math.random() * 100) + 10,
      easterEggsDiscovered: Math.floor(Math.random() * 50),
      activeUsers: Math.floor(Math.random() * 200) + 50,
    });
  }

  return {
    overview: {
      totalMessagesShown: 45230,
      totalAchievementsUnlocked: 1892,
      totalEasterEggsDiscovered: 567,
      totalSoundsPlayed: 12450,
      totalActiveUsers: 342,
      firstActivityDate: '2024-11-01',
      lastActivityDate: today.toISOString().split('T')[0],
      daysWithActivity: 57,
    },
    dailyStats,
    topMessages: [
      { messageId: 1, messageText: 'Consulting the fundamental forces...', categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', displayStyle: 'subtle', totalShown: 2340, totalUniqueUsers: 189, shownToday: 45, shownThisWeek: 312, shownThisMonth: 1204, firstShownAt: '2024-11-05T10:23:00Z', lastShownAt: today.toISOString() },
      { messageId: 2, messageText: 'Compiling the solution...', categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', displayStyle: 'subtle', totalShown: 2105, totalUniqueUsers: 167, shownToday: 38, shownThisWeek: 280, shownThisMonth: 1089, firstShownAt: '2024-11-05T11:45:00Z', lastShownAt: today.toISOString() },
      { messageId: 3, messageText: 'Burning the midnight tokens.', categoryId: 'time_awareness', injectionPoint: 'pre_execution', triggerType: 'time_aware', displayStyle: 'subtle', totalShown: 1890, totalUniqueUsers: 145, shownToday: 0, shownThisWeek: 156, shownThisMonth: 678, firstShownAt: '2024-11-06T23:15:00Z', lastShownAt: today.toISOString() },
      { messageId: 4, messageText: 'Consensus forming...', categoryId: 'model_dynamics', injectionPoint: 'during_execution', triggerType: 'model_dynamics', displayStyle: 'subtle', totalShown: 1756, totalUniqueUsers: 134, shownToday: 32, shownThisWeek: 245, shownThisMonth: 892, firstShownAt: '2024-11-07T09:30:00Z', lastShownAt: today.toISOString() },
      { messageId: 5, messageText: 'You\'ve been thinking hard. Time for a break?', categoryId: 'wellbeing', injectionPoint: 'post_execution', triggerType: 'wellbeing', displayStyle: 'moderate', totalShown: 1234, totalUniqueUsers: 112, shownToday: 18, shownThisWeek: 167, shownThisMonth: 534, firstShownAt: '2024-11-08T14:00:00Z', lastShownAt: today.toISOString() },
    ],
    achievementStats: [
      { achievementId: 'queries_100', name: 'Century Club', description: 'Submitted 100 queries', achievementType: 'queries_count', rarity: 'common', points: 20, totalUnlocked: 456, totalInProgress: 234, unlockedToday: 5, unlockedThisWeek: 34, unlockedThisMonth: 123, averageDaysToUnlock: 12.5, firstUnlockedAt: '2024-11-10T08:00:00Z', lastUnlockedAt: today.toISOString() },
      { achievementId: 'domain_explorer_10', name: 'Domain Explorer', description: 'Explored 10 different knowledge domains', achievementType: 'domain_explorer', rarity: 'common', points: 10, totalUnlocked: 389, totalInProgress: 178, unlockedToday: 4, unlockedThisWeek: 28, unlockedThisMonth: 98, averageDaysToUnlock: 8.2, firstUnlockedAt: '2024-11-08T10:30:00Z', lastUnlockedAt: today.toISOString() },
      { achievementId: 'streak_7', name: 'Week Warrior', description: 'Used Think Tank 7 days in a row', achievementType: 'streak', rarity: 'common', points: 15, totalUnlocked: 234, totalInProgress: 156, unlockedToday: 3, unlockedThisWeek: 21, unlockedThisMonth: 67, averageDaysToUnlock: 14.0, firstUnlockedAt: '2024-11-12T12:00:00Z', lastUnlockedAt: today.toISOString() },
      { achievementId: 'domain_explorer_50', name: 'Renaissance Mind', description: 'Explored 50 different knowledge domains', achievementType: 'domain_explorer', rarity: 'rare', points: 50, totalUnlocked: 78, totalInProgress: 234, unlockedToday: 1, unlockedThisWeek: 8, unlockedThisMonth: 23, averageDaysToUnlock: 45.3, firstUnlockedAt: '2024-11-20T15:45:00Z', lastUnlockedAt: today.toISOString() },
      { achievementId: 'streak_30', name: 'Monthly Mind', description: 'Used Think Tank 30 days in a row', achievementType: 'streak', rarity: 'epic', points: 75, totalUnlocked: 23, totalInProgress: 89, unlockedToday: 0, unlockedThisWeek: 2, unlockedThisMonth: 8, averageDaysToUnlock: 35.0, firstUnlockedAt: '2024-12-01T09:00:00Z', lastUnlockedAt: today.toISOString() },
    ],
    easterEggStats: [
      { easterEggId: 'emission_toot', name: 'Emission Mode', description: 'Tesla-style sound effects', triggerType: 'text_input', effectType: 'sound_play', totalDiscoveries: 234, totalActivations: 1567, discoveredToday: 3, discoveredThisWeek: 23, discoveredThisMonth: 78, firstDiscoveredAt: '2024-11-10T22:00:00Z', lastDiscoveredAt: today.toISOString() },
      { easterEggId: 'chaos_mode', name: 'Chaos Mode', description: 'Let the models argue', triggerType: 'text_input', effectType: 'mode_change', totalDiscoveries: 189, totalActivations: 456, discoveredToday: 2, discoveredThisWeek: 18, discoveredThisMonth: 56, firstDiscoveredAt: '2024-11-12T14:30:00Z', lastDiscoveredAt: today.toISOString() },
      { easterEggId: 'pirate', name: 'Pirate Mode', description: 'Arrr, talk like a pirate', triggerType: 'text_input', effectType: 'mode_change', totalDiscoveries: 156, totalActivations: 345, discoveredToday: 1, discoveredThisWeek: 12, discoveredThisMonth: 45, firstDiscoveredAt: '2024-11-15T16:00:00Z', lastDiscoveredAt: today.toISOString() },
      { easterEggId: 'konami', name: 'Konami Code', description: 'Classic gaming easter egg', triggerType: 'key_sequence', effectType: 'mode_change', totalDiscoveries: 89, totalActivations: 234, discoveredToday: 1, discoveredThisWeek: 8, discoveredThisMonth: 28, firstDiscoveredAt: '2024-11-18T20:00:00Z', lastDiscoveredAt: today.toISOString() },
      { easterEggId: 'socratic', name: 'Socratic Mode', description: 'Answer questions with questions', triggerType: 'text_input', effectType: 'mode_change', totalDiscoveries: 67, totalActivations: 189, discoveredToday: 0, discoveredThisWeek: 5, discoveredThisMonth: 19, firstDiscoveredAt: '2024-11-20T11:00:00Z', lastDiscoveredAt: today.toISOString() },
    ],
    weeklyTrends,
  };
}
