import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import buildingsRouter from './routes/buildings';
import routeRouter from './routes/route';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/buildings', buildingsRouter);
app.use('/route', routeRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Fire evacuation API listening on port ${PORT}`);
});
