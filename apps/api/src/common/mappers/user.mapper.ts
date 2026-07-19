import type { Lawyer, User } from '@prisma/client';
import type { PublicUser } from '@anura/shared';

/** Maps a Prisma User (+ optional Lawyer) to the shared PublicUser view model. */
export function toPublicUser(user: User, lawyer?: Lawyer | null): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    city: user.city,
    state: user.state,
    emailVerified: user.emailVerified,
    onboardingComplete: user.onboardingComplete,
    lawyerId: lawyer?.id ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
