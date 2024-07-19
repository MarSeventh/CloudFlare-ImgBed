Object.defineProperty(exports, '__esModule', { value: true });

const tracing = require('@sentry-internal/tracing');

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
const BrowserTracing = tracing.BrowserTracing;

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
const addExtensionMethods = tracing.addExtensionMethods;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `getActiveTransaction` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const getActiveTransaction = tracing.getActiveTransaction;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `extractTraceparentData` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const extractTraceparentData = tracing.extractTraceparentData;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `spanStatusfromHttpCode` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */
// eslint-disable-next-line deprecation/deprecation
const spanStatusfromHttpCode = tracing.spanStatusfromHttpCode;

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
const Transaction = tracing.Transaction;

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
const Span = tracing.Span;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `Span` can be imported from `@sentry/node`, `@sentry/browser`, or your framework SDK
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const BROWSER_TRACING_INTEGRATION_ID = tracing.BROWSER_TRACING_INTEGRATION_ID;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `defaultRequestInstrumentationOptions` can be imported from `@sentry/browser`, or your framework SDK
 */
const defaultRequestInstrumentationOptions = tracing.defaultRequestInstrumentationOptions;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `hasTracingEnabled` can be imported from `@sentry/utils`
 */
const hasTracingEnabled = tracing.hasTracingEnabled;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `stripUrlQueryAndFragment` can be imported from `@sentry/utils`
 */
const stripUrlQueryAndFragment = tracing.stripUrlQueryAndFragment;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 *
 * `TRACEPARENT_REGEXP` can be imported from `@sentry/utils`
 */
const TRACEPARENT_REGEXP = tracing.TRACEPARENT_REGEXP;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const IdleTransaction = tracing.IdleTransaction;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const instrumentOutgoingRequests = tracing.instrumentOutgoingRequests;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
const startIdleTransaction = tracing.startIdleTransaction;

/**
 * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
 */
// eslint-disable-next-line deprecation/deprecation
const SpanStatus = tracing.SpanStatus;

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
  Apollo: tracing.Apollo,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Express` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Express({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Express: tracing.Express,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `GraphQL` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.GraphQL({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  GraphQL: tracing.GraphQL,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Mongo` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Mongo({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Mongo: tracing.Mongo,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Mysql` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Mysql({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Mysql: tracing.Mysql,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Postgres` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Postgres({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Postgres: tracing.Postgres,
  /**
   * @deprecated `@sentry/tracing` has been deprecated and will be moved to to `@sentry/node`, `@sentry/browser`, or your framework SDK in the next major version.
   * `Prisma` can be imported from `@sentry/node`
   *
   * import { Integrations } from '@sentry/node';
   * new Integrations.Prisma({ ... })
   */
  // eslint-disable-next-line deprecation/deprecation
  Prisma: tracing.Prisma,
};

// Treeshakable guard to remove all code related to tracing

// Guard for tree
if (typeof __SENTRY_TRACING__ === 'undefined' || __SENTRY_TRACING__) {
  // We are patching the global object with our hub extension methods
  tracing.addExtensionMethods();
}

exports.BROWSER_TRACING_INTEGRATION_ID = BROWSER_TRACING_INTEGRATION_ID;
exports.BrowserTracing = BrowserTracing;
exports.IdleTransaction = IdleTransaction;
exports.Integrations = Integrations;
exports.Span = Span;
exports.SpanStatus = SpanStatus;
exports.TRACEPARENT_REGEXP = TRACEPARENT_REGEXP;
exports.Transaction = Transaction;
exports.addExtensionMethods = addExtensionMethods;
exports.defaultRequestInstrumentationOptions = defaultRequestInstrumentationOptions;
exports.extractTraceparentData = extractTraceparentData;
exports.getActiveTransaction = getActiveTransaction;
exports.hasTracingEnabled = hasTracingEnabled;
exports.instrumentOutgoingRequests = instrumentOutgoingRequests;
exports.spanStatusfromHttpCode = spanStatusfromHttpCode;
exports.startIdleTransaction = startIdleTransaction;
exports.stripUrlQueryAndFragment = stripUrlQueryAndFragment;
//# sourceMappingURL=index.js.map
