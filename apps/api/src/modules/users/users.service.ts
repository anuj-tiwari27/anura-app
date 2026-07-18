import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Lawyer, Prisma, User } from '@prisma/client';
import type { LawyerProfileView, PublicUser } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../../common/mappers/user.mapper';
import { AuditService } from '../audit/audit.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Lawyer row loaded together with its User (identity lives on User). */
type LawyerWithUser = Lawyer & { user: User };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** GET /users/me — current user with lawyer relation as PublicUser. */
  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { lawyer: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user, user.lawyer);
  }

  /** PATCH /users/me — update basic account fields. */
  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    await this.assertUserExists(userId);

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { lawyer: true },
    });
    void this.audit.log({
      actorId: userId,
      action: 'user.account_update',
      entityType: 'USER',
      entityId: userId,
      meta: { fields: Object.keys(data) },
    });
    return toPublicUser(user, user.lawyer);
  }

  /**
   * POST /users/onboarding — identity fields (name/phone/city/state) go to the
   * User row; professional fields go to the upserted Lawyer row. When `skip`
   * is true only the name is persisted so the user can finish later.
   */
  async onboarding(userId: string, dto: OnboardingDto): Promise<PublicUser> {
    const skip = dto.skip === true;

    const professional = {
      barCouncilId: skip ? null : dto.barCouncilId ?? null,
      experienceYears: skip ? null : dto.experienceYears ?? null,
      practiceAreas: skip ? [] : dto.practiceAreas ?? [],
      courts: skip ? [] : dto.courts ?? [],
      primaryCourtType: skip ? null : dto.primaryCourtType ?? null,
      bio: skip ? null : dto.bio ?? null,
    };

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.lawyer.upsert({
        where: { userId },
        create: { userId, ...professional },
        update: professional,
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          fullName: dto.fullName,
          phone: skip ? undefined : dto.phone ?? null,
          city: skip ? undefined : dto.city ?? null,
          state: skip ? undefined : dto.state ?? null,
          onboardingComplete: true,
        },
        include: { lawyer: true },
      });
    });

    void this.audit.log({
      actorId: userId,
      action: 'user.onboarding',
      entityType: 'USER',
      entityId: userId,
      meta: { skipped: skip },
    });
    return toPublicUser(user, user.lawyer);
  }

  /** GET /users/profile — the caller's profile (User identity + Lawyer professional). */
  async getProfile(lawyerId: string | null | undefined): Promise<LawyerProfileView> {
    return this.toLawyerProfileView(await this.requireLawyer(lawyerId));
  }

  /**
   * PATCH /users/profile — identity fields update the User row, professional
   * fields update the Lawyer row; both in one transaction.
   */
  async updateProfile(
    lawyerId: string | null | undefined,
    dto: UpdateProfileDto,
  ): Promise<LawyerProfileView> {
    const lawyer = await this.requireLawyer(lawyerId);

    const identity: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) identity.fullName = dto.fullName;
    if (dto.phone !== undefined) identity.phone = dto.phone;
    if (dto.city !== undefined) identity.city = dto.city;
    if (dto.state !== undefined) identity.state = dto.state;

    const professional: Prisma.LawyerUpdateInput = {};
    if (dto.barCouncilId !== undefined) professional.barCouncilId = dto.barCouncilId;
    if (dto.enrollmentYear !== undefined) professional.enrollmentYear = dto.enrollmentYear;
    if (dto.experienceYears !== undefined) professional.experienceYears = dto.experienceYears;
    if (dto.practiceAreas !== undefined) professional.practiceAreas = dto.practiceAreas;
    if (dto.courts !== undefined) professional.courts = dto.courts;
    if (dto.primaryCourtType !== undefined) professional.primaryCourtType = dto.primaryCourtType;
    if (dto.bio !== undefined) professional.bio = dto.bio;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(identity).length > 0) {
        await tx.user.update({ where: { id: lawyer.userId }, data: identity });
      }
      return tx.lawyer.update({
        where: { id: lawyer.id },
        data: professional,
        include: { user: true },
      });
    });

    void this.audit.log({
      actorId: lawyer.userId,
      action: 'user.profile_update',
      entityType: 'USER',
      entityId: lawyer.userId,
      meta: { fields: [...Object.keys(identity), ...Object.keys(professional)] },
    });
    return this.toLawyerProfileView(updated);
  }

  // --- helpers --------------------------------------------------------------

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');
  }

  /** Loads the caller's lawyer (with User identity); enforces onboarding + existence. */
  private async requireLawyer(lawyerId: string | null | undefined): Promise<LawyerWithUser> {
    if (!lawyerId) throw new BadRequestException('Complete onboarding first');
    const lawyer = await this.prisma.lawyer.findUnique({
      where: { id: lawyerId },
      include: { user: true },
    });
    if (!lawyer) throw new NotFoundException('Lawyer profile not found');
    return lawyer;
  }

  private toLawyerProfileView(lawyer: LawyerWithUser): LawyerProfileView {
    return {
      id: lawyer.id,
      userId: lawyer.userId,
      fullName: lawyer.user.fullName ?? '',
      phone: lawyer.user.phone,
      barCouncilId: lawyer.barCouncilId,
      enrollmentYear: lawyer.enrollmentYear,
      experienceYears: lawyer.experienceYears,
      practiceAreas: lawyer.practiceAreas,
      courts: lawyer.courts,
      primaryCourtType: lawyer.primaryCourtType,
      city: lawyer.user.city,
      state: lawyer.user.state,
      bio: lawyer.bio,
      createdAt: lawyer.createdAt.toISOString(),
      updatedAt: lawyer.updatedAt.toISOString(),
    };
  }
}
