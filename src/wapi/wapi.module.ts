import { Module } from '@nestjs/common';
import { WApiController } from './controller/wapi.controller';
import { WApiService } from './service/wapi.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [WApiController],
  providers: [WApiService],
  exports: [WApiService],
})
export class WApiModule {}
