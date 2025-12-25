'use client';

import CollaborativeSession from '@/components/collaboration/CollaborativeSession';

export default function CollaboratePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collaborative Session</h1>
        <p className="text-muted-foreground">
          Real-time collaborative conversation sharing
        </p>
      </div>
      
      <CollaborativeSession
        sessionId="demo-session-1"
        conversationTitle="AI Development Best Practices"
        currentUserId="current-user"
        initialMessages={[
          {
            id: 'msg_1',
            participantId: 'current-user',
            role: 'user',
            content: 'What are the best practices for building production AI applications?',
            status: 'sent',
            reactions: { '👍': ['2', '3'] },
            threadCount: 0,
            createdAt: new Date(Date.now() - 300000),
          },
          {
            id: 'msg_2',
            participantId: 'ai',
            role: 'assistant',
            content: `Here are the key best practices for building production AI applications:

**1. Data Quality & Management**
- Implement robust data validation pipelines
- Version your training data alongside your models
- Monitor for data drift in production

**2. Model Development**
- Start simple, then iterate
- Use proper train/validation/test splits
- Document model assumptions and limitations

**3. Infrastructure**
- Design for horizontal scaling
- Implement proper caching strategies
- Use async processing for long-running tasks

**4. Monitoring & Observability**
- Track latency, throughput, and error rates
- Monitor model performance metrics over time
- Set up alerting for anomalies

**5. Security & Compliance**
- Implement input validation and sanitization
- Use proper authentication and authorization
- Ensure data privacy compliance (GDPR, etc.)

Would you like me to elaborate on any of these points?`,
            model: 'claude-3-5-sonnet',
            status: 'sent',
            reactions: { '🎉': ['current-user'], '❤️': ['2'] },
            threadCount: 2,
            createdAt: new Date(Date.now() - 280000),
          },
          {
            id: 'msg_3',
            participantId: '2',
            role: 'user',
            content: 'Great overview! Can you elaborate on the monitoring aspects? What specific metrics should we track?',
            status: 'sent',
            reactions: {},
            threadCount: 0,
            createdAt: new Date(Date.now() - 120000),
          },
        ]}
      />
    </div>
  );
}
