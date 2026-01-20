'use client';

/**
 * Think Tank Consumer App Simulator - UI Components
 * v3.0 - Reusable UI building blocks
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';

// Utility function for class names
export const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

// Glass Card Component
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  onClick,
  hover = false,
}) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl',
      hover && 'hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
);

// Badge Component
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange' | 'cyan';
  size?: 'sm' | 'md';
  className?: string;
}

const badgeColors: Record<string, string> = {
  default: 'bg-white/10 text-white/70',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  orange: 'bg-orange-500/20 text-orange-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
};

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default', 
  size = 'sm',
  className = '',
}) => (
  <span
    className={cn(
      'inline-flex items-center font-medium rounded-full',
      badgeColors[variant],
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      className
    )}
  >
    {children}
  </span>
);

// Icon Button Component
interface IconBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'solid' | 'outline';
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

export const IconBtn: React.FC<IconBtnProps> = ({
  icon: Icon,
  onClick,
  className = '',
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  title,
}) => {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const variantClasses = {
    ghost: cn(
      'hover:bg-white/10',
      active && 'bg-white/10 text-white'
    ),
    solid: 'bg-white/10 hover:bg-white/20',
    outline: 'border border-white/20 hover:bg-white/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded-lg transition-all text-white/70 hover:text-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </button>
  );
};

// Toggle Switch Component
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) => (
  <label className={cn(
    'flex items-center gap-3 cursor-pointer',
    disabled && 'opacity-50 cursor-not-allowed'
  )}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-blue-500' : 'bg-white/20'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
          checked && 'translate-x-5'
        )}
      />
    </button>
    {(label || description) && (
      <div className="flex flex-col">
        {label && <span className="text-sm text-white">{label}</span>}
        {description && <span className="text-xs text-white/50">{description}</span>}
      </div>
    )}
  </label>
);

// Button Component
interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  icon: Icon,
  iconPosition = 'left',
}) => {
  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white',
    ghost: 'hover:bg-white/10 text-white/70 hover:text-white',
    danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {Icon && iconPosition === 'left' && <Icon className="w-4 h-4" />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className="w-4 h-4" />}
    </button>
  );
};

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full p-4',
              sizeClasses[size]
            )}
          >
            <GlassCard className="p-6">
              {title && (
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <IconBtn icon={X} onClick={onClose} size="sm" />
                </div>
              )}
              {children}
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Dropdown Component
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  isOpen,
  onToggle,
  align = 'left',
}) => (
  <div className="relative">
    <div onClick={onToggle}>{trigger}</div>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'absolute top-full mt-2 z-40',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          <GlassCard className="p-2 min-w-[200px]">
            {children}
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Dropdown Item
interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  onClick,
  icon: Icon,
  active = false,
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all',
      'hover:bg-white/10 text-white/70 hover:text-white',
      active && 'bg-white/10 text-white',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

// Accordion Component
interface AccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  isOpen,
  onToggle,
  className = '',
}) => (
  <div className={className}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-all"
    >
      <span className="text-sm font-medium text-white">{title}</span>
      <ChevronDown
        className={cn(
          'w-4 h-4 text-white/50 transition-transform',
          isOpen && 'rotate-180'
        )}
      />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="p-3 pt-0">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Progress Bar Component
interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  className = '',
  showLabel = false,
  variant = 'default',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const variantColors = {
    default: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn('h-full rounded-full', variantColors[variant])}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-white/50 mt-1">{Math.round(percentage)}%</span>
      )}
    </div>
  );
};

// Tabs Component
interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => (
  <div className={cn('flex gap-1 p-1 bg-white/5 rounded-lg', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          activeTab === tab.id
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:text-white hover:bg-white/5'
        )}
      >
        {tab.icon && <tab.icon className="w-4 h-4" />}
        {tab.label}
      </button>
    ))}
  </div>
);

// Tooltip Component
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap',
              positionClasses[position]
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Skeleton Loader Component
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
}) => {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'bg-white/10 animate-pulse',
        variantClasses[variant],
        className
      )}
    />
  );
};

// Empty State Component
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-white/30" />
    </div>
    <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
    {description && <p className="text-sm text-white/50 mb-4 max-w-sm">{description}</p>}
    {action}
  </div>
);
