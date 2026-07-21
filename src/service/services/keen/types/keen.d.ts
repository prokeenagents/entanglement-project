import KeenConnector from '../keen.connector';

export {};

declare global {
    var __keenConnector: KeenConnector | undefined;

    namespace Keen {
        interface Connector {
            KEEN_HOST: string;
            ORIGIN: string;
            CLIENT_ID: string;
            CLIENT_SECRET: string;
            API_KEY_ID: string;
            API_KEY_SECRET: string;
        }

        interface ConsumerContractSpace {
            id: string;
            title: string;
        }

        interface ConsumerContract {
            id: string;
            apiKeyId: string | null;
            name: string;
            key: string;
            createdAt: string;
            spaces: ConsumerContractSpace[];
            outsideRegistration: boolean;
            otpInsideRegistration: boolean;
            otpOutsideRegistration: boolean;
            blockOutsideRegistrationLogins: boolean;
            blockSystemRegistrationLogins: boolean;
        }

        interface ConsumerContractResponse {
            success: boolean;
            status: number;
            message: string;
            result: ConsumerContract | null;
        }

        interface ConsumerAccessTokenBody {
            email: string;
            password: string;
        }

        interface ConsumerAccessToken {
            success: boolean;
            message: string;
            status: number;
            statusCode: number;
            result: {
                access_token: string;
                token_type: string;
                expires_in: number;
                refresh_token: string;
            };
        }

        interface ConsumerRotateToken {
            success: boolean;
            message: string;
            status: number;
            statusCode: number;
        }

        interface ConsumerAccessTokenError {
            message: Array<string>;
            error: string;
            statusCode: number;
        }

        interface ConsumerRotateTokenBody {
            token: string;
            refreshToken: string;
        }

        interface ConsumerOTPBody {
            pin: string;
            token: string;
        }

        interface ConsumerUpdateBody {
            accessToken: string;
            firstName?: string;
            lastName?: string;
            gender?: 'male' | 'female' | 'other';
            dobDay?: string;
            dobMonth?: string;
            dobYear?: string;
            callbackUrl?: string;
        }

        interface ConsumerResetPasswordClaimBody {
            email: string;
            password: string;
            accessToken: string;
            callbackUrl: string;
        }

        interface ConsumerResetPasswordRedeemBody {
            accessToken: string;
            callbackSecret: string;
            hash: string;
            callbackUrl?: string;
        }

        interface ConsumerDeleteClaimBody {
            accessToken: string;
            callbackUrl: string;
        }

        interface ConsumerDeleteRedeemBody {
            accessToken: string;
            callbackSecret: string;
            hash: string;
            callbackUrl?: string;
        }

        interface ConsumerChatListBody {
            accessToken: string;
        }

        interface ConsumerChatSearchBody {
            accessToken: string;
            query: string;
            limit?: number;
        }

        interface ConsumerChatHistoryBody {
            accessToken: string;
            chatId: string;
            limit?: number;
            before?: string;
        }

        interface ConsumerSetChatTitleBody {
            accessToken: string;
            chatId: string;
            title: string;
        }

        interface ConsumerDeleteChatBody {
            accessToken: string;
            chatId: string;
        }

        /** A chat as it appears in a list / search result. */
        interface ChatListItem {
            chatId: string;
            /** Null until the chat has been titled. */
            title: string | null;
            agentId: string;
            /** ISO-8601. */
            createdAt: string;
            /** ISO-8601. */
            updatedAt: string;
        }

        /**
         * One user-facing turn. The history surface returns only `initial = true`
         * rows — sub-agent / tool calls are excluded — so each row is a whole
         * exchange: the user's prompt AND the final answer.
         */
        interface ChatHistoryItem {
            id: string;
            prompt: string;
            response: string;
            responseType: 'text' | 'image' | 'tool' | 'error';
            agentId: string;
            /** ISO-8601. */
            createdAt: string;
        }

        /**
         * Pagination cursor. Round-trip `nextCursor` back as
         * `before = "<createdAt>:<id>"` to fetch the next (older) page.
         */
        interface ChatCursor {
            createdAt: string;
            id: string;
        }

        interface ConsumerChatListData {
            items: Keen.ChatListItem[];
        }

        interface ConsumerChatHistoryData {
            items: Keen.ChatHistoryItem[];
            /** Null when this is the last page. */
            nextCursor: Keen.ChatCursor | null;
        }

        interface ConsumerSetChatTitleData {
            chatId: string;
            title: string;
        }

        interface ConsumerDeleteChatData {
            chatId: string;
            /** Always true — the delete is a soft archive. */
            archived: boolean;
        }

        /** Success envelope — `data` is guaranteed present. */
        interface ConsumerChatOk<T> {
            success: true;
            status?: number;
            code?: string;
            message?: string;
            data: T;
        }

        /** Failure envelope — never carries `data`. */
        interface ConsumerChatFail {
            success: false;
            status?: number;
            code?: string;
            message?: string;
            data?: undefined;
        }

        /**
         * The chat wire envelope, discriminated by `success` — narrow on it and
         * `data` is fully typed with no optional chaining:
         *
         *     const res = await chat.list();
         *     if (!res.success) return;
         *     res.data.items;            // Keen.ChatListItem[]
         */
        type ConsumerChatReply<T = unknown> = Keen.ConsumerChatOk<T> | Keen.ConsumerChatFail;

        type ConsumerChatListReply = Keen.ConsumerChatReply<Keen.ConsumerChatListData>;
        type ConsumerChatHistoryReply = Keen.ConsumerChatReply<Keen.ConsumerChatHistoryData>;
        type ConsumerSetChatTitleReply = Keen.ConsumerChatReply<Keen.ConsumerSetChatTitleData>;
        type ConsumerDeleteChatReply = Keen.ConsumerChatReply<Keen.ConsumerDeleteChatData>;

        interface ExternalRegistrationClaimBody {
            firstName: string;
            lastName: string;
            password: string;
            gender: 'male' | 'female' | 'other';
            consent: boolean;
            dob: string;
            email: string;
            callbackUrl: string;
        }

        interface ExternalRegistrationRedeemBody {
            callbackSecret: string;
            hash: string;
            callbackUrl?: string;
        }

        interface ExternalResetPasswordClaimBody {
            email: string;
            password: string;
            callbackUrl: string;
        }

        interface ExternalResetPasswordRedeemBody {
            callbackSecret: string;
            hash: string;
            callbackUrl?: string;
        }

        interface RegistrationHashPayload {
            firstName: string;
            lastName: string;
            password: string;
            gender: string;
            consent: string;
            dob: string;
            email: string;
            consumerContractKey: string;
            callbackSecret: string;
            expireIn: number;
        }

        interface ResetPasswordHashPayload {
            email: string;
            password: string;
            consumerContractKey: string;
            callbackSecret: string;
            expireIn: number;
        }

        interface DeleteHashPayload {
            email: string;
            consumerContractKey: string;
            callbackSecret: string;
            expireIn: number;
        }

        /**
         * The consumer access-token's logical payload, reconstructed by
         * getTokenPayload: the sealed sensitive claims (opened from `hash`) plus the
         * clear routing claims. This is the shape ms-auth-consumer built BEFORE
         * sealing — `origin` + `clientId` ride the token in the clear, everything
         * else comes out of the AES-sealed `hash`.
         */
        interface AccessTokenPayload {
            sub: string;
            username: string;
            email: string;
            space: string;
            jti: string;
            consumerContractKey: string;
            origin: string;
            clientId: string;
        }

        /**
         * The login OTP hash's contents. ms-auth-consumer seals
         * `${account.id}:${account.email}:${expireIn}` with purpose 'otp' — no
         * signature, unlike the access token, just an AES-GCM blob. `expireIn` is a
         * UNIX seconds deadline.
         */
        interface OtpHashPayload {
            id: string;
            email: string;
            expireIn: number;
        }

        interface SpaceListCache {
            success: boolean;
            status: number;
            message: string;
            result: Keen.SpaceListCacheResult[];
        }

        interface SpaceListCacheResult {
            id: string;
            createdAt: string;
            updatedAt: string;
            title: string;
            description: string;
            deploymentToken: string;
            agents: Keen.SpaceListCacheAgent[];
        }

        interface SpaceListCacheAgent {
            id: string;
            createdAt: string;
            updatedAt: string;
            displayName: string;
            agentId: string;
            template: string;
            startFlow: string;
            startNode: string;
            active: boolean;
            spaceId: string;
        }

        /**
         * Everything the Next server needs about the signed-in consumer in one shot —
         * the raw cookie tokens, the decoded token payload, the spaces the consumer is
         * entitled to (token `space` claim ∩ cached list), and every agent across those
         * spaces. Assembled by KeenTools.getConsumerData(). The tokens are `undefined`
         * when there is no session, in which case tokenPayload is null and the arrays
         * are empty.
         */
        interface ConsumerData {
            accessToken: string | undefined;
            refreshToken: string | undefined;
            tokenPayload: Keen.AccessTokenPayload | null;
            consumerSpaces: Keen.SpaceListCacheResult[];
            agents: Keen.SpaceListCacheAgent[];
        }

        namespace Webhook {
            /**
             * The `result` of an `r_cert` redeem. Both halves of the certificate
             * arrive together: `cert` is the public PEM (verify signatures with it),
             * `key` is the shared symmetric key ('' when the admin never set one).
             *
             * This webhook is the ONLY channel that carries `key` — ms-api-keys keeps
             * it out of the CERTIFICATES:KEY:PULL snapshot on purpose, so it cannot be
             * re-read from a cache. Miss the delivery and the connector must redeem a
             * fresh code.
             */
            interface CertificateMaterial {
                cert: string;
                key: string;
            }

            /**
             * Inbound webhook body. `synch-data` is a single kind on the r_cert
             * redeem, or an ARRAY of kinds on the notify-then-fetch broadcasts —
             * hence the union; `result` only rides the redeem.
             */
            interface Payload {
                'synch-data': string | string[];
                result?: unknown;
                type?: string;
            }
        }
    }
}
