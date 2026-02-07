'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  Smile,
  AtSign,
  Hash,
  Image as ImageIcon,
  Code,
  Sparkles,
  GitBranch,
  Reply,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Bookmark,
  Flag,
  Loader2,
  Bot,
  User,
  CheckCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'facilitator';
  senderId?: string;
  senderName?: string;
  senderColor?: string;
  senderAvatar?: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  replyTo?: string;
  reactions?: { emoji: string; users: string[] }[];
  attachments?: { type: string; url: string; name: string }[];
  isAI?: boolean;
  modelId?: string;
  branchId?: string;
}

interface RealTimeChatProps {
  messages: Message[];
  participants: any[];
  currentUserId: string;
  onSendMessage: (content: string, replyTo?: string) => Promise<void>;
  onReaction: (messageId: string, emoji: string) => void;
  onBranch: (messageId: string) => void;
  typingUsers?: string[];
  isConnected?: boolean;
  facilitatorEnabled?: boolean;
}

export function RealTimeChat({
  messages,
  participants,
  currentUserId,
  onSendMessage,
  onReaction,
  onBranch,
  typingUsers = [],
  isConnected = true,
  facilitatorEnabled = false,
}: RealTimeChatProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle send
  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await onSendMessage(input, replyingTo?.id);
      setInput('');
      setReplyingTo(null);
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get participant info
  const getParticipant = useCallback((id?: string) => {
    return participants.find((p) => p.id === id || p.userId === id);
  }, [participants]);

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      {!isConnected && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Reconnecting to real-time updates...</span>
        </div>
      )}

      {/* AI Facilitator Banner */}
      {facilitatorEnabled && (
        <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border-b flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm">
            <strong className="text-violet-600">AI Facilitator</strong> is helping guide this conversation
          </span>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        <div className="py-4 space-y-6">
          {Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Messages */}
              <div className="space-y-1">
                {dayMessages.map((message, index) => {
                  const prevMessage = dayMessages[index - 1];
                  const showAvatar = !prevMessage || 
                    prevMessage.senderId !== message.senderId ||
                    (new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() > 300000);
                  
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      showAvatar={showAvatar}
                      isOwn={message.senderId === currentUserId}
                      participant={getParticipant(message.senderId)}
                      isHovered={hoveredMessageId === message.id}
                      onHover={(hovered) => setHoveredMessageId(hovered ? message.id : null)}
                      onReply={() => setReplyingTo(message)}
                      onReaction={onReaction}
                      onBranch={() => onBranch(message.id)}
                      replyToMessage={message.replyTo ? messages.find((m) => m.id === message.replyTo) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-violet-500" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Start the conversation</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Type a message to begin collaborating. AI features are ready to assist you.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Typing Indicators */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-t bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {typingUsers.slice(0, 3).map((userId) => {
                  const participant = getParticipant(userId);
                  return (
                    <Avatar key={userId} className="h-5 w-5 border-2 border-background">
                      <AvatarFallback
                        style={{ backgroundColor: participant?.color }}
                        className="text-white text-[8px]"
                      >
                        {(participant?.name || 'U').slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
              <span className="text-xs text-muted-foreground">
                {typingUsers.length === 1
                  ? `${getParticipant(typingUsers[0])?.name || 'Someone'} is typing`
                  : `${typingUsers.length} people are typing`}
              </span>
              <motion.span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1 h-1 bg-muted-foreground rounded-full"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  />
                ))}
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-t bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Reply className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  Replying to {replyingTo.senderName || 'message'}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {replyingTo.content.slice(0, 50)}...
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setReplyingTo(null)}
              >
                ×
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Input */}
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="min-h-[44px] max-h-[200px] pr-24 resize-none"
              rows={1}
            />
            
            {/* Input Actions */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="end">
                  <div className="grid grid-cols-8 gap-1">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        className="p-2 hover:bg-muted rounded text-lg"
                        onClick={() => {
                          setInput((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsRecording(!isRecording)}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4 text-red-500" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice message</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="h-10 px-4"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <AtSign className="h-3 w-3" />
            Mention
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            Ask AI
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <GitBranch className="h-3 w-3" />
            Branch
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Code className="h-3 w-3" />
            Code
          </Button>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  showAvatar,
  isOwn,
  participant,
  isHovered,
  onHover,
  onReply,
  onReaction,
  onBranch,
  replyToMessage,
}: {
  message: Message;
  showAvatar: boolean;
  isOwn: boolean;
  participant?: any;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
  onReply: () => void;
  onReaction: (messageId: string, emoji: string) => void;
  onBranch: () => void;
  replyToMessage?: Message;
}) {
  const isAI = message.role === 'assistant' || message.role === 'facilitator';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative flex gap-3',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        !showAvatar && 'pl-11'
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0">
          {isAI ? (
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              message.role === 'facilitator'
                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                : 'bg-gradient-to-br from-blue-500 to-cyan-600'
            )}>
              <Bot className="h-4 w-4 text-white" />
            </div>
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarImage src={participant?.avatarUrl || message.senderAvatar} />
              <AvatarFallback
                style={{ backgroundColor: participant?.color || message.senderColor }}
                className="text-white text-xs"
              >
                {(participant?.name || message.senderName || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={cn('flex-1 max-w-[80%]', isOwn && 'flex flex-col items-end')}>
        {/* Sender Name & Time */}
        {showAvatar && (
          <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
            <span className="text-sm font-medium">
              {isAI
                ? message.role === 'facilitator'
                  ? 'AI Facilitator'
                  : `AI (${message.modelId || 'Assistant'})`
                : participant?.name || message.senderName || 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.timestamp)}
            </span>
            {message.role === 'facilitator' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                Facilitator
              </Badge>
            )}
          </div>
        )}

        {/* Reply Preview */}
        {replyToMessage && (
          <div className={cn(
            'mb-1 px-3 py-1.5 rounded-lg bg-muted/50 border-l-2 border-primary/50 text-sm',
            isOwn ? 'ml-auto' : 'mr-auto'
          )}>
            <span className="font-medium text-xs">{replyToMessage.senderName}</span>
            <p className="text-muted-foreground text-xs truncate max-w-[200px]">
              {replyToMessage.content}
            </p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'relative rounded-2xl px-4 py-2.5 text-sm',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : isAI
              ? message.role === 'facilitator'
                ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border border-violet-200 dark:border-violet-800 rounded-bl-md'
                : 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border border-blue-200 dark:border-blue-800 rounded-bl-md'
              : 'bg-muted rounded-bl-md'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>

          {/* Status */}
          {isOwn && message.status && (
            <div className="absolute -bottom-4 right-0 text-xs text-muted-foreground flex items-center gap-1">
              {message.status === 'sending' && <Clock className="h-3 w-3" />}
              {message.status === 'sent' && <CheckCheck className="h-3 w-3" />}
              {message.status === 'delivered' && <CheckCheck className="h-3 w-3 text-blue-500" />}
              {message.status === 'read' && <CheckCheck className="h-3 w-3 text-green-500" />}
              {message.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={cn('flex gap-1 mt-1', isOwn && 'justify-end')}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className="px-2 py-0.5 bg-muted rounded-full text-xs flex items-center gap-1 hover:bg-muted/80"
                onClick={() => onReaction(message.id, reaction.emoji)}
              >
                <span>{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover Actions */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              'absolute top-0 flex items-center gap-0.5 p-1 bg-background border rounded-lg shadow-sm',
              isOwn ? 'right-full mr-2' : 'left-full ml-2'
            )}
          >
            <TooltipProvider>
              {quickReactions.map((emoji) => (
                <Tooltip key={emoji}>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1.5 hover:bg-muted rounded"
                      onClick={() => onReaction(message.id, emoji)}
                    >
                      {emoji}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">React with {emoji}</TooltipContent>
                </Tooltip>
              ))}
              
              <div className="w-px h-4 bg-border mx-1" />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReply}>
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Reply</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBranch}>
                    <GitBranch className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Branch from here</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                  <DropdownMenuItem>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy text
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bookmark className="h-4 w-4 mr-2" />
                    Save message
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Helpers
function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};
  
  messages.forEach((message) => {
    const date = new Date(message.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateKey: string;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });
  
  return groups;
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const quickReactions = ['👍', '❤️', '😂', '😮', '😢'];

const commonEmojis = [
  '😀', '😂', '🥰', '😎', '🤔', '👍', '👎', '❤️',
  '🔥', '✨', '🎉', '💯', '🙏', '👏', '💪', '🤝',
  '✅', '❌', '⭐', '💡', '📌', '🎯', '🚀', '💬',
];
