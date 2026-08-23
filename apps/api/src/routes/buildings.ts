import { Router } from 'express';
import { supabase } from '../supabase-client';
import { BuildingGraph } from '../lib/evacuation-types';

const router = Router();

router.post('/', async (req, res) => {
  const graph = req.body as BuildingGraph;

  if (!graph?.buildingId || !Array.isArray(graph.rooms)) {
    return res.status(400).json({ error: 'Request body must be a valid BuildingGraph' });
  }

  const { error } = await supabase
    .from('buildings')
    .upsert({ id: graph.buildingId, name: graph.buildingId, graph_data: graph });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ buildingId: graph.buildingId });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('buildings')
    .select('graph_data')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Building not found' });
  }

  res.json(data.graph_data);
});

export default router;
