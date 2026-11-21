import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'API de Inventário de TI',
      version: '1.0.0',
      description:
        'API REST para controle de equipamentos, licenças e relatórios entre filiais. Autenticação via JWT com papéis ADMIN, TÉCNICO e LEITURA.',
      contact: {
        name: 'Pablo Dilio',
        email: 'contato@pablodilio.com',
      },
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3000',
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtido via /auth/login',
        },
      },
      schemas: {
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            email: { type: 'string', format: 'email', example: 'admin@example.com' },
            papel: { type: 'string', enum: ['ADMIN', 'TECNICO', 'LEITURA'], example: 'ADMIN' },
          },
          required: ['id', 'email', 'papel'],
        },
        Filial: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            nome: { type: 'string', example: 'Matriz' },
          },
          required: ['id', 'nome'],
        },
        Equipamento: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nome: { type: 'string', example: 'Notebook Inspiron 15' },
            patrimonio: { type: 'string', example: 'EQ-001' },
            filialId: { type: 'string', format: 'uuid' },
          },
          required: ['id', 'nome', 'patrimonio', 'filialId'],
        },
        Licenca: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nome: { type: 'string', example: 'Microsoft Office 365' },
            tipo: { type: 'string', enum: ['ETIQUETA', 'CASE', 'KIT_DOCUMENTACAO', 'SOFTWARE'], example: 'SOFTWARE' },
            fabricante: { type: 'string', example: 'Microsoft' },
            quantidadeAtual: { type: 'integer', example: 50 },
            quantidadeMaxima: { type: 'integer', example: 50 },
            vencimento: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Erro: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NAO_AUTENTICADO' },
                message: { type: 'string', example: 'Token inválido ou ausente' },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const specs = swaggerJsdoc(options);
