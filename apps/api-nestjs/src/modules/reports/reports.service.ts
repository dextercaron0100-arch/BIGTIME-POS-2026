import { Injectable } from '@nestjs/common';
import {
  cashBalancingRows,
  dashboardOverview,
  reportPoints,
} from '../../data/mock-data';
import { QueueRegistryService } from '../../queues/queue-registry.service';
import { GenerateEndOfDayReportDto } from './dto/generate-end-of-day-report.dto';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto';
import { PosLedgerService } from '../pos/pos-ledger.service';
import {
  assertBranchAllowed,
  isBranchAllowed,
} from '../../common/auth/branch-scope';

@Injectable()
export class ReportsService {
  constructor(
    private readonly queueRegistryService: QueueRegistryService,
    private readonly posLedgerService: PosLedgerService,
  ) {}

  getSalesTrend(_allowedBranchIds?: string[]) {
    void _allowedBranchIds;
    return reportPoints;
  }

  getBranchComparison(allowedBranchIds?: string[]) {
    return dashboardOverview.branches.filter((branch) =>
      isBranchAllowed(branch.id, allowedBranchIds),
    );
  }

  getQueueBlueprint() {
    return this.queueRegistryService.listQueues();
  }

  getCashBalancing(branchId?: string, allowedBranchIds?: string[]) {
    if (branchId && branchId !== 'all') {
      assertBranchAllowed(branchId, allowedBranchIds);
    }
    if (branchId && branchId !== 'all') {
      return cashBalancingRows.filter((row) => row.branchId === branchId);
    }
    return cashBalancingRows.filter((row) =>
      isBranchAllowed(row.branchId, allowedBranchIds),
    );
  }

  getSalesSummary(query: SalesSummaryQueryDto, allowedBranchIds?: string[]) {
    assertBranchAllowed(query.branchId, allowedBranchIds);
    return this.posLedgerService.getSalesSummary(query);
  }

  getEndOfDayReport(query: SalesSummaryQueryDto, allowedBranchIds?: string[]) {
    assertBranchAllowed(query.branchId, allowedBranchIds);
    return this.posLedgerService.getEndOfDayReport(query);
  }

  generateEndOfDayReport(
    payload: GenerateEndOfDayReportDto,
    allowedBranchIds?: string[],
  ) {
    assertBranchAllowed(payload.branchId, allowedBranchIds);
    return this.posLedgerService.generateEndOfDayReport(payload);
  }
}
