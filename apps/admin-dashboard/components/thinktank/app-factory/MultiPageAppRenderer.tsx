'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Home,
  Layout,
  FileText,
  Settings,
  Users,
  BarChart2,
  Mail,
  Info,
  Search,
  ShoppingCart,
  Edit,
  Lock,
  Box,
  List,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Menu,
  X,
  Globe,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface GeneratedPage {
  id: string;
  slug: string;
  title: string;
  description?: string;
  pageType: string;
  layout: PageLayout;
  sections: PageSection[];
  localState: Record<string, unknown>;
  showInNav: boolean;
  navOrder?: number;
  navIcon?: string;
}

interface PageLayout {
  type: 'full_width' | 'centered' | 'sidebar_left' | 'sidebar_right' | 'two_column' | 'three_column';
  maxWidth?: string;
  padding?: string;
  background?: string;
  showHeader: boolean;
  showFooter: boolean;
  showBreadcrumbs: boolean;
}

interface PageSection {
  id: string;
  title?: string;
  sectionType: string;
  components: unknown[];
  layout: 'stack' | 'grid' | 'flex' | 'masonry';
  columns?: number;
  gap?: string;
  background?: string;
  padding?: string;
}

interface AppNavigation {
  type: 'top_bar' | 'sidebar' | 'bottom_tabs' | 'hamburger' | 'breadcrumb' | 'none';
  items: NavItem[];
  secondaryItems?: NavItem[];
  brand?: { text?: string; logo?: string; link?: string };
}

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  pageId?: string;
  href?: string;
  children?: NavItem[];
}

interface AppTheme {
  mode: 'light' | 'dark' | 'system';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  fonts: { heading: string; body: string; mono: string };
  borderRadius: string;
  spacing: string;
}

interface GeneratedMultiPageApp {
  id: string;
  name: string;
  description: string;
  appType: string;
  pages: GeneratedPage[];
  homePage: string;
  navigation: AppNavigation;
  theme: AppTheme;
  buildStatus: string;
  previewUrl?: string;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const ICON_MAP: Record<string, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  layout: <Layout className="h-4 w-4" />,
  'file-text': <FileText className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  'bar-chart-2': <BarChart2 className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  'shopping-cart': <ShoppingCart className="h-4 w-4" />,
  edit: <Edit className="h-4 w-4" />,
  lock: <Lock className="h-4 w-4" />,
  box: <Box className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
  user: <Users className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />,
};

function getIcon(iconName?: string): React.ReactNode {
  if (!iconName) return <Box className="h-4 w-4" />;
  return ICON_MAP[iconName] || <Box className="h-4 w-4" />;
}

// ============================================================================
// Multi-Page App Renderer
// ============================================================================

interface MultiPageAppRendererProps {
  appId: string;
  className?: string;
}

export function MultiPageAppRenderer({ appId, className }: MultiPageAppRendererProps) {
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: app, isLoading } = useQuery<GeneratedMultiPageApp>({
    queryKey: ['multipage-app', appId],
    queryFn: () => fetch(`/api/thinktank/multipage-apps/${appId}`).then(r => r.json()),
  });

  useEffect(() => {
    if (app && !currentPageId) {
      setCurrentPageId(app.homePage || app.pages[0]?.id || '');
    }
  }, [app, currentPageId]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!app) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center text-muted-foreground">
          App not found
        </CardContent>
      </Card>
    );
  }

  const currentPage = app.pages.find(p => p.id === currentPageId) || app.pages[0];
  const navType = app.navigation.type;

  return (
    <Card className={cn('overflow-hidden', isFullscreen && 'fixed inset-4 z-50', className)}>
      {/* App Header */}
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{app.name}</CardTitle>
              <CardDescription className="text-xs">
                {app.appType.replace('_', ' ')} • {app.pages.length} pages
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Viewport Switcher */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', viewportSize === 'desktop' && 'bg-muted')}
                onClick={() => setViewportSize('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', viewportSize === 'tablet' && 'bg-muted')}
                onClick={() => setViewportSize('tablet')}
              >
                <Layout className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', viewportSize === 'mobile' && 'bg-muted')}
                onClick={() => setViewportSize('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

            <Badge variant={app.buildStatus === 'ready' ? 'default' : 'secondary'}>
              {app.buildStatus}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {app.previewUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={app.previewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Preview
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex h-[600px]">
          {/* Sidebar Navigation */}
          {navType === 'sidebar' && (
            <div className={cn(
              'border-r bg-muted/30 transition-all',
              sidebarOpen ? 'w-56' : 'w-12'
            )}>
              <div className="p-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-48px)]">
                <nav className="p-2 space-y-1">
                  {app.navigation.items.map(item => (
                    <Button
                      key={item.id}
                      variant={currentPageId === item.pageId ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start',
                        !sidebarOpen && 'justify-center px-2'
                      )}
                      onClick={() => item.pageId && setCurrentPageId(item.pageId)}
                    >
                      {getIcon(app.pages.find(p => p.id === item.pageId)?.navIcon)}
                      {sidebarOpen && <span className="ml-2">{item.label}</span>}
                    </Button>
                  ))}
                </nav>
              </ScrollArea>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Navigation */}
            {navType === 'top_bar' && (
              <div className="border-b px-4 py-2 flex items-center gap-4 bg-background">
                {app.navigation.brand?.text && (
                  <span className="font-semibold">{app.navigation.brand.text}</span>
                )}
                <nav className="flex items-center gap-1">
                  {app.navigation.items.map(item => (
                    <Button
                      key={item.id}
                      variant={currentPageId === item.pageId ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => item.pageId && setCurrentPageId(item.pageId)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </nav>
              </div>
            )}

            {/* Page Content */}
            <div 
              className={cn(
                'flex-1 overflow-auto p-6',
                viewportSize === 'tablet' && 'max-w-3xl mx-auto w-full',
                viewportSize === 'mobile' && 'max-w-sm mx-auto w-full'
              )}
              style={{ 
                backgroundColor: app.theme.colors.background,
                color: app.theme.colors.text,
              }}
            >
              {currentPage && (
                <PageRenderer page={currentPage} theme={app.theme} />
              )}
            </div>

            {/* Bottom Tabs */}
            {navType === 'bottom_tabs' && (
              <div className="border-t px-4 py-2 flex justify-around bg-background">
                {app.navigation.items.slice(0, 5).map(item => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'flex-col h-auto py-2',
                      currentPageId === item.pageId && 'text-primary'
                    )}
                    onClick={() => item.pageId && setCurrentPageId(item.pageId)}
                  >
                    {getIcon(app.pages.find(p => p.id === item.pageId)?.navIcon)}
                    <span className="text-xs mt-1">{item.label}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Page List Panel */}
          <div className="w-48 border-l bg-muted/20 p-3">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Pages</h4>
            <div className="space-y-1">
              {app.pages.map(page => (
                <button
                  key={page.id}
                  className={cn(
                    'w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors',
                    currentPageId === page.id && 'bg-muted font-medium'
                  )}
                  onClick={() => setCurrentPageId(page.id)}
                >
                  <div className="flex items-center gap-2">
                    {getIcon(page.navIcon)}
                    <span className="truncate">{page.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">
                    /{page.slug || '(home)'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Page Renderer
// ============================================================================

interface PageRendererProps {
  page: GeneratedPage;
  theme: AppTheme;
}

function PageRenderer({ page, theme }: PageRendererProps) {
  return (
    <div 
      className={cn(
        'space-y-8',
        page.layout.type === 'centered' && 'max-w-4xl mx-auto',
        page.layout.type === 'full_width' && 'w-full'
      )}
    >
      {/* Breadcrumbs */}
      {page.layout.showBreadcrumbs && page.slug && (
        <div className="flex items-center text-sm text-muted-foreground">
          <span>Home</span>
          <ChevronRight className="h-4 w-4 mx-1" />
          <span className="text-foreground">{page.title}</span>
        </div>
      )}

      {/* Page Title */}
      <div>
        <h1 
          className="text-3xl font-bold"
          style={{ fontFamily: theme.fonts.heading }}
        >
          {page.title}
        </h1>
        {page.description && (
          <p className="text-muted-foreground mt-2">{page.description}</p>
        )}
      </div>

      {/* Sections */}
      {page.sections.map(section => (
        <SectionRenderer key={section.id} section={section} theme={theme} />
      ))}
    </div>
  );
}

// ============================================================================
// Section Renderer
// ============================================================================

interface SectionRendererProps {
  section: PageSection;
  theme: AppTheme;
}

function SectionRenderer({ section, theme }: SectionRendererProps) {
  const renderSectionContent = () => {
    switch (section.sectionType) {
      case 'hero':
        return (
          <div className="text-center py-16 px-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
            <h2 className="text-4xl font-bold mb-4">Welcome to Your App</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              This is a generated hero section. Customize it with your own content.
            </p>
            <div className="flex justify-center gap-4">
              <Button style={{ backgroundColor: theme.colors.primary }}>Get Started</Button>
              <Button variant="outline">Learn More</Button>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className={cn(
            'grid gap-6',
            section.layout === 'grid' ? `grid-cols-${section.columns || 3}` : 'grid-cols-1 md:grid-cols-3'
          )}>
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${theme.colors.primary}20` }}
                  >
                    <Box className="h-6 w-6" style={{ color: theme.colors.primary }} />
                  </div>
                  <CardTitle className="text-lg">Feature {i}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Description of feature {i}. This will be customized based on your app.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'stats':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: '12,345' },
              { label: 'Revenue', value: '$45,678' },
              { label: 'Growth', value: '+23%' },
              { label: 'Active Now', value: '1,234' },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'chart_grid':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Chart {i}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40 bg-muted rounded flex items-center justify-center">
                    <BarChart2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'data_table':
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-3 text-sm">Item {i}</td>
                        <td className="px-4 py-3">
                          <Badge variant={i % 2 === 0 ? 'default' : 'secondary'}>
                            {i % 2 === 0 ? 'Active' : 'Pending'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Dec {20 + i}, 2024
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      case 'form':
        return (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <input className="w-full px-3 py-2 border rounded-md" placeholder="John" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <input className="w-full px-3 py-2 border rounded-md" placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input className="w-full px-3 py-2 border rounded-md" placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <textarea className="w-full px-3 py-2 border rounded-md" rows={4} placeholder="Your message..." />
              </div>
              <Button style={{ backgroundColor: theme.colors.primary }}>Submit</Button>
            </CardContent>
          </Card>
        );

      case 'contact':
        return (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Get in Touch</h3>
              <p className="text-muted-foreground mb-6">
                Fill out the form and we&apos;ll get back to you as soon as possible.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5" style={{ color: theme.colors.primary }} />
                  <span>contact@example.com</span>
                </div>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <input className="w-full px-3 py-2 border rounded-md" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input className="w-full px-3 py-2 border rounded-md" placeholder="your@email.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <textarea className="w-full px-3 py-2 border rounded-md" rows={4} />
                </div>
                <Button className="w-full" style={{ backgroundColor: theme.colors.primary }}>
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'content':
        return (
          <div className="prose max-w-none">
            <p className="text-muted-foreground">
              This is a content section. In your generated app, this will contain the actual content
              based on your requirements. You can add text, images, and other elements here.
            </p>
          </div>
        );

      case 'cta':
        return (
          <div 
            className="text-center py-12 px-4 rounded-lg"
            style={{ backgroundColor: `${theme.colors.primary}10` }}
          >
            <h3 className="text-2xl font-bold mb-2">Ready to Get Started?</h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of users who are already using our platform.
            </p>
            <Button size="lg" style={{ backgroundColor: theme.colors.primary }}>
              Start Now
            </Button>
          </div>
        );

      case 'team':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="text-center">
                <div 
                  className="w-24 h-24 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: theme.colors.surface }}
                >
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <h4 className="font-medium">Team Member {i}</h4>
                <p className="text-sm text-muted-foreground">Role</p>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
            <Box className="h-8 w-8 mx-auto mb-2" />
            <p>{section.sectionType} section</p>
          </div>
        );
    }
  };

  return (
    <section 
      className="space-y-4"
      style={{
        backgroundColor: section.background,
        padding: section.padding,
      }}
    >
      {section.title && (
        <h2 className="text-2xl font-semibold">{section.title}</h2>
      )}
      {renderSectionContent()}
    </section>
  );
}

// ============================================================================
// Export
// ============================================================================

export default MultiPageAppRenderer;
