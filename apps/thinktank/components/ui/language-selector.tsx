'use client';

/**
 * Language Selector Component
 * 
 * Allows users to select their preferred language.
 * ALL language data comes from the Radiant API.
 */

import React from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'list';
  className?: string;
  showNativeName?: boolean;
}

export function LanguageSelector({ 
  variant = 'dropdown', 
  className,
  showNativeName = true,
}: LanguageSelectorProps) {
  const { language, languages, setLanguage, isLoading } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLanguage = languages.find((l) => l.code === language);

  const handleSelectLanguage = async (code: string) => {
    await setLanguage(code);
    setIsOpen(false);
  };

  if (variant === 'list') {
    return (
      <div className={cn('space-y-1', className)}>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                language === lang.code
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'hover:bg-slate-800/50 text-slate-300'
              )}
              dir={lang.direction}
            >
              <span className="flex items-center gap-2">
                <span>{showNativeName ? lang.nativeName : lang.name}</span>
                {showNativeName && lang.nativeName !== lang.name && (
                  <span className="text-xs text-slate-500">({lang.name})</span>
                )}
              </span>
              {language === lang.code && (
                <Check className="h-4 w-4 text-violet-400" />
              )}
            </button>
          ))
        )}
      </div>
    );
  }

  // Dropdown variant
  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50',
          'text-slate-300 hover:text-white',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">
          {currentLanguage?.nativeName || currentLanguage?.name || language}
        </span>
        <ChevronDown className={cn(
          'h-4 w-4 transition-transform',
          isOpen && 'transform rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className={cn(
          'absolute top-full mt-1 w-48 py-1 rounded-lg border',
          'bg-slate-900 border-slate-700/50 shadow-xl z-50',
          'max-h-64 overflow-y-auto'
        )}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                language === lang.code
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'hover:bg-slate-800/50 text-slate-300'
              )}
              dir={lang.direction}
            >
              <span>{showNativeName ? lang.nativeName : lang.name}</span>
              {language === lang.code && (
                <Check className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
