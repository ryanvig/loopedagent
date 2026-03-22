const RAILWAY_GRAPHQL_ENDPOINT = 'https://backboard.railway.app/graphql/v2';
const DEPLOYMENT_ROLLBACK_MUTATION = `
  mutation DeploymentRollback($id: String!) {
    deploymentRollback(id: $id)
  }
`;
const VALIDATE_RAILWAY_CONNECTION_QUERY = `
  query ValidateRailwayConnection($projectId: String!) {
    project(id: $projectId) {
      id
      name
    }
  }
`;
const ROLLBACK_MUTATION_SHAPE_QUERY = `
  query RollbackMutationShape {
    __type(name: "Mutation") {
      name
      fields(includeDeprecated: true) {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLErrorShape {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorShape[];
  extensions?: Record<string, unknown>;
}

interface RailwayProjectSummary {
  id: string;
  name: string;
}

interface ValidateRailwayConnectionData {
  project: RailwayProjectSummary | null;
}

interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}

interface MutationField {
  name: string;
  args: Array<{
    name: string;
    type: TypeRef;
  }>;
  type: TypeRef;
}

interface RollbackMutationShapeData {
  __type: {
    name: string;
    fields: MutationField[];
  } | null;
}

interface RollbackDeploymentData {
  deploymentRollback: boolean;
}

interface RailwayConfig {
  apiToken: string;
  projectId: string;
  serviceId: string;
  deploymentId: string;
  dryRun: boolean;
}

export interface RailwayValidationResult {
  ok: true;
  projectId: string;
  project: RailwayProjectSummary;
  response: GraphQLResponse<ValidateRailwayConnectionData>;
}

export interface RollbackDeploymentResult {
  dryRun: boolean;
  response?: GraphQLResponse<RollbackDeploymentData>;
  request: {
    endpoint: string;
    query: string;
    variables: {
      id: string;
    };
    projectId: string;
    serviceId: string;
    deploymentId: string;
  };
}

export interface RollbackMutationShapeResult {
  response: GraphQLResponse<RollbackMutationShapeData>;
  field: MutationField;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required Railway environment variable: ${name}`);
  }

  return value;
}

function isDryRunEnabled(): boolean {
  return process.env.RAILWAY_DRY_RUN?.trim().toLowerCase() === 'true';
}

function getRailwayConfig(): RailwayConfig {
  return {
    apiToken: requireEnv('RAILWAY_API_TOKEN'),
    projectId: requireEnv('RAILWAY_PROJECT_ID'),
    serviceId: requireEnv('RAILWAY_SERVICE_ID'),
    deploymentId: requireEnv('RAILWAY_DEPLOYMENT_ID'),
    dryRun: isDryRunEnabled(),
  };
}

function getValidationConfig(): Pick<RailwayConfig, 'apiToken' | 'projectId'> {
  return {
    apiToken: requireEnv('RAILWAY_API_TOKEN'),
    projectId: requireEnv('RAILWAY_PROJECT_ID'),
  };
}

async function railwayGraphQLRequest<T>(
  apiToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const rawBody = await response.text();
  let parsedBody: GraphQLResponse<T>;

  try {
    parsedBody = rawBody ? (JSON.parse(rawBody) as GraphQLResponse<T>) : {};
  } catch {
    throw new Error(
      `Railway API returned a non-JSON response (${response.status} ${response.statusText}): ${rawBody}`
    );
  }

  if (!response.ok) {
    const errorMessage = parsedBody.errors
      ?.map((error) => error.message)
      .join('; ');
    throw new Error(
      `Railway API request failed (${response.status} ${response.statusText})${errorMessage ? `: ${errorMessage}` : ''}`
    );
  }

  if (parsedBody.errors?.length) {
    throw new Error(
      `Railway GraphQL error: ${parsedBody.errors.map((error) => error.message).join('; ')}`
    );
  }

  return parsedBody;
}

function compactGraphQL(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

function unwrapTypeRef(type: TypeRef): TypeRef {
  let current: TypeRef = type;

  while (current.ofType) {
    current = current.ofType;
  }

  return current;
}

function ensureRollbackMutationContract(field: MutationField): void {
  if (field.args.length !== 1 || field.args[0]?.name !== 'id') {
    throw new Error(
      'Railway deploymentRollback mutation contract changed: expected a single id argument.'
    );
  }

  if (field.args[0].type.kind !== 'NON_NULL') {
    throw new Error(
      'Railway deploymentRollback mutation contract changed: id must remain NON_NULL.'
    );
  }

  const argumentLeafType = unwrapTypeRef(field.args[0].type);
  if (
    argumentLeafType.kind !== 'SCALAR' ||
    argumentLeafType.name !== 'String'
  ) {
    throw new Error(
      'Railway deploymentRollback mutation contract changed: id must remain a String scalar.'
    );
  }

  if (field.type.kind !== 'NON_NULL') {
    throw new Error(
      'Railway deploymentRollback mutation contract changed: return type must remain NON_NULL.'
    );
  }

  const returnLeafType = unwrapTypeRef(field.type);
  if (returnLeafType.kind !== 'SCALAR' || returnLeafType.name !== 'Boolean') {
    throw new Error(
      'Railway deploymentRollback mutation contract changed: expected a Boolean return value.'
    );
  }
}

export async function validateRailwayConnection(): Promise<RailwayValidationResult> {
  const { apiToken, projectId } = getValidationConfig();
  const response = await railwayGraphQLRequest<ValidateRailwayConnectionData>(
    apiToken,
    VALIDATE_RAILWAY_CONNECTION_QUERY,
    { projectId }
  );

  const project = response.data?.project;

  if (!project) {
    throw new Error(
      `Railway project was not found for RAILWAY_PROJECT_ID=${projectId}`
    );
  }

  return {
    ok: true,
    projectId,
    project,
    response,
  };
}

export async function getRollbackMutationShape(): Promise<RollbackMutationShapeResult> {
  const { apiToken } = getValidationConfig();
  const response = await railwayGraphQLRequest<RollbackMutationShapeData>(
    apiToken,
    ROLLBACK_MUTATION_SHAPE_QUERY,
    {}
  );

  const field = response.data?.__type?.fields.find(
    (candidate) => candidate.name === 'deploymentRollback'
  );

  if (!field) {
    throw new Error(
      'Railway GraphQL schema does not expose a deploymentRollback mutation.'
    );
  }

  ensureRollbackMutationContract(field);

  return {
    response,
    field,
  };
}

export async function rollbackDeployment(): Promise<RollbackDeploymentResult> {
  const config = getRailwayConfig();
  const request = {
    endpoint: RAILWAY_GRAPHQL_ENDPOINT,
    query: compactGraphQL(DEPLOYMENT_ROLLBACK_MUTATION),
    variables: {
      id: config.deploymentId,
    },
    projectId: config.projectId,
    serviceId: config.serviceId,
    deploymentId: config.deploymentId,
  };

  if (config.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          action: 'deploymentRollback',
          request,
        },
        null,
        2
      )
    );

    return {
      dryRun: true,
      request,
    };
  }

  const response = await railwayGraphQLRequest<RollbackDeploymentData>(
    config.apiToken,
    DEPLOYMENT_ROLLBACK_MUTATION,
    request.variables
  );

  if (typeof response.data?.deploymentRollback !== 'boolean') {
    throw new Error(
      'Railway deploymentRollback response did not return the expected Boolean payload.'
    );
  }

  return {
    dryRun: false,
    response,
    request,
  };
}

export { RAILWAY_GRAPHQL_ENDPOINT };
