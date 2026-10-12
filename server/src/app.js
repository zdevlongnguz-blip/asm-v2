import express from 'express';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api', routes);

// Luôn đặt 2 cái này SAU CÙNG
app.use(notFound);
app.use(errorHandler);

export default app;
