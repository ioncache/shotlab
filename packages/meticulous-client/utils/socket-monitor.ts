import process from 'node:process';
import { connectSocketIo } from '../src/socket-io-client.ts';

const DEFAULT_SAMPLE_LIMIT = 3;
const DEFAULT_DEPTH_LIMIT = 3;

function normalizeMachineBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.search || url.hash) {
    throw new Error('baseUrl must not include a query string or fragment');
  }
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname.slice(0, -'/api/v1'.length) || '/';
  } else {
    url.pathname = pathname || '/';
  }

  return url.toString().replace(/\/+$/, '');
}

function parseArgs(argv: string[]) {
  const args = {
    baseUrl: undefined as string | undefined,
    depthLimit: DEFAULT_DEPTH_LIMIT,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith('--') && !args.baseUrl) {
      args.baseUrl = value;
      continue;
    }

    if (value === '--samples') {
      args.sampleLimit =
        Number.parseInt(argv[index + 1] ?? '', 10) || DEFAULT_SAMPLE_LIMIT;
      index += 1;
      continue;
    }

    if (value === '--depth') {
      args.depthLimit =
        Number.parseInt(argv[index + 1] ?? '', 10) || DEFAULT_DEPTH_LIMIT;
      index += 1;
    }
  }

  if (!args.baseUrl) {
    throw new Error(
      'Usage: node ./utils/socket-monitor.ts http://<machine-ip>:8080 [--samples 3] [--depth 3]',
    );
  }

  return args;
}

function describeValue(
  value: unknown,
  depthLimit: number,
  depth = 0,
): unknown {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (depth >= depthLimit) {
      return 'array';
    }

    const entries = value
      .slice(0, 5)
      .map((entry) => describeValue(entry, depthLimit, depth + 1));

    return entries.length === 0
      ? 'array[]'
      : `array<${Array.from(new Set(entries)).toSorted().join(' | ')}>`;
  }

  if (typeof value === 'object') {
    if (depth >= depthLimit) {
      return 'object';
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [
        key,
        describeValue(nestedValue, depthLimit, depth + 1),
      ]);

    return Object.fromEntries(entries);
  }

  if (typeof value === 'number' && Number.isNaN(value)) {
    return 'number:NaN';
  }

  return typeof value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, nestedValue]) =>
        `${JSON.stringify(key)}:${stableStringify(nestedValue)}`,
    );

  return `{${entries.join(',')}}`;
}

type EventSummary = {
  count: number;
  samplePayloads: unknown[][];
  seenShapes: Set<string>;
};

function recordEvent(
  store: Map<string, EventSummary>,
  eventName: string,
  payload: unknown[],
  sampleLimit: number,
  depthLimit: number,
) {
  let entry = store.get(eventName);
  if (!entry) {
    entry = {
      count: 0,
      samplePayloads: [],
      seenShapes: new Set<string>(),
    };
    store.set(eventName, entry);
  }

  entry.count += 1;
  const shape = describeValue(payload, depthLimit);
  entry.seenShapes.add(stableStringify(shape));

  if (entry.samplePayloads.length < sampleLimit) {
    entry.samplePayloads.push(payload);
  }
}

function printSummary(store: Map<string, EventSummary>) {
  console.log('\n=== Socket Event Summary ===');

  const rows = Array.from(store.entries()).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [eventName, entry] of rows) {
    console.log(`\n${eventName} (${entry.count})`);

    for (const shape of Array.from(entry.seenShapes).slice(0, 3)) {
      console.log(`shape ${JSON.stringify(JSON.parse(shape), null, 2)}`);
    }

    for (const [index, samplePayload] of entry.samplePayloads.entries()) {
      console.log(`sample ${index + 1} ${JSON.stringify(samplePayload, null, 2)}`);
    }
  }

  console.log('\n=== End Summary ===');
}

const { baseUrl, depthLimit, sampleLimit } = parseArgs(process.argv.slice(2));
const eventStore = new Map<string, EventSummary>();

console.log(`monitoring ${baseUrl}`);

const connection = await connectSocketIo({
  baseUrl: normalizeMachineBaseUrl(baseUrl),
  onStateChange: (state) => {
    console.log(`state ${JSON.stringify(state)}`);
  },
});

connection.onAny((eventName, ...payload) => {
    const timestamp = new Date().toISOString();
    recordEvent(eventStore, eventName, payload, sampleLimit, depthLimit);
    console.log(`[${timestamp}] ${eventName} ${JSON.stringify(payload)}`);
});

process.on('SIGINT', async () => {
  connection.close();
  printSummary(eventStore);
  process.exit(0);
});
