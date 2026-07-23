import { forwardRef, Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [forwardRef(() => EmployeesModule)],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
