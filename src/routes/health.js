/** Minimal liveness endpoints for ECS/ALB and AgentCore. No tools or connection data. */
export const setupHealth = (app) => {
  app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
  app.get('/ping', (_req, res) => res.json({ status: 'Healthy' }));
};
