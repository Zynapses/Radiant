import { PrepromptLearningClient } from './preprompt-learning-client';

export const metadata = {
  title: 'Pre-Prompt Learning | RADIANT Admin',
  description: 'Manage pre-prompt templates, weights, and view learning effectiveness',
};

export default function PrepromptLearningPage() {
  return <PrepromptLearningClient />;
}
