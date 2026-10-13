import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

const app = express();
const clientOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
	.split(',')
	.map((origin) => origin.trim().replace(/\/+$/, ''))
	.filter(Boolean);

if (clientOrigins.length > 0) {
	app.use(cors({
		origin: clientOrigins,
		methods: ['GET', 'POST', 'OPTIONS'],
		allowedHeaders: ['Content-Type'],
	}));
}

app.use(express.json());
app.use('/api', routes);

// Luôn đặt 2 cái này SAU CÙNG
app.use(notFound);
app.use(errorHandler);

export default app;
