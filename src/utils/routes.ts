import { generateUUID } from '@/utils/global';

/**
 * Every app URL is built here, so the route shape lives in one place:
 *
 *   /space/<spaceId>                          a space and its agents
 *   /space/<spaceId>/<agentRowId>             one agent + its conversations
 *   /space/<spaceId>/<agentRowId>/<chatId>    a live conversation
 *
 * The agent segment is the agent's ROW id (cuid) — the chat shell resolves the
 * slug from it. A new conversation is just a fresh chat id.
 */
export const spaceHref = (spaceId: string): string => `/space/${spaceId}`;

export const agentHref = (spaceId: string, agentId: string): string => `/space/${spaceId}/${agentId}`;

export const chatHref = (spaceId: string, agentId: string, chatId: string): string => `/space/${spaceId}/${agentId}/${chatId}`;

export const newChatHref = (spaceId: string, agentId: string): string => chatHref(spaceId, agentId, generateUUID());
