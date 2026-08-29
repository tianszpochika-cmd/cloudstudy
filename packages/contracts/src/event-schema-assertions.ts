import type {
  WorkflowOutboxPublishedEvent,
  WorkflowSagaCompensationRequestedEvent,
} from '../generated/events';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Condition extends true> = Condition;

// Compile-time regression guards: the shared envelope contract identifier must
// never erase the event-specific schema literal used by publishers/consumers.
export type WorkflowEventSchemaIsLiteral = Assert<Equal<
  WorkflowOutboxPublishedEvent['schema'],
  'workflow.event.v1'
>>;
export type WorkflowEventSchemaVersionIsLiteral = Assert<Equal<
  WorkflowOutboxPublishedEvent['schemaVersion'],
  'workflow.event.v1'
>>;
export type WorkflowSagaSchemaIsLiteral = Assert<Equal<
  WorkflowSagaCompensationRequestedEvent['schema'],
  'workflow.saga.v1'
>>;
