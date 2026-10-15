import { notFound } from 'next/navigation';
import SonoScopeExperience from '../../components/sonoscope-experience';
export const dynamic = 'force-dynamic';
export default function DiagnosticsPage() { if (process.env.NODE_ENV === 'production') notFound(); return <SonoScopeExperience diagnostics />; }
