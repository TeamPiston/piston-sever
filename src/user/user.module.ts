import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './application/user.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  exports: [UserService],
})
/**
 * User 엔티티에 대한 TypeORM 리포지토리를 등록하고 UserService를 외부로 공개하는 모듈.
 */
export class UserModule {}
