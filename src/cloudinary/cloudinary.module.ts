import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService], // ← necessário para outros módulos utilizarem
})
export class CloudinaryModule {}
