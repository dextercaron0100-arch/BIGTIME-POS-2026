import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { EmployeesService } from '../employees/employees.service';
import { SignupDto } from './dto/signup.dto';

export type OrganizationStatus = 'TRIAL' | 'EXPIRED' | 'SUSPENDED';

export type Organization = {
  id: string;
  name: string;
  ownerEmail: string;
  branchIds: string[];
  status: OrganizationStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  createdAt: string;
};

export type OrganizationTrialState =
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'SUSPENDED';

type OrganizationsStore = {
  version: 1;
  organizations: Organization[];
  lastUpdatedAt: string;
};

const TRIAL_DURATION_DAYS = 30;
const LEGACY_DEMO_ORG_ID = 'org-legacy-demo';

@Injectable()
export class OrganizationsService {
  private readonly storageFilePath = this.resolveStorageFilePath();
  private writeQueue = Promise.resolve();

  constructor(private readonly employeesService: EmployeesService) {}

  async findByBranchId(branchId: string): Promise<Organization | undefined> {
    const normalized = branchId.trim().toLowerCase();
    const organizations = await this.getEffectiveOrganizations();
    return organizations.find((org) => org.branchIds.includes(normalized));
  }

  async findById(id: string): Promise<Organization | undefined> {
    const organizations = await this.getEffectiveOrganizations();
    return organizations.find((org) => org.id === id);
  }

  async addBranchToOrganization(ownerBranchId: string, branchId: string) {
    const normalizedOwnerBranchId = ownerBranchId.trim().toLowerCase();
    const normalizedBranchId = branchId.trim().toLowerCase();

    await this.mutateStore((store) => {
      const owner = store.organizations.find((organization) =>
        organization.branchIds.includes(normalizedOwnerBranchId),
      );
      if (!owner) {
        throw new ForbiddenException(
          'The authenticated branch is not assigned to an organization.',
        );
      }

      const existingOwner = store.organizations.find((organization) =>
        organization.branchIds.includes(normalizedBranchId),
      );
      if (existingOwner && existingOwner.id !== owner.id) {
        throw new BadRequestException(
          'The branch is already assigned to another organization.',
        );
      }

      if (!owner.branchIds.includes(normalizedBranchId)) {
        owner.branchIds.push(normalizedBranchId);
      }
    });
  }

  async assertCanRemoveBranch(ownerBranchId: string, branchId: string) {
    const normalizedOwnerBranchId = ownerBranchId.trim().toLowerCase();
    const normalizedBranchId = branchId.trim().toLowerCase();
    const organization = await this.findByBranchId(normalizedOwnerBranchId);

    if (!organization?.branchIds.includes(normalizedBranchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
    if (normalizedBranchId === normalizedOwnerBranchId) {
      throw new BadRequestException(
        'You cannot delete the branch used by your current session.',
      );
    }
    if (organization.branchIds.length <= 1) {
      throw new BadRequestException(
        'An organization must retain at least one branch.',
      );
    }
  }

  async removeBranchFromOrganization(ownerBranchId: string, branchId: string) {
    const normalizedOwnerBranchId = ownerBranchId.trim().toLowerCase();
    const normalizedBranchId = branchId.trim().toLowerCase();

    await this.mutateStore((store) => {
      const owner = store.organizations.find((organization) =>
        organization.branchIds.includes(normalizedOwnerBranchId),
      );
      if (!owner) {
        throw new NotFoundException('Organization does not exist.');
      }
      owner.branchIds = owner.branchIds.filter(
        (candidate) => candidate !== normalizedBranchId,
      );
    });
  }

  /**
   * Branches created before organizations existed (or via the branch-management
   * screen, outside the signup flow) aren't listed in any organization's
   * branchIds. Fold any such "unclaimed" managed branch into the legacy demo
   * org so existing multi-branch accounts keep working, while branches
   * explicitly owned by a real signed-up organization stay isolated.
   */
  private async getEffectiveOrganizations(): Promise<Organization[]> {
    const store = await this.readStore();
    const claimedByOthers = new Set(
      store.organizations
        .filter((org) => org.id !== LEGACY_DEMO_ORG_ID)
        .flatMap((org) => org.branchIds),
    );

    const managedBranches = await this.employeesService.listBranches();
    const unclaimedManagedBranchIds = managedBranches
      .map((branch) => branch.id)
      .filter((id) => !claimedByOthers.has(id));

    return store.organizations.map((org) => {
      if (org.id !== LEGACY_DEMO_ORG_ID) {
        return org;
      }

      return {
        ...org,
        branchIds: Array.from(
          new Set([...org.branchIds, ...unclaimedManagedBranchIds]),
        ),
      };
    });
  }

  getTrialState(org: Organization): OrganizationTrialState {
    if (org.status === 'SUSPENDED') {
      return 'SUSPENDED';
    }
    if (new Date(org.trialEndsAt).getTime() < Date.now()) {
      return 'TRIAL_EXPIRED';
    }
    return 'TRIAL_ACTIVE';
  }

  describeOrganization(org: Organization) {
    const trialState = this.getTrialState(org);
    const msRemaining = Math.max(
      0,
      new Date(org.trialEndsAt).getTime() - Date.now(),
    );
    return {
      id: org.id,
      name: org.name,
      status: org.status,
      trialState,
      trialStartedAt: org.trialStartedAt,
      trialEndsAt: org.trialEndsAt,
      daysRemaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    };
  }

  async createOrganizationWithBranch(payload: SignupDto) {
    const businessName = payload.businessName.trim();
    const ownerName = payload.ownerName.trim();

    const branch = await this.employeesService.createBranchWithActor(
      { name: businessName },
      'system-signup',
    );

    const managedUser = await this.employeesService.createManagedUserWithActor(
      {
        branchId: branch.id,
        employeeCode: payload.employeeCode,
        name: ownerName,
        role: 'ADMIN',
        pin: payload.pin,
        isActive: true,
      },
      'system-signup',
    );

    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    const organization: Organization = {
      id: `org-${randomUUID()}`,
      name: businessName,
      ownerEmail: payload.ownerEmail.trim().toLowerCase(),
      branchIds: [branch.id],
      status: 'TRIAL',
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      createdAt: now.toISOString(),
    };

    await this.mutateStore((store) => {
      store.organizations.push(organization);
    });

    return {
      organization,
      branchId: branch.id,
      employeeCode: managedUser.employeeCode,
    };
  }

  private async mutateStore(
    mutator: (store: OrganizationsStore) => Promise<void> | void,
  ): Promise<void> {
    const runMutation = async () => {
      const store = await this.readStore();
      await mutator(store);
      store.lastUpdatedAt = new Date().toISOString();
      await this.writeStore(store);
    };

    const next = this.writeQueue.then(runMutation, runMutation);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );

    await next;
  }

  private resolveStorageFilePath() {
    if (process.env.ORGANIZATIONS_STORAGE_FILE) {
      return process.env.ORGANIZATIONS_STORAGE_FILE;
    }

    const cwd = process.cwd();
    if (cwd.endsWith(join('apps', 'api-nestjs'))) {
      return join(cwd, 'storage', 'organizations.json');
    }

    return join(cwd, 'apps', 'api-nestjs', 'storage', 'organizations.json');
  }

  private buildLegacyDemoOrg(): Organization {
    const farPast = new Date('2020-01-01T00:00:00.000Z').toISOString();
    const farFuture = new Date('2099-01-01T00:00:00.000Z').toISOString();
    return {
      id: LEGACY_DEMO_ORG_ID,
      name: 'BIGTIME Demo',
      ownerEmail: 'demo@bigtime.pos',
      branchIds: ['branch-manila', 'branch-cebu', 'branch-davao'],
      status: 'TRIAL',
      trialStartedAt: farPast,
      trialEndsAt: farFuture,
      createdAt: farPast,
    };
  }

  private async readStore(): Promise<OrganizationsStore> {
    await this.ensureStoreFile();
    const content = await readFile(this.storageFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<OrganizationsStore>;

    return {
      version: 1,
      organizations: Array.isArray(parsed.organizations)
        ? parsed.organizations
        : [this.buildLegacyDemoOrg()],
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  private async writeStore(store: OrganizationsStore) {
    await mkdir(dirname(this.storageFilePath), { recursive: true });
    const tempPath = `${this.storageFilePath}.tmp`;
    const payload = `${JSON.stringify(store, null, 2)}\n`;

    await writeFile(tempPath, payload, 'utf8');
    try {
      await rename(tempPath, this.storageFilePath);
    } catch (error) {
      if (!this.isAtomicWriteRetryable(error)) {
        throw error;
      }

      // OneDrive and other sync tools can briefly block atomic renames on Windows.
      await writeFile(this.storageFilePath, payload, 'utf8');
      await this.removeTempFile(tempPath);
    }
  }

  private async ensureStoreFile() {
    try {
      await stat(this.storageFilePath);
    } catch {
      const seedStore: OrganizationsStore = {
        version: 1,
        organizations: [this.buildLegacyDemoOrg()],
        lastUpdatedAt: new Date().toISOString(),
      };
      await mkdir(dirname(this.storageFilePath), { recursive: true });
      await writeFile(
        this.storageFilePath,
        `${JSON.stringify(seedStore, null, 2)}\n`,
        'utf8',
      );
    }
  }

  private isAtomicWriteRetryable(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const code =
      'code' in error ? String((error as { code?: unknown }).code) : '';
    return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
  }

  private async removeTempFile(tempPath: string) {
    try {
      await unlink(tempPath);
    } catch {
      // Best effort cleanup only.
    }
  }
}
