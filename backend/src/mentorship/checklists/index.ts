import { BountyType, ReviewChecklistTemplate } from '../mentorship.types';
import { SMART_CONTRACTS_CHECKLIST } from './smart-contracts.checklist';
import { FRONTEND_CHECKLIST } from './frontend.checklist';
import { BACKEND_CHECKLIST } from './backend.checklist';
import { DEVOPS_CHECKLIST } from './devops.checklist';
import { DOCUMENTATION_CHECKLIST } from './documentation.checklist';
import { SECURITY_CHECKLIST } from './security.checklist';
import { DESIGN_CHECKLIST } from './design.checklist';
import { DATA_CHECKLIST } from './data.checklist';

/** Map of all review checklist templates keyed by bounty type. */
export const CHECKLIST_REGISTRY: Record<BountyType, ReviewChecklistTemplate> = {
  'smart-contracts': SMART_CONTRACTS_CHECKLIST,
  frontend: FRONTEND_CHECKLIST,
  backend: BACKEND_CHECKLIST,
  devops: DEVOPS_CHECKLIST,
  documentation: DOCUMENTATION_CHECKLIST,
  security: SECURITY_CHECKLIST,
  design: DESIGN_CHECKLIST,
  data: DATA_CHECKLIST,
};

export {
  SMART_CONTRACTS_CHECKLIST,
  FRONTEND_CHECKLIST,
  BACKEND_CHECKLIST,
  DEVOPS_CHECKLIST,
  DOCUMENTATION_CHECKLIST,
  SECURITY_CHECKLIST,
  DESIGN_CHECKLIST,
  DATA_CHECKLIST,
};
