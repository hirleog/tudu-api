import { Test, TestingModule } from '@nestjs/testing';
import { ImagemController } from './imagem.controller';

describe('ImagemController', () => {
  let controller: ImagemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagemController],
    }).compile();

    controller = module.get<ImagemController>(ImagemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
