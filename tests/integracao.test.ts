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
let admin: string, leitura: string, tecnico: string, filialA: string, filialB: string, item: string;

beforeAll(async () => {
  await pg.waitReady;
  await pg.exec(readFileSync('prisma/migrations/20261121000000_init/migration.sql', 'utf8'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Sem porta de teste');
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${address.port}/postgres?connection_limit=1`;
  process.env.JWT_SECRET = 'chave-de-teste-ficticia-com-mais-de-32-caracteres';
  db = new PrismaClient();
  const hash = await bcrypt.hash('senha-ficticia', 12);
  await db.usuario.createMany({
    data: [
      { email: 'admin@example.com', senhaHash: hash, papel: 'ADMIN' },
      { email: 'leitura@example.com', senhaHash: hash, papel: 'LEITURA' },
      { email: 'tecnico@example.com', senhaHash: hash, papel: 'TECNICO' },
    ],
  });
  filialA = (await db.filial.create({ data: { nome: 'Matriz' } })).id;
  filialB = (await db.filial.create({ data: { nome: 'Filial' } })).id;
  app = (await import('../src/app')).createApp();
  admin = (await request(app).post('/auth/login').send({ email: 'admin@example.com', senha: 'senha-ficticia' })).body.token;
  leitura = (await request(app).post('/auth/login').send({ email: 'leitura@example.com', senha: 'senha-ficticia' })).body.token;
  tecnico = (await request(app).post('/auth/login').send({ email: 'tecnico@example.com', senha: 'senha-ficticia' })).body.token;
}, 30000);

afterAll(async () => {
  await db?.$disconnect();
  server.close();
  await pg.close();
});

describe('fluxo de inventário', () => {
  it('nega credencial errada e escrita ao papel leitura', async () => {
    expect((await request(app).post('/auth/login').send({ email: 'admin@example.com', senha: 'errada' })).status).toBe(401);
    expect((await request(app).post('/equipamentos').set('Authorization', `Bearer ${leitura}`).send({})).status).toBe(403);
  });
  it('cria e filtra equipamento', async () => {
    const response = await request(app)
      .post('/equipamentos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nome: 'Notebook', patrimonio: 'PAT-1', filialId: filialA });
    expect(response.status).toBe(201);
    item = response.body.id;
    const list = await request(app)
      .get('/equipamentos')
      .query({ filialId: filialA, nome: 'note', limite: 1 })
      .set('Authorization', `Bearer ${admin}`);
    expect(list.body.total).toBe(1);
    expect(list.body.dados[0].id).toBe(item);
  });
  it('movimenta e registra histórico; destino inválido não altera equipamento', async () => {
    const moved = await request(app)
      .post(`/equipamentos/${item}/movimentar`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ destinoId: filialB });
    expect(moved.status).toBe(201);
    const failed = await request(app)
      .post(`/equipamentos/${item}/movimentar`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ destinoId: '00000000-0000-4000-8000-000000000000' });
    expect(failed.status).toBe(422);
    expect((await db.equipamento.findUniqueOrThrow({ where: { id: item } })).filialId).toBe(filialB);
    const history = await request(app)
      .get(`/equipamentos/${item}/historico`)
      .set('Authorization', `Bearer ${leitura}`);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].origemId).toBe(filialA);
  });
});

describe('licenças', () => {
  it('cria licença', async () => {
    const response = await request(app)
      .post('/licencas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Microsoft Office 365 E3',
        tipo: 'SOFTWARE',
        fabricante: 'Microsoft',
        quantidadeAtual: 50,
        quantidadeMaxima: 50,
        vencimento: '2025-06-30T00:00:00.000Z',
      });
    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('Microsoft Office 365 E3');
  });

  it('lista licenças', async () => {
    const response = await request(app).get('/licencas').set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('busca licença por ID', async () => {
    const create = await request(app)
      .post('/licencas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Windows 11 Pro',
        tipo: 'SOFTWARE',
        fabricante: 'Microsoft',
        quantidadeAtual: 10,
        quantidadeMaxima: 10,
      });
    const id = create.body.id;

    const response = await request(app).get(`/licencas/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(response.body.nome).toBe('Windows 11 Pro');
  });

  it('atualiza licença', async () => {
    const create = await request(app)
      .post('/licencas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Licenca Teste',
        tipo: 'ETIQUETA',
        fabricante: 'Zebra',
        quantidadeAtual: 100,
        quantidadeMaxima: 200,
      });
    const id = create.body.id;

    const response = await request(app)
      .put(`/licencas/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ quantidadeAtual: 150 });
    expect(response.status).toBe(200);
    expect(response.body.quantidadeAtual).toBe(150);
  });

  it('deleta licença', async () => {
    const create = await request(app)
      .post('/licencas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Licenca Para Deletar',
        tipo: 'CASE',
        fabricante: 'Dell',
        quantidadeAtual: 1,
        quantidadeMaxima: 1,
      });
    const id = create.body.id;

    const delResponse = await request(app).delete(`/licencas/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(delResponse.status).toBe(204);

    const getResponse = await request(app).get(`/licencas/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(getResponse.status).toBe(404);
  });

  it('filtra licenças vencendo em X dias', async () => {
    await request(app)
      .post('/licencas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Licenca Vencida',
        tipo: 'SOFTWARE',
        fabricante: 'Teste',
        quantidadeAtual: 1,
        quantidadeMaxima: 1,
        vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });

    const response = await request(app).get('/licencas?dias=30').set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
  });
});

describe('relatórios', () => {
  it('não permite acesso sem autenticação', async () => {
    const response = await request(app).get('/relatorios/por-filial');
    expect(response.status).toBe(401);
  });

  it('não permite acesso ao papel TECNICO', async () => {
    const response = await request(app).get('/relatorios/por-filial').set('Authorization', `Bearer ${tecnico}`);
    expect(response.status).toBe(403);
  });

  it('retorna relatório por filial', async () => {
    const response = await request(app).get('/relatorios/por-filial').set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    // Verificar estrutura do relatório
    const relatorio = response.body[0];
    expect(relatorio).toHaveProperty('id');
    expect(relatorio).toHaveProperty('nome');
    expect(relatorio).toHaveProperty('equipamentos');
    expect(relatorio).toHaveProperty('licencas');
    expect(relatorio).toHaveProperty('movimentacoes');
    expect(relatorio).toHaveProperty('resumo');

    expect(relatorio.equipamentos).toHaveProperty('total');
    expect(relatorio.equipamentos).toHaveProperty('valorTotal');
    expect(relatorio.licencas).toHaveProperty('total');
    expect(relatorio.movimentacoes).toHaveProperty('ultimos7Dias');
    expect(relatorio.movimentacoes).toHaveProperty('ultimos30Dias');
  });

  it('filtra por filialId', async () => {
    const filialId = (await db.filial.findFirst({ select: { id: true } })).id;
    const response = await request(app)
      .get(`/relatorios/por-filial?filialId=${filialId}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
  });
});
