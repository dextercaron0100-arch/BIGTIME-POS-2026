import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from './organizations.module';
import { SignupController } from './signup.controller';

@Module({
  imports: [OrganizationsModule, AuthModule],
  controllers: [SignupController],
})
export class SignupModule {}
