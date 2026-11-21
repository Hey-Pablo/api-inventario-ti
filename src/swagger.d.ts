declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';
  
  export interface SwaggerUiExpressOptions {
    explorer?: boolean;
    swaggerUrl?: string;
  }
  
  export const serve: RequestHandler;
  export function setup(swaggerDocument: Record<string, unknown>, options?: SwaggerUiExpressOptions): RequestHandler;
}

declare module 'swagger-jsdoc' {
  export default function swaggerJSDoc(options: Record<string, unknown>): Record<string, unknown>;
}
