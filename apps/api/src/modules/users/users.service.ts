import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Lawyer, Prisma } from '@prisma/client';
import type { LawyerProfileView, PublicUser } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../../common/mappers/user.mapper';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return toPublicUser(user, user.lawyer);
  }

  /**
   * POST /users/onboarding — upsert the caller's Lawyer profile, set the
   * User.fullName and mark onboarding complete. When `skip` is true only the
   * name is persisted so the user can finish later.
   */
  async onboarding(userId: string, dto: OnboardingDto): Promise<PublicUser> {
    const skip = dto.skip === true;

    const lawyerData = {
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      barCouncilId: skip ? null : dto.barCouncilId ?? null,
      experienceYears: skip ? null : dto.experienceYears ?? null,
      practiceAreas: skip ? [] : dto.practiceAreas ?? [],
      courts: skip ? [] : dto.courts ?? [],
      primaryCourtType: skip ? null : dto.primaryCourtType ?? null,
      city: skip ? null : dto.city ?? null,
      state: skip ? null : dto.state ?? null,
      bio: skip ? null : dto.bio ?? null,
    };

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.lawyer.upsert({
        where: { userId },
        create: { userId, ...lawyerData },
        update: lawyerData,
      });

      return tx.user.update({
        where: { id: userId },
        data: { fullName: dto.fullName, onboardingComplete: true },
        include: { lawyer: true },
      });
    });

    return toPublicUser(user, user.lawyer);
  }

  /** GET /users/profile — the caller's Lawyer profile. */
  async getProfile(lawyerId: string | null | undefined): Promise<LawyerProfileView> {
    return this.toLawyerProfileView(await this.requireLawyer(lawyerId));
  }

  /** PATCH /users/profile — update the caller's Lawyer profile. */
  async updateProfile(
    lawyerId: string | null | undefined,
    dto: UpdateProfileDto,
  ): Promise<LawyerProfileView> {
    const lawyer = await this.requireLawyer(lawyerId);

    const data: Prisma.LawyerUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.barCouncilId !== undefined) data.barCouncilId = dto.barCouncilId;
    if (dto.enrollmentYear !== undefined) data.enrollmentYear = dto.enrollmentYear;
    if (dto.experienceYears !== undefined) data.experienceYears = dto.experienceYears;
    if (dto.practiceAreas !== undefined) data.practiceAreas = dto.practiceAreas;
    if (dto.courts !== undefined) data.courts = dto.courts;
    if (dto.primaryCourtType !== undefined) data.primaryCourtType = dto.primaryCourtType;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.bio !== undefined) data.bio = dto.bio;

    const updated = await this.prisma.lawyer.update({ where: { id: lawyer.id }, data });
    return this.toLawyerProfileView(updated);
  }

  // --- helpers --------------------------------------------------------------

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');
  }

  /** Loads the caller's lawyer; enforces onboarding + existence. */
  private async requireLawyer(lawyerId: string | null | undefined): Promise<Lawyer> {
    if (!lawyerId) throw new BadRequestException('Complete onboarding first');
    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) throw new NotFoundException('Lawyer profile not found');
    return lawyer;
  }

  private toLawyerProfileView(lawyer: Lawyer): LawyerProfileView {
    return {
      id: lawyer.id,
      userId: lawyer.userId,
      fullName: lawyer.fullName,
      phone: lawyer.phone,
      barCouncilId: lawyer.barCouncilId,
      enrollmentYear: lawyer.enrollmentYear,
      experienceYears: lawyer.experienceYears,
      practiceAreas: lawyer.practiceAreas,
      courts: lawyer.courts,
      primaryCourtType: lawyer.primaryCourtType,
      city: lawyer.city,
      state: lawyer.state,
      bio: lawyer.bio,
      createdAt: lawyer.createdAt.toISOString(),
      updatedAt: lawyer.updatedAt.toISOString(),
    };
  }
}
