'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, User, Bell, Sparkles, Shield, Keyboard, 
  Volume2, Eye, Download, Trash2, Check, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { GlassCard, GlassPanel } from '@/components/ui/glass-card';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useSettingsStore, type PersonalityMode } from '@/lib/stores/settings-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTranslation, T } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PERSONALITY_MODES: Array<{
  id: PersonalityMode;
  name: string;
  icon: string;
  description: string;
}> = [
  { id: 'auto', name: 'Auto', icon: '✨', description: 'Cato adapts based on context and your preferences' },
  { id: 'professional', name: 'Professional', icon: '💼', description: 'Clean, concise, business-focused responses' },
  { id: 'subtle', name: 'Subtle', icon: '🌿', description: 'Light personality touches, mostly informative' },
  { id: 'expressive', name: 'Expressive', icon: '🎯', description: 'Engaging personality with helpful guidance' },
  { id: 'playful', name: 'Playful', icon: '🎮', description: 'Fun, witty interactions with creative flair' },
];

export default function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const { soundEnabled, setSoundEnabled } = useUIStore();
  const [activeSection, setActiveSection] = useState('personality');

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      {/* Aurora Background */}
      <AuroraBackground colors="mixed" intensity="subtle" className="fixed inset-0 pointer-events-none" />
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-slate-800/50 flex items-center px-4 bg-[#0d0d14]/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back to Chat</span>
        </Link>
        <h1 className="flex-1 text-center font-semibold text-white">Settings</h1>
        <div className="w-24" />
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <GlassPanel blur="md" className="col-span-3 p-3 h-fit sticky top-20">
            <nav className="space-y-1">
            {[
              { id: 'personality', icon: Sparkles, label: t(T.settings.personality) },
              { id: 'language', icon: Globe, label: t(T.settings.language) },
              { id: 'notifications', icon: Bell, label: t(T.settings.notifications) },
              { id: 'appearance', icon: Eye, label: t(T.settings.appearance) },
              { id: 'shortcuts', icon: Keyboard, label: t(T.settings.shortcuts) },
              { id: 'sounds', icon: Volume2, label: t(T.settings.sounds) },
              { id: 'privacy', icon: Shield, label: t(T.settings.privacy) },
              { id: 'account', icon: User, label: t(T.settings.account) },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeSection === id 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'text-slate-400 hover:bg-slate-800/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            </nav>
          </GlassPanel>

          {/* Content */}
          <div className="col-span-9 space-y-6">
            {activeSection === 'personality' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Sparkles className="h-5 w-5 text-violet-400" />
                      AI Personality Mode
                    </CardTitle>
                    <CardDescription>
                      Choose how Cato expresses itself in conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {PERSONALITY_MODES.map((mode) => (
                      <div
                        key={mode.id}
                        onClick={() => settings.setPersonalityMode(mode.id)}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all border',
                          settings.personalityMode === mode.id
                            ? 'border-violet-500/50 bg-violet-500/10'
                            : 'border-slate-700/50 hover:border-slate-600/50 bg-slate-800/30'
                        )}
                      >
                        <div className="text-2xl">{mode.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{mode.name}</h4>
                            {mode.id === 'auto' && (
                              <Badge variant="glow" className="text-xs">Recommended</Badge>
                            )}
                            {settings.personalityMode === mode.id && (
                              <Check className="h-4 w-4 text-violet-400 ml-auto" />
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{mode.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'language' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Globe className="h-5 w-5 text-violet-400" />
                      {t(T.settings.language)}
                    </CardTitle>
                    <CardDescription>
                      {t(T.settings.languageDesc)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        {t(T.settings.selectLanguage)}
                      </p>
                      <LanguageSelector variant="list" />
                    </div>
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Bell className="h-5 w-5 text-violet-400" />
                      {t(T.settings.notifications)}
                    </CardTitle>
                    <CardDescription>
                      {t(T.settings.notificationsDesc)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingRow
                      label={t(T.settings.notifyUpdates)}
                      description={t(T.settings.notificationsDesc)}
                      checked={settings.notificationsEnabled}
                      onChange={settings.setNotificationsEnabled}
                    />
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'appearance' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Eye className="h-5 w-5 text-violet-400" />
                      Appearance
                    </CardTitle>
                    <CardDescription>
                      Customize how Think Tank looks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingRow
                      label="Compact Mode"
                      description="Use a more compact layout for messages"
                      checked={settings.compactMode}
                      onChange={settings.setCompactMode}
                    />
                    <SettingRow
                      label="Show Token Count"
                      description="Display token usage for each message (Advanced Mode)"
                      checked={settings.showTokenCount}
                      onChange={settings.setShowTokenCount}
                    />
                    <SettingRow
                      label="Show Cost Estimate"
                      description="Display estimated cost for responses (Advanced Mode)"
                      checked={settings.showCostEstimate}
                      onChange={settings.setShowCostEstimate}
                    />
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'shortcuts' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Keyboard className="h-5 w-5 text-violet-400" />
                      Keyboard Shortcuts
                    </CardTitle>
                    <CardDescription>
                      Quick keys for power users
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingRow
                      label="Enable Keyboard Shortcuts"
                      description="Use keyboard shortcuts throughout the app"
                      checked={settings.keyboardShortcutsEnabled}
                      onChange={settings.setKeyboardShortcutsEnabled}
                    />
                    
                    <div className="mt-6 space-y-2">
                      <h4 className="text-sm font-medium text-white">Available Shortcuts</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <ShortcutRow keys={['⌘', 'Shift', 'A']} action="Toggle Advanced Mode" />
                        <ShortcutRow keys={['⌘', 'K']} action="New Conversation" />
                        <ShortcutRow keys={['⌘', '/']} action="Focus Search" />
                        <ShortcutRow keys={['Esc']} action="Close Dialog" />
                      </div>
                    </div>
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'sounds' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Volume2 className="h-5 w-5 text-violet-400" />
                      Sound Effects
                    </CardTitle>
                    <CardDescription>
                      Audio feedback for actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingRow
                      label="Enable Sounds"
                      description="Play sounds for messages, achievements, and actions"
                      checked={soundEnabled}
                      onChange={setSoundEnabled}
                    />
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Shield className="h-5 w-5 text-violet-400" />
                      Privacy
                    </CardTitle>
                    <CardDescription>
                      Control your data and privacy settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <h4 className="font-medium text-white mb-2">Your Data</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Download a copy of all your data including conversations, rules, and preferences.
                      </p>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export Data
                      </Button>
                    </div>
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}

            {activeSection === 'account' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="default" hoverEffect={false} padding="none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <User className="h-5 w-5 text-violet-400" />
                      Account
                    </CardTitle>
                    <CardDescription>
                      Manage your account settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <h4 className="font-medium text-red-400 mb-2">Danger Zone</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Permanently delete your account and all associated data. This cannot be undone.
                      </p>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </CardContent>
                </GlassCard>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-400">{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-slate-600">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
