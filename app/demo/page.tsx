import type { Metadata } from 'next';
import { BuildingEditor } from '@/components/editor/BuildingEditor';
import { sampleBuilding } from '@/lib/sample-building';

export const metadata: Metadata = {
  title: 'Live demo — Sentinel Grid',
  description: 'Explore a three-storey office: tap any room for its way out, start a fire, or walk a route with AR Scan and see it in 3D.',
};

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // /demo?scan=1 opens AR Scan straight away (the landing page links here).
  const { scan } = await searchParams;
  return (
    <BuildingEditor
      buildingId="demo"
      initialName="Sample Office · 3 floors"
      initialGraph={sampleBuilding()}
      initialRoute={{ point: { x: 34, y: 5 }, floor: 3 }}
      openScanner={scan === '1'}
      demo
    />
  );
}
