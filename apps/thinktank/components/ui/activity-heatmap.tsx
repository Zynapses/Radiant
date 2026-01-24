'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityDay {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data: ActivityDay[];
  year?: number;
  colorScheme?: 'violet' | 'green' | 'blue';
  showLabels?: boolean;
  className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getColorClass(count: number, max: number, scheme: 'violet' | 'green' | 'blue'): string {
  if (count === 0) return 'bg-slate-800/50';
  
  const intensity = Math.min(count / Math.max(max, 1), 1);
  
  const colors = {
    violet: [
      'bg-violet-900/40',
      'bg-violet-700/50',
      'bg-violet-600/60',
      'bg-violet-500/70',
      'bg-violet-400',
    ],
    green: [
      'bg-green-900/40',
      'bg-green-700/50',
      'bg-green-600/60',
      'bg-green-500/70',
      'bg-green-400',
    ],
    blue: [
      'bg-blue-900/40',
      'bg-blue-700/50',
      'bg-blue-600/60',
      'bg-blue-500/70',
      'bg-blue-400',
    ],
  };
  
  const index = Math.min(Math.floor(intensity * 5), 4);
  return colors[scheme][index];
}

function generateYearGrid(year: number, data: ActivityDay[]) {
  const dataMap = new Map(data.map(d => [d.date, d.count]));
  const weeks: Array<Array<{ date: string; count: number; dayOfWeek: number }>> = [];
  
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  let currentWeek: Array<{ date: string; count: number; dayOfWeek: number }> = [];
  
  const firstDayOfWeek = startDate.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ date: '', count: 0, dayOfWeek: i });
  }
  
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay();
    
    currentWeek.push({
      date: dateStr,
      count: dataMap.get(dateStr) || 0,
      dayOfWeek,
    });
    
    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: '', count: 0, dayOfWeek: currentWeek.length });
    }
    weeks.push(currentWeek);
  }
  
  return weeks;
}

function getMonthLabels(year: number, weeks: ReturnType<typeof generateYearGrid>) {
  const labels: Array<{ month: string; weekIndex: number }> = [];
  let currentMonth = -1;
  
  weeks.forEach((week, weekIndex) => {
    const validDay = week.find(d => d.date);
    if (validDay) {
      const month = new Date(validDay.date).getMonth();
      if (month !== currentMonth) {
        currentMonth = month;
        labels.push({ month: MONTHS[month], weekIndex });
      }
    }
  });
  
  return labels;
}

export function ActivityHeatmap({
  data,
  year = new Date().getFullYear(),
  colorScheme = 'violet',
  showLabels = true,
  className,
}: ActivityHeatmapProps) {
  const weeks = useMemo(() => generateYearGrid(year, data), [year, data]);
  const monthLabels = useMemo(() => getMonthLabels(year, weeks), [year, weeks]);
  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
  const totalActivity = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  return (
    <div className={cn('space-y-2', className)}>
      {showLabels && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-400">
            {totalActivity.toLocaleString()} interactions in {year}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-slate-800/50" />
              <div className={cn('w-3 h-3 rounded-sm', getColorClass(1, 4, colorScheme))} />
              <div className={cn('w-3 h-3 rounded-sm', getColorClass(2, 4, colorScheme))} />
              <div className={cn('w-3 h-3 rounded-sm', getColorClass(3, 4, colorScheme))} />
              <div className={cn('w-3 h-3 rounded-sm', getColorClass(4, 4, colorScheme))} />
            </div>
            <span>More</span>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0.5 min-w-max">
          {showLabels && (
            <div className="flex ml-8 mb-1">
              {monthLabels.map(({ month, weekIndex }, i) => (
                <span
                  key={`${month}-${weekIndex}`}
                  className="text-xs text-slate-500"
                  style={{ 
                    marginLeft: i === 0 ? weekIndex * 13 : (weekIndex - monthLabels[i-1].weekIndex - 1) * 13,
                    width: 40 
                  }}
                >
                  {month}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex">
            {showLabels && (
              <div className="flex flex-col gap-0.5 mr-2 text-xs text-slate-500">
                {DAYS.map((day, i) => (
                  <div key={day} className="h-3 flex items-center">
                    {i % 2 === 1 && <span>{day}</span>}
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-0.5">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((day, dayIndex) => (
                    <motion.div
                      key={`${weekIndex}-${dayIndex}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (weekIndex * 7 + dayIndex) * 0.001 }}
                      className={cn(
                        'w-3 h-3 rounded-sm transition-colors cursor-pointer',
                        day.date ? getColorClass(day.count, maxCount, colorScheme) : 'bg-transparent',
                        day.date && 'hover:ring-1 hover:ring-white/30'
                      )}
                      title={day.date ? `${day.date}: ${day.count} interactions` : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
