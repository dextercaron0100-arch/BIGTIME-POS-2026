import { ForbiddenException } from '@nestjs/common';

export function normalizeBranchId(branchId: string) {
  return branchId.trim().toLowerCase();
}

export function toAllowedBranchSet(allowedBranchIds?: string[]) {
  if (!allowedBranchIds) {
    return undefined;
  }

  return new Set(allowedBranchIds.map(normalizeBranchId));
}

export function assertBranchAllowed(
  branchId: string,
  allowedBranchIds?: string[],
) {
  const normalizedBranchId = normalizeBranchId(branchId);
  const allowedBranches = toAllowedBranchSet(allowedBranchIds);
  if (allowedBranches && !allowedBranches.has(normalizedBranchId)) {
    throw new ForbiddenException('You do not have access to this branch.');
  }

  return normalizedBranchId;
}

export function isBranchAllowed(branchId: string, allowedBranchIds?: string[]) {
  const allowedBranches = toAllowedBranchSet(allowedBranchIds);
  return !allowedBranches || allowedBranches.has(normalizeBranchId(branchId));
}
