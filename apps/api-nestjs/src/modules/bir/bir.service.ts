import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { EisSubmissionService } from '../eis/eis-submission.service';
import { GenerateZReadingDto } from './dto/generate-z-reading.dto';
import { ReadingSummaryQueryDto } from './dto/reading-summary-query.dto';
import { UpdateBirSettingsDto } from './dto/update-bir-settings.dto';
import { BirSettingsService } from './bir-settings.service';
import { PosLedgerService } from '../pos/pos-ledger.service';
import { assertBranchAllowed } from '../../common/auth/branch-scope';

@Injectable()
export class BirService {
  constructor(
    private readonly posLedgerService: PosLedgerService,
    private readonly eisSubmissionService: EisSubmissionService,
    private readonly birSettingsService: BirSettingsService,
  ) {}

  getSettings(branchId: string, allowedBranchIds?: string[]) {
    const normalizedBranchId = assertBranchAllowed(branchId, allowedBranchIds);
    return this.birSettingsService.getSettings(normalizedBranchId);
  }

  updateSettings(
    branchId: string,
    payload: UpdateBirSettingsDto,
    allowedBranchIds?: string[],
  ) {
    const normalizedBranchId = assertBranchAllowed(branchId, allowedBranchIds);
    return this.birSettingsService.updateSettings(normalizedBranchId, payload);
  }

  listReadings(
    terminalId?: string,
    date?: string,
    allowedBranchIds?: string[],
  ) {
    return this.posLedgerService.listZReadings(
      terminalId,
      date,
      allowedBranchIds,
    );
  }

  generateZReading(payload: GenerateZReadingDto, allowedBranchIds?: string[]) {
    assertBranchAllowed(payload.branchId, allowedBranchIds);
    return this.posLedgerService.generateZReading(payload);
  }

  getXReading(query: ReadingSummaryQueryDto, allowedBranchIds?: string[]) {
    assertBranchAllowed(query.branchId, allowedBranchIds);
    return this.posLedgerService.getXReading(query);
  }

  getZReadingSummary(
    query: ReadingSummaryQueryDto,
    allowedBranchIds?: string[],
  ) {
    assertBranchAllowed(query.branchId, allowedBranchIds);
    return this.posLedgerService.getLatestZReadingSummary(query);
  }

  listEisSubmissions(
    params?: {
      branchId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    },
    allowedBranchIds?: string[],
  ) {
    return this.eisSubmissionService.listSubmissions(
      {
        branchId: params?.branchId,
        status: params?.status,
        page: this.toPositiveInt(params?.page, 1),
        pageSize: this.toPositiveInt(params?.pageSize, 25),
      },
      allowedBranchIds,
    );
  }

  getEisSummary(
    params?: {
      branchId?: string;
      fromDate?: string;
      toDate?: string;
    },
    allowedBranchIds?: string[],
  ) {
    return this.eisSubmissionService.getSubmissionSummary(
      {
        branchId: params?.branchId,
        fromDate: params?.fromDate,
        toDate: params?.toDate,
      },
      allowedBranchIds,
    );
  }

  flushEisQueue(
    payload?: { branchId?: string; maxItems?: number },
    allowedBranchIds?: string[],
  ) {
    if (!payload?.branchId) {
      throw new BadRequestException(
        'branchId is required to flush the EIS queue.',
      );
    }
    const branchId = assertBranchAllowed(payload.branchId, allowedBranchIds);
    return this.eisSubmissionService.processPendingQueue({
      branchId,
      maxItems:
        typeof payload?.maxItems === 'number' && payload.maxItems > 0
          ? Math.floor(payload.maxItems)
          : undefined,
    });
  }

  retryEisSubmission(submissionId: string, allowedBranchIds?: string[]) {
    return this.eisSubmissionService.retrySubmission(
      submissionId,
      allowedBranchIds,
    );
  }

  private toPositiveInt(raw: string | undefined, fallback: number) {
    if (!raw || raw.trim().length === 0) {
      return fallback;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 1) {
      throw new BadRequestException(
        'Page and pageSize must be positive integers.',
      );
    }
    return Math.floor(parsed);
  }
}
