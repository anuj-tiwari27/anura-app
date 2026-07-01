import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import type { LawyerProfileView, PublicUser } from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser('sub') userId: string): Promise<PublicUser> {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateMeDto): Promise<PublicUser> {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('onboarding')
  onboarding(@CurrentUser('sub') userId: string, @Body() dto: OnboardingDto): Promise<PublicUser> {
    return this.usersService.onboarding(userId, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser('lawyerId') lawyerId: string | null): Promise<LawyerProfileView> {
    return this.usersService.getProfile(lawyerId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Body() dto: UpdateProfileDto,
  ): Promise<LawyerProfileView> {
    return this.usersService.updateProfile(lawyerId, dto);
  }
}
