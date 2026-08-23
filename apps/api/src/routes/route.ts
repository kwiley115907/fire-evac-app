import { Router } from 'express';
import { supabase } from '../supabase-client';
import { findNearestExit } from '../lib/evacuation-router';
import { BuildingGraph } from '../lib/evacuation-types';

const router = Router();

// Body: { buildingId: string, point: { x: number, y: number }, floor: number }
router.post('/', async (req, res) => {
  const { buildingId, point, floor } = req.body ?? {};

  if (!buildingId || !point || typeof floor !== 'number') {
    return res.status(400).json({ error: 'buildingId, point, and floor are required' });
  }

  const { data, error } = await supabase
    .from('buildings')
    .select('graph_data')
    .eq('id', buildingId)
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
