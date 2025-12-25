'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Languages,
  Sparkles,
  Check,
  AlertTriangle,
  Download,
  Upload,
} from 'lucide-react';

interface Translation {
  key: string;
  namespace: string;
  translations: Record<string, string>;
  isComplete: boolean;
  lastUpdated: string;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  completionPercent: number;
  isDefault: boolean;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', completionPercent: 100, isDefault: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', completionPercent: 95, isDefault: false },
  { code: 'fr', name: 'French', nativeName: 'Français', completionPercent: 92, isDefault: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', completionPercent: 88, isDefault: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', completionPercent: 85, isDefault: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', completionPercent: 82, isDefault: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', completionPercent: 78, isDefault: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', completionPercent: 75, isDefault: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', completionPercent: 72, isDefault: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', completionPercent: 68, isDefault: false },
];

export default function TranslationsPage() {
  const [search, setSearch] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const queryClient = useQueryClient();

  const { data: translations, isLoading } = useQuery<{ data: Translation[] }>({
    queryKey: ['translations', search, selectedLang],
    queryFn: () =>
      fetch(`/api/admin/localization/translations?search=${search}&lang=${selectedLang}`).then(
        (r) => r.json()
      ),
  });

  const updateTranslationMutation = useMutation({
    mutationFn: (params: { key: string; lang: string; value: string }) =>
      fetch('/api/admin/localization/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translations'] });
      setEditingKey(null);
    },
  });

  const aiTranslateMutation = useMutation({
    mutationFn: (params: { key: string; targetLang: string }) =>
      fetch('/api/admin/localization/ai-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translations'] });
    },
  });

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (editingKey) {
      updateTranslationMutation.mutate({
        key: editingKey,
        lang: selectedLang,
        value: editValue,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Translation Manager</h1>
          <p className="text-muted-foreground">
            Manage translations across 18 languages with AI assistance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Language Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        {SUPPORTED_LANGUAGES.slice(0, 5).map((lang) => (
          <Card
            key={lang.code}
            className={`cursor-pointer transition-colors ${
              selectedLang === lang.code ? 'border-primary' : ''
            }`}
            onClick={() => setSelectedLang(lang.code)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{lang.nativeName}</span>
                {lang.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${lang.completionPercent}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{lang.completionPercent}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Translations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search translation keys..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedLang} onValueChange={setSelectedLang}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() =>
                aiTranslateMutation.mutate({ key: '*', targetLang: selectedLang })
              }
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Translate Missing
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>English (Source)</TableHead>
                <TableHead>
                  {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.nativeName}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                (translations?.data || []).map((translation) => (
                  <TableRow key={translation.key}>
                    <TableCell className="font-mono text-sm">{translation.key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{translation.namespace}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {translation.translations['en']}
                    </TableCell>
                    <TableCell>
                      {editingKey === translation.key ? (
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="min-h-[60px]"
                        />
                      ) : (
                        <div className="max-w-[200px] truncate">
                          {translation.translations[selectedLang] || (
                            <span className="text-muted-foreground italic">
                              Not translated
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {translation.translations[selectedLang] ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {editingKey === translation.key ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={handleSave}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingKey(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleEdit(
                                translation.key,
                                translation.translations[selectedLang] || ''
                              )
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              aiTranslateMutation.mutate({
                                key: translation.key,
                                targetLang: selectedLang,
                              })
                            }
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
