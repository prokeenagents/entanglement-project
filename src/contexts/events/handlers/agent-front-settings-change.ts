import type { EventHandler } from './types';

/**
 * `agent-front-settings-change` — an agent's partner-facing Front Settings were
 * saved org-side. By the time this fires, the webhook receiver has ALREADY
 * re-fetched the fresh values into the connector cache, so anything reading
 * /api/agent-front-settings from here on sees the new state.
 *
 * Raises the blocking notice dialog (same proof-of-channel role as
 * `space-change`): the change is acknowledged, not swiped away. NOT terminal —
 * no `stop()`, no navigation; a user mid-conversation stays where they are.
 */
export const agentFrontSettingsChange: EventHandler<App.Events.AgentFrontSettingsChangeEvent> = (_event, { notice }) => {
    notice.show({
        title: 'Agent settings updated',
        message: 'An agent’s settings were updated in your organization.'
    });
};
