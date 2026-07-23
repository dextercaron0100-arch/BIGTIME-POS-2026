import { Module } from '@nestjs/common';
import { AuthSessionsModule } from '../auth/auth-sessions.module';
import { EmployeesModule } from '../employees/employees.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [AuthSessionsModule, EmployeesModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
