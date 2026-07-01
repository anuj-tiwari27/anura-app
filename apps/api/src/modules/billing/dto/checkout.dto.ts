import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@anura/shared';

export class CheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}
