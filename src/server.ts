import 'dotenv/config';
import { createApp } from './app';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET deve ter ao menos 32 caracteres');
const port = Number(process.env.PORT || 3000);
createApp().listen(port, () => console.log(`API ouvindo na porta ${port}`));
