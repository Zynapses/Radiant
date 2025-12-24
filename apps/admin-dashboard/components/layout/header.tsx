'use client';

import { useAuth } from '@/lib/auth/hooks';
import { Button } from '@/components/ui/button';
import { Bell, Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from 'next-themes';

export function Header() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Admin Dashboard</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <div className="flex items-center gap-3 ml-4 pl-4 border-l">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-radiant-100 dark:bg-radiant-900 flex items-center justify-center">
              <User className="h-4 w-4 text-radiant-600 dark:text-radiant-400" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{user?.displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
