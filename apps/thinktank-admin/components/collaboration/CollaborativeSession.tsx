'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Users, Send, MessageSquare, MoreVertical, Copy, Check, UserPlus, Settings, Eye, Edit3, MessageCircle, Smile, Reply, Trash2, Clock, Wifi, WifiOff, Crown, ChevronDown, X, Sparkles, Bot } from 'lucide-react';

interface Participant { id: string; name: string; email?: string; avatarUrl?: string; color: string; permission: 'owner' | 'editor' | 'commenter' | 'viewer'; isOnline: boolean; isTyping: boolean; cursorPosition?: { messageId: string; offset: number }; }
interface Message { id: string; participantId: string; role: 'user' | 'assistant' | 'system'; content: string; model?: string; status: 'typing' | 'sent' | 'delivered' | 'edited' | 'deleted'; reactions: Record<string, string[]>; threadCount: number; createdAt: Date; editedAt?: Date; }
interface Comment { id: string; messageId: string; participantId: string; content: string; selectedText?: string; isResolved: boolean; createdAt: Date; }
interface CollaborativeSessionProps { sessionId: string; conversationTitle?: string; initialMessages?: Message[]; currentUserId: string; websocketUrl?: string; }

function PresenceAvatars({ participants, maxVisible = 4 }: { participants: Participant[]; maxVisible?: number }) {
  const online = participants.filter(p => p.isOnline);
  const visible = online.slice(0, maxVisible);
  const overflow = online.length - maxVisible;
  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        {visible.map((participant) => (
          <Tooltip key={participant.id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-background transition-transform hover:scale-110 hover:z-10" style={{ boxShadow: `0 0 0 2px ${participant.color}` }}>
                  <AvatarImage src={participant.avatarUrl} />
                  <AvatarFallback style={{ backgroundColor: participant.color }} className="text-white text-xs font-medium">{participant.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {participant.isTyping && (<span className="absolute -bottom-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" /></span>)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: participant.color }} /><span>{participant.name}</span>{participant.isTyping && (<span className="text-xs text-muted-foreground">typing...</span>)}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (<Tooltip><TooltipTrigger asChild><Avatar className="h-8 w-8 border-2 border-background bg-muted"><AvatarFallback className="text-xs">+{overflow}</AvatarFallback></Avatar></TooltipTrigger><TooltipContent><div className="space-y-1">{online.slice(maxVisible).map(p => (<div key={p.id} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-sm">{p.name}</span></div>))}</div></TooltipContent></Tooltip>)}
      </div>
    </TooltipProvider>
  );
}

function TypingIndicator({ participants }: { participants: Participant[] }) {
  const typing = participants.filter(p => p.isTyping && p.isOnline);
  if (typing.length === 0) return null;
  const names = typing.map(p => p.name);
  let text = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : `${names[0]} and ${names.length - 1} others are typing`;
  return (<div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground"><div className="flex gap-1"><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div><span>{text}</span></div>);
}

function CollaborativeMessage({ message, participant, isCurrentUser, comments, onReact, onReply, onEdit, onDelete, onAddComment }: { message: Message; participant: Participant; isCurrentUser: boolean; comments: Comment[]; onReact: (emoji: string) => void; onReply: () => void; onEdit: () => void; onDelete: () => void; onAddComment: (text: string, selectedText?: string) => void; }) {
  const [showActions, setShowActions] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const messageComments = comments.filter(c => c.messageId === message.id && !c.isResolved);
  const isAI = message.role === 'assistant';
  const quickReactions = ['👍', '❤️', '😊', '🎉', '🤔', '👀'];

  return (
    <div className={cn('group relative flex gap-3 px-4 py-3 transition-colors', showActions && 'bg-muted/50', isCurrentUser ? 'flex-row-reverse' : 'flex-row')} onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <div className="flex-shrink-0">{isAI ? (<div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Bot className="h-4 w-4 text-white" /></div>) : (<Avatar className="h-8 w-8"><AvatarImage src={participant.avatarUrl} /><AvatarFallback style={{ backgroundColor: participant.color }} className="text-white text-xs">{participant.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>)}</div>
      <div className={cn('flex-1 max-w-[80%]', isCurrentUser && 'text-right')}>
        <div className={cn('flex items-center gap-2 mb-1', isCurrentUser && 'justify-end')}><span className="text-sm font-medium" style={{ color: isAI ? undefined : participant.color }}>{isAI ? (message.model || 'AI Assistant') : participant.name}</span>{isAI && (<Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>)}{participant.permission === 'owner' && !isAI && (<Crown className="h-3 w-3 text-amber-500" />)}<span className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{message.editedAt && (<span className="text-xs text-muted-foreground">(edited)</span>)}</div>
        <div className={cn('relative inline-block rounded-2xl px-4 py-2 text-sm', isAI ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800' : isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}><p className="whitespace-pre-wrap">{message.content}</p>{messageComments.length > 0 && (<div className="absolute -right-2 -top-2"><Badge className="h-5 w-5 p-0 flex items-center justify-center bg-amber-500">{messageComments.length}</Badge></div>)}</div>
        {Object.keys(message.reactions).length > 0 && (<div className={cn('flex flex-wrap gap-1 mt-1', isCurrentUser && 'justify-end')}>{Object.entries(message.reactions).map(([emoji, users]) => (<button key={emoji} onClick={() => onReact(emoji)} className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', 'bg-muted hover:bg-muted/80 transition-colors', users.includes(participant.id) && 'ring-2 ring-primary')}><span>{emoji}</span><span className="text-muted-foreground">{users.length}</span></button>))}</div>)}
        {message.threadCount > 0 && (<button onClick={onReply} className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline"><MessageCircle className="h-3 w-3" />{message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}</button>)}
      </div>
      {showActions && (<div className={cn('absolute top-0 flex items-center gap-1 bg-background border rounded-lg shadow-sm p-1', isCurrentUser ? 'left-4' : 'right-4')}>{quickReactions.slice(0, 3).map(emoji => (<button key={emoji} onClick={() => onReact(emoji)} className="p-1 hover:bg-muted rounded transition-colors">{emoji}</button>))}<DropdownMenu><DropdownMenuTrigger asChild><button className="p-1 hover:bg-muted rounded transition-colors"><Smile className="h-4 w-4" /></button></DropdownMenuTrigger><DropdownMenuContent><div className="grid grid-cols-6 gap-1 p-2">{quickReactions.map(emoji => (<button key={emoji} onClick={() => onReact(emoji)} className="p-2 hover:bg-muted rounded text-lg">{emoji}</button>))}</div></DropdownMenuContent></DropdownMenu><Separator orientation="vertical" className="h-4" /><button onClick={onReply} className="p-1 hover:bg-muted rounded transition-colors" title="Reply in thread"><Reply className="h-4 w-4" /></button><button onClick={() => setShowCommentInput(!showCommentInput)} className="p-1 hover:bg-muted rounded transition-colors" title="Add comment"><MessageSquare className="h-4 w-4" /></button>{(isCurrentUser || participant.permission === 'owner') && (<><button onClick={onEdit} className="p-1 hover:bg-muted rounded transition-colors" title="Edit"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="p-1 hover:bg-muted rounded text-destructive transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button></>)}</div>)}
      {showCommentInput && (<div className="absolute left-0 right-0 -bottom-16 px-4 z-10"><div className="flex gap-2 bg-background border rounded-lg shadow-lg p-2"><Input placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (commentText.trim()) { onAddComment(commentText); setCommentText(''); setShowCommentInput(false); } } }} /><Button size="sm" onClick={() => { if (commentText.trim()) { onAddComment(commentText); setCommentText(''); setShowCommentInput(false); } }}>Add</Button><Button size="sm" variant="ghost" onClick={() => setShowCommentInput(false)}><X className="h-4 w-4" /></Button></div></div>)}
    </div>
  );
}

function ShareDialog({ sessionName, shareLink, participants, onInvite, onUpdatePermission, onRemove }: { sessionName: string; shareLink: string; participants: Participant[]; onInvite: (email: string, permission: string) => void; onUpdatePermission: (participantId: string, permission: string) => void; onRemove: (participantId: string) => void; }) {
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('editor');
  const copyLink = async () => { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Share &ldquo;{sessionName}&rdquo;</DialogTitle></DialogHeader>
      <div className="space-y-6">
        <div className="space-y-2"><Label>Share link</Label><div className="flex gap-2"><Input value={shareLink} readOnly className="font-mono text-sm" /><Button variant="outline" size="icon" onClick={copyLink}>{copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button></div><p className="text-xs text-muted-foreground">Anyone with the link can join as a viewer</p></div>
        <Separator />
        <div className="space-y-2"><Label>Invite people</Label><div className="flex gap-2"><Input placeholder="Email address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" /><Select value={invitePermission} onValueChange={setInvitePermission}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor"><div className="flex items-center gap-2"><Edit3 className="h-3 w-3" />Editor</div></SelectItem><SelectItem value="commenter"><div className="flex items-center gap-2"><MessageSquare className="h-3 w-3" />Commenter</div></SelectItem><SelectItem value="viewer"><div className="flex items-center gap-2"><Eye className="h-3 w-3" />Viewer</div></SelectItem></SelectContent></Select><Button onClick={() => { if (inviteEmail) { onInvite(inviteEmail, invitePermission); setInviteEmail(''); } }}><UserPlus className="h-4 w-4" /></Button></div></div>
        <Separator />
        <div className="space-y-2"><Label>People with access</Label><ScrollArea className="h-48"><div className="space-y-2">{participants.map((p) => (<div key={p.id} className="flex items-center justify-between py-2"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={p.avatarUrl} /><AvatarFallback style={{ backgroundColor: p.color }} className="text-white text-xs">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><div className="flex items-center gap-2"><span className="text-sm font-medium">{p.name}</span>{p.isOnline && (<span className="w-2 h-2 bg-green-500 rounded-full" />)}</div>{p.email && (<span className="text-xs text-muted-foreground">{p.email}</span>)}</div></div>{p.permission === 'owner' ? (<Badge variant="secondary"><Crown className="h-3 w-3 mr-1" />Owner</Badge>) : (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm">{p.permission === 'editor' && <Edit3 className="h-3 w-3 mr-1" />}{p.permission === 'commenter' && <MessageSquare className="h-3 w-3 mr-1" />}{p.permission === 'viewer' && <Eye className="h-3 w-3 mr-1" />}{p.permission.charAt(0).toUpperCase() + p.permission.slice(1)}<ChevronDown className="h-3 w-3 ml-1" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onUpdatePermission(p.id, 'editor')}><Edit3 className="h-4 w-4 mr-2" />Editor</DropdownMenuItem><DropdownMenuItem onClick={() => onUpdatePermission(p.id, 'commenter')}><MessageSquare className="h-4 w-4 mr-2" />Commenter</DropdownMenuItem><DropdownMenuItem onClick={() => onUpdatePermission(p.id, 'viewer')}><Eye className="h-4 w-4 mr-2" />Viewer</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onRemove(p.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Remove</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</div>))}</div></ScrollArea></div>
      </div>
    </DialogContent>
  );
}

export default function CollaborativeSession({ sessionId, conversationTitle = 'Untitled Session', initialMessages = [], currentUserId }: CollaborativeSessionProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [participants, setParticipants] = useState<Participant[]>([{ id: currentUserId, name: 'You', color: '#3b82f6', permission: 'owner', isOnline: true, isTyping: false }, { id: '2', name: 'Sarah Chen', email: 'sarah@example.com', color: '#ef4444', permission: 'editor', isOnline: true, isTyping: false }, { id: '3', name: 'Mike Johnson', email: 'mike@example.com', color: '#22c55e', permission: 'commenter', isOnline: true, isTyping: true }]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    const newMessage: Message = { id: `msg_${Date.now()}`, participantId: currentUserId, role: 'user', content: inputValue, status: 'sent', reactions: {}, threadCount: 0, createdAt: new Date() };
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setTimeout(() => { const aiMessage: Message = { id: `msg_${Date.now()}_ai`, participantId: 'ai', role: 'assistant', content: 'This is a collaborative AI response that all participants can see in real-time.', model: 'claude-3-5-sonnet', status: 'sent', reactions: {}, threadCount: 0, createdAt: new Date() }; setMessages(prev => [...prev, aiMessage]); }, 1000);
  }, [inputValue, currentUserId]);

  const shareLink = `https://thinktank.radiant.ai/session/${sessionId}`;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3"><h2 className="font-semibold">{conversationTitle}</h2><Badge variant="outline" className="gap-1">{isConnected ? (<><Wifi className="h-3 w-3 text-green-500" />Live</>) : (<><WifiOff className="h-3 w-3 text-destructive" />Disconnected</>)}</Badge></div>
          <div className="flex items-center gap-3"><PresenceAvatars participants={participants} /><Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><UserPlus className="h-4 w-4 mr-2" />Share</Button></DialogTrigger><ShareDialog sessionName={conversationTitle} shareLink={shareLink} participants={participants} onInvite={(email, permission) => console.log('Invite:', email, permission)} onUpdatePermission={(id, permission) => console.log('Update:', id, permission)} onRemove={(id) => console.log('Remove:', id)} /></Dialog><Button variant="ghost" size="icon" onClick={() => setShowComments(!showComments)}><MessageSquare className="h-4 w-4" />{comments.filter(c => !c.isResolved).length > 0 && (<Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">{comments.filter(c => !c.isResolved).length}</Badge>)}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem><Settings className="h-4 w-4 mr-2" />Session settings</DropdownMenuItem><DropdownMenuItem><Clock className="h-4 w-4 mr-2" />View history</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />End session</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </div>
        <ScrollArea className="flex-1"><div className="py-4">{messages.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Users className="h-12 w-12 mb-4 opacity-50" /><p className="text-lg font-medium">Start a collaborative conversation</p><p className="text-sm">Messages will appear here for all participants</p></div>) : (messages.map((message) => { const participant = participants.find(p => p.id === message.participantId) || { id: message.participantId, name: message.role === 'assistant' ? 'AI' : 'Unknown', color: '#6b7280', permission: 'viewer' as const, isOnline: false, isTyping: false }; return (<CollaborativeMessage key={message.id} message={message} participant={participant} isCurrentUser={message.participantId === currentUserId} comments={comments} onReact={(emoji) => { setMessages(prev => prev.map(m => { if (m.id === message.id) { const reactions = { ...m.reactions }; if (reactions[emoji]?.includes(currentUserId)) { reactions[emoji] = reactions[emoji].filter(id => id !== currentUserId); if (reactions[emoji].length === 0) delete reactions[emoji]; } else { reactions[emoji] = [...(reactions[emoji] || []), currentUserId]; } return { ...m, reactions }; } return m; })); }} onReply={() => console.log('Reply to:', message.id)} onEdit={() => console.log('Edit:', message.id)} onDelete={() => setMessages(prev => prev.filter(m => m.id !== message.id))} onAddComment={(text) => { const newComment: Comment = { id: `cmt_${Date.now()}`, messageId: message.id, participantId: currentUserId, content: text, isResolved: false, createdAt: new Date() }; setComments(prev => [...prev, newComment]); }} />); }))}<div ref={messagesEndRef} /></div></ScrollArea>
        <TypingIndicator participants={participants} />
        <div className="p-4 border-t bg-muted/30"><div className="flex gap-2"><Textarea placeholder="Type a message... (Everyone in the session will see this)" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} className="min-h-[44px] max-h-32 resize-none" rows={1} /><Button onClick={handleSend} disabled={!inputValue.trim()}><Send className="h-4 w-4" /></Button></div><div className="flex items-center justify-between mt-2 text-xs text-muted-foreground"><span>Press Enter to send, Shift+Enter for new line</span><span>{participants.filter(p => p.isOnline).length} online</span></div></div>
      </div>
    </div>
  );
}
