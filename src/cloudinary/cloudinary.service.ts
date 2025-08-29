// src/common/cloudinary/cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get('CLOUDINARY_API_KEY'),
      api_secret: configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  uploadCardAssets(buffer: Buffer, filename: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'cards-assets', // opcional: cria uma pasta "cards"
          public_id: filename.replace(/\.[^/.]+$/, ''), // tira a extensão
          resource_type: 'image',
          format: 'webp',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }
  uploadProfilePrestadorImg(buffer: Buffer, filename: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'prestadores-assets', // opcional: cria uma pasta "prestadores"
          public_id: filename.replace(/\.[^/.]+$/, ''), // tira a extensão
          resource_type: 'image',
          format: 'webp',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
