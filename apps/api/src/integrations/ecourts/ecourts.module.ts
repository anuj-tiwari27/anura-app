import { Global, Module } from '@nestjs/common';
import { EcourtsService } from './ecourts.service';

@Global()
@Module({
  providers: [EcourtsService],
  exports: [EcourtsService],
})
export class EcourtsModule {}
