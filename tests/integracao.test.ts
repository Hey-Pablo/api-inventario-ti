import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'pglite-server';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';

const pg = new PGlite();
const server = createServer(pg);
let db: PrismaClient;
let app: Express;
let admin: string, leitura: string, filialA: string, filialB: string, item: string;
beforeAll(async () => {
  await pg.waitReady;
  await pg.exec(readFileSync('prisma/migrations/20261121000000_init/migration.sql', 'utf8'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Sem porta de teste');
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${address.port}/postgres?connection_limit=1`;
  process.env.JWT_SECRET = 'chave-de-teste-ficticia-com-mais-de-32-caracteres';
  db = new PrismaClient();
  const hash = await bcrypt.hash('senha-ficticia', 12);
  await db.usuario.createMany({ data: [{ email: 'admin@example.com', senhaHash: hash, papel: 'ADMIN' }, { email: 'leitura@example.com', senhaHash: hash, papel: 'LEITURA' }] });
  filialA = (await db.filial.create({ data: { nome: 'Matriz' } })).id;
  filialB = (await db.filial.create({ data: { nome: 'Filial' } })).id;
  app = (await import('../src/app')).createApp();
  admin = (await request(app).post('/auth/login').send({ email: 'admin@example.com', senha: 'senha-ficticia' })).body.token;
  leitura = (await request(app).post('/auth/login').send({ email: 'leitura@example.com', senha: 'senha-ficticia' })).body.token;
}, 30000);
afterAll(async () => { await db?.$disconnect(); server.close(); await pg.close(); });
describe('fluxo de inventário', () => {
  it('nega credencial errada e escrita ao papel leitura', async () => {
    expect((await request(app).post('/auth/login').send({ email: 'admin@example.com', senha: 'errada' })).status).toBe(401);
    expect((await request(app).post('/equipamentos').set('Authorization', `Bearer ${leitura}`).send({})).status).toBe(403);
  });
  it('cria e filtra equipamento', async () => {
    const response = await request(app).post('/equipamentos').set('Authorization', `Bearer ${admin}`).send({ nome: 'Notebook', patrimonio: 'PAT-1', filialId: filialA });
    expect(response.status).toBe(201); item = response.body.id;
    const list = await request(app).get('/equipamentos').query({ filialId: filialA, nome: 'note', limite: 1 }).set('Authorization', `Bearer ${admin}`);
    expect(list.body.total).toBe(1); expect(list.body.dados[0].id).toBe(item);
  });
  it('movimenta e registra histórico; destino inválido não altera equipamento', async () => {
    const moved = await request(app).post(`/equipamentos/${item}/movimentar`).set('Authorization', `Bearer ${admin}`).send({ destinoId: filialB });
    expect(moved.status).toBe(201);
    const failed = await request(app).post(`/equipamentos/${item}/movimentar`).set('Authorization', `Bearer ${admin}`).send({ destinoId: '00000000-0000-4000-8000-000000000000' });
    expect(failed.status).toBe(422);
    expect((await db.equipamento.findUniqueOrThrow({ where: { id: item } })).filialId).toBe(filialB);
    const history = await request(app).get(`/equipamentos/${item}/historico`).set('Authorization', `Bearer ${leitura}`);
    expect(history.body).toHaveLength(1); expect(history.body[0].origemId).toBe(filialA);
  });
});
