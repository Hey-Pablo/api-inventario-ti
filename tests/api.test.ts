import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('fronteiras da API', () => {
  const app = createApp();
  it('rejeita acesso sem token', async () => {
    const response = await request(app).get('/equipamentos');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('NAO_AUTENTICADO');
  });
  it('valida dados de login', async () => {
    const response = await request(app).post('/auth/login').send({ email: 'invalido' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DADOS_INVALIDOS');
  });
});
