// src/malga/malga.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MalgaService } from './service/malga.service';
import { MalgaController } from './controller/malga.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [MalgaService],
  controllers: [MalgaController],
  exports: [MalgaService],
})
export class MalgaModule {}
