import { ForbiddenException } from '@nestjs/common';
import {
  assertBranchAllowed,
  isBranchAllowed,
  normalizeBranchId,
} from './branch-scope';

describe('branch scope', () => {
  const allowedBranches = ['branch-manila', 'branch-cebu'];

  it('normalizes and accepts an owned branch', () => {
    expect(assertBranchAllowed(' BRANCH-MANILA ', allowedBranches)).toBe(
      'branch-manila',
    );
  });

  it('rejects a branch owned by another organization', () => {
    expect(() => assertBranchAllowed('branch-davao', allowedBranches)).toThrow(
      ForbiddenException,
    );
  });

  it('filters records outside the owned branch set', () => {
    expect(isBranchAllowed('branch-cebu', allowedBranches)).toBe(true);
    expect(isBranchAllowed('branch-davao', allowedBranches)).toBe(false);
    expect(normalizeBranchId(' Branch-Cebu ')).toBe('branch-cebu');
  });
});
