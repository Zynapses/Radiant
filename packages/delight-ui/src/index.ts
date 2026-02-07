/**
 * @radiant/delight-ui
 *
 * Shared Delight UX system for all RADIANT user-facing apps.
 * Provides personality-aware UX touches (pre/during/post execution).
 *
 * POLICY: Every user-facing RADIANT app MUST wrap its root with
 * <RadiantDelightProvider> and trigger delight at appropriate injection points.
 * See: .windsurf/workflows/delight-ux-policy.md
 *
 * @version 1.0.0
 */

export {
  RadiantDelightProvider,
  useRadiantDelight,
  useRadiantDelightOptional,
} from './RadiantDelightProvider';

export type {
  PersonalityMode,
  InjectionPoint,
  DisplayStyle,
  DelightMessage,
  DelightToastData,
  AppDelightConfig,
  RadiantDelightContextValue,
} from './types';

export {
  getAnimationConfig,
  getMotionTransition,
  getMorphAnimationStates,
  getMorphNarration,
  getMorphSubtitle,
} from './animations';

export type {
  PersonalityAnimationConfig,
  MorphTarget,
} from './animations';

export { playSynthSound } from './sounds';
