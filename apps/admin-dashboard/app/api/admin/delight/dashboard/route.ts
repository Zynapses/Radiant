import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    
    const response = await fetch(`${API_URL}/api/admin/delight/dashboard`, {
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-Admin': 'true',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Return mock data for development
      return NextResponse.json(getMockDashboard());
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Return mock data for development when backend is unavailable
    return NextResponse.json(getMockDashboard());
  }
}

function getMockDashboard() {
  return {
    categories: [
      { id: 'domain_loading', name: 'Domain Loading Messages', description: 'Messages shown while loading domain-specific content', icon: 'Loader', sortOrder: 1, isEnabled: true },
      { id: 'domain_transition', name: 'Domain Transitions', description: 'Messages when switching between different domains', icon: 'ArrowRightLeft', sortOrder: 2, isEnabled: true },
      { id: 'time_awareness', name: 'Time Awareness', description: 'Context-aware messages based on time of day/session', icon: 'Clock', sortOrder: 3, isEnabled: true },
      { id: 'model_dynamics', name: 'Model Dynamics', description: 'Messages about AI model collaboration and consensus', icon: 'Users', sortOrder: 4, isEnabled: true },
      { id: 'complexity_signals', name: 'Complexity Signals', description: 'Messages indicating query complexity and progress', icon: 'Brain', sortOrder: 5, isEnabled: true },
      { id: 'synthesis_quality', name: 'Synthesis Quality', description: 'Post-execution quality indicators', icon: 'Sparkles', sortOrder: 6, isEnabled: true },
      { id: 'achievements', name: 'Achievements', description: 'Milestone and progress celebrations', icon: 'Trophy', sortOrder: 7, isEnabled: true },
      { id: 'wellbeing', name: 'Wellbeing Nudges', description: 'Gentle reminders for breaks and self-care', icon: 'Heart', sortOrder: 8, isEnabled: true },
      { id: 'easter_eggs', name: 'Easter Eggs', description: 'Hidden surprises for explorers', icon: 'Egg', sortOrder: 9, isEnabled: true },
      { id: 'sounds', name: 'Sound Effects', description: 'Audio feedback for various events', icon: 'Volume2', sortOrder: 10, isEnabled: true },
    ],
    messages: [
      { id: 1, categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', messageText: 'Consulting the fundamental forces...', messageAltTexts: ['Collapsing the wave function...'], domainFamilies: ['physics'], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 2, categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', messageText: 'Compiling the solution...', messageAltTexts: ['Debugging the approach...'], domainFamilies: ['programming'], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 3, categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', messageText: 'Reviewing the differential...', messageAltTexts: ['Consulting the evidence...'], domainFamilies: ['medicine'], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 4, categoryId: 'domain_loading', injectionPoint: 'pre_execution', triggerType: 'domain_loading', messageText: 'Gathering the ingredients...', messageAltTexts: ['Preheating the knowledge base...'], domainFamilies: ['cooking'], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 5, categoryId: 'time_awareness', injectionPoint: 'pre_execution', triggerType: 'time_aware', messageText: 'Burning the midnight tokens.', messageAltTexts: [], domainFamilies: [], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 6, categoryId: 'time_awareness', injectionPoint: 'post_execution', triggerType: 'wellbeing', messageText: 'You\'ve been at this a while. Stretch break?', messageAltTexts: [], domainFamilies: [], displayStyle: 'moderate', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 7, categoryId: 'model_dynamics', injectionPoint: 'during_execution', triggerType: 'model_dynamics', messageText: 'Consensus forming...', messageAltTexts: ['The models agree on this one.'], domainFamilies: [], displayStyle: 'subtle', priority: 50, isEnabled: true, requiresOptIn: false },
      { id: 8, categoryId: 'model_dynamics', injectionPoint: 'during_execution', triggerType: 'model_dynamics', messageText: 'The models are debating this one.', messageAltTexts: [], domainFamilies: [], displayStyle: 'moderate', priority: 50, isEnabled: true, requiresOptIn: false },
    ],
    achievements: [
      { id: 'domain_explorer_10', name: 'Domain Explorer', description: 'Explored 10 different knowledge domains', icon: 'Compass', achievementType: 'domain_explorer', thresholdValue: 10, celebrationMessage: 'Curiosity knows no bounds!', rarity: 'common', points: 10, isHidden: false, isEnabled: true },
      { id: 'domain_explorer_50', name: 'Renaissance Mind', description: 'Explored 50 different knowledge domains', icon: 'Crown', achievementType: 'domain_explorer', thresholdValue: 50, celebrationMessage: 'True polymath territory!', rarity: 'rare', points: 50, isHidden: false, isEnabled: true },
      { id: 'streak_7', name: 'Week Warrior', description: 'Used Think Tank 7 days in a row', icon: 'Flame', achievementType: 'streak', thresholdValue: 7, celebrationMessage: 'Consistency wins!', rarity: 'common', points: 15, isHidden: false, isEnabled: true },
      { id: 'streak_30', name: 'Monthly Mind', description: 'Used Think Tank 30 days in a row', icon: 'Zap', achievementType: 'streak', thresholdValue: 30, celebrationMessage: 'A month of brilliance!', rarity: 'epic', points: 75, isHidden: false, isEnabled: true },
      { id: 'easter_egg_1', name: 'Curious One', description: 'Found your first easter egg', icon: 'Egg', achievementType: 'discovery', thresholdValue: 1, celebrationMessage: 'You found a secret!', rarity: 'uncommon', points: 20, isHidden: false, isEnabled: true },
      { id: 'queries_100', name: 'Century Club', description: 'Submitted 100 queries', icon: 'MessageSquare', achievementType: 'queries_count', thresholdValue: 100, celebrationMessage: 'The 100 club. Welcome.', rarity: 'common', points: 20, isHidden: false, isEnabled: true },
    ],
    easterEggs: [
      { id: 'konami', name: 'Konami Code', description: 'Classic gaming easter egg', triggerType: 'key_sequence', triggerValue: 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a', effectType: 'mode_change', activationMessage: '🎮 Cheat codes activated!', effectDurationSeconds: 60, isEnabled: true, discoveryCount: 42 },
      { id: 'chaos_mode', name: 'Chaos Mode', description: 'Let the models argue', triggerType: 'text_input', triggerValue: '/chaos', effectType: 'mode_change', activationMessage: '🌪️ Chaos Mode engaged!', effectDurationSeconds: 0, isEnabled: true, discoveryCount: 128 },
      { id: 'socratic', name: 'Socratic Mode', description: 'Answer questions with questions', triggerType: 'text_input', triggerValue: '/socratic', effectType: 'mode_change', activationMessage: '🏛️ Socratic Mode activated.', effectDurationSeconds: 0, isEnabled: true, discoveryCount: 89 },
      { id: 'pirate', name: 'Pirate Mode', description: 'Arrr, talk like a pirate', triggerType: 'text_input', triggerValue: '/pirate', effectType: 'mode_change', activationMessage: '🏴‍☠️ Ahoy!', effectDurationSeconds: 0, isEnabled: true, discoveryCount: 215 },
      { id: 'tesla_fart', name: 'Emission Mode', description: 'Sound effects for synthesis events', triggerType: 'text_input', triggerValue: '/emissions', effectType: 'sound_play', activationMessage: '💨 Emissions enabled!', effectDurationSeconds: 0, isEnabled: true, discoveryCount: 567 },
    ],
    sounds: [
      { id: 'confirm_subtle', name: 'Subtle Confirmation', soundCategory: 'confirmation', soundTheme: 'default', volumeDefault: 70, isEnabled: true },
      { id: 'confirm_chime', name: 'Chime Confirmation', soundCategory: 'confirmation', soundTheme: 'default', volumeDefault: 70, isEnabled: true },
      { id: 'achievement_fanfare', name: 'Achievement Fanfare', soundCategory: 'achievement', soundTheme: 'default', volumeDefault: 80, isEnabled: true },
      { id: 'mc_confirm', name: 'Mission Control Confirm', soundCategory: 'confirmation', soundTheme: 'mission_control', volumeDefault: 70, isEnabled: true },
      { id: 'mc_launch', name: 'Mission Control Launch', soundCategory: 'transition', soundTheme: 'mission_control', volumeDefault: 75, isEnabled: true },
      { id: 'emission_toot', name: 'Toot', soundCategory: 'confirmation', soundTheme: 'emissions', volumeDefault: 70, isEnabled: true },
      { id: 'emission_whoopee', name: 'Whoopee', soundCategory: 'achievement', soundTheme: 'emissions', volumeDefault: 75, isEnabled: true },
    ],
    analytics: {
      totalMessagesShown: 15420,
      achievementsUnlocked: 892,
      easterEggsDiscovered: 1041,
      engagementByMode: {
        professional: 245,
        subtle: 412,
        expressive: 687,
        playful: 156,
      },
    },
    summary: {
      totalMessages: 8,
      enabledMessages: 8,
      totalAchievements: 6,
      totalEasterEggs: 5,
      totalSounds: 7,
    },
  };
}
