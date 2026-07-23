import { forwardRef, Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [forwardRef(() => OrganizationsModule)],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
