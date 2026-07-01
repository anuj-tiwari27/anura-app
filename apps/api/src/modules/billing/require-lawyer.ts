import { BadRequestException } from '@nestjs/common';

/**
 * Ensures the caller has completed onboarding (i.e. has a Lawyer profile).
 * Returns the non-null lawyerId or throws so lawyer-scoped endpoints stay safe.
 */
export function requireLawyer(lawyerId: string | null | undefined): string {
  if (!lawyerId) {
    throw new BadRequestException('Complete onboarding first');
  }
  return lawyerId;
}
