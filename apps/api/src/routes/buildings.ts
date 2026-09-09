import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { buildingGraphSchema } from '../lib/validation';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const graph = buildingGraphSchema.parse(req.body);

  const { data, error } = await req.supabase!
    .from('buildings')
    .upsert(
      {
        owner_id: req.userId,
        client_building_id: graph.buildingId,
        name: graph.buildingId,
        graph_data: graph,
      },
      { onConflict: 'owner_id,client_building_id' }
    )
    .select('client_building_id')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ buildingId: data.client_building_id });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase!
    .from('buildings')
    .select('graph_data')
    .eq('client_building_id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Building not found' });
  }

  res.json(data.graph_data);
});

export default router;
