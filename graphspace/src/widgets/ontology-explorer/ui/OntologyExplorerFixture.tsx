import { parseProjection } from '@/entities/ontology-diagram';
import fixture from '../model/motivation-full.fixture.json';
import { OntologyExplorer } from './OntologyExplorer';
export function OntologyExplorerFixture() { return <OntologyExplorer projection={parseProjection(fixture)} />; }
