import { parseProjection } from "@/entities/ontology-diagram";
import fixture from "../model/membership.fixture.json";
import { OntologyExplorer } from "./OntologyExplorer";

export function OntologyMembershipFixture() {
  return <OntologyExplorer projection={parseProjection(fixture)} />;
}
