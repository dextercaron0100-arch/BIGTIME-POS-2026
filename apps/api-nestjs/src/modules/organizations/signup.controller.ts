import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { OrganizationsService } from './organizations.service';

const SIGNUP_TERMINAL_ID = 'dashboard-web-signup';

@Controller('organizations')
export class SignupController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly authService: AuthService,
  ) {}

  @Post('signup')
  @Public()
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  async signup(@Body() payload: SignupDto) {
    const { branchId, employeeCode } =
      await this.organizationsService.createOrganizationWithBranch(payload);
    const loginPayload: LoginDto = {
      branchId,
      terminalId: SIGNUP_TERMINAL_ID,
      employeeCode,
      pin: payload.pin,
    };
    return this.authService.login(loginPayload);
  }
}
