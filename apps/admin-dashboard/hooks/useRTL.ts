/**
 * RADIANT v5.52.29 - RTL Helper Hook (PROMPT-41D)
 * 
 * Provides utilities for RTL-aware component rendering.
 */

'use client';

import { useTranslation } from '@/hooks/useTranslation';

export function useRTL() {
  const { language, isRTL } = useTranslation();
  
  return {
    isRTL,
    locale: language,
    
    // Get direction attribute value
    dir: isRTL ? 'rtl' as const : 'ltr' as const,
    
    // Flip margin/padding classes
    marginStart: (value: string) => isRTL ? `mr-${value}` : `ml-${value}`,
    marginEnd: (value: string) => isRTL ? `ml-${value}` : `mr-${value}`,
    paddingStart: (value: string) => isRTL ? `pr-${value}` : `pl-${value}`,
    paddingEnd: (value: string) => isRTL ? `pl-${value}` : `pr-${value}`,
    
    // Flip text alignment
    textStart: isRTL ? 'text-right' : 'text-left',
    textEnd: isRTL ? 'text-left' : 'text-right',
    
    // Flip flex direction
    flexRow: isRTL ? 'flex-row-reverse' : 'flex-row',
    
    // Flip positions
    startPosition: isRTL ? 'right' : 'left',
    endPosition: isRTL ? 'left' : 'right',
    
    // Get appropriate chevron direction
    ChevronStart: isRTL ? 'ChevronRight' : 'ChevronLeft',
    ChevronEnd: isRTL ? 'ChevronLeft' : 'ChevronRight',
    
    // Helper for conditional RTL classes
    rtlClass: (ltrClass: string, rtlClass: string) => isRTL ? rtlClass : ltrClass,
  };
}

export default useRTL;
