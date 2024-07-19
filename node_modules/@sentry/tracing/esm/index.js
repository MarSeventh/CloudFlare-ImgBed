import { addExtensionMethods as addExtensionMethods$1, BrowserTracing as BrowserTracing$1, getActiveTransaction as getActiveTransaction$1, extractTraceparentData as extractTraceparentData$1, spanStatusfromHttpCode as spanStatusfromHttpCode$1, Transaction as Transaction$1, Span as Span$1, BROWSER_TRACING_INTEGRATION_ID as BROWSER_TRACING_INTEGRATION_ID$1, defaultRequestInstrumentationOptions as defaultRequestInstrumentationOptions$1, hasTracingEnabled as hasTracingEnabled$1, stripUrlQueryAndFragment as stripUrlQueryAndFragment$1, TRACEPARENT_REGEXP as TRACEPARENT_REGEXP$1, IdleTransaction as IdleTransaction$1, instrumentOutgoingRequests as instrumentOutgoingRequests$1, startIdleTransaction as startIdleTransaction$1, SpanStatus as SpanStatus$1, Apollo, Express, GraphQL, Mongo, Mysql, Postgres, Prisma } from '@sentry-internal/tracing';

// BrowserTracing is already exported as part of `Integrations` below (and for the moment will remain so for
// backwards compatibility), but that interferes with treeshaking, so we also export it separately
// here.
/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 * `BrowserTracing` can be imported from `@sentry/browser` or your framework SDK
 *
 * import { BrowserTracing } from '@sentry/browser';
 * new BrowserTracing()
 */
// eslint-disable-next-line deprecation/deprecation
const BrowserTracing = BrowserTracing$1;

// BrowserTracing is already exported as part of `Integrations` below (and for the moment will remain so for
// backwards compatibility), but that interferes with treeshaking, so we also export it separately
// here.
/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 * `BrowserTracing` can be imported from `@sentry/browser` or your framework SDK
 *
 * import { BrowserTracing } from '@sentry/browser';
 * new BrowserTracing()
 */
// eslint-disable-next-line deprecation/deprecation

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const addExtensionMethods = addExtensionMethods$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `getActiveTransaction` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const getActiveTransaction = getActiveTransaction$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `extractTraceparentData` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const extractTraceparentData = extractTraceparentData$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `spanStatusfromHttpCode` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const spanStatusfromHttpCode = spanStatusfromHttpCode$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `SpanStatusType` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `Transaction` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
const Transaction = Transaction$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `Transaction` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `Span` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
const Span = Span$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `Span` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const BROWSER_TRACING_INTEGRATION_ID = BROWSER_TRACING_INTEGRATION_ID$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `defaultRequestInstrumentationOptions` can be imported from `@sentry/browser`, or your framework SDK
 */
const defaultRequestInstrumentationOptions = defaultRequestInstrumentationOptions$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `hasTracingEnabled` can be imported from `@sentry/utils`
 */
const hasTracingEnabled = hasTracingEnabled$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `stripUrlQueryAndFragment` can be imported from `@sentry/utils`
 */
const stripUrlQueryAndFragment = stripUrlQueryAndFragment$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `TRACEPARENT_REGEXP` can be imported from `@sentry/utils`
 */
const TRACEPARENT_REGEXP = TRACEPARENT_REGEXP$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const IdleTransaction = IdleTransaction$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const instrumentOutgoingRequests = instrumentOutgoingRequests$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const startIdleTransaction = startIdleTransaction$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
// eslint-disable-next-line deprecation/deprecation
const SpanStatus = SpanStatus$1;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
// eslint-disable-next-line deprecation/deprecation

const Integrations = {
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `BrowserTracing` can be imported from `@sentry/browser` or your framework SDK
   *
   * import { BrowserTracing } from '@sentry/browser';
   * new BrowserTracing()
   */
  // eslint-disable-next-line deprecation/deprecation
  BrowserTracing: BrowserTracing,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Apollo` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Apollo({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Apollo: Apollo,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Express` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Express({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Express: Express,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `GraphQL` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.GraphQL({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  GraphQL: GraphQL,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Mongo` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Mongo({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Mongo: Mongo,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Mysql` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Mysql({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Mysql: Mysql,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Postgres` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Postgres({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Postgres: Postgres,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Prisma` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Prisma({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Prisma: Prisma,
};

// Treeshakable guard to remove all code related to tracing

// Guard for tree
if (typeof __SENTRY_TRACING__ === 'undefined' || __SENTRY_TRACING__) {
  // We are patching the global object with our hub extension methods
  addExtensionMethods$1();
}

export { BROWSER_TRACING_INTEGRATION_ID, BrowserTracing, IdleTransaction, Integrations, Span, SpanStatus, TRACEPARENT_REGEXP, Transaction, addExtensionMethods, defaultRequestInstrumentationOptions, extractTraceparentData, getActiveTransaction, hasTracingEnabled, instrumentOutgoingRequests, spanStatusfromHttpCode, startIdleTransaction, stripUrlQueryAndFragment };
//# sourceMappingURL=index.js.map
