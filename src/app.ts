import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient, Papel } from '@prisma/client';
import { z, ZodError } from 'zod';
import swaggerUiExpress from 'swagger-ui-express';
import { specs } from './docs/swagger';

const prisma = new PrismaClient();

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET deve ter ao menos 32 caracteres');
  return value;
};

const equipamento = z.object({ nome: z.string().trim().min(1).max(120), patrimonio: z.string().trim().min(1).max(80), filialId: z.string().uuid() }).strict();
const id = z.string().uuid();
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };

export function createApp() {
  const app = express();
  app.use(helmet(), express.json({ limit: '16kb' }), morgan('combined'));

  // Limitador global
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      limit: 100, // limite por janela
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Endpoint de saúde
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Swagger UI - OpenAPI
  app.use('/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(specs, { explorer: true }));

  // Auth
  app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'LIMITE_EXCEDIDO', message: 'Muitas tentativas; tente novamente mais tarde' } } }));
  app.post('/auth/login', asyncRoute(async (req, res) => {
    const data = z.object({ email: z.string().email().max(254), senha: z.string().min(1).max(200) }).strict().parse(req.body);
    const user = await prisma.usuario.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(data.senha, user.senhaHash))) throw new ApiError(401, 'CREDENCIAIS_INVALIDAS', 'Credenciais inválidas');
    res.json({ token: jwt.sign({ papel: user.papel }, secret(), { subject: user.id, expiresIn: '1h', algorithm: 'HS256' }) });
  }));

  // Middleware de autenticação
  app.use((req, _res, next) => {
    try {
      const token = /^Bearer (\S+)$/.exec(req.get('authorization') || '')?.[1];
      if (!token) throw new Error();
      const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub || !Object.values(Papel).includes(payload.papel)) throw new Error();
      (req as Request & { papel: Papel }).papel = payload.papel as Papel;
      next();
    } catch {
      next(new ApiError(401, 'NAO_AUTENTICADO', 'Token inválido ou ausente'));
    }
  });

  const permitir = (...papeis: Papel[]) => (req: Request, _res: Response, next: NextFunction) =>
    papeis.includes((req as Request & { papel: Papel }).papel) ? next() : next(new ApiError(403, 'PROIBIDO', 'Permissão insuficiente'));

  // Filiais
  app.get('/filiais', permitir('ADMIN', 'TECNICO'), asyncRoute(async (_req, res) => {
    res.json(await prisma.filial.findMany({ orderBy: { nome: 'asc' } }));
  }));

  // Equipamentos
  app.get(
    '/equipamentos',
    permitir('ADMIN', 'TECNICO', 'LEITURA'),
    asyncRoute(async (req, res) => {
      const q = z
        .object({
          pagina: z.coerce.number().int().min(1).default(1),
          limite: z.coerce.number().int().min(1).max(100).default(20),
          nome: z.string().max(120).optional(),
          filialId: id.optional(),
        })
        .strict().parse(req.query);
      const where: Prisma.EquipamentoWhereInput = {
        nome: q.nome ? { contains: q.nome, mode: 'insensitive' } : undefined,
        filialId: q.filialId,
      };
      const [dados, total] = await prisma.$transaction([
        prisma.equipamento.findMany({ where, skip: (q.pagina - 1) * q.limite, take: q.limite, orderBy: { id: 'asc' } }),
        prisma.equipamento.count({ where }),
      ]);
      res.json({ dados, total, pagina: q.pagina, limite: q.limite });
    }),
  );

  app.get('/equipamentos/:id', permitir('ADMIN', 'TECNICO', 'LEITURA'), asyncRoute(async (req, res) => {
    const item = await prisma.equipamento.findUnique({ where: { id: id.parse(req.params.id) } });
    if (!item) throw new ApiError(404, 'NAO_ENCONTRADO', 'Equipamento não encontrado');
    res.json(item);
  }));

  app.post('/equipamentos', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const item = await prisma.equipamento.create({ data: equipamento.parse(req.body) });
    res.status(201).json(item);
  }));

  app.put('/equipamentos/:id', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const data = equipamento.omit({ filialId: true }).parse(req.body);
    res.json(await prisma.equipamento.update({ where: { id: id.parse(req.params.id) }, data }));
  }));

  app.delete('/equipamentos/:id', permitir('ADMIN'), asyncRoute(async (req, res) => {
    await prisma.equipamento.delete({ where: { id: id.parse(req.params.id) } });
    res.status(204).end();
  }));

  app.post('/equipamentos/:id/movimentar', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const equipamentoId = id.parse(req.params.id);
    const { destinoId } = z.object({ destinoId: id }).strict().parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({ where: { id: equipamentoId } });
      if (!atual) throw new ApiError(404, 'NAO_ENCONTRADO', 'Equipamento não encontrado');
      if (!await tx.filial.findUnique({ where: { id: destinoId } }))
        throw new ApiError(422, 'DADOS_INVALIDOS', 'Filial de destino não encontrada');
      if (atual.filialId === destinoId)
        throw new ApiError(422, 'DADOS_INVALIDOS', 'Destino deve ser diferente da origem');
      const updated = await tx.equipamento.updateMany({
        where: { id: equipamentoId, filialId: atual.filialId },
        data: { filialId: destinoId },
      });
      if (updated.count !== 1) throw new ApiError(409, 'CONFLITO', 'Equipamento alterado; tente novamente');
      return tx.movimentacao.create({ data: { equipamentoId, origemId: atual.filialId, destinoId } });
    });
    res.status(201).json(result);
  }));

  app.get('/equipamentos/:id/historico', permitir('ADMIN', 'TECNICO', 'LEITURA'), asyncRoute(async (req, res) => {
    const equipamentoId = id.parse(req.params.id);
    if (!await prisma.equipamento.findUnique({ where: { id: equipamentoId } }))
      throw new ApiError(404, 'NAO_ENCONTRADO', 'Equipamento não encontrado');
    res.json(await prisma.movimentacao.findMany({ where: { equipamentoId }, orderBy: { criadoEm: 'desc' } }));
  }));

  // Licenças - routes
  app.get(
    '/licencas',
    permitir('ADMIN', 'TECNICO'),
    asyncRoute(async (req, res) => {
      const q = z.object({ dias: z.coerce.number().int().min(1).max(365).optional() }).parse(req.query);
      const where = q.dias ? { vencimento: { lte: new Date(Date.now() + q.dias * 24 * 60 * 60 * 1000) } } : {};
      const lista = await prisma.licenca.findMany({ where, orderBy: { vencimento: 'asc' } });
      res.json(lista);
    }),
  );

  app.get('/licencas/:id', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const licenca = await prisma.licenca.findUnique({
      where: { id: id.parse(req.params.id) },
    });
    if (!licenca) throw new ApiError(404, 'NAO_ENCONTRADO', 'Licença não encontrada');
    res.json(licenca);
  }));

  app.post('/licencas', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const dados = z
      .object({
        nome: z.string().trim().min(1).max(200),
        tipo: z.enum(['ETIQUETA', 'CASE', 'KIT_DOCUMENTACAO', 'SOFTWARE']),
        fabricante: z.string().trim().min(1).max(200),
        quantidadeAtual: z.coerce.number().min(0).max(10000),
        quantidadeMaxima: z.coerce.number().min(1).max(10000),
        vencimento: z.string().datetime().optional().nullable(),
        localizacao: z.string().trim().max(500).optional(),
        observacoes: z.string().max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    const licenca = await prisma.licenca.create({
      data: { ...dados, vencimento: dados.vencimento ? new Date(dados.vencimento) : null },
    });
    res.status(201).json(licenca);
  }));

  app.put('/licencas/:id', permitir('ADMIN', 'TECNICO'), asyncRoute(async (req, res) => {
    const dados = z
      .object({
        nome: z.string().trim().min(1).max(200).optional(),
        tipo: z.enum(['ETIQUETA', 'CASE', 'KIT_DOCUMENTACAO', 'SOFTWARE']).optional(),
        fabricante: z.string().trim().min(1).max(200).optional(),
        quantidadeAtual: z.coerce.number().min(0).max(10000).optional(),
        quantidadeMaxima: z.coerce.number().min(1).max(10000).optional(),
        vencimento: z.string().datetime().optional().nullable(),
        localizacao: z.string().trim().max(500).optional(),
        observacoes: z.string().max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    const licenca = await prisma.licenca.update({
      where: { id: id.parse(req.params.id) },
      data: { ...dados, vencimento: dados.vencimento ? new Date(dados.vencimento) : null },
    });
    res.json(licenca);
  }));

  app.delete('/licencas/:id', permitir('ADMIN'), asyncRoute(async (req, res) => {
    await prisma.licenca.delete({ where: { id: id.parse(req.params.id) } });
    res.status(204).end();
  }));

  // Relatórios - rotas
  app.get('/relatorios/por-filial', permitir('ADMIN'), asyncRoute(async (req, res) => {
    const filialId = req.query.filialId as string | undefined;
    const where = filialId ? { id: filialId } : {};

    const filiais = await prisma.filial.findMany({ where });

    const results = await Promise.all(
      filiais.map(async (filial) => {
        const [equipamentos, licencas, movimentacoes7d, movimentacoes30d] = await Promise.all([
          prisma.equipamento.count({ where: { filialId: filial.id } }),
          prisma.licenca.count({ where: {} }),
          prisma.movimentacao.count({
            where: { destinoId: filial.id, criadoEm: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          }),
          prisma.movimentacao.count({
            where: { destinoId: filial.id, criadoEm: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          }),
        ]);

        // Para o relatório, calculamos o valor total de forma simples
        const equipamentosLista = await prisma.equipamento.findMany({ where: { filialId: filial.id } });
        const valorTotal = equipamentosLista.reduce((sum, eq) => sum + (Number(eq.patrimonio) || 0), 0);

        const resumo = `Filial ${filial.nome}: ${equipamentos} equipamentos, ${licencas} licenças, ${movimentacoes7d} movimentações nos últimos 7 dias.`;

        return {
          id: filial.id,
          nome: filial.nome,
          equipamentos: { total: equipamentos, valorTotal: valorTotal.toString() },
          licencas: { total: licencas },
          movimentacoes: { ultimos7Dias: movimentacoes7d, ultimos30Dias: movimentacoes30d },
          resumo,
        };
      }),
    );

    res.json(results);
  }));

  app.use((_req, _res, next) => next(new ApiError(404, 'NAO_ENCONTRADO', 'Rota não encontrada')));

  // Middleware de erro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(422).json({ error: { code: 'DADOS_INVALIDOS', message: 'Dados inválidos', details: err.flatten() } });
      return;
    }
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const status = err.code === 'P2025' ? 404 : err.code === 'P2002' ? 409 : err.code === 'P2003' ? 422 : 500;
      res
        .status(status)
        .json({ error: { code: status === 500 ? 'ERRO_INTERNO' : 'OPERACAO_INVALIDA', message: status === 500 ? 'Erro interno' : 'Operação inválida' } });
      return;
    }
    res.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Erro interno' } });
  });

  return app;
}