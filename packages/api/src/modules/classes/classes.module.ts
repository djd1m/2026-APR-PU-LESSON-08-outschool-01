import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassesRepository } from './classes.repository';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [ClassesController],
  providers: [ClassesService, ClassesRepository],
  exports: [ClassesService],
})
export class ClassesModule {}
