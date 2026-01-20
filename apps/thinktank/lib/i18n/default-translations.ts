/**
 * Default English Translations for Think Tank
 * 
 * These translations are used as fallbacks when the API is unavailable
 * and as the source for registering new strings in the Radiant localization registry.
 * 
 * ALL UI text MUST be defined here - NO hardcoded strings in components.
 */

import { T } from './translation-keys';

export const DEFAULT_TRANSLATIONS: Record<string, string> = {
  // ============================================
  // COMMON
  // ============================================
  [T.common.appName]: 'Think Tank',
  [T.common.tagline]: 'AI-powered thinking companion',
  [T.common.loading]: 'Loading...',
  [T.common.error]: 'An error occurred',
  [T.common.retry]: 'Retry',
  [T.common.cancel]: 'Cancel',
  [T.common.save]: 'Save',
  [T.common.delete]: 'Delete',
  [T.common.edit]: 'Edit',
  [T.common.create]: 'Create',
  [T.common.search]: 'Search',
  [T.common.filter]: 'Filter',
  [T.common.sort]: 'Sort',
  [T.common.close]: 'Close',
  [T.common.back]: 'Back',
  [T.common.next]: 'Next',
  [T.common.previous]: 'Previous',
  [T.common.confirm]: 'Confirm',
  [T.common.yes]: 'Yes',
  [T.common.no]: 'No',
  [T.common.ok]: 'OK',
  [T.common.done]: 'Done',
  [T.common.all]: 'All',
  [T.common.none]: 'None',
  [T.common.signIn]: 'Sign In',
  [T.common.signOut]: 'Sign Out',
  [T.common.signUp]: 'Sign Up',
  [T.common.learnMore]: 'Learn More',
  [T.common.seeAll]: 'See All',
  [T.common.viewMore]: 'View More',
  [T.common.showLess]: 'Show Less',
  [T.common.copy]: 'Copy',
  [T.common.copied]: 'Copied!',
  [T.common.download]: 'Download',
  [T.common.share]: 'Share',
  [T.common.refresh]: 'Refresh',
  [T.common.today]: 'Today',
  [T.common.yesterday]: 'Yesterday',
  [T.common.lastWeek]: 'Last 7 Days',
  [T.common.older]: 'Older',

  // ============================================
  // CHAT
  // ============================================
  [T.chat.newChat]: 'New Chat',
  [T.chat.messagePlaceholder]: 'Message Cato...',
  [T.chat.send]: 'Send',
  [T.chat.stopGenerating]: 'Stop generating',
  [T.chat.regenerate]: 'Regenerate',
  [T.chat.copyMessage]: 'Copy message',
  [T.chat.rateGood]: 'Good response',
  [T.chat.rateBad]: 'Poor response',
  [T.chat.welcomeTitle]: 'Welcome to Think Tank',
  [T.chat.welcomeMessage]: "Hello! I'm Cato, your AI thinking companion. I can help you with research, writing, coding, analysis, brainstorming, and much more. What would you like to explore today?",
  [T.chat.thinking]: 'Thinking...',
  [T.chat.typing]: 'Cato is typing...',
  [T.chat.noConversations]: 'No conversations yet',
  [T.chat.deleteConversation]: 'Delete conversation',
  [T.chat.deleteConversationConfirm]: 'Are you sure you want to delete this conversation? This cannot be undone.',
  [T.chat.renameConversation]: 'Rename conversation',
  [T.chat.exportConversation]: 'Export conversation',
  [T.chat.attachFile]: 'Attach file',
  [T.chat.voiceInput]: 'Voice input',
  [T.chat.modelInfo]: 'Model info',
  [T.chat.tokensUsed]: 'Tokens used',
  [T.chat.latency]: 'Latency',
  [T.chat.cost]: 'Cost',
  [T.chat.recent]: 'Recent',
  [T.chat.favorites]: 'Favorites',
  [T.chat.placeholder]: 'What would you like to explore?',
  [T.chat.keyboardHint]: 'Press Enter to send, Shift+Enter for new line',

  // ============================================
  // MODES
  // ============================================
  [T.modes.autoMode]: 'Auto Mode',
  [T.modes.autoModeDesc]: 'Cato automatically selects the best model for each task',
  [T.modes.advancedMode]: 'Advanced Mode',
  [T.modes.advancedModeDesc]: 'Full control over model selection and execution plan visibility',
  [T.modes.toggleShortcut]: '⌘+Shift+A to toggle',
  [T.modes.selectModel]: 'Select model',
  [T.modes.letCatoDecide]: 'Let Cato decide',

  // ============================================
  // BRAIN PLAN
  // ============================================
  [T.brainPlan.title]: 'Execution Plan',
  [T.brainPlan.mode]: 'Mode',
  [T.brainPlan.domain]: 'Domain',
  [T.brainPlan.model]: 'Model',
  [T.brainPlan.steps]: 'Steps',
  [T.brainPlan.estimatedTime]: 'Est. time',
  [T.brainPlan.estimatedCost]: 'Est. cost',
  [T.brainPlan.executing]: 'Executing...',
  [T.brainPlan.completed]: 'Completed',
  [T.brainPlan.failed]: 'Failed',
  [T.brainPlan.pending]: 'Pending',
  [T.brainPlan.showDetails]: 'Show details',
  [T.brainPlan.hideDetails]: 'Hide details',

  // ============================================
  // MODELS
  // ============================================
  [T.models.selectModel]: 'Select Model',
  [T.models.searchModels]: 'Search models...',
  [T.models.allModels]: 'All Models',
  [T.models.premium]: 'Premium',
  [T.models.new]: 'New',
  [T.models.capabilities]: 'Capabilities',
  [T.models.contextLength]: 'Context length',
  [T.models.costPer1k]: 'Cost per 1K tokens',
  [T.models.avgLatency]: 'Avg. latency',
  [T.models.noModelsFound]: 'No models found',

  // ============================================
  // SIDEBAR
  // ============================================
  [T.sidebar.conversations]: 'Conversations',
  [T.sidebar.searchConversations]: 'Search conversations...',
  [T.sidebar.history]: 'History',
  [T.sidebar.favorites]: 'Favorites',
  [T.sidebar.settings]: 'Settings',
  [T.sidebar.help]: 'Help',
  [T.sidebar.profile]: 'Profile',
  [T.sidebar.freePlan]: 'Free Plan',
  [T.sidebar.proPlan]: 'Pro Plan',
  [T.sidebar.upgrade]: 'Upgrade',

  // ============================================
  // SETTINGS
  // ============================================
  [T.settings.title]: 'Settings',
  [T.settings.personality]: 'Personality',
  [T.settings.personalityDesc]: 'Choose how Cato expresses itself in conversations',
  [T.settings.personalityAuto]: 'Auto',
  [T.settings.personalityProfessional]: 'Professional',
  [T.settings.personalitySubtle]: 'Subtle',
  [T.settings.personalityExpressive]: 'Expressive',
  [T.settings.personalityPlayful]: 'Playful',
  [T.settings.notifications]: 'Notifications',
  [T.settings.notificationsDesc]: 'Manage your notification preferences',
  [T.settings.notifyAchievements]: 'Achievement notifications',
  [T.settings.notifyUpdates]: 'Update notifications',
  [T.settings.notifyTips]: 'Tips and suggestions',
  [T.settings.appearance]: 'Appearance',
  [T.settings.appearanceDesc]: 'Customize how Think Tank looks',
  [T.settings.compactMode]: 'Compact mode',
  [T.settings.showTokens]: 'Show token count',
  [T.settings.showCosts]: 'Show cost estimate',
  [T.settings.shortcuts]: 'Keyboard Shortcuts',
  [T.settings.shortcutsDesc]: 'Quick keys for power users',
  [T.settings.enableShortcuts]: 'Enable keyboard shortcuts',
  [T.settings.viewShortcuts]: 'View all shortcuts',
  [T.settings.sounds]: 'Sounds',
  [T.settings.soundsDesc]: 'Audio feedback for actions',
  [T.settings.enableSounds]: 'Enable sound effects',
  [T.settings.privacy]: 'Privacy',
  [T.settings.privacyDesc]: 'Control your data and privacy settings',
  [T.settings.shareAnalytics]: 'Share analytics',
  [T.settings.storeConversations]: 'Store conversations',
  [T.settings.exportData]: 'Export Data',
  [T.settings.exportDataDesc]: 'Download a copy of all your data',
  [T.settings.account]: 'Account',
  [T.settings.accountDesc]: 'Manage your account settings',
  [T.settings.deleteAccount]: 'Delete Account',
  [T.settings.deleteAccountWarning]: 'Permanently delete your account and all associated data. This cannot be undone.',
  [T.settings.language]: 'Language',
  [T.settings.languageDesc]: 'Choose your preferred language for the interface',
  [T.settings.selectLanguage]: 'Select your language',

  // ============================================
  // RULES
  // ============================================
  [T.rules.title]: 'My Rules',
  [T.rules.subtitle]: 'Customize how Cato responds to you',
  [T.rules.myRules]: 'My Rules',
  [T.rules.presets]: 'Presets',
  [T.rules.addRule]: 'Add Rule',
  [T.rules.addRuleTitle]: 'Create a new rule',
  [T.rules.ruleText]: 'Rule text',
  [T.rules.ruleTextPlaceholder]: 'e.g., Always respond in bullet points',
  [T.rules.ruleType]: 'Rule type',
  [T.rules.typeRestriction]: 'Restriction',
  [T.rules.typePreference]: 'Preference',
  [T.rules.typeFormat]: 'Format',
  [T.rules.typeSource]: 'Source',
  [T.rules.typeTone]: 'Tone',
  [T.rules.typeTopic]: 'Topic',
  [T.rules.typePrivacy]: 'Privacy',
  [T.rules.priority]: 'Priority',
  [T.rules.timesApplied]: 'Times applied',
  [T.rules.noRules]: 'No rules yet',
  [T.rules.noRulesDesc]: 'Create rules to customize how Cato responds to you',
  [T.rules.deleteRule]: 'Delete rule',
  [T.rules.deleteRuleConfirm]: 'Are you sure you want to delete this rule?',
  [T.rules.addFromPreset]: 'Add to my rules',
  [T.rules.presetAdded]: 'Rule added from preset',

  // ============================================
  // HISTORY
  // ============================================
  [T.history.title]: 'History',
  [T.history.searchHistory]: 'Search history...',
  [T.history.filters]: 'Filters',
  [T.history.timePeriod]: 'Time period',
  [T.history.periodAll]: 'All time',
  [T.history.periodToday]: 'Today',
  [T.history.periodWeek]: 'This week',
  [T.history.periodMonth]: 'This month',
  [T.history.periodYear]: 'This year',
  [T.history.sortBy]: 'Sort by',
  [T.history.sortRecent]: 'Most recent',
  [T.history.sortOldest]: 'Oldest first',
  [T.history.sortMessages]: 'Most messages',
  [T.history.sortFavorites]: 'Favorites first',
  [T.history.totalConversations]: 'Total conversations',
  [T.history.totalMessages]: 'Total messages',
  [T.history.noHistory]: 'No history yet',
  [T.history.noHistoryDesc]: 'Start a conversation to see it here',
  [T.history.deleteSelected]: 'Delete selected',
  [T.history.deleteSelectedConfirm]: 'Are you sure you want to delete {{count}} conversation(s)?',
  [T.history.viewConversation]: 'View conversation',

  // ============================================
  // ARTIFACTS
  // ============================================
  [T.artifacts.title]: 'Artifacts',
  [T.artifacts.searchArtifacts]: 'Search artifacts...',
  [T.artifacts.totalArtifacts]: 'Total artifacts',
  [T.artifacts.codeSnippets]: 'Code snippets',
  [T.artifacts.documents]: 'Documents',
  [T.artifacts.images]: 'Images',
  [T.artifacts.typeCode]: 'Code',
  [T.artifacts.typeDocument]: 'Document',
  [T.artifacts.typeImage]: 'Image',
  [T.artifacts.typeChart]: 'Chart',
  [T.artifacts.noArtifacts]: 'No artifacts yet',
  [T.artifacts.noArtifactsDesc]: 'Artifacts generated during conversations will appear here',
  [T.artifacts.viewConversation]: 'View conversation',

  // ============================================
  // PROFILE
  // ============================================
  [T.profile.title]: 'Profile',
  [T.profile.signInRequired]: 'Sign In Required',
  [T.profile.signInRequiredDesc]: 'Sign in to view your profile and statistics',
  [T.profile.conversations]: 'Conversations',
  [T.profile.tokensUsed]: 'Tokens Used',
  [T.profile.messages]: 'Messages',
  [T.profile.achievements]: 'Achievements',
  [T.profile.achievementsUnlocked]: '{{unlocked}} of {{total}} unlocked',
  [T.profile.noAchievements]: 'No achievements available',
  [T.profile.topDomains]: 'Your Top Domains',
  [T.profile.upgradeToPro]: 'Upgrade to Pro',
  [T.profile.upgradeToProDesc]: 'Get unlimited conversations, priority access to new models, and more',

  // ============================================
  // ERRORS
  // ============================================
  [T.errors.generic]: 'Something went wrong. Please try again.',
  [T.errors.network]: 'Network error. Please check your connection.',
  [T.errors.unauthorized]: 'You need to sign in to continue.',
  [T.errors.notFound]: 'The requested resource was not found.',
  [T.errors.serverError]: 'Server error. Please try again later.',
  [T.errors.rateLimited]: 'Too many requests. Please wait a moment.',
  [T.errors.invalidInput]: 'Invalid input. Please check your data.',
  [T.errors.sessionExpired]: 'Your session has expired. Please sign in again.',
  [T.errors.loadFailed]: 'Failed to load data.',
  [T.errors.saveFailed]: 'Failed to save changes.',
  [T.errors.deleteFailed]: 'Failed to delete.',
  [T.errors.sendFailed]: 'Failed to send message.',
  [T.errors.streamFailed]: 'Streaming connection failed.',
  [T.errors.modelUnavailable]: 'The selected model is currently unavailable.',
  [T.errors.quotaExceeded]: 'You have exceeded your usage quota.',

  // ============================================
  // NOTIFICATIONS
  // ============================================
  [T.notifications.settingsSaved]: 'Settings saved successfully',
  [T.notifications.ruleSaved]: 'Rule saved successfully',
  [T.notifications.ruleDeleted]: 'Rule deleted',
  [T.notifications.ruleToggled]: 'Rule {{status}}',
  [T.notifications.conversationDeleted]: 'Conversation deleted',
  [T.notifications.messageCopied]: 'Message copied to clipboard',
  [T.notifications.exportStarted]: 'Export started...',
  [T.notifications.exportComplete]: 'Export complete',
  [T.notifications.languageChanged]: 'Language changed to {{language}}',
  [T.notifications.achievementUnlocked]: 'Achievement unlocked: {{name}}',

  // ============================================
  // PLACEHOLDERS
  // ============================================
  [T.placeholders.search]: 'Search...',
  [T.placeholders.message]: 'Type a message...',
  [T.placeholders.ruleText]: 'Enter your rule...',
  [T.placeholders.conversationTitle]: 'Conversation title...',

  // ============================================
  // TOOLTIPS
  // ============================================
  [T.tooltips.toggleAdvanced]: 'Toggle Advanced Mode (⌘+Shift+A)',
  [T.tooltips.attachFile]: 'Attach a file',
  [T.tooltips.voiceInput]: 'Use voice input',
  [T.tooltips.sendMessage]: 'Send message (Enter)',
  [T.tooltips.copyMessage]: 'Copy message to clipboard',
  [T.tooltips.ratePositive]: 'This was helpful',
  [T.tooltips.rateNegative]: 'This could be better',
  [T.tooltips.selectModel]: 'Select a different model',
  [T.tooltips.brainPlan]: 'View execution plan',

  // ============================================
  // ACCESSIBILITY
  // ============================================
  [T.a11y.mainNavigation]: 'Main navigation',
  [T.a11y.chatMessages]: 'Chat messages',
  [T.a11y.messageInput]: 'Message input',
  [T.a11y.sidebar]: 'Sidebar',
  [T.a11y.closeSidebar]: 'Close sidebar',
  [T.a11y.openSidebar]: 'Open sidebar',
  [T.a11y.loading]: 'Loading content',
  [T.a11y.userMessage]: 'Your message',
  [T.a11y.assistantMessage]: 'Cato\'s response',
};
