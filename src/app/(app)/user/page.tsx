import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';
import { UserContent } from './content';

/**
 * Server Component — fetch the consumer's profile (name / gender / dob) HERE, where
 * the connector + httpOnly cookies exist, and pass it down to PREFILL the form.
 *
 * This is the only way the client sees the structured values: the access token
 * carries just the combined display name + email, so the current first/last name,
 * gender and DOB come from GET /keen-api/consumer/profile. If the fetch fails the
 * form falls back to blank (still usable as a partial update). Guarded as an
 * authenticated page by the proxy (a signed-out visitor is bounced to /login).
 */
export default async function UserPage() {
    const accessToken = await getAccessToken();
    const reply = accessToken ? await getKeen().consumer.getProfile({ accessToken }) : null;
    const profile = reply?.success ? (reply.data ?? null) : null;

    return <UserContent profile={profile} />;
}
