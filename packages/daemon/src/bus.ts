import type { Event } from "@ccgmon/shared/types";

const MAX_PENDING_BYTES = 1_048_576;

type Subscriber = {
  closed: boolean;
  pendingBytes: number;
  queue: Promise<void>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

export class SseBus {
  private readonly encoder = new TextEncoder();
  private readonly subscribers = new Set<Subscriber>();

  public subscribe(): { close: () => void; response: Response } {
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();

    const subscriber: Subscriber = {
      closed: false,
      pendingBytes: 0,
      queue: Promise.resolve(),
      writer,
    };
    this.subscribers.add(subscriber);

    // Prime the stream so clients know they are connected.
    this.enqueueWrite(subscriber, this.encoder.encode(": connected\n\n"));

    return {
      close: () => this.unsubscribe(subscriber),
      response: new Response(stream.readable, {
        headers: {
          "cache-control": "no-cache",
          connection: "keep-alive",
          "content-type": "text/event-stream",
        },
      }),
    };
  }

  public broadcast(event: Event): void {
    const chunk = this.encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    for (const subscriber of this.subscribers) {
      this.enqueueWrite(subscriber, chunk);
    }
  }

  public subscriberCount(): number {
    return this.subscribers.size;
  }

  private enqueueWrite(subscriber: Subscriber, chunk: Uint8Array): void {
    if (subscriber.closed) {
      return;
    }

    subscriber.pendingBytes += chunk.byteLength;
    if (subscriber.pendingBytes > MAX_PENDING_BYTES) {
      this.unsubscribe(subscriber);
      return;
    }

    subscriber.queue = subscriber.queue
      .then(async () => {
        await subscriber.writer.write(chunk);
      })
      .catch(() => {
        this.unsubscribe(subscriber);
      })
      .finally(() => {
        subscriber.pendingBytes = Math.max(
          0,
          subscriber.pendingBytes - chunk.byteLength,
        );
      });
  }

  private unsubscribe(subscriber: Subscriber): void {
    if (subscriber.closed) {
      return;
    }
    subscriber.closed = true;
    this.subscribers.delete(subscriber);
    void subscriber.writer.close().catch(() => {
      // Ignore client-disconnect write errors.
    });
  }
}
