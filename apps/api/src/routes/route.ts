import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { findNearestExit } from '../lib/evacuation-router';
import { BuildingGraph } from '../lib/evacuation-types';
import { routeRequestSchema } from '../lib/validation';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { buildingId, point, floor } = routeRequestSchema.parse(req.body);

  const { data, error } = await req.supabase!
    .from('buildings')
    .select('graph_data')
    .eq('client_building_id', buildingId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Building not found' });
  }

  const graph = data.graph_data as BuildingGraph;
  const result = findNearestExit(graph, point, floor);

  if (!result) {
    return res.status(422).json({ error: 'No route found from that point to any exit' });
  }

  res.json(result);
});

export default router;
