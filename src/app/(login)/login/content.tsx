'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Container, Text, VStack } from '@chakra-ui/react';
import { LoginForm } from './components/forms/login';
import { OtpForm } from './components/forms/otp';
import { LocalStorage } from '@/utils/localStorage';
import { OTP_CONFIG } from '@/configs/otp.config';
import { PAGE_CONFIG } from '@/configs/page.config';

export default function Content(props: { resetSuccess: boolean; registrationSuccess: boolean }) {
    const { resetSuccess, registrationSuccess } = props;

    const router = useRouter();

    const [mounted, setMounted] = React.useState(false);
    const otpState = React.useState<boolean>(false);
    const hashState = React.useState<App.Login.HashObject>(null);

    const [hash, setHash] = hashState;
    const setOtp = otpState[1];

    // Consume the one-time success flags: capture them ONCE into state so the message
    // survives the URL strip below (router.replace flips the props to false on the
    // soft re-render). "Read into a const, then delete the signal."
    const [showResetSuccess] = React.useState(resetSuccess);
    const [showRegistrationSuccess] = React.useState(registrationSuccess);

    // Remove the ?reset / ?registration flag from the URL so a refresh can't re-show
    // the message. replace, not push, so Back doesn't return to the flagged URL.
    React.useEffect(() => {
        if (resetSuccess || registrationSuccess) {
            router.replace(PAGE_CONFIG.LOGIN.URL);
        }
    }, [resetSuccess, registrationSuccess, router]);

    // Drop the pending OTP and fall back to the login form. Clears storage as well
    // as state, so a spent hash can't be re-seeded by the next mount.
    const expire = React.useCallback(() => {
        LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);
        setHash(null);
        setOtp(false);
    }, [setHash, setOtp]);

    // localStorage is browser-only, so read it AFTER mount (never during SSR) and
    // seed the shared otpState/hashState the forms toggle on — this resumes an
    // in-progress OTP flow across a reload. Gating the render on `mounted` means
    // nothing paints until the read has happened, so the server and first client
    // render stay identical (no hydration mismatch) and there's no flash of the
    // login form. This one-time client-only seed is a deliberate post-mount
    // setState, hence the scoped rule disable.
    React.useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        const otpData = LocalStorage.getJson<App.Login.HashObject>(OTP_CONFIG.STORAGE_KEY);

        // `timestamp` is a deadline, so a hash is only resumable while it still
        // lies in the future. A missing key reads as null and lands in the same
        // branch — either way there is no OTP to resume, so show the login form.
        if (otpData && otpData.timestamp > new Date().getTime()) {
            setHash(otpData);
            setOtp(true);
        } else {
            expire();
        }

        // Set on BOTH branches: returning early here would leave the component
        // rendering null forever, since nothing else ever flips `mounted`.
        setMounted(true);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [expire, setOtp, setHash]);

    // The seed above only rejects a hash that was ALREADY stale on arrival, which
    // is not yet a timeout: sitting on the OTP form past the deadline would still
    // leave a dead hash submittable. So arm a timer for exactly the time left.
    // Re-armed whenever the hash changes (a fresh login mints a new deadline) and
    // cleared on unmount so it can never fire against a dead component.
    React.useEffect(() => {
        if (!hash) {
            return;
        }

        // Expire via the timer even when already past due (0 ms) rather than
        // calling expire() inline — that keeps this effect free of set-state.
        const remaining = Math.max(0, hash.timestamp - new Date().getTime());
        const timer = window.setTimeout(expire, remaining);

        return () => window.clearTimeout(timer);
    }, [hash, expire]);

    if (!mounted) {
        // Read hasn't happened yet — render nothing (swap for a <Spinner /> if you
        // want a placeholder). This is what "wait for localStorage before render" means.
        return null;
    }

    return (
        <VStack minH="dvh" minW="dvw" bg="grey.200" alignItems="center" justifyContent="center">
            <VStack justifyContent="center" w="full">
                {showResetSuccess && (
                    <Text color="green.500" mb={4}>
                        Your password is successfully reset.
                    </Text>
                )}
                {showRegistrationSuccess && (
                    <Text color="green.500" mb={4}>
                        Your account has been created. Please sign in.
                    </Text>
                )}
                <OtpForm otpState={otpState} hashState={hashState} onExpire={expire} />
                <LoginForm otpState={otpState} hashState={hashState} />
            </VStack>
        </VStack>
    );
}
