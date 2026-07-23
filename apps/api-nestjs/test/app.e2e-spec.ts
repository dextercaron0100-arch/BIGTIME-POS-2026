import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from './../src/app.module';

type HealthResponse = {
  status: string;
};

type TransactionResponse = {
  id: string;
  orNumber: number;
  status: string;
  type: string;
};

type TransactionListResponse = {
  total: number;
};

type SalesSummaryResponse = {
  salesCount: number;
  voidCount: number;
  refundCount: number;
  netSales: number;
};

type EndOfDayResponse = {
  summary: {
    voidCount: number;
  };
};

type XReadingResponse = {
  type: string;
};

type ZReadingResponse = {
  zNumber: number;
};

type AuditTrailResponse = {
  total: number;
};

type StorageStatusResponse = {
  mode: string;
  counts: {
    transactions: number;
  };
};

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;
  let ledgerFilePath: string;
  let accessToken: string;

  beforeEach(async () => {
    ledgerFilePath = join(
      tmpdir(),
      `bigtime-pos-ledger-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );
    process.env.POS_LEDGER_FILE = ledgerFilePath;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    accessToken = await app.get(JwtService).signAsync({
      sub: 'e2e-admin',
      branchId: 'branch-test',
      terminalId: 'terminal-01',
      employeeCode: 'ADM001',
      role: 'ADMIN',
    });
  });

  afterEach(async () => {
    await app.close();
    await rm(ledgerFilePath, { force: true });
  });

  it('/api/health (GET)', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/health');
    const body = response.body as HealthResponse;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('records sales, voids, refunds, summaries, audit trail, and storage', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const branchId = 'branch-test';
    const terminalId = 'terminal-01';
    const cashierId = 'cashier-01';
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replaceAll('/', '-');

    const saleResponse = await request(server)
      .post('/api/pos/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        cashierId,
        customerName: 'Walk-in Customer',
        discountAmount: 20,
        items: [
          {
            itemId: 'item-burger',
            quantity: 2,
            unitPrice: 120,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amount: 250,
          },
        ],
      });
    const saleBody = saleResponse.body as TransactionResponse;

    expect(saleResponse.status).toBe(201);
    expect(saleBody.orNumber).toBe(300001);
    expect(saleBody.status).toBe('COMPLETED');

    const voidCandidateResponse = await request(server)
      .post('/api/pos/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        cashierId,
        items: [
          {
            itemId: 'item-fries',
            quantity: 1,
            unitPrice: 90,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amount: 90,
          },
        ],
      });
    const voidCandidateBody = voidCandidateResponse.body as TransactionResponse;

    expect(voidCandidateResponse.status).toBe(201);

    const refundResponse = await request(server)
      .post(`/api/pos/transactions/${saleBody.id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        cashierId,
        reason: 'Customer changed order',
      });
    const refundBody = refundResponse.body as TransactionResponse;

    expect(refundResponse.status).toBe(201);
    expect(refundBody.type).toBe('REFUND');
    expect(refundBody.status).toBe('RETURNED');

    const voidResponse = await request(server)
      .post(`/api/pos/transactions/${voidCandidateBody.id}/void`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        cashierId,
        reason: 'Supervisor-approved mistake',
      });
    const voidBody = voidResponse.body as { transaction: TransactionResponse };

    expect(voidResponse.status).toBe(201);
    expect(voidBody.transaction.status).toBe('VOID');

    const listResponse = await request(server)
      .get('/api/pos/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ branchId });
    const transactionListBody = listResponse.body as TransactionListResponse;

    expect(listResponse.status).toBe(200);
    expect(transactionListBody.total).toBe(3);

    const salesSummaryResponse = await request(server)
      .get('/api/reports/sales-summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ branchId, date: today });
    const salesSummaryBody = salesSummaryResponse.body as SalesSummaryResponse;

    expect(salesSummaryResponse.status).toBe(200);
    expect(salesSummaryBody.salesCount).toBe(1);
    expect(salesSummaryBody.voidCount).toBe(1);
    expect(salesSummaryBody.refundCount).toBe(1);
    expect(salesSummaryBody.netSales).toBe(0);

    const endOfDayResponse = await request(server)
      .post('/api/reports/end-of-day/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        date: today,
        generatedBy: cashierId,
      });
    const endOfDayBody = endOfDayResponse.body as EndOfDayResponse;

    expect(endOfDayResponse.status).toBe(201);
    expect(endOfDayBody.summary.voidCount).toBe(1);

    const xReadingResponse = await request(server)
      .get('/api/bir/x-reading')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ branchId, terminalId, date: today });
    const xReadingBody = xReadingResponse.body as XReadingResponse;

    expect(xReadingResponse.status).toBe(200);
    expect(xReadingBody.type).toBe('X');

    const zReadingResponse = await request(server)
      .post('/api/bir/z-readings/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        terminalId,
        date: today,
        generatedBy: cashierId,
      });
    const zReadingBody = zReadingResponse.body as ZReadingResponse;

    expect(zReadingResponse.status).toBe(201);
    expect(zReadingBody.zNumber).toBe(1001);

    const auditTrailResponse = await request(server)
      .get('/api/pos/audit-trail')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ branchId });
    const auditTrailBody = auditTrailResponse.body as AuditTrailResponse;

    expect(auditTrailResponse.status).toBe(200);
    expect(auditTrailBody.total).toBeGreaterThanOrEqual(5);

    const storageStatusResponse = await request(server)
      .get('/api/pos/storage-status')
      .set('Authorization', `Bearer ${accessToken}`);
    const storageStatusBody =
      storageStatusResponse.body as StorageStatusResponse;

    expect(storageStatusResponse.status).toBe(200);
    expect(storageStatusBody.mode).toBe('append-only-file');
    expect(storageStatusBody.counts.transactions).toBe(3);
  });
});
