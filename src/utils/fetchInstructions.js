import { logger } from "./logger.js";

// The CMS's own /mcp/info endpoint (see McpInfo.php) exposes a policy_prompt field
// meant to teach a connecting MCP client how to actually use this API - creation
// order (website -> pages -> files/folders -> modules/forms), the dynamicDiv
// composition contract, module ids, etc. That guidance previously only reached an
// agent with direct repo access to AGENTS.md; this surfaces it through the MCP
// protocol's own `instructions` field instead, so any client sees it automatically.
export async function fetchServerInstructions(openapiSchemaUrl) {
  if (!openapiSchemaUrl) {
    return undefined;
  }

  let infoUrl;
  try {
    infoUrl = openapiSchemaUrl.replace(/\/openapi\.json$/, "/info");
    if (infoUrl === openapiSchemaUrl) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  try {
    const response = await fetch(infoUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      logger.warn(`Could not fetch server instructions from ${infoUrl}: HTTP ${response.status}`);
      return undefined;
    }
    const payload = await response.json();
    const policyPrompt = typeof payload?.policy_prompt === "string" ? payload.policy_prompt.trim() : "";
    return policyPrompt !== "" ? policyPrompt : undefined;
  } catch (error) {
    logger.warn(`Could not fetch server instructions from ${infoUrl}: ${error.message}`);
    return undefined;
  }
}
