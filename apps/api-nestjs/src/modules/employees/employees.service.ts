import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeSummary, UserRole } from '@apex-pos/shared-types';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  catalogCategories,
  catalogItems,
  employeeSummaries,
} from '../../data/mock-data';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';

export type ManagedBranch = {
  id: string;
  name: string;
  createdAt: string;
};

export type ManagedUser = {
  id: string;
  branchId: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  pinHash: string;
  createdAt: string;
};

export type ManagedUserView = Omit<ManagedUser, 'pinHash'>;

export type EmployeesAdminAuditLogRecord = {
  id: string;
  action:
    | 'BRANCH_CREATED'
    | 'BRANCH_DELETED'
    | 'USER_CREATED'
    | 'USER_STATUS_UPDATED';
  actorUserId?: string;
  targetType: 'branch' | 'user';
  targetId: string;
  branchId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

type EmployeesAdminStore = {
  branches: ManagedBranch[];
  users: ManagedUser[];
  auditLog: EmployeesAdminAuditLogRecord[];
};

const employeesAdminStorePath = resolveEmployeesAdminStorePath();
const demoEmployeeCodes = new Set([
  'ADM001',
  'SUP001',
  'CSH101',
  'MNL101',
  'CEB201',
  'DVO301',
  'DVO302',
]);

const builtInBranchNames: Record<string, string> = {
  'branch-manila': 'CALAMBA BANGA',
  'branch-cebu': 'Cebu',
  'branch-davao': 'Davao',
};

function resolveEmployeesAdminStorePath() {
  const cwd = process.cwd();
  if (cwd.endsWith(join('apps', 'api-nestjs'))) {
    return join(cwd, 'storage', 'employees-admin.json');
  }

  return join(cwd, 'apps', 'api-nestjs', 'storage', 'employees-admin.json');
}

function normalizeBranchId(value: string) {
  return value.trim().toLowerCase();
}

function branchIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `branch-${slug}` : 'branch-custom';
}

function buildKnownBranchIds() {
  return new Set<string>([
    ...Object.keys(builtInBranchNames),
    ...employeeSummaries.map((employee) =>
      normalizeBranchId(employee.branchId),
    ),
    ...catalogCategories.map((category) =>
      normalizeBranchId(category.branchId),
    ),
    ...catalogItems.map((item) => normalizeBranchId(item.branchId)),
  ]);
}

function defaultStore(): EmployeesAdminStore {
  return {
    branches: [],
    users: [],
    auditLog: [],
  };
}

@Injectable()
export class EmployeesService {
  private writeQueue = Promise.resolve();

  async listEmployees(
    branchId?: string,
    allowedBranchIds?: string[],
  ): Promise<EmployeeSummary[]> {
    const normalizedBranchId = branchId
      ? normalizeBranchId(branchId)
      : undefined;
    this.assertBranchAllowed(normalizedBranchId, allowedBranchIds);
    const allowedBranches = this.normalizeAllowedBranchIds(allowedBranchIds);
    const staticEmployees = employeeSummaries.filter(
      (employee) =>
        (!normalizedBranchId || employee.branchId === normalizedBranchId) &&
        (!allowedBranches || allowedBranches.has(employee.branchId)),
    );
    const managedUsers = await this.listManagedUsers(
      normalizedBranchId,
      allowedBranchIds,
    );
    const managedEmployees: EmployeeSummary[] = managedUsers.map(
      (user: ManagedUserView) => ({
        id: user.id,
        branchId: user.branchId,
        fullName: user.name,
        position: this.roleToPosition(user.role),
        hoursThisWeek: 0,
        rate: 0,
      }),
    );

    return [...staticEmployees, ...managedEmployees];
  }

  async getWorkHours(branchId?: string, allowedBranchIds?: string[]) {
    const employees = await this.listEmployees(branchId, allowedBranchIds);
    return employees.map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.fullName,
      hoursThisWeek: employee.hoursThisWeek,
      projectedPayroll: employee.hoursThisWeek * employee.rate,
    }));
  }

  async listBranches(allowedBranchIds?: string[]): Promise<ManagedBranch[]> {
    const store = await this.readStore();
    const allowedBranches = this.normalizeAllowedBranchIds(allowedBranchIds);
    return store.branches
      .filter((branch) => !allowedBranches || allowedBranches.has(branch.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async createBranch(payload: CreateBranchDto) {
    return this.createBranchWithActor(payload);
  }

  async createBranchWithActor(payload: CreateBranchDto, actorUserId?: string) {
    const name = payload.name.trim();
    const candidateId = payload.id?.trim()
      ? payload.id.trim().toLowerCase()
      : branchIdFromName(name);
    const branchId = normalizeBranchId(candidateId);

    if (!branchId.startsWith('branch-')) {
      throw new BadRequestException('Branch id must start with "branch-".');
    }

    return this.mutateStore((store) => {
      const exists = this.isKnownBranchId(branchId, store);
      if (exists) {
        throw new BadRequestException('Branch id already exists.');
      }

      const branch: ManagedBranch = {
        id: branchId,
        name,
        createdAt: new Date().toISOString(),
      };
      store.branches.push(branch);
      this.appendAdminAudit(store, {
        action: 'BRANCH_CREATED',
        actorUserId,
        targetType: 'branch',
        targetId: branch.id,
        branchId: branch.id,
        details: {
          name: branch.name,
        },
      });
      return branch;
    });
  }

  async deleteBranchWithActor(branchId: string, actorUserId?: string) {
    const normalizedBranchId = normalizeBranchId(branchId);

    return this.mutateStore((store) => {
      const branch = store.branches.find(
        (candidate) => candidate.id === normalizedBranchId,
      );
      if (!branch) {
        throw new NotFoundException(
          `Branch "${normalizedBranchId}" does not exist.`,
        );
      }

      store.branches = store.branches.filter(
        (candidate) => candidate.id !== normalizedBranchId,
      );
      this.appendAdminAudit(store, {
        action: 'BRANCH_DELETED',
        actorUserId,
        targetType: 'branch',
        targetId: branch.id,
        branchId: branch.id,
        details: {
          name: branch.name,
        },
      });

      return {
        id: branch.id,
        name: branch.name,
      };
    });
  }

  async listManagedUsers(
    branchId?: string,
    allowedBranchIds?: string[],
  ): Promise<ManagedUserView[]> {
    const store = await this.readStore();
    const normalizedBranchId = branchId
      ? normalizeBranchId(branchId)
      : undefined;
    this.assertBranchAllowed(normalizedBranchId, allowedBranchIds);
    const allowedBranches = this.normalizeAllowedBranchIds(allowedBranchIds);
    const rows: ManagedUser[] = store.users.filter(
      (user) =>
        (!normalizedBranchId || user.branchId === normalizedBranchId) &&
        (!allowedBranches || allowedBranches.has(user.branchId)),
    );
    return rows
      .map((user: ManagedUser) => this.toManagedUserView(user))
      .sort((left, right) =>
        left.employeeCode.localeCompare(right.employeeCode),
      );
  }

  async createManagedUser(payload: CreateManagedUserDto) {
    return this.createManagedUserWithActor(payload);
  }

  async createManagedUserWithActor(
    payload: CreateManagedUserDto,
    actorUserId?: string,
    allowedBranchIds?: string[],
  ) {
    const branchId = normalizeBranchId(payload.branchId);
    this.assertBranchAllowed(branchId, allowedBranchIds);
    const employeeCode = payload.employeeCode.trim().toUpperCase();
    const name = payload.name.trim();
    const role = payload.role;
    const isActive = payload.isActive ?? true;

    if (demoEmployeeCodes.has(employeeCode)) {
      throw new BadRequestException(
        'Employee code is reserved by a built-in account.',
      );
    }

    return this.mutateStore(async (store) => {
      const branchExists = this.isKnownBranchId(branchId, store);
      if (!branchExists) {
        throw new NotFoundException(`Branch "${branchId}" does not exist.`);
      }

      const duplicate = store.users.some(
        (user) =>
          user.branchId === branchId && user.employeeCode === employeeCode,
      );
      if (duplicate) {
        throw new BadRequestException(
          'Employee code already exists for this branch.',
        );
      }

      const user: ManagedUser = {
        id: `user-managed-${randomUUID()}`,
        branchId,
        employeeCode,
        name,
        role,
        isActive,
        pinHash: await hash(payload.pin, 10),
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
      this.appendAdminAudit(store, {
        action: 'USER_CREATED',
        actorUserId,
        targetType: 'user',
        targetId: user.id,
        branchId: user.branchId,
        details: {
          employeeCode: user.employeeCode,
          name: user.name,
          role: user.role,
        },
      });
      return this.toManagedUserView(user);
    });
  }

  async updateManagedUserStatusWithActor(
    userId: string,
    isActive: boolean,
    actorUserId?: string,
    allowedBranchIds?: string[],
  ) {
    return this.mutateStore((store) => {
      const user = store.users.find((candidate) => candidate.id === userId);
      if (!user) {
        throw new NotFoundException(`POS user "${userId}" does not exist.`);
      }
      this.assertBranchAllowed(user.branchId, allowedBranchIds);

      user.isActive = isActive;
      this.appendAdminAudit(store, {
        action: 'USER_STATUS_UPDATED',
        actorUserId,
        targetType: 'user',
        targetId: user.id,
        branchId: user.branchId,
        details: {
          employeeCode: user.employeeCode,
          name: user.name,
          isActive,
        },
      });

      return this.toManagedUserView(user);
    });
  }

  async listAdminAuditLog(limit = 200, allowedBranchIds?: string[]) {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const store = await this.readStore();
    const allowedBranches = this.normalizeAllowedBranchIds(allowedBranchIds);
    return store.auditLog
      .filter(
        (record) => !allowedBranches || allowedBranches.has(record.branchId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, safeLimit);
  }

  async findManagedUser(branchId: string, employeeCode: string) {
    const store = await this.readStore();
    const normalizedBranchId = normalizeBranchId(branchId);
    const normalizedEmployeeCode = employeeCode.trim().toUpperCase();
    const user = store.users.find(
      (candidate) =>
        candidate.branchId === normalizedBranchId &&
        candidate.employeeCode === normalizedEmployeeCode,
    );
    return user ?? null;
  }

  async resolveManagedUserForLogin(branchId: string, employeeCode: string) {
    const store = await this.readStore();
    const normalizedBranchId = normalizeBranchId(branchId);
    const normalizedEmployeeCode = employeeCode.trim().toUpperCase();
    const exactMatch = store.users.find(
      (candidate) =>
        candidate.branchId === normalizedBranchId &&
        candidate.employeeCode === normalizedEmployeeCode,
    );

    if (exactMatch) {
      return exactMatch;
    }

    return null;
  }

  private normalizeAllowedBranchIds(allowedBranchIds?: string[]) {
    if (!allowedBranchIds) {
      return undefined;
    }

    return new Set(allowedBranchIds.map(normalizeBranchId));
  }

  private assertBranchAllowed(
    branchId: string | undefined,
    allowedBranchIds?: string[],
  ) {
    if (!branchId || !allowedBranchIds) {
      return;
    }

    const allowedBranches = this.normalizeAllowedBranchIds(allowedBranchIds);
    if (!allowedBranches?.has(normalizeBranchId(branchId))) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
  }

  async removeManagedUserByIdentity(branchId: string, employeeCode: string) {
    return this.mutateStore((store) => {
      const normalizedBranchId = normalizeBranchId(branchId);
      const normalizedEmployeeCode = employeeCode.trim().toUpperCase();
      const nextUsers = store.users.filter(
        (candidate) =>
          !(
            candidate.branchId === normalizedBranchId &&
            candidate.employeeCode === normalizedEmployeeCode
          ),
      );

      const removedCount = store.users.length - nextUsers.length;
      store.users = nextUsers;
      return removedCount;
    });
  }

  async resetManagementData() {
    return this.mutateStore((store) => {
      const nextStore = defaultStore();
      const branchCountBefore = store.branches.length;
      const userCountBefore = store.users.length;
      const auditCountBefore = store.auditLog.length;

      store.branches = nextStore.branches;
      store.users = nextStore.users;
      store.auditLog = nextStore.auditLog;

      return {
        branchCountBefore,
        userCountBefore,
        auditCountBefore,
        branchCountAfter: store.branches.length,
      };
    });
  }

  private toManagedUserView(user: ManagedUser): ManagedUserView {
    return {
      id: user.id,
      branchId: user.branchId,
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private roleToPosition(role: UserRole) {
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'SUPERVISOR':
        return 'Supervisor';
      case 'CASHIER':
        return 'Cashier';
      case 'INVENTORY':
        return 'Inventory';
      case 'AUDITOR':
        return 'Auditor';
      default:
        return 'Employee';
    }
  }

  private async mutateStore<T>(
    mutation: (store: EmployeesAdminStore) => Promise<T> | T,
  ): Promise<T> {
    const runMutation = async () => {
      const store = await this.readStore();
      const nextStore = structuredClone(store);
      const result = await mutation(nextStore);
      await this.writeStore(nextStore);
      return result;
    };

    const pending = this.writeQueue.then(runMutation, runMutation);
    this.writeQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private async readStore(): Promise<EmployeesAdminStore> {
    await this.ensureStoreFile();
    const raw = await readFile(employeesAdminStorePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<EmployeesAdminStore> | null;
    if (!parsed || typeof parsed !== 'object') {
      return defaultStore();
    }

    const branches = Array.isArray(parsed.branches)
      ? parsed.branches
          .filter(
            (branch): branch is ManagedBranch =>
              typeof branch?.id === 'string' &&
              branch.id.length > 0 &&
              typeof branch?.name === 'string' &&
              branch.name.length > 0 &&
              typeof branch?.createdAt === 'string',
          )
          .map((branch) => ({
            id: normalizeBranchId(branch.id),
            name: branch.name,
            createdAt: branch.createdAt,
          }))
      : [];
    const users = Array.isArray(parsed.users)
      ? parsed.users
          .filter(
            (user): user is ManagedUser =>
              typeof user?.id === 'string' &&
              typeof user?.branchId === 'string' &&
              typeof user?.employeeCode === 'string' &&
              typeof user?.name === 'string' &&
              typeof user?.role === 'string' &&
              typeof user?.pinHash === 'string' &&
              typeof user?.createdAt === 'string',
          )
          .map((user) => ({
            id: user.id,
            branchId: normalizeBranchId(user.branchId),
            employeeCode: user.employeeCode.toUpperCase(),
            name: user.name,
            role: user.role,
            isActive: typeof user.isActive === 'boolean' ? user.isActive : true,
            pinHash: user.pinHash,
            createdAt: user.createdAt,
          }))
      : [];

    const dedupedBranches = new Map<string, ManagedBranch>();
    for (const branch of branches) {
      dedupedBranches.set(branch.id, branch);
    }

    return {
      branches: Array.from(dedupedBranches.values()),
      users,
      auditLog: Array.isArray(parsed.auditLog)
        ? parsed.auditLog
            .filter(
              (entry): entry is EmployeesAdminAuditLogRecord =>
                typeof entry?.id === 'string' &&
                typeof entry?.action === 'string' &&
                typeof entry?.targetType === 'string' &&
                typeof entry?.targetId === 'string' &&
                typeof entry?.branchId === 'string' &&
                typeof entry?.createdAt === 'string' &&
                !!entry?.details &&
                typeof entry.details === 'object',
            )
            .map((entry) => ({
              id: entry.id,
              action: entry.action,
              actorUserId: entry.actorUserId,
              targetType: entry.targetType,
              targetId: entry.targetId,
              branchId: normalizeBranchId(entry.branchId),
              details: entry.details,
              createdAt: entry.createdAt,
            }))
        : [],
    };
  }

  private async writeStore(store: EmployeesAdminStore) {
    await writeFile(
      employeesAdminStorePath,
      JSON.stringify(store, null, 2),
      'utf-8',
    );
  }

  private async ensureStoreFile() {
    await mkdir(dirname(employeesAdminStorePath), { recursive: true });
    try {
      await readFile(employeesAdminStorePath, 'utf-8');
    } catch {
      await this.writeStore(defaultStore());
    }
  }

  private appendAdminAudit(
    store: EmployeesAdminStore,
    entry: Omit<EmployeesAdminAuditLogRecord, 'id' | 'createdAt'>,
  ) {
    store.auditLog.push({
      id: `audit-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    });
  }

  private isKnownBranchId(branchId: string, store: EmployeesAdminStore) {
    if (store.branches.some((branch) => branch.id === branchId)) {
      return true;
    }

    return buildKnownBranchIds().has(branchId);
  }
}
