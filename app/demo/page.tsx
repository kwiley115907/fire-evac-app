import type { Metadata } from 'next';
import { BuildingEditor } from '@/components/editor/BuildingEditor';
import { sampleBuilding } from '@/lib/sample-building';

export const metadata: Metadata = {
  title: 'Live demo — Sentinel Grid',
  description: 'Explore a three-storey office: tap any room for its way out, start a fire and watch every route re-plan.',
};

export default function DemoPage() {
  return (
    <BuildingEditor
      buildingId="demo"
      initialName="Sample Office · 3 floors"
      initialGraph={sampleBuilding()}
      initialRoute={{ point: { x: 34, y: 5 }, floor: 3 }}
      demo
    />
  );
}
