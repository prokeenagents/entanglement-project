import { GuestLayout } from '@/components/ui/guest-layout';

export default function Layout({ children }: Readonly<React.PropsWithChildren>) {
    return <GuestLayout>{children}</GuestLayout>;
}
