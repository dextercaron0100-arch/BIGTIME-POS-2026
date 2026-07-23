import type { UserRole } from '@apex-pos/shared-types';

export type AuthenticatedUser = {
  id: string;
  branchId: string;
  sessionId?: string;
  terminalId?: string;
  employeeCode?: string;
  name?: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};
