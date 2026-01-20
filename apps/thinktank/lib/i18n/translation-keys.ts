/**
 * Think Tank Translation Keys
 * 
 * ALL UI text strings MUST be defined here and registered in the Radiant localization registry.
 * NO hardcoded strings allowed in components.
 * 
 * Key format: thinktank.{category}.{subcategory}.{key}
 */

export const T = {
  // ============================================
  // COMMON - Shared across all pages
  // ============================================
  common: {
    appName: 'thinktank.common.appName',
    tagline: 'thinktank.common.tagline',
    loading: 'thinktank.common.loading',
    error: 'thinktank.common.error',
    retry: 'thinktank.common.retry',
    cancel: 'thinktank.common.cancel',
    save: 'thinktank.common.save',
    delete: 'thinktank.common.delete',
    edit: 'thinktank.common.edit',
    create: 'thinktank.common.create',
    search: 'thinktank.common.search',
    filter: 'thinktank.common.filter',
    sort: 'thinktank.common.sort',
    close: 'thinktank.common.close',
    back: 'thinktank.common.back',
    next: 'thinktank.common.next',
    previous: 'thinktank.common.previous',
    confirm: 'thinktank.common.confirm',
    yes: 'thinktank.common.yes',
    no: 'thinktank.common.no',
    ok: 'thinktank.common.ok',
    done: 'thinktank.common.done',
    all: 'thinktank.common.all',
    none: 'thinktank.common.none',
    signIn: 'thinktank.common.signIn',
    signOut: 'thinktank.common.signOut',
    signUp: 'thinktank.common.signUp',
    learnMore: 'thinktank.common.learnMore',
    seeAll: 'thinktank.common.seeAll',
    viewMore: 'thinktank.common.viewMore',
    showLess: 'thinktank.common.showLess',
    copy: 'thinktank.common.copy',
    copied: 'thinktank.common.copied',
    download: 'thinktank.common.download',
    share: 'thinktank.common.share',
    refresh: 'thinktank.common.refresh',
    today: 'thinktank.common.today',
    yesterday: 'thinktank.common.yesterday',
    lastWeek: 'thinktank.common.lastWeek',
    older: 'thinktank.common.older',
  },

  // ============================================
  // CHAT - Main chat interface
  // ============================================
  chat: {
    newChat: 'thinktank.chat.newChat',
    messagePlaceholder: 'thinktank.chat.messagePlaceholder',
    send: 'thinktank.chat.send',
    stopGenerating: 'thinktank.chat.stopGenerating',
    regenerate: 'thinktank.chat.regenerate',
    copyMessage: 'thinktank.chat.copyMessage',
    rateGood: 'thinktank.chat.rateGood',
    rateBad: 'thinktank.chat.rateBad',
    welcomeTitle: 'thinktank.chat.welcomeTitle',
    welcomeMessage: 'thinktank.chat.welcomeMessage',
    thinking: 'thinktank.chat.thinking',
    typing: 'thinktank.chat.typing',
    noConversations: 'thinktank.chat.noConversations',
    deleteConversation: 'thinktank.chat.deleteConversation',
    deleteConversationConfirm: 'thinktank.chat.deleteConversationConfirm',
    renameConversation: 'thinktank.chat.renameConversation',
    exportConversation: 'thinktank.chat.exportConversation',
    attachFile: 'thinktank.chat.attachFile',
    voiceInput: 'thinktank.chat.voiceInput',
    modelInfo: 'thinktank.chat.modelInfo',
    tokensUsed: 'thinktank.chat.tokensUsed',
    latency: 'thinktank.chat.latency',
    cost: 'thinktank.chat.cost',
    recent: 'thinktank.chat.recent',
    favorites: 'thinktank.chat.favorites',
    placeholder: 'thinktank.chat.placeholder',
    keyboardHint: 'thinktank.chat.keyboardHint',
  },

  // ============================================
  // MODES - Auto/Advanced mode
  // ============================================
  modes: {
    autoMode: 'thinktank.modes.autoMode',
    autoModeDesc: 'thinktank.modes.autoModeDesc',
    advancedMode: 'thinktank.modes.advancedMode',
    advancedModeDesc: 'thinktank.modes.advancedModeDesc',
    toggleShortcut: 'thinktank.modes.toggleShortcut',
    selectModel: 'thinktank.modes.selectModel',
    letCatoDecide: 'thinktank.modes.letCatoDecide',
  },

  // ============================================
  // BRAIN PLAN - Execution plan display
  // ============================================
  brainPlan: {
    title: 'thinktank.brainPlan.title',
    mode: 'thinktank.brainPlan.mode',
    domain: 'thinktank.brainPlan.domain',
    model: 'thinktank.brainPlan.model',
    steps: 'thinktank.brainPlan.steps',
    estimatedTime: 'thinktank.brainPlan.estimatedTime',
    estimatedCost: 'thinktank.brainPlan.estimatedCost',
    executing: 'thinktank.brainPlan.executing',
    completed: 'thinktank.brainPlan.completed',
    failed: 'thinktank.brainPlan.failed',
    pending: 'thinktank.brainPlan.pending',
    showDetails: 'thinktank.brainPlan.showDetails',
    hideDetails: 'thinktank.brainPlan.hideDetails',
  },

  // ============================================
  // MODELS - Model selection
  // ============================================
  models: {
    selectModel: 'thinktank.models.selectModel',
    searchModels: 'thinktank.models.searchModels',
    allModels: 'thinktank.models.allModels',
    premium: 'thinktank.models.premium',
    new: 'thinktank.models.new',
    capabilities: 'thinktank.models.capabilities',
    contextLength: 'thinktank.models.contextLength',
    costPer1k: 'thinktank.models.costPer1k',
    avgLatency: 'thinktank.models.avgLatency',
    noModelsFound: 'thinktank.models.noModelsFound',
  },

  // ============================================
  // SIDEBAR - Navigation sidebar
  // ============================================
  sidebar: {
    conversations: 'thinktank.sidebar.conversations',
    searchConversations: 'thinktank.sidebar.searchConversations',
    history: 'thinktank.sidebar.history',
    favorites: 'thinktank.sidebar.favorites',
    settings: 'thinktank.sidebar.settings',
    help: 'thinktank.sidebar.help',
    profile: 'thinktank.sidebar.profile',
    freePlan: 'thinktank.sidebar.freePlan',
    proPlan: 'thinktank.sidebar.proPlan',
    upgrade: 'thinktank.sidebar.upgrade',
  },

  // ============================================
  // SETTINGS - Settings page
  // ============================================
  settings: {
    title: 'thinktank.settings.title',
    personality: 'thinktank.settings.personality',
    personalityDesc: 'thinktank.settings.personalityDesc',
    personalityAuto: 'thinktank.settings.personalityAuto',
    personalityProfessional: 'thinktank.settings.personalityProfessional',
    personalitySubtle: 'thinktank.settings.personalitySubtle',
    personalityExpressive: 'thinktank.settings.personalityExpressive',
    personalityPlayful: 'thinktank.settings.personalityPlayful',
    notifications: 'thinktank.settings.notifications',
    notificationsDesc: 'thinktank.settings.notificationsDesc',
    notifyAchievements: 'thinktank.settings.notifyAchievements',
    notifyUpdates: 'thinktank.settings.notifyUpdates',
    notifyTips: 'thinktank.settings.notifyTips',
    appearance: 'thinktank.settings.appearance',
    appearanceDesc: 'thinktank.settings.appearanceDesc',
    compactMode: 'thinktank.settings.compactMode',
    showTokens: 'thinktank.settings.showTokens',
    showCosts: 'thinktank.settings.showCosts',
    shortcuts: 'thinktank.settings.shortcuts',
    shortcutsDesc: 'thinktank.settings.shortcutsDesc',
    enableShortcuts: 'thinktank.settings.enableShortcuts',
    viewShortcuts: 'thinktank.settings.viewShortcuts',
    sounds: 'thinktank.settings.sounds',
    soundsDesc: 'thinktank.settings.soundsDesc',
    enableSounds: 'thinktank.settings.enableSounds',
    privacy: 'thinktank.settings.privacy',
    privacyDesc: 'thinktank.settings.privacyDesc',
    shareAnalytics: 'thinktank.settings.shareAnalytics',
    storeConversations: 'thinktank.settings.storeConversations',
    exportData: 'thinktank.settings.exportData',
    exportDataDesc: 'thinktank.settings.exportDataDesc',
    account: 'thinktank.settings.account',
    accountDesc: 'thinktank.settings.accountDesc',
    deleteAccount: 'thinktank.settings.deleteAccount',
    deleteAccountWarning: 'thinktank.settings.deleteAccountWarning',
    language: 'thinktank.settings.language',
    languageDesc: 'thinktank.settings.languageDesc',
    selectLanguage: 'thinktank.settings.selectLanguage',
  },

  // ============================================
  // RULES - My Rules page
  // ============================================
  rules: {
    title: 'thinktank.rules.title',
    subtitle: 'thinktank.rules.subtitle',
    myRules: 'thinktank.rules.myRules',
    presets: 'thinktank.rules.presets',
    addRule: 'thinktank.rules.addRule',
    addRuleTitle: 'thinktank.rules.addRuleTitle',
    ruleText: 'thinktank.rules.ruleText',
    ruleTextPlaceholder: 'thinktank.rules.ruleTextPlaceholder',
    ruleType: 'thinktank.rules.ruleType',
    typeRestriction: 'thinktank.rules.typeRestriction',
    typePreference: 'thinktank.rules.typePreference',
    typeFormat: 'thinktank.rules.typeFormat',
    typeSource: 'thinktank.rules.typeSource',
    typeTone: 'thinktank.rules.typeTone',
    typeTopic: 'thinktank.rules.typeTopic',
    typePrivacy: 'thinktank.rules.typePrivacy',
    priority: 'thinktank.rules.priority',
    timesApplied: 'thinktank.rules.timesApplied',
    noRules: 'thinktank.rules.noRules',
    noRulesDesc: 'thinktank.rules.noRulesDesc',
    deleteRule: 'thinktank.rules.deleteRule',
    deleteRuleConfirm: 'thinktank.rules.deleteRuleConfirm',
    addFromPreset: 'thinktank.rules.addFromPreset',
    presetAdded: 'thinktank.rules.presetAdded',
  },

  // ============================================
  // HISTORY - History page
  // ============================================
  history: {
    title: 'thinktank.history.title',
    searchHistory: 'thinktank.history.searchHistory',
    filters: 'thinktank.history.filters',
    timePeriod: 'thinktank.history.timePeriod',
    periodAll: 'thinktank.history.periodAll',
    periodToday: 'thinktank.history.periodToday',
    periodWeek: 'thinktank.history.periodWeek',
    periodMonth: 'thinktank.history.periodMonth',
    periodYear: 'thinktank.history.periodYear',
    sortBy: 'thinktank.history.sortBy',
    sortRecent: 'thinktank.history.sortRecent',
    sortOldest: 'thinktank.history.sortOldest',
    sortMessages: 'thinktank.history.sortMessages',
    sortFavorites: 'thinktank.history.sortFavorites',
    totalConversations: 'thinktank.history.totalConversations',
    totalMessages: 'thinktank.history.totalMessages',
    noHistory: 'thinktank.history.noHistory',
    noHistoryDesc: 'thinktank.history.noHistoryDesc',
    deleteSelected: 'thinktank.history.deleteSelected',
    deleteSelectedConfirm: 'thinktank.history.deleteSelectedConfirm',
    viewConversation: 'thinktank.history.viewConversation',
  },

  // ============================================
  // ARTIFACTS - Artifacts page
  // ============================================
  artifacts: {
    title: 'thinktank.artifacts.title',
    searchArtifacts: 'thinktank.artifacts.searchArtifacts',
    totalArtifacts: 'thinktank.artifacts.totalArtifacts',
    codeSnippets: 'thinktank.artifacts.codeSnippets',
    documents: 'thinktank.artifacts.documents',
    images: 'thinktank.artifacts.images',
    typeCode: 'thinktank.artifacts.typeCode',
    typeDocument: 'thinktank.artifacts.typeDocument',
    typeImage: 'thinktank.artifacts.typeImage',
    typeChart: 'thinktank.artifacts.typeChart',
    noArtifacts: 'thinktank.artifacts.noArtifacts',
    noArtifactsDesc: 'thinktank.artifacts.noArtifactsDesc',
    viewConversation: 'thinktank.artifacts.viewConversation',
  },

  // ============================================
  // PROFILE - Profile page
  // ============================================
  profile: {
    title: 'thinktank.profile.title',
    signInRequired: 'thinktank.profile.signInRequired',
    signInRequiredDesc: 'thinktank.profile.signInRequiredDesc',
    conversations: 'thinktank.profile.conversations',
    tokensUsed: 'thinktank.profile.tokensUsed',
    messages: 'thinktank.profile.messages',
    achievements: 'thinktank.profile.achievements',
    achievementsUnlocked: 'thinktank.profile.achievementsUnlocked',
    noAchievements: 'thinktank.profile.noAchievements',
    topDomains: 'thinktank.profile.topDomains',
    upgradeToPro: 'thinktank.profile.upgradeToPro',
    upgradeToProDesc: 'thinktank.profile.upgradeToProDesc',
  },

  // ============================================
  // ERRORS - Error messages
  // ============================================
  errors: {
    generic: 'thinktank.errors.generic',
    network: 'thinktank.errors.network',
    unauthorized: 'thinktank.errors.unauthorized',
    notFound: 'thinktank.errors.notFound',
    serverError: 'thinktank.errors.serverError',
    rateLimited: 'thinktank.errors.rateLimited',
    invalidInput: 'thinktank.errors.invalidInput',
    sessionExpired: 'thinktank.errors.sessionExpired',
    loadFailed: 'thinktank.errors.loadFailed',
    saveFailed: 'thinktank.errors.saveFailed',
    deleteFailed: 'thinktank.errors.deleteFailed',
    sendFailed: 'thinktank.errors.sendFailed',
    streamFailed: 'thinktank.errors.streamFailed',
    modelUnavailable: 'thinktank.errors.modelUnavailable',
    quotaExceeded: 'thinktank.errors.quotaExceeded',
  },

  // ============================================
  // NOTIFICATIONS - Toast messages
  // ============================================
  notifications: {
    settingsSaved: 'thinktank.notifications.settingsSaved',
    ruleSaved: 'thinktank.notifications.ruleSaved',
    ruleDeleted: 'thinktank.notifications.ruleDeleted',
    ruleToggled: 'thinktank.notifications.ruleToggled',
    conversationDeleted: 'thinktank.notifications.conversationDeleted',
    messageCopied: 'thinktank.notifications.messageCopied',
    exportStarted: 'thinktank.notifications.exportStarted',
    exportComplete: 'thinktank.notifications.exportComplete',
    languageChanged: 'thinktank.notifications.languageChanged',
    achievementUnlocked: 'thinktank.notifications.achievementUnlocked',
  },

  // ============================================
  // PLACEHOLDERS - Input placeholders
  // ============================================
  placeholders: {
    search: 'thinktank.placeholders.search',
    message: 'thinktank.placeholders.message',
    ruleText: 'thinktank.placeholders.ruleText',
    conversationTitle: 'thinktank.placeholders.conversationTitle',
  },

  // ============================================
  // TOOLTIPS - Hover tooltips
  // ============================================
  tooltips: {
    toggleAdvanced: 'thinktank.tooltips.toggleAdvanced',
    attachFile: 'thinktank.tooltips.attachFile',
    voiceInput: 'thinktank.tooltips.voiceInput',
    sendMessage: 'thinktank.tooltips.sendMessage',
    copyMessage: 'thinktank.tooltips.copyMessage',
    ratePositive: 'thinktank.tooltips.ratePositive',
    rateNegative: 'thinktank.tooltips.rateNegative',
    selectModel: 'thinktank.tooltips.selectModel',
    brainPlan: 'thinktank.tooltips.brainPlan',
  },

  // ============================================
  // ACCESSIBILITY - Screen reader labels
  // ============================================
  a11y: {
    mainNavigation: 'thinktank.a11y.mainNavigation',
    chatMessages: 'thinktank.a11y.chatMessages',
    messageInput: 'thinktank.a11y.messageInput',
    sidebar: 'thinktank.a11y.sidebar',
    closeSidebar: 'thinktank.a11y.closeSidebar',
    openSidebar: 'thinktank.a11y.openSidebar',
    loading: 'thinktank.a11y.loading',
    userMessage: 'thinktank.a11y.userMessage',
    assistantMessage: 'thinktank.a11y.assistantMessage',
  },
} as const;

/**
 * Type-safe translation key type
 */
export type TranslationKey = string;
