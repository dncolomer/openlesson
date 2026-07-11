import type { Plugin } from '@elizaos/core';

import { createPlanAction } from './actions/createPlan';
import { adaptPlanAction } from './actions/adaptPlan';
import { createPlanFromVideoAction } from './actions/createPlanFromVideo';
import { startSessionAction } from './actions/startSession';
import { analyzeHeartbeatAction } from './actions/analyzeHeartbeat';
import { pauseSessionAction } from './actions/pauseSession';
import { resumeSessionAction } from './actions/resumeSession';
import { endSessionAction } from './actions/endSession';
import { askAssistantAction } from './actions/askAssistant';
import { getAnalyticsAction } from './actions/getAnalytics';

export const openLessonPlugin: Plugin = {
  name: 'open-lesson',
  description:
    'openLesson Proof-of-Work API — verification workspaces, blocks, and Think Aloud Protocol (TAP) links',
  actions: [
    createPlanAction,
    adaptPlanAction,
    createPlanFromVideoAction,
    startSessionAction,
    analyzeHeartbeatAction,
    pauseSessionAction,
    resumeSessionAction,
    endSessionAction,
    askAssistantAction,
    getAnalyticsAction,
  ],
  providers: [],
  services: [],
  evaluators: [],
};

export default openLessonPlugin;

export { createPlanAction } from './actions/createPlan';
export { adaptPlanAction } from './actions/adaptPlan';
export { createPlanFromVideoAction } from './actions/createPlanFromVideo';
export { startSessionAction } from './actions/startSession';
export { analyzeHeartbeatAction } from './actions/analyzeHeartbeat';
export { pauseSessionAction } from './actions/pauseSession';
export { resumeSessionAction } from './actions/resumeSession';
export { endSessionAction } from './actions/endSession';
export { askAssistantAction } from './actions/askAssistant';
export { getAnalyticsAction } from './actions/getAnalytics';
