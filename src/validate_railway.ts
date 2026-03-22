import {
  getRollbackMutationShape,
  validateRailwayConnection,
} from './railway';

async function main(): Promise<void> {
  const validation = await validateRailwayConnection();
  const mutationShape = await getRollbackMutationShape();

  console.log('Railway validation succeeded.');
  console.log(
    JSON.stringify(
      {
        validateRailwayConnection: validation.response,
        rollbackMutationShape: mutationShape.response,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Railway validation failed: ${message}`);
  process.exit(1);
});
